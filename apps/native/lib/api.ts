import { clearTokens, getTokens, saveTokens } from "@/lib/tokens";

// Base da API (apps/web). Em dispositivo físico use o IP da máquina, não localhost.
const BASE_URL = process.env.EXPO_PUBLIC_SERVER_URL;

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: "CLIENT" | "PROVIDER" | "BOTH";
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
};

type AuthResponse = { user: AppUser; accessToken: string; refreshToken: string };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function url(path: string): string {
  if (!BASE_URL) {
    throw new ApiError("EXPO_PUBLIC_SERVER_URL não configurada (.env)", 0);
  }
  return `${BASE_URL.replace(/\/$/, "")}${path}`;
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `Erro ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

// Troca o refresh token por um novo par. Limpa a sessão se falhar.
async function tryRefresh(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;
  try {
    const res = await fetch(url("/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) throw new ApiError("refresh failed", res.status);
    const data = (await res.json()) as AuthResponse;
    await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

// Request autenticada com refresh automático em 401 (uma tentativa).
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const send = async (accessToken?: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let accessToken: string | undefined;
  if (auth) accessToken = (await getTokens())?.accessToken;

  let res = await send(accessToken);
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await send(refreshed);
  }
  return parse<T>(res);
}

// ---- Endpoints de auth ----
export const authApi = {
  register(input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role?: AppUser["role"];
  }) {
    return apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: input,
      auth: false,
    });
  },
  login(input: { email: string; password: string }) {
    return apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: input,
      auth: false,
    });
  },
  me() {
    return apiFetch<{ user: AppUser }>("/api/auth/me");
  },
  async logout() {
    const tokens = await getTokens();
    if (tokens) {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
        body: { refreshToken: tokens.refreshToken },
        auth: false,
      }).catch(() => undefined);
    }
  },
};

// ---- Catálogo (categorias + prestadores) ----
export type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  count: number;
  featured: boolean;
};

export type ProviderListItem = {
  id: string;
  name: string;
  role: string | null;
  rating: number;
  reviews: number;
  yearsExperience: number;
  priceFromCents: number | null;
  baseLat: number | null;
  baseLng: number | null;
};

export type ProviderDetail = ProviderListItem & {
  bio: string | null;
  services: { id: string; name: string; priceCents: number }[];
};

export const catalogApi = {
  categories() {
    return apiFetch<{ categories: Category[] }>("/api/categories").then((r) => r.categories);
  },
  providers(categoryId?: string) {
    const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    return apiFetch<{ providers: ProviderListItem[] }>(`/api/providers${qs}`).then((r) => r.providers);
  },
  provider(id: string) {
    return apiFetch<{ provider: ProviderDetail }>(`/api/providers/${id}`).then((r) => r.provider);
  },
};

// ---- Cadastro profissional + KYC do prestador (RF-B1/B2/B3) ----
export type MyProviderProfile = {
  status: "PENDING" | "APPROVED" | "BLOCKED";
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  serviceRadiusKm: number;
  baseLat: number | null;
  baseLng: number | null;
  hasDocument: boolean;
  categoryIds: string[];
  services: { id: string; categoryId: string; name: string; priceCents: number }[];
};

export type UpsertProviderProfileInput = {
  headline: string;
  bio?: string;
  yearsExperience: number;
  serviceRadiusKm: number;
  baseLat?: number;
  baseLng?: number;
  categoryIds: string[];
  services: { name: string; priceCents: number; categoryId: string }[];
};

export const providerProfileApi = {
  me() {
    return apiFetch<{ profile: MyProviderProfile | null }>("/api/providers/me").then(
      (r) => r.profile,
    );
  },
  upsert(input: UpsertProviderProfileInput) {
    return apiFetch<{ profile: MyProviderProfile }>("/api/providers/me", {
      method: "POST",
      body: input,
    }).then((r) => r.profile);
  },
  uploadDocument(base64: string, mimeType: string) {
    return apiFetch<{ profile: MyProviderProfile }>("/api/providers/me/document", {
      method: "POST",
      body: { base64, mimeType },
    }).then((r) => r.profile);
  },
};

// ---- Pedidos (ciclo de vida + máquina de estados) ----
export type OrderStatus =
  | "CREATED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type OrderAction =
  | "accept"
  | "reject"
  | "start_route"
  | "start_work"
  | "complete"
  | "cancel";

export type OrderAddress = {
  label: string | null;
  street: string;
  number: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
};

export type Order = {
  id: string;
  status: OrderStatus;
  description: string | null;
  scheduledAt: string | null;
  priceCents: number;
  platformFeeCents: number;
  totalCents: number;
  cancelReason: string | null;
  createdAt: string;
  service: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  provider: { id: string; name: string; headline: string | null; ratingAvg: number } | null;
  client: { id: string; name: string; phone: string | null };
  address: OrderAddress;
  events: { status: OrderStatus; note: string | null; createdAt: string }[];
};

export type CreateOrderInput = {
  providerId: string;
  serviceId?: string;
  categoryId?: string;
  description?: string;
  scheduledAt?: string;
  address: {
    label?: string;
    cep?: string;
    street: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city: string;
    state: string;
    lat?: number;
    lng?: number;
  };
};

export const ordersApi = {
  list(as: "client" | "provider" = "client") {
    return apiFetch<{ orders: Order[] }>(`/api/orders?as=${as}`).then((r) => r.orders);
  },
  get(id: string) {
    return apiFetch<{ order: Order }>(`/api/orders/${id}`).then((r) => r.order);
  },
  create(input: CreateOrderInput) {
    return apiFetch<{ order: Order }>("/api/orders", { method: "POST", body: input }).then(
      (r) => r.order,
    );
  },
  transition(id: string, action: OrderAction, note?: string) {
    return apiFetch<{ order: Order }>(`/api/orders/${id}/transition`, {
      method: "POST",
      body: { action, note },
    }).then((r) => r.order);
  },
};

// ---- Avaliações (reputação bidirecional) ----
export type Review = {
  id: string;
  orderId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { id: string; name: string };
};

export type CreateReviewInput = { rating: number; comment?: string };

export const reviewsApi = {
  // Avaliação que o usuário atual fez de um pedido (null se ainda não avaliou).
  mine(orderId: string) {
    return apiFetch<{ review: Review | null }>(`/api/orders/${orderId}/review`).then(
      (r) => r.review,
    );
  },
  create(orderId: string, input: CreateReviewInput) {
    return apiFetch<{ review: Review }>(`/api/orders/${orderId}/review`, {
      method: "POST",
      body: input,
    }).then((r) => r.review);
  },
  forProvider(providerId: string) {
    return apiFetch<{ reviews: Review[] }>(`/api/providers/${providerId}/reviews`).then(
      (r) => r.reviews,
    );
  },
};

// ---- Chat (mensagens reais ancoradas a um pedido) ----
export type ChatMessage = {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export const chatApi = {
  list(orderId: string) {
    return apiFetch<{ messages: ChatMessage[] }>(`/api/orders/${orderId}/messages`).then(
      (r) => r.messages,
    );
  },
  send(orderId: string, body: string) {
    return apiFetch<{ message: ChatMessage }>(`/api/orders/${orderId}/messages`, {
      method: "POST",
      body: { body },
    }).then((r) => r.message);
  },
};

// ---- Pagamento (Stripe: Pix/cartão/dinheiro) ----
export type PaymentMethodOption = "PIX" | "CARD" | "CASH";

export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethodOption;
  status: "PENDING" | "PAID" | "REFUNDED" | "FAILED";
  amountCents: number;
  createdAt: string;
};

export type PixDisplay = { data: string; imageUrl: string | null; expiresAt: string | null };

export type CreatePaymentResult = { payment: Payment; clientSecret?: string; pix?: PixDisplay };

export const paymentsApi = {
  get(orderId: string) {
    return apiFetch<{ payment: Payment | null }>(`/api/orders/${orderId}/payment`).then(
      (r) => r.payment,
    );
  },
  create(orderId: string, method: PaymentMethodOption) {
    return apiFetch<CreatePaymentResult>(`/api/orders/${orderId}/payment`, {
      method: "POST",
      body: { method },
    });
  },
};

// ---- Carteira do prestador (saldo + ganhos + extrato) ----
export type WalletTransaction = {
  id: string;
  type: "CREDIT" | "DEBIT";
  amountCents: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
};

export type WalletDailyEarning = { day: string; totalCents: number; isToday: boolean };

export type WalletSummary = {
  balanceCents: number;
  weekTotalCents: number;
  daily: WalletDailyEarning[];
  transactions: WalletTransaction[];
};

export const walletApi = {
  summary() {
    return apiFetch<{ wallet: WalletSummary }>("/api/wallet").then((r) => r.wallet);
  },
};

// ---- Push notifications (RF-E2) ----
export const pushApi = {
  register(pushToken: string) {
    return apiFetch<{ ok: boolean }>("/api/push-token", { method: "POST", body: { pushToken } });
  },
};

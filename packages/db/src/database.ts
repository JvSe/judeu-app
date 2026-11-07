import type {
  AiRole,
  JobApplicationStatus,
  JobContractType,
  JobStatus,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProposalStatus,
  ProviderStatus,
  Role,
  SupportTicketCategory,
  SupportTicketStatus,
  WalletTxType,
  WeekDay,
} from "./enums";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  pushToken: string | null;
  notifyOrders: boolean;
  notifyMessages: boolean;
  termsAcceptedAt: string | null;
  acquisitionChannel: string | null;
  acquisitionCode: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RefreshTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type PasswordResetTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  attempts: number;
  createdAt: string;
};

export type NotificationRow = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Json | null;
  readAt: string | null;
  createdAt: string;
};

export type ProviderProfileRow = {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  status: ProviderStatus;
  isAvailable: boolean;
  isHelper: boolean;
  isCompany: boolean;
  companyName: string | null;
  responsibleName: string | null;
  hiringEmployees: boolean;
  allowsNegotiation: boolean;
  ratingAvg: number;
  ratingCount: number;
  documentUrl: string | null;
  baseLat: number | null;
  baseLng: number | null;
  serviceRadiusKm: number;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  feeRate: number | null;
  createdAt: string;
};

export type ProviderCategoryRow = {
  providerId: string;
  categoryId: string;
};

export type ServiceRow = {
  id: string;
  providerId: string;
  categoryId: string;
  name: string;
  priceCents: number;
  createdAt: string;
};

export type AddressRow = {
  id: string;
  userId: string;
  label: string | null;
  cep: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: string;
};

export type OrderRow = {
  id: string;
  clientId: string;
  providerId: string | null;
  serviceId: string | null;
  categoryId: string | null;
  addressId: string;
  pickupAddressId: string | null;
  isOpenRequest: boolean;
  detailsReady: boolean;
  description: string | null;
  status: OrderStatus;
  scheduledAt: string | null;
  priceCents: number;
  platformFeeCents: number;
  totalCents: number;
  feeRate: number;
  feePayer: "CLIENT" | "PROVIDER";
  doorCode: string | null;
  doorCodeAttempts: number;
  couponCode: string | null;
  cancelReason: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  providerLat: number | null;
  providerLng: number | null;
  providerLocationAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderEventRow = {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type OrderProposalRow = {
  id: string;
  orderId: string;
  byRole: string;
  priceCents: number;
  note: string | null;
  status: ProposalStatus;
  createdAt: string;
  respondedAt: string | null;
  clientAcceptedAt: string | null;
  providerAcceptedAt: string | null;
};

export type MessageRow = {
  id: string;
  orderId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type ReviewRow = {
  id: string;
  orderId: string;
  authorId: string;
  targetId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type PaymentRow = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountCents: number;
  gatewayRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WalletRow = {
  id: string;
  userId: string;
  balanceCents: number;
  updatedAt: string;
};

export type WalletTransactionRow = {
  id: string;
  walletId: string;
  type: WalletTxType;
  amountCents: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
};

export type AiConversationRow = {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiMessageRow = {
  id: string;
  conversationId: string;
  role: AiRole;
  content: string;
  createdAt: string;
};

export type JobPostingRow = {
  id: string;
  providerId: string;
  categoryId: string;
  title: string;
  description: string;
  contractType: JobContractType;
  salaryCents: number | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
};

export type JobShiftRow = {
  id: string;
  jobPostingId: string;
  weekday: WeekDay;
  startTime: string;
  endTime: string;
};

export type JobApplicationRow = {
  id: string;
  jobPostingId: string;
  applicantId: string;
  message: string | null;
  status: JobApplicationStatus;
  createdAt: string;
  respondedAt: string | null;
};

export type SupportTicketRow = {
  id: string;
  userId: string;
  orderId: string | null;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppConfigRow = {
  key: string;
  value: Json;
  updatedAt: string;
};

export type AppEventRow = {
  id: string;
  type: string;
  userId: string | null;
  orderId: string | null;
  props: Json;
  createdAt: string;
};

export type PayoutAccountRow = {
  id: string;
  userId: string;
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";
  pixKey: string;
  holderName: string;
  createdAt: string;
  updatedAt: string;
};

export type PayoutRow = {
  id: string;
  userId: string;
  walletId: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  status: "SIMULATED" | "PROCESSING" | "PAID" | "FAILED";
  provider: string;
  providerRef: string | null;
  pixKeyMasked: string;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  createdAt: string;
  completedAt: string | null;
};

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row> & Record<string, unknown>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      user: TableDef<UserRow>;
      refreshtoken: TableDef<RefreshTokenRow>;
      passwordresettoken: TableDef<PasswordResetTokenRow>;
      notification: TableDef<NotificationRow>;
      providerprofile: TableDef<ProviderProfileRow>;
      category: TableDef<CategoryRow>;
      providercategory: TableDef<ProviderCategoryRow>;
      service: TableDef<ServiceRow>;
      address: TableDef<AddressRow>;
      order: TableDef<OrderRow>;
      orderevent: TableDef<OrderEventRow>;
      orderproposal: TableDef<OrderProposalRow>;
      message: TableDef<MessageRow>;
      review: TableDef<ReviewRow>;
      payment: TableDef<PaymentRow>;
      wallet: TableDef<WalletRow>;
      wallettransaction: TableDef<WalletTransactionRow>;
      aiconversation: TableDef<AiConversationRow>;
      aimessage: TableDef<AiMessageRow>;
      jobposting: TableDef<JobPostingRow>;
      jobshift: TableDef<JobShiftRow>;
      jobapplication: TableDef<JobApplicationRow>;
      supportticket: TableDef<SupportTicketRow>;
      appconfig: TableDef<AppConfigRow>;
      appevent: TableDef<AppEventRow>;
      payoutaccount: TableDef<PayoutAccountRow>;
      payout: TableDef<PayoutRow>;
    };
    Views: Record<string, never>;
    Functions: {
      replace_provider_categories_services: {
        Args: {
          p_provider_id: string;
          p_category_ids: string[];
          p_services: Json;
        };
        Returns: undefined;
      };
      set_default_address: {
        Args: { p_user_id: string; p_address_id: string };
        Returns: AddressRow;
      };
      soft_delete_account: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_password_hash: string;
          p_has_provider: boolean;
        };
        Returns: undefined;
      };
      create_order_with_event: {
        Args: { p_order: Json; p_event_note?: string | null };
        Returns: OrderRow;
      };
      transition_order: {
        Args: {
          p_order_id: string;
          p_status: OrderStatus;
          p_patch: Json;
          p_event_note?: string | null;
        };
        Returns: OrderRow;
      };
      credit_wallet_on_payment: {
        Args: {
          p_provider_user_id: string;
          p_amount_cents: number;
          p_order_id: string;
          p_description: string;
          p_payment_id: string;
          p_gateway_ref?: string | null;
        };
        Returns: undefined;
      };
      request_payout: {
        Args: {
          p_payout_id: string;
          p_user_id: string;
          p_amount_cents: number;
          p_fee_cents: number;
          p_held_cents: number;
          p_min_cents: number;
          p_status: string;
          p_provider: string;
          p_provider_ref: string | null;
          p_pix_key_masked: string;
          p_description: string;
        };
        Returns: PayoutRow;
      };
      create_job_with_shifts: {
        Args: { p_job: Json; p_shifts: Json };
        Returns: JobPostingRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

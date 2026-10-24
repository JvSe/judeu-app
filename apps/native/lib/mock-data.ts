export type Provider = {
  id: string;
  name: string;
  initials: string;
  role: string;
  rating: number;
  reviews: number;
  distanceKm: number;
  etaMin: number;
  price: number;
  color: string;
  years: number;
  services: { name: string; price: number }[];
};

export const providers: Provider[] = [
  {
    id: "carlos-mendes",
    name: "Carlos Mendes",
    initials: "CM",
    role: "Eletricista",
    rating: 4.9,
    reviews: 328,
    distanceKm: 1.2,
    etaMin: 15,
    price: 80,
    color: "#FF6600",
    years: 8,
    services: [
      { name: "Instalação de tomada", price: 80 },
      { name: "Troca de chuveiro", price: 120 },
      { name: "Diagnóstico elétrico", price: 60 },
    ],
  },
  {
    id: "marina-lopes",
    name: "Marina Lopes",
    initials: "ML",
    role: "Diarista",
    rating: 4.8,
    reviews: 214,
    distanceKm: 0.9,
    etaMin: 12,
    price: 120,
    color: "#3a3a70",
    years: 5,
    services: [
      { name: "Limpeza padrão", price: 120 },
      { name: "Limpeza pesada", price: 180 },
    ],
  },
  {
    id: "rafael-souza",
    name: "Rafael Souza",
    initials: "RS",
    role: "Encanador",
    rating: 4.7,
    reviews: 156,
    distanceKm: 1.8,
    etaMin: 20,
    price: 90,
    color: "#3a3a70",
    years: 6,
    services: [{ name: "Reparo de vazamento", price: 90 }],
  },
];

export const categories = [
  { id: "reparos", name: "Reparos", count: 48, icon: "flash" as const, featured: true },
  { id: "limpeza", name: "Limpeza", count: 61, icon: "sparkles" as const },
  { id: "frete", name: "Frete", count: 23, icon: "cube" as const },
  { id: "beleza", name: "Beleza", count: 37, icon: "cut" as const },
];

export const chatMessages = [
  {
    id: "1",
    from: "provider" as const,
    text: "Olá! Já estou indo até você 🙂 Chego em uns 8 minutos.",
  },
  {
    id: "2",
    from: "client" as const,
    text: "Perfeito! O portão é o azul, pode tocar a campainha.",
  },
  {
    id: "3",
    from: "provider" as const,
    text: "Combinado. Vou levar as ferramentas pra deixar tudo pronto hoje.",
  },
  { id: "4", from: "client" as const, text: "Show, obrigado! 👍" },
];

export const newRequests = [
  {
    id: "1",
    title: "Instalação de tomada",
    distanceKm: 0.8,
    minutesAgo: 2,
    price: 80,
  },
  {
    id: "2",
    title: "Troca de chuveiro",
    distanceKm: 1.4,
    minutesAgo: 6,
    price: 120,
  },
];

/** Centro de Palmas/TO — mesmo fallback do mapa. */
const PALMAS = { lat: -10.1841, lng: -48.3336 };

export type ActivatedHelpStatus = "searching" | "matched" | "en_route";

export type ActivatedHelp = {
  id: string;
  title: string;
  category: string;
  status: ActivatedHelpStatus;
  distanceKm: number;
  minutesAgo: number;
  lat: number;
  lng: number;
  clientName: string;
};

type ActivatedHelpSeed = Omit<ActivatedHelp, "lat" | "lng"> & {
  /** Deslocamento em graus a partir da origem do usuário. */
  dLat: number;
  dLng: number;
};

const ACTIVATED_HELP_SEEDS: ActivatedHelpSeed[] = [
  {
    id: "help-1",
    title: "Troca de chuveiro",
    category: "Reparos",
    status: "searching",
    distanceKm: 0.4,
    minutesAgo: 3,
    dLat: 0.0032,
    dLng: -0.0021,
    clientName: "Ana Paula",
  },
  {
    id: "help-2",
    title: "Limpeza pós-obra",
    category: "Limpeza",
    status: "matched",
    distanceKm: 0.9,
    minutesAgo: 12,
    dLat: -0.0024,
    dLng: 0.0038,
    clientName: "Bruno Costa",
  },
  {
    id: "help-3",
    title: "Frete de sofá",
    category: "Frete",
    status: "en_route",
    distanceKm: 1.3,
    minutesAgo: 18,
    dLat: 0.0011,
    dLng: 0.0045,
    clientName: "Carla Dias",
  },
  {
    id: "help-4",
    title: "Instalação de tomada",
    category: "Reparos",
    status: "searching",
    distanceKm: 0.6,
    minutesAgo: 7,
    dLat: -0.0038,
    dLng: -0.0016,
    clientName: "Diego Alves",
  },
  {
    id: "help-5",
    title: "Corte e escova",
    category: "Beleza",
    status: "matched",
    distanceKm: 1.1,
    minutesAgo: 22,
    dLat: 0.0046,
    dLng: 0.0012,
    clientName: "Elena Rocha",
  },
];

/** Gera ajudas acionadas ao redor da origem (fallback: Palmas). */
export function getActivatedHelpsAround(
  origin: { lat: number; lng: number } | null | undefined,
): ActivatedHelp[] {
  const base = origin ?? PALMAS;
  return ACTIVATED_HELP_SEEDS.map(({ dLat, dLng, ...rest }) => ({
    ...rest,
    lat: base.lat + dLat,
    lng: base.lng + dLng,
  }));
}

/** Snapshot estático (Palmas) — útil em previews/testes. */
export const activatedHelps = getActivatedHelpsAround(PALMAS);

export type OrderStatus = "a-caminho" | "agendado";

export const activeOrders = [
  {
    id: "4821",
    title: "Instalação de tomada",
    providerName: "Carlos Mendes",
    providerRole: "Eletricista",
    initials: "CM",
    color: "#FF6600",
    price: 80,
    status: "a-caminho" as OrderStatus,
    statusLabel: "A CAMINHO",
    when: "Hoje, 14:30",
  },
  {
    id: "4790",
    title: "Limpeza completa",
    providerName: "Marina L.",
    providerRole: "Diarista",
    initials: "ML",
    color: "#3a3a70",
    price: 120,
    status: "agendado" as OrderStatus,
    statusLabel: "AGENDADO",
    when: "Sáb, 10:00",
  },
];

export const completedOrders = [
  {
    id: "4712",
    title: "Reparo de sifão",
    providerName: "Roberto Silva",
    initials: "RS",
    date: "28 jun",
    price: 110,
    rating: null as number | null,
  },
  {
    id: "4655",
    title: "Corte de cabelo",
    providerName: "Ana P.",
    initials: "AP",
    date: "21 jun",
    price: 45,
    rating: 5.0 as number | null,
  },
];

export const weeklyEarnings = [
  { day: "S", ratio: 0.38, highlighted: false },
  { day: "T", ratio: 0.55, highlighted: false },
  { day: "Q", ratio: 0.42, highlighted: false },
  { day: "Q", ratio: 0.7, highlighted: false },
  { day: "S", ratio: 1, highlighted: true },
  { day: "S", ratio: 0.6, highlighted: false },
  { day: "D", ratio: 0.28, highlighted: false },
];

export const earningsHistory = [
  {
    id: "1",
    title: "Instalação de tomada",
    meta: "Hoje, 14:30 · Pix",
    amount: 80,
    type: "in" as const,
  },
  {
    id: "2",
    title: "Troca de chuveiro",
    meta: "Hoje, 11:00 · Cartão",
    amount: 120,
    type: "in" as const,
  },
  {
    id: "3",
    title: "Saque para conta",
    meta: "Ontem · Banco •••• 4021",
    amount: 500,
    type: "out" as const,
  },
];

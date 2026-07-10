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

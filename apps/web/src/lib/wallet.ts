import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Carteira/ganhos do prestador (RF-F4/F5): leitura do ledger interno
// (Wallet/WalletTransaction) já alimentado pelo fluxo de pagamento. Saque
// fica para depois (depende de KYC/dados bancários) — aqui é só saldo/extrato.
// ---------------------------------------------------------------------------

export type WalletTransactionDTO = {
  id: string;
  type: "CREDIT" | "DEBIT";
  amountCents: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
};

export type WalletDailyEarning = {
  day: string; // "Seg".."Dom"
  totalCents: number;
  isToday: boolean;
};

export type WalletSummaryDTO = {
  balanceCents: number;
  weekTotalCents: number;
  daily: WalletDailyEarning[];
  transactions: WalletTransactionDTO[];
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function getWalletSummary(userId: string): Promise<WalletSummaryDTO> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  const balanceCents = wallet?.balanceCents ?? 0;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6); // janela de 7 dias, hoje incluso

  const [weekTx, recentTx] = wallet
    ? await Promise.all([
        prisma.walletTransaction.findMany({
          where: { walletId: wallet.id, createdAt: { gte: since } },
        }),
        prisma.walletTransaction.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ])
    : [[], []];

  // Agrega o líquido (crédito - débito) por dia dentro da janela de 7 dias.
  const dayKeys: string[] = [];
  const buckets = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toDateString();
    dayKeys.push(key);
    buckets.set(key, 0);
  }
  for (const tx of weekTx) {
    const key = tx.createdAt.toDateString();
    if (!buckets.has(key)) continue;
    const signed = tx.type === "CREDIT" ? tx.amountCents : -tx.amountCents;
    buckets.set(key, (buckets.get(key) ?? 0) + signed);
  }

  const todayKey = new Date().toDateString();
  const daily: WalletDailyEarning[] = dayKeys.map((key) => ({
    day: WEEKDAY_LABELS[new Date(key).getDay()],
    totalCents: Math.max(buckets.get(key) ?? 0, 0),
    isToday: key === todayKey,
  }));

  const weekTotalCents = daily.reduce((sum, d) => sum + d.totalCents, 0);

  return {
    balanceCents,
    weekTotalCents,
    daily,
    transactions: recentTx.map((t) => ({
      id: t.id,
      type: t.type,
      amountCents: t.amountCents,
      description: t.description,
      orderId: t.orderId,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

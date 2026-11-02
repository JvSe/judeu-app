import { supabase } from "./db";

export type WalletTransactionDTO = {
  id: string;
  type: "CREDIT" | "DEBIT";
  amountCents: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
};

export type WalletDailyEarning = {
  day: string;
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
  const { data: wallet } = await supabase.from("wallet").select("*").eq("userId", userId).maybeSingle();
  const balanceCents = wallet?.balanceCents ?? 0;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const [weekTx, recentTx] = wallet
    ? await Promise.all([
        supabase
          .from("wallettransaction")
          .select("*")
          .eq("walletId", wallet.id)
          .gte("createdAt", since.toISOString())
          .then((r) => r.data ?? []),
        supabase
          .from("wallettransaction")
          .select("*")
          .eq("walletId", wallet.id)
          .order("createdAt", { ascending: false })
          .limit(20)
          .then((r) => r.data ?? []),
      ])
    : [[], []];

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
    const key = new Date(tx.createdAt).toDateString();
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

  return {
    balanceCents,
    weekTotalCents: daily.reduce((sum, d) => sum + d.totalCents, 0),
    daily,
    transactions: recentTx.map((t) => ({
      id: t.id,
      type: t.type,
      amountCents: t.amountCents,
      description: t.description,
      orderId: t.orderId,
      createdAt: t.createdAt,
    })),
  };
}

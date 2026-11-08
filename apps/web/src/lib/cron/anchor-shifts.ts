import { isShiftActive, isShiftDue, shiftSettlement, shouldCountPresence } from "../anchors";
import { getConfig } from "../config";
import { supabase } from "../db";
import { notifyUser } from "../notifications";
import { BUSY_ORDER_STATUSES } from "../orders";
import { applyWalletMovement } from "../payments";
import type { CronJob } from "./runner";

// Turnos de âncora: conta presença minuto a minuto e fecha a conta no fim.

type ShiftRow = {
  id: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  hourlyFloorCents: number;
  onlineMinutes: number;
  lastPresenceAt: string | null;
  status: string;
};

async function countPresence(now: Date): Promise<number> {
  const iso = now.toISOString();
  const { data: shifts, error } = await supabase
    .from("anchorshift")
    .select("id, providerId, startsAt, endsAt, hourlyFloorCents, onlineMinutes, lastPresenceAt, status")
    .eq("status", "SCHEDULED")
    .lte("startsAt", iso)
    .gt("endsAt", iso);
  if (error) throw new Error(error.message);
  const active = ((shifts ?? []) as ShiftRow[]).filter(
    (s) => isShiftActive(s, now) && shouldCountPresence(s.lastPresenceAt, now),
  );
  if (active.length === 0) return 0;

  const providerIds = [...new Set(active.map((s) => s.providerId))];
  const [{ data: profiles }, { data: busy }] = await Promise.all([
    supabase.from("providerprofile").select("id, isAvailable, status").in("id", providerIds),
    supabase.from("order").select("providerId").in("status", [...BUSY_ORDER_STATUSES]).in("providerId", providerIds),
  ]);
  const present = new Set<string>();
  for (const p of profiles ?? []) if (p.status === "APPROVED" && p.isAvailable) present.add(p.id);
  for (const o of busy ?? []) if (o.providerId) present.add(o.providerId);

  let counted = 0;
  for (const s of active) {
    if (!present.has(s.providerId)) continue;
    // Trava otimista: se outro tick já contou este minuto, onlineMinutes mudou e nada é gravado.
    const { data: updated } = await supabase
      .from("anchorshift")
      .update({ onlineMinutes: s.onlineMinutes + 1, lastPresenceAt: iso })
      .eq("id", s.id)
      .eq("onlineMinutes", s.onlineMinutes)
      .select("id");
    if (updated?.length) counted += 1;
  }
  return counted;
}

async function settleDueShifts(now: Date, graceMin: number): Promise<{ settled: number; subsidized: number }> {
  const cutoff = new Date(now.getTime() - graceMin * 60_000).toISOString();
  const { data: shifts, error } = await supabase
    .from("anchorshift")
    .select("id, providerId, startsAt, endsAt, hourlyFloorCents, onlineMinutes, lastPresenceAt, status, provider:providerprofile(userId)")
    .eq("status", "SCHEDULED")
    .lte("endsAt", cutoff)
    .limit(100);
  if (error) throw new Error(error.message);

  let settled = 0;
  let subsidized = 0;
  for (const raw of shifts ?? []) {
    const shift = raw as unknown as ShiftRow & { provider: { userId: string } | { userId: string }[] | null };
    if (!isShiftDue(shift, now, graceMin)) continue;
    const { data: orders } = await supabase
      .from("order")
      .select("priceCents, feeRate, feePayer")
      .eq("providerId", shift.providerId)
      .eq("status", "COMPLETED")
      .gte("acceptedAt", shift.startsAt)
      .lt("acceptedAt", shift.endsAt);
    const result = shiftSettlement(shift, orders ?? []);

    // Fecha uma vez só: quem não conseguir mudar SCHEDULED → SETTLED não credita.
    const { data: closed } = await supabase
      .from("anchorshift")
      .update({
        status: "SETTLED",
        earnedCents: result.earnedCents,
        subsidyCents: result.subsidyCents,
        settledAt: now.toISOString(),
      })
      .eq("id", shift.id)
      .eq("status", "SCHEDULED")
      .select("id");
    if (!closed?.length) continue;
    settled += 1;

    const provider = Array.isArray(shift.provider) ? shift.provider[0] : shift.provider;
    if (!provider) continue;
    if (result.subsidyCents > 0) {
      await applyWalletMovement(
        provider.userId,
        { type: "CREDIT", amountCents: result.subsidyCents, description: "Complemento do piso do plantão" },
        null,
      );
      subsidized += 1;
    }
    const money = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
    void notifyUser(provider.userId, "SUPPORT", {
      title: "Plantão encerrado",
      body:
        result.subsidyCents > 0
          ? `Você ganhou ${money(result.earnedCents)} e o piso era ${money(result.floorCents)}. Creditamos ${money(result.subsidyCents)} na carteira.`
          : `Você ganhou ${money(result.earnedCents)} no plantão, acima do piso de ${money(result.floorCents)}.`,
      data: { type: "wallet" },
    });
  }
  return { settled, subsidized };
}

export const anchorShiftsJob: CronJob = {
  name: "anchorShifts",
  async run(now) {
    const config = await getConfig();
    const presence = await countPresence(now);
    const { settled, subsidized } = await settleDueShifts(now, config.anchorSettleGraceMin);
    return { presence, settled, subsidized };
  },
};

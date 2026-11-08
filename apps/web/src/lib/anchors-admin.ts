import { randomUUID } from "node:crypto";

import { shiftFloorCents } from "./anchors";
import { supabase } from "./db";
import { notifyUser } from "./notifications";
import { formatBrasiliaDateTime } from "./zones";

export type AdminShiftDTO = {
  id: string;
  providerId: string;
  providerName: string;
  startsAt: string;
  endsAt: string;
  hourlyFloorCents: number;
  onlineMinutes: number;
  /** Piso acumulado até agora (ou final, se fechado). */
  floorCents: number;
  status: "SCHEDULED" | "SETTLED" | "CANCELLED";
  earnedCents: number | null;
  subsidyCents: number | null;
};

type Embedded<T> = T | T[] | null;
const one = <T,>(v: Embedded<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function listShifts(limit = 100): Promise<AdminShiftDTO[]> {
  const { data, error } = await supabase
    .from("anchorshift")
    .select("*, provider:providerprofile(user:user!inner(fullName))")
    .order("startsAt", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const s = raw as typeof raw & { provider: Embedded<{ user: Embedded<{ fullName: string }> }> };
    return {
      id: s.id,
      providerId: s.providerId,
      providerName: one(one(s.provider)?.user ?? null)?.fullName ?? "—",
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      hourlyFloorCents: s.hourlyFloorCents,
      onlineMinutes: s.onlineMinutes,
      floorCents: shiftFloorCents(s.hourlyFloorCents, s.onlineMinutes),
      status: s.status,
      earnedCents: s.earnedCents,
      subsidyCents: s.subsidyCents,
    };
  });
}

/** Quem pode ser âncora: aprovado. */
export async function listAnchorCandidates(): Promise<{ id: string; name: string; isHelper: boolean }[]> {
  const { data } = await supabase
    .from("providerprofile")
    .select("id, isHelper, user:user!inner(fullName)")
    .eq("status", "APPROVED");
  return (data ?? [])
    .map((raw) => {
      const p = raw as typeof raw & { user: Embedded<{ fullName: string }> };
      return { id: p.id, name: one(p.user)?.fullName ?? "—", isHelper: p.isHelper };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function createShift(input: {
  providerId: string;
  startsAt: string;
  endsAt: string;
  hourlyFloorCents: number;
}): Promise<void> {
  const { error } = await supabase.from("anchorshift").insert({ id: randomUUID(), ...input, status: "SCHEDULED" });
  if (error) throw new Error(error.message);
  const { data: p } = await supabase.from("providerprofile").select("userId").eq("id", input.providerId).maybeSingle();
  if (p) {
    const money = `R$ ${(input.hourlyFloorCents / 100).toFixed(2).replace(".", ",")}`;
    void notifyUser(p.userId, "SUPPORT", {
      title: "Você tem um plantão",
      body: `${formatBrasiliaDateTime(input.startsAt)} até ${formatBrasiliaDateTime(input.endsAt)}. Fique disponível no app: garantimos ${money} por hora disponível.`,
      data: { type: "provider_status" },
    });
  }
}

/** Só cancela turno que ainda não foi fechado. */
export async function cancelShift(shiftId: string): Promise<void> {
  const { error } = await supabase
    .from("anchorshift")
    .update({ status: "CANCELLED" })
    .eq("id", shiftId)
    .eq("status", "SCHEDULED");
  if (error) throw new Error(error.message);
}

/** Âncoras de plantão agora (turno em andamento). */
export async function onDutyAnchorIds(now = new Date()): Promise<Set<string>> {
  const iso = now.toISOString();
  const { data } = await supabase
    .from("anchorshift")
    .select("providerId")
    .eq("status", "SCHEDULED")
    .lte("startsAt", iso)
    .gt("endsAt", iso);
  return new Set((data ?? []).map((s) => s.providerId));
}

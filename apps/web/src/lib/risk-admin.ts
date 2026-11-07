import { randomUUID } from "node:crypto";

import { supabase } from "./db";
import { BADGE_LABEL, type BadgeType, type RiskLevel, normalizeRisk } from "./risk";
import { notifyUser } from "./notifications";

// Operações do painel admin para níveis de tarefa e selos.

export async function listCategoriesWithRisk(): Promise<{ id: string; name: string; riskLevel: RiskLevel }[]> {
  const { data, error } = await supabase.from("category").select("id, name, riskLevel").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, riskLevel: normalizeRisk(c.riskLevel) }));
}

export async function setCategoryRisk(categoryId: string, level: RiskLevel): Promise<void> {
  const { error } = await supabase.from("category").update({ riskLevel: level }).eq("id", categoryId);
  if (error) throw new Error(error.message);
}

export async function listBadgesByProvider(): Promise<Map<string, BadgeType[]>> {
  const { data } = await supabase.from("providerbadge").select("providerId, type");
  const map = new Map<string, BadgeType[]>();
  for (const b of data ?? []) {
    map.set(b.providerId, [...(map.get(b.providerId) ?? []), b.type]);
  }
  return map;
}

export async function setProviderBadge(providerId: string, type: BadgeType, granted: boolean): Promise<void> {
  if (!granted) {
    await supabase.from("providerbadge").delete().eq("providerId", providerId).eq("type", type);
    return;
  }
  const { error } = await supabase
    .from("providerbadge")
    .upsert(
      { id: randomUUID(), providerId, type, grantedAt: new Date().toISOString() },
      { onConflict: "providerId,type", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  const { data: p } = await supabase.from("providerprofile").select("userId").eq("id", providerId).maybeSingle();
  if (p) {
    void notifyUser(p.userId, "SUPPORT", {
      title: `${BADGE_LABEL[type]} concedido`,
      body: "Agora você pode atender tarefas que exigem essa qualificação.",
      data: { type: "provider_status" },
    });
  }
}

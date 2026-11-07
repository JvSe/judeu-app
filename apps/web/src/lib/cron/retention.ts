import { getConfig } from "../config";
import { supabase } from "../db";
import { deleteKycFiles } from "../storage";
import type { CronJob } from "./runner";

// LGPD: retenção. Roda uma vez por dia (03:00 UTC) dentro do tick de 1 min.
const DAY = 24 * 60 * 60_000;

export function isRetentionWindow(now: Date): boolean {
  return now.getUTCHours() === 3 && now.getUTCMinutes() === 0;
}

export const retentionJob: CronJob = {
  name: "retention",
  async run(now): Promise<Record<string, number>> {
    if (!isRetentionWindow(now)) return { skipped: 1 };
    const config = await getConfig();
    const locationCutoff = new Date(now.getTime() - config.locationRetentionDays * DAY).toISOString();
    const kycCutoff = new Date(now.getTime() - config.blockedKycRetentionDays * DAY).toISOString();

    // Posição de quem atende em pedidos encerrados há mais de N dias.
    const { data: orders } = await supabase
      .from("order")
      .update({ providerLat: null, providerLng: null, providerLocationAt: null })
      .in("status", ["COMPLETED", "CANCELLED"])
      .lt("updatedAt", locationCutoff)
      .not("providerLat", "is", null)
      .select("id");

    // Última posição de quem não atende há mais de N dias.
    const { data: profiles } = await supabase
      .from("providerprofile")
      .update({ lastLat: null, lastLng: null, lastLocationAt: null })
      .eq("isAvailable", false)
      .lt("lastLocationAt", locationCutoff)
      .select("id");

    // KYC de cadastros bloqueados há muito tempo.
    const { data: blocked } = await supabase
      .from("providerprofile")
      .select("id, documentUrl, selfieUrl, backgroundCheckUrl")
      .eq("status", "BLOCKED")
      .lt("updatedAt", kycCutoff)
      .or("documentUrl.not.is.null,selfieUrl.not.is.null,backgroundCheckUrl.not.is.null")
      .limit(100);
    for (const p of blocked ?? []) {
      await deleteKycFiles([p.documentUrl, p.selfieUrl, p.backgroundCheckUrl]);
      await supabase
        .from("providerprofile")
        .update({ documentUrl: null, selfieUrl: null, backgroundCheckUrl: null })
        .eq("id", p.id);
    }

    return {
      orderLocationsCleared: orders?.length ?? 0,
      profileLocationsCleared: profiles?.length ?? 0,
      blockedKycErased: blocked?.length ?? 0,
    };
  },
};

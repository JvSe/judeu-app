import { randomUUID } from "node:crypto";

import type { LatLng } from "./geo";
import { supabase } from "./db";
import { type AreaStatus, type ServiceZone, areaStatus } from "./zones";

// Leitura e escrita das zonas. A lista é pequena e muda pouco: cache de 60 s.

const CACHE_TTL_MS = 60_000;
let cache: { value: ServiceZone[]; at: number } | null = null;

function toZone(row: {
  id: string;
  name: string;
  polygon: unknown;
  weekdays: number[] | null;
  openMinute: number;
  closeMinute: number;
  active: boolean;
}): ServiceZone {
  const polygon = Array.isArray(row.polygon)
    ? (row.polygon as unknown[])
        .map((p) => (Array.isArray(p) ? ([Number(p[0]), Number(p[1])] as [number, number]) : null))
        .filter((p): p is [number, number] => p !== null && p.every(Number.isFinite))
    : [];
  return {
    id: row.id,
    name: row.name,
    polygon,
    weekdays: row.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
    openMinute: row.openMinute,
    closeMinute: row.closeMinute,
    active: row.active,
  };
}

/** Todas as zonas (ativas e inativas). Se a tabela não existir ou falhar, devolve [] = tudo liberado. */
export async function listZones(): Promise<ServiceZone[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const { data, error } = await supabase.from("servicezone").select("*").order("name");
  if (error) {
    console.warn("[zones] falha ao ler servicezone, sem restrição de área:", error.message);
    return cache?.value ?? [];
  }
  const value = (data ?? []).map(toZone);
  cache = { value, at: Date.now() };
  return value;
}

export function resetZonesCache() {
  cache = null;
}

export async function checkArea(point: LatLng, at = new Date()): Promise<AreaStatus> {
  return areaStatus(point, await listZones(), at);
}

export type ZoneInput = {
  name: string;
  polygon: [number, number][];
  weekdays: number[];
  openMinute: number;
  closeMinute: number;
};

export async function createZone(input: ZoneInput): Promise<void> {
  const { error } = await supabase.from("servicezone").insert({
    id: randomUUID(),
    ...input,
    polygon: input.polygon,
    active: true,
  });
  if (error) throw new Error(error.message);
  resetZonesCache();
}

export async function updateZone(id: string, patch: Partial<ZoneInput> & { active?: boolean }): Promise<void> {
  const { error } = await supabase
    .from("servicezone")
    .update({ ...patch, updatedAt: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  resetZonesCache();
}

export async function deleteZone(id: string): Promise<void> {
  const { error } = await supabase.from("servicezone").delete().eq("id", id);
  if (error) throw new Error(error.message);
  resetZonesCache();
}

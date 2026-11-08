import type { LatLng } from "./geo";

// Zonas e horário de operação (Fase 6). Sem zona ativa, nada muda: o app
// atende em qualquer lugar e a qualquer hora, como antes.

/** Brasília não tem horário de verão desde 2019: UTC−3 fixo (mesma conta de pricing.ts). */
const BRT_OFFSET_MIN = -3 * 60;
const DAY_MIN = 24 * 60;

export type ServiceZone = {
  id: string;
  name: string;
  /** Pontos [lat, lng]. */
  polygon: [number, number][];
  /** 0 = domingo … 6 = sábado (dia de Brasília). */
  weekdays: number[];
  openMinute: number;
  closeMinute: number;
  active: boolean;
};

export type AreaStatus =
  /** Pode pedir agora (ou não há zona cadastrada). */
  | { status: "OPEN"; zoneName: string | null }
  /** Dentro de uma zona, mas fora do horário: só agendando. */
  | { status: "CLOSED"; zoneName: string; nextOpenAt: string | null }
  /** Fora de todas as zonas: o app ainda não atende ali. */
  | { status: "OUTSIDE" };

/** Ray casting. Polígono em [lat, lng]; funciona para as áreas pequenas de uma cidade. */
export function pointInPolygon(point: LatLng, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const crosses =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Dia da semana e minuto do dia em Brasília. */
export function brasiliaClock(at: Date): { weekday: number; minute: number } {
  const local = new Date(at.getTime() + BRT_OFFSET_MIN * 60_000);
  return { weekday: local.getUTCDay(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** A zona está aberta neste instante? Janela que cruza a meia-noite pertence ao dia em que abre. */
export function isZoneOpenAt(zone: Pick<ServiceZone, "weekdays" | "openMinute" | "closeMinute">, at: Date): boolean {
  const { weekday, minute } = brasiliaClock(at);
  if (zone.closeMinute > zone.openMinute) {
    return zone.weekdays.includes(weekday) && minute >= zone.openMinute && minute < zone.closeMinute;
  }
  // Ex.: 18h → 2h. Antes da meia-noite vale o dia de hoje; depois, o de ontem.
  if (minute >= zone.openMinute) return zone.weekdays.includes(weekday);
  if (minute < zone.closeMinute) return zone.weekdays.includes((weekday + 6) % 7);
  return false;
}

/** Próxima abertura (até 8 dias à frente), em ISO. Null se a zona nunca abre. */
export function nextOpening(
  zone: Pick<ServiceZone, "weekdays" | "openMinute" | "closeMinute">,
  from: Date,
): string | null {
  if (zone.weekdays.length === 0) return null;
  const { minute } = brasiliaClock(from);
  // Meia-noite de hoje em Brasília, como instante UTC.
  const todayStart = from.getTime() - minute * 60_000 - from.getUTCSeconds() * 1000 - from.getUTCMilliseconds();
  for (let day = 0; day <= 8; day++) {
    const candidate = new Date(todayStart + (day * DAY_MIN + zone.openMinute) * 60_000);
    if (candidate.getTime() <= from.getTime()) continue;
    if (zone.weekdays.includes(brasiliaClock(candidate).weekday)) return candidate.toISOString();
  }
  return null;
}

/** Situação de um endereço agora (ou num horário agendado). */
export function areaStatus(point: LatLng, zones: ServiceZone[], at: Date): AreaStatus {
  const active = zones.filter((z) => z.active && z.polygon.length >= 3);
  if (active.length === 0) return { status: "OPEN", zoneName: null };
  const containing = active.filter((z) => pointInPolygon(point, z.polygon));
  if (containing.length === 0) return { status: "OUTSIDE" };
  const open = containing.find((z) => isZoneOpenAt(z, at));
  if (open) return { status: "OPEN", zoneName: open.name };
  const openings = containing
    .map((z) => nextOpening(z, at))
    .filter((v): v is string => Boolean(v))
    .sort();
  return { status: "CLOSED", zoneName: containing[0].name, nextOpenAt: openings[0] ?? null };
}

export const AREA_MESSAGES = {
  OUTSIDE: "Ainda não atendemos esse endereço.",
  CLOSED: "Fora do horário de atendimento. Agende para quando estivermos funcionando.",
  SCHEDULE_CLOSED: "Nesse horário não há atendimento nesse endereço. Escolha outro horário.",
} as const;

/**
 * Lê o polígono digitado no admin: GeoJSON (Polygon ou Feature, em [lng, lat])
 * ou uma linha "lat, lng" por ponto. Devolve null se não der um polígono válido.
 */
export function parsePolygonInput(text: string): [number, number][] | null {
  const raw = text.trim();
  if (!raw) return null;
  let points: [number, number][] = [];
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const geometry =
        parsed && typeof parsed === "object" && "geometry" in parsed
          ? (parsed as { geometry: unknown }).geometry
          : parsed;
      const coords =
        geometry && typeof geometry === "object" && "coordinates" in geometry
          ? (geometry as { coordinates: unknown }).coordinates
          : geometry;
      // Polygon: [[[lng, lat], ...]]; também aceita [[lng, lat], ...].
      const ring = Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0]) ? coords[0] : coords;
      if (!Array.isArray(ring)) return null;
      points = ring.map((p) => [Number(p?.[1]), Number(p?.[0])] as [number, number]);
    } catch {
      return null;
    }
  } else {
    points = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [lat, lng] = line.split(/[,;\s]+/).map(Number);
        return [lat, lng] as [number, number];
      });
  }
  const valid = points.every(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180,
  );
  if (!valid) return null;
  // O GeoJSON repete o primeiro ponto no fim; não precisa.
  const [first, last] = [points[0], points[points.length - 1]];
  if (points.length > 3 && first[0] === last[0] && first[1] === last[1]) points = points.slice(0, -1);
  return points.length >= 3 ? points : null;
}

const WEEKDAY_SHORT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** "ter., 10/11 às 08:00" no horário de Brasília. */
export function formatBrasiliaDateTime(iso: string): string {
  const local = new Date(new Date(iso).getTime() + BRT_OFFSET_MIN * 60_000);
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const min = String(local.getUTCMinutes()).padStart(2, "0");
  return `${WEEKDAY_SHORT[local.getUTCDay()]}, ${dd}/${mm} às ${hh}:${min}`;
}

/** Mensagem de recusa para um pedido, ou null se pode seguir. */
export function areaDenial(area: AreaStatus, scheduled: boolean): { error: string; status: number } | null {
  if (area.status === "OPEN") return null;
  if (area.status === "OUTSIDE") return { error: AREA_MESSAGES.OUTSIDE, status: 400 };
  if (scheduled) return { error: AREA_MESSAGES.SCHEDULE_CLOSED, status: 400 };
  const next = area.nextOpenAt ? ` Abrimos de novo ${formatBrasiliaDateTime(area.nextOpenAt)}.` : "";
  return { error: `${AREA_MESSAGES.CLOSED}${next}`, status: 409 };
}

/** "08:00" ↔ 480. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes <= DAY_MIN && Number(match[2]) < 60 ? minutes : null;
}

export function formatClock(minutes: number): string {
  const m = minutes % DAY_MIN === 0 && minutes > 0 ? DAY_MIN : minutes;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

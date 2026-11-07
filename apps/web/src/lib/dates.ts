// O banco guarda UTC em `timestamp` (sem fuso), e o PostgREST devolve
// "2026-11-03T15:54:17.996" sem o "Z". Quem lê (app em Brasília) interpretava
// como hora local: +3 h no cronômetro da oferta e nos horários (QA A-03/C-05).

const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;

/** Acrescenta "Z" a um timestamp do banco sem fuso; outros valores passam intactos. */
export function ensureUtcIso(value: string): string {
  return NAIVE_TIMESTAMP.test(value) ? `${value}Z` : value;
}

/** Aplica `ensureUtcIso` em profundidade (objetos e arrays) sem alterar o original. */
export function withUtcTimestamps<T>(value: T): T {
  if (typeof value === "string") return ensureUtcIso(value) as T;
  if (Array.isArray(value)) return value.map((v) => withUtcTimestamps(v)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = withUtcTimestamps(v);
    return out as T;
  }
  return value;
}

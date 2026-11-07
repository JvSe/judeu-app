/**
 * O PostgREST devolve uma relação embutida como array quando não detecta que ela
 * é 1:1 (ex.: `payment:payment(...)`). `[]` é truthy, então `!order.payment`
 * falhava mesmo sem pagamento (QA C-03/P-03). Normaliza para objeto ou null.
 */
export function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

import type { PixKeyType } from "@/lib/api";

export const PIX_KEY_TYPES: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: "CPF", label: "CPF", placeholder: "000.000.000-00" },
  { value: "PHONE", label: "Celular", placeholder: "(63) 99999-0000" },
  { value: "EMAIL", label: "E-mail", placeholder: "voce@email.com" },
  { value: "CNPJ", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "RANDOM", label: "Aleatória", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
];

/** "50", "50,5", "1.234,56" → centavos; vazio ou inválido → 0. */
export function reaisToCents(input: string): number {
  const clean = input.trim().replace(/\./g, "").replace(",", ".");
  if (!clean) return 0;
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

/** Centavos → texto editável no campo ("1234,50"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

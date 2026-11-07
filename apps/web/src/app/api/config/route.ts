import { getConfig, toPublicConfig } from "@/lib/config";
import { handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// Público: o app lê taxa e TTLs antes do login (ex.: resumo de preço).
export async function GET() {
  return json(toPublicConfig(await getConfig()));
}

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { suggestedPriceFor } from "@/lib/pricing";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/orders/suggested-price?categoryId= — valor inicial sugerido para ajuda aberta.
export async function GET(req: Request) {
  if (!(await requireAuth(req))) return error("Não autenticado", 401);
  const categoryId = new URL(req.url).searchParams.get("categoryId") || null;
  return json(await suggestedPriceFor(categoryId));
}

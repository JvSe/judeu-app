import { requireAuth } from "@/lib/auth";
import { searchCatalog } from "@/lib/catalog";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: Request) {
  if (!(await requireAuth(req))) return error("Não autenticado", 401);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json(await searchCatalog(q));
}

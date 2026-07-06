import { requireAuth } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: Request) {
  if (!(await requireAuth(req))) return error("Não autenticado", 401);
  return json({ categories: await listCategories() });
}

import { requireAuth } from "@/lib/auth";
import { getProvider } from "@/lib/catalog";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth(req))) return error("Não autenticado", 401);
  const { id } = await ctx.params;
  const provider = await getProvider(id);
  if (!provider) return error("Prestador não encontrado", 404);
  return json({ provider });
}

import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getMyJobPosting, setJobPostingStatus } from "@/lib/jobs";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const patchSchema = z.object({ status: z.enum(["OPEN", "CLOSED"]) });

// GET /api/jobs/me/:id — detalhe de uma vaga da empresa logada.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const result = await getMyJobPosting(id, claims.sub);
  if ("error" in result) return error(result.error, result.status);
  return json({ job: result });
}

// PATCH /api/jobs/me/:id — abre ou fecha a vaga.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const result = await setJobPostingStatus(id, claims.sub, parsed.data.status);
  if ("error" in result) return error(result.error, result.status);
  return json({ job: result });
}

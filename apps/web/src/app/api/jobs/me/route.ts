import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { createJobPosting, listMyJobPostings } from "@/lib/jobs";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftSchema = z
  .object({
    weekday: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
    startTime: z.string().regex(TIME_RE, "Horário inválido (use HH:mm)"),
    endTime: z.string().regex(TIME_RE, "Horário inválido (use HH:mm)"),
  })
  .refine((s) => s.startTime < s.endTime, {
    message: "O horário de início deve ser antes do horário de término",
    path: ["endTime"],
  });

const createSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  contractType: z.enum(["CLT", "PJ", "FREELANCE", "TEMPORARY"]),
  salaryCents: z.number().int().min(0).optional(),
  shifts: z.array(shiftSchema).min(1).max(30),
});

// GET /api/jobs/me — vagas publicadas pela empresa logada (todos os status).
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só prestadores podem publicar vagas", 403);
  }
  return json({ jobs: await listMyJobPostings(claims.sub) });
}

// POST /api/jobs/me — publica uma nova vaga (só empresas aprovadas).
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só prestadores podem publicar vagas", 403);
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const result = await createJobPosting(claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ job: result }, { status: 201 });
}

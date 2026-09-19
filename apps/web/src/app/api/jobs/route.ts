import type { JobContractType } from "@judeu/db";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { listOpenJobs } from "@/lib/jobs";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const CONTRACT_TYPES: readonly JobContractType[] = ["CLT", "PJ", "FREELANCE", "TEMPORARY"];

function parseContractType(value: string | null): JobContractType | undefined {
  return value && (CONTRACT_TYPES as readonly string[]).includes(value)
    ? (value as JobContractType)
    : undefined;
}

// GET /api/jobs?categoryId=&contractType=&q= — vagas abertas, para qualquer candidato.
export async function GET(req: Request) {
  if (!(await requireAuth(req))) return error("Não autenticado", 401);
  const params = new URL(req.url).searchParams;
  const jobs = await listOpenJobs({
    categoryId: params.get("categoryId") ?? undefined,
    contractType: parseContractType(params.get("contractType")),
    q: params.get("q") ?? undefined,
  });
  return json({ jobs });
}

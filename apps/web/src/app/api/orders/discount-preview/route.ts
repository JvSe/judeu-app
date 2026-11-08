import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { supabase } from "@/lib/db";
import { creditBalance, resolveDiscount } from "@/lib/discounts";
import { computeFees, resolveFeeRule } from "@/lib/fees";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const schema = z.object({
  priceCents: z.number().int().min(0).max(1_000_000),
  categoryId: z.string().min(1).optional(),
  couponCode: z.string().max(40).optional(),
  useCredits: z.boolean().optional(),
});

// POST /api/orders/discount-preview — quanto o cupom e o crédito abatem antes
// de criar o pedido. A conta final é refeita no POST /api/orders.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 400);
  const { priceCents, categoryId, couponCode, useCredits } = parsed.data;

  const [config, { data: category }, balance] = await Promise.all([
    getConfig(),
    categoryId
      ? supabase.from("category").select("feeRate").eq("id", categoryId).maybeSingle()
      : Promise.resolve({ data: null }),
    creditBalance(claims.sub),
  ]);
  const rule = resolveFeeRule(config, category);
  const plan = await resolveDiscount(claims.sub, {
    couponCode,
    useCredits,
    priceCents,
    grossTotalCents: computeFees(priceCents, rule).totalCents,
  });
  if ("error" in plan) return error(plan.error, plan.status);
  const fees = computeFees(priceCents, rule, plan.totalCents);
  return json({
    couponLabel: plan.couponLabel,
    couponCents: plan.couponCents,
    creditCents: plan.creditCents,
    creditBalanceCents: balance,
    discountCents: fees.discountCents,
    totalCents: fees.totalCents,
  });
}

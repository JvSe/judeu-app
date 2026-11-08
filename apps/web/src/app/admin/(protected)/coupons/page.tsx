import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { listCouponsWithUsage, listRecentCreditGrants } from "@/lib/discounts";
import { formatBrasiliaDateTime } from "@/lib/zones";

import { createDiscountCoupon, grantClientCredit, toggleCoupon } from "../../actions";

export const dynamic = "force-dynamic";

const inputClass = "rounded-md border bg-background px-2 py-1 text-sm";
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Cupons e crédito do cliente. O desconto sai da parte da plataforma: quem
// atende recebe o mesmo valor de um pedido sem desconto.
export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const [coupons, grants, { error, ok }] = await Promise.all([
    listCouponsWithUsage(),
    listRecentCreditGrants(),
    searchParams,
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Cupons e créditos</h1>
        <p className="text-sm text-muted-foreground">
          O desconto é custo da plataforma: quem atende recebe o mesmo. O total do pedido nunca fica abaixo de R$ 1.
          Pedido cancelado devolve o cupom e o crédito.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {ok && <p className="rounded-md border px-3 py-2 text-sm">{ok}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Novo cupom</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDiscountCoupon} className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input name="code" required placeholder="CÓDIGO" className={`${inputClass} w-40 uppercase`} />
              <select name="kind" className={inputClass} defaultValue="PERCENT">
                <option value="PERCENT">% do preço</option>
                <option value="FIXED">R$ fixo</option>
              </select>
              <input name="value" required placeholder="20 ou 10,00" className={`${inputClass} w-28`} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              Teto R$ <input name="maxDiscount" placeholder="opcional" className={`${inputClass} w-24`} />
              Pedido mínimo R$ <input name="minPrice" placeholder="opcional" className={`${inputClass} w-24`} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              Usos no total <input name="maxRedemptions" placeholder="sem limite" className={`${inputClass} w-24`} />
              Por pessoa <input name="perUserLimit" defaultValue="1" className={`${inputClass} w-16`} />
              <label className="flex items-center gap-1">
                <input type="checkbox" name="firstOrderOnly" /> Só no primeiro pedido
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              Vence em <input type="date" name="expiresOn" className={inputClass} /> (opcional, fim do dia em Brasília)
            </div>
            <div>
              <Button type="submit" size="sm">
                Criar cupom
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {coupons.map((c) => (
        <Card key={c.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {c.code} {c.active ? "" : "(desativado)"}
            </CardTitle>
            <CardDescription>
              {c.label}
              {c.minPriceCents != null ? ` · pedido a partir de ${money(c.minPriceCents)}` : ""}
              {c.firstOrderOnly ? " · só no primeiro pedido" : ""}
              {c.expiresAt ? ` · vence ${formatBrasiliaDateTime(c.expiresAt)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {c.redemptions}
              {c.maxRedemptions != null ? `/${c.maxRedemptions}` : ""} usos · {money(c.discountGivenCents)} em desconto
            </span>
            <form action={toggleCoupon.bind(null, c.id, !c.active)}>
              <Button type="submit" size="sm" variant="outline">
                {c.active ? "Desativar" : "Ativar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dar crédito a um cliente</CardTitle>
          <CardDescription>O cliente usa marcando &quot;usar meus créditos&quot; ao pedir.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form action={grantClientCredit} className="flex flex-wrap items-center gap-2 text-sm">
            <input name="email" type="email" required placeholder="e-mail do cliente" className={`${inputClass} w-56`} />
            R$ <input name="amount" required placeholder="10,00" className={`${inputClass} w-24`} />
            <input name="reason" placeholder="Motivo (ex.: cortesia)" className={`${inputClass} w-56`} />
            <Button type="submit" size="sm">
              Dar crédito
            </Button>
          </form>
          {grants.length > 0 && (
            <ul className="text-sm text-muted-foreground">
              {grants.map((g) => (
                <li key={g.id}>
                  {formatBrasiliaDateTime(g.createdAt)} · {g.name} ({g.email}) · {money(g.amountCents)}
                  {g.reason ? ` · ${g.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

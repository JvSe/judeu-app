import { timingSafeEqual } from "node:crypto";

/**
 * Confere o `Authorization: Bearer <CRON_SECRET>` do tick. Sem segredo
 * configurado, sempre recusa (endpoint desligado).
 */
export function isCronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!authorization?.startsWith("Bearer ")) return false;
  const a = Buffer.from(authorization.slice("Bearer ".length).trim());
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "@judeu/env/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { supabase } from "./db";
import { sendEmail } from "./mailer";

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 30;

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export type AccessClaims = {
  sub: string;
  role: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    if (!payload.sub) return null;
    return { sub: payload.sub, role: String(payload.role ?? "CLIENT") };
  } catch {
    return null;
  }
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("refreshtoken").insert({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(raw),
    expiresAt,
  });
  if (error) throw new Error(`refresh token: ${error.message}`);
  return raw;
}

export async function rotateRefreshToken(
  raw: string,
): Promise<{ userId: string; role: string; accessToken: string; refreshToken: string } | null> {
  const tokenHash = hashToken(raw);
  const { data: record, error } = await supabase
    .from("refreshtoken")
    .select("id, userId, expiresAt, revokedAt, user:user!inner(role)")
    .eq("tokenHash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(`refresh lookup: ${error.message}`);
  if (!record || record.revokedAt || new Date(record.expiresAt) < new Date()) return null;

  const user = record.user as unknown as { role: string };
  await supabase
    .from("refreshtoken")
    .update({ revokedAt: new Date().toISOString() })
    .eq("id", record.id);

  const accessToken = await signAccessToken({ sub: record.userId, role: user.role });
  const refreshToken = await issueRefreshToken(record.userId);
  return { userId: record.userId, role: user.role, accessToken, refreshToken };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await supabase
    .from("refreshtoken")
    .update({ revokedAt: new Date().toISOString() })
    .eq("tokenHash", hashToken(raw))
    .is("revokedAt", null);
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await supabase
    .from("refreshtoken")
    .update({ revokedAt: new Date().toISOString() })
    .eq("userId", userId)
    .is("revokedAt", null);
}

const RESET_TTL_MINUTES = 15;
export const RESET_MAX_ATTEMPTS = 5;

function hashResetCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/** Código de 6 dígitos com gerador criptográfico (antes era fixo "123456" — QA C-01). */
export function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type ResetCheck = "ok" | "mismatch" | "expired" | "locked";

/** Decide se o código confere com o registro ativo, sem tocar no banco. */
export function checkResetCode(
  record: { userId: string; tokenHash: string; expiresAt: string; usedAt: string | null; attempts: number },
  code: string,
  now = new Date(),
): ResetCheck {
  if (record.usedAt || new Date(record.expiresAt) < now) return "expired";
  if (record.attempts >= RESET_MAX_ATTEMPTS) return "locked";
  const a = Buffer.from(hashResetCode(record.userId, code));
  const b = Buffer.from(record.tokenHash);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "mismatch";
}

export async function issuePasswordResetCode(userId: string, email: string): Promise<void> {
  const now = new Date();
  // Só o código mais recente vale.
  await supabase
    .from("passwordresettoken")
    .update({ usedAt: now.toISOString() })
    .eq("userId", userId)
    .is("usedAt", null);

  const code = generateResetCode();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabase.from("passwordresettoken").insert({
    id: randomUUID(),
    userId,
    tokenHash: hashResetCode(userId, code),
    expiresAt,
    usedAt: null,
    attempts: 0,
  });
  if (error) throw new Error(`reset code: ${error.message}`);

  await sendEmail({
    to: email,
    subject: "Seu código para criar uma nova senha",
    body:
      `Seu código é ${code}. Ele vale por ${RESET_TTL_MINUTES} minutos.\n\n` +
      "Se você não pediu para trocar a senha, ignore este e-mail.",
  });
}

export async function consumePasswordResetCode(userId: string, code: string): Promise<boolean> {
  const { data: record } = await supabase
    .from("passwordresettoken")
    .select("*")
    .eq("userId", userId)
    .is("usedAt", null)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!record) return false;

  const result = checkResetCode(record, code);
  if (result === "mismatch") {
    await supabase
      .from("passwordresettoken")
      .update({ attempts: record.attempts + 1 })
      .eq("id", record.id);
    return false;
  }
  if (result !== "ok") return false;

  await supabase
    .from("passwordresettoken")
    .update({ usedAt: new Date().toISOString() })
    .eq("id", record.id);
  return true;
}

export async function requireAuth(req: Request): Promise<AccessClaims | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifyAccessToken(header.slice("Bearer ".length).trim());
}

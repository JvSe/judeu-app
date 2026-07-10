import { createHash, randomBytes, randomInt } from "node:crypto";

import { env } from "@judeu/env/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "./db";

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 30;

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export type AccessClaims = {
  sub: string;
  role: string;
};

// ---- Senha ----
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---- Access token (JWT curto) ----
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

// ---- Refresh token (opaco, hash no banco, rotacionável) ----
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return raw;
}

// Rotaciona: valida o refresh atual, revoga, e emite um novo par.
export async function rotateRefreshToken(
  raw: string,
): Promise<{ userId: string; role: string; accessToken: string; refreshToken: string } | null> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = await signAccessToken({ sub: record.userId, role: record.user.role });
  const refreshToken = await issueRefreshToken(record.userId);
  return { userId: record.userId, role: record.user.role, accessToken, refreshToken };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken
    .updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}

// Derruba todas as sessões do usuário — usado após reset de senha (RF-A4), por segurança.
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---- Recuperação de senha (RF-A4): código de 6 dígitos, hash no banco, TTL curto ----
const RESET_TTL_MINUTES = 15;

function hashResetCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

// Gera um código de 6 dígitos e invalida códigos anteriores ainda não usados do
// mesmo usuário (evita acumular vários códigos válidos ao pedir de novo).
export async function issuePasswordResetCode(userId: string): Promise<string> {
  const code = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashResetCode(userId, code), expiresAt },
    }),
  ]);
  return code;
}

// Valida o código pro usuário; se válido, marca como usado (não pode ser reaproveitado).
export async function consumePasswordResetCode(userId: string, code: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetCode(userId, code) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return false;

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return true;
}

// Autoriza uma request pelo Bearer access token. Retorna claims ou null.
export async function requireAuth(req: Request): Promise<AccessClaims | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifyAccessToken(header.slice("Bearer ".length).trim());
}

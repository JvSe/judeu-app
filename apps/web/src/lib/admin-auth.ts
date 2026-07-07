import { timingSafeEqual } from "node:crypto";

import { env } from "@judeu/env/server";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Auth do painel admin (RF-H3): senha única compartilhada (ADMIN_PASSWORD),
// sem conta/role própria — sessão via cookie HttpOnly assinado (jose, mesma
// lib do JWT de auth do app). Escopo mínimo: só moderação de KYC por ora.
// ---------------------------------------------------------------------------

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL = "7d";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export function isAdminPasswordConfigured(): boolean {
  return !!env.ADMIN_PASSWORD;
}

export function checkAdminPassword(password: string): boolean {
  if (!env.ADMIN_PASSWORD) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(env.ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function signAdminSession(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret);
}

async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.admin === true;
  } catch {
    return false;
  }
}

// Pra usar em Server Components/Actions — lança se a sessão não for válida.
export async function requireAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  const valid = token ? await verifyAdminSession(token) : false;
  if (!valid) throw new Error("Sessão de admin inválida");
}

export async function hasAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminSession(token) : false;
}

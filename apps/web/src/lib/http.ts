import { env } from "@judeu/env/server";
import { NextResponse } from "next/server";

// CORS: o app nativo (Expo) chama a API de outra origem.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": env.CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  });
}

export function error(message: string, status = 400) {
  return json({ error: message }, { status });
}

// Resposta ao preflight OPTIONS.
export function handleOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Poolers — só tooling Prisma (db push). Runtime do app usa supabase-js.
    DATABASE_URL: z.string().min(1).optional(),
    DIRECT_URL: z.string().min(1).optional(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Auth custom (email/senha via API própria)
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),

    // Supabase (PostgREST + Storage via service role)
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // Busca por IA (Claude) — usada apenas no servidor
    ANTHROPIC_API_KEY: z.string().min(1).optional(),

    // Geo. Padrão = comportamento atual (OSRM + Nominatim). Ver apps/web/src/lib/geo.ts.
    ROUTING_PROVIDER: z.enum(["osrm", "valhalla", "google"]).default("osrm"),
    GEOCODING_PROVIDER: z.enum(["nominatim", "google"]).default("nominatim"),
    OSRM_URL: z.url().optional(),
    // Valhalla de verdade (apps/geo). Legado: com ROUTING_PROVIDER=osrm e sem
    // OSRM_URL, este valor continua sendo usado como base do OSRM (como antes).
    VALHALLA_URL: z.url().optional(),
    NOMINATIM_URL: z.url().optional(),
    GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),

    // Saque de quem atende. Só "simulated" por enquanto: registra e debita a
    // carteira sem transferir dinheiro. Um provedor real entra em lib/payouts.ts.
    PAYOUT_PROVIDER: z.enum(["simulated"]).default("simulated"),

    // Pagamentos (Stripe) — Pix/cartão/dinheiro, cobrado na conta da plataforma
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

    // Painel admin (web, RF-H3) — senha única compartilhada, sem conta/role por ora
    ADMIN_PASSWORD: z.string().min(8).optional(),

    // E-mail transacional (Resend). Sem chave, o mailer só escreve no log (dev).
    RESEND_API_KEY: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(3).optional(),

    // Job agendado (POST /api/cron/tick, disparado pelo pg_cron). Sem ela, o endpoint fica desligado.
    CRON_SECRET: z.string().min(32).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

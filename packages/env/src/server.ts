import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    // Conexão direta (session pooler) usada só por migrations/db push
    DIRECT_URL: z.string().min(1).optional(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Auth custom (email/senha via API própria)
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),

    // Supabase (Postgres via DATABASE_URL + Storage via service role)
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

    // Busca por IA (Claude) — usada apenas no servidor
    ANTHROPIC_API_KEY: z.string().min(1).optional(),

    // Serviços de geo self-hosted (Railway)
    VALHALLA_URL: z.url().optional(),
    NOMINATIM_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

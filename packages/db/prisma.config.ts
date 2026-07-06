import path from "node:path";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({
  path: "../../apps/web/.env",
});

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Migrations/db push usam a conexão direta (session pooler, porta 5432).
    // O runtime do app usa o DATABASE_URL (pooler de transação) via adapter-pg.
    url: env("DIRECT_URL"),
  },
});

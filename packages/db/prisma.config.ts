import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: "../../apps/web/.env",
});

// Migrations e db push usam a conexão direta (session pooler, porta 5432).
// O runtime do app usa o DATABASE_URL (pooler de transação) via adapter-pg.
// `prisma generate` não conecta no banco. No EAS Build e no CI essa variável
// não existe, e o postinstall ainda precisa gerar o client.
const directUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});

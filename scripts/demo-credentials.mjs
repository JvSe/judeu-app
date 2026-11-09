// Copia (SOMENTE LEITURA no banco) o hash de senha dos dois usuários do Modo Apresentação
// para apps/native/.env, ignorado pelo Git. Nunca imprime os hashes.
// Rode de novo se um deles trocar a senha e refaça o build.
// Uso (na raiz do repo): node scripts/demo-credentials.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  readFileSync(new URL("../apps/web/.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const VARS = {
  "9dcc79de-b284-4ef6-8953-c23f21a456c5": "EXPO_PUBLIC_DEMO_HASH_CLIENT",
  "f926a29f-a254-4aff-86c4-f53101971618": "EXPO_PUBLIC_DEMO_HASH_HELPER",
};

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: users, error } = await db.from("user").select("id,passwordHash").in("id", Object.keys(VARS));
if (error) throw new Error(`user: ${error.message}`);

const envUrl = new URL("../apps/native/.env", import.meta.url);
let lines = existsSync(envUrl) ? readFileSync(envUrl, "utf8").replace(/\n+$/, "").split("\n") : [];

for (const [id, name] of Object.entries(VARS)) {
  const hash = users.find((u) => u.id === id)?.passwordHash;
  if (!hash?.startsWith("$2")) throw new Error(`${name}: usuário sem hash bcrypt no banco.`);
  // O .env do Expo expande "$"; o app desfaz a troca (o alfabeto do bcrypt não tem "_").
  lines = lines.filter((l) => !l.startsWith(`${name}=`));
  lines.push(`${name}=${hash.replaceAll("$", "_")}`);
}

writeFileSync(envUrl, `${lines.join("\n")}\n`);
console.log("ok: hashes dos 2 usuários demo gravados em apps/native/.env");

// Snapshot (SOMENTE LEITURA) dos dois usuários do Modo Apresentação.
// Gera apps/native/lib/demo/fixtures.json — embarcado no app, sem rede em runtime.
// Uso (na raiz do repo): node scripts/demo-snapshot.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const CLIENT_ID = "9dcc79de-b284-4ef6-8953-c23f21a456c5";
const HELPER_ID = "f926a29f-a254-4aff-86c4-f53101971618";

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function rows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const users = await rows(
  db
    .from("user")
    .select("id,email,fullName,phone,role,avatarUrl,emailVerified,phoneVerified,gender,createdAt")
    .in("id", [CLIENT_ID, HELPER_ID]),
  "user",
);
const addresses = await rows(
  db
    .from("address")
    .select("id,userId,label,cep,street,number,complement,neighborhood,city,state,lat,lng,isDefault")
    .in("userId", [CLIENT_ID, HELPER_ID]),
  "address",
);
const profiles = await rows(
  db
    .from("providerprofile")
    .select("id,userId,headline,bio,yearsExperience,status,isHelper,ratingAvg,ratingCount,serviceRadiusKm,baseLat,baseLng")
    .in("userId", [CLIENT_ID, HELPER_ID]),
  "providerprofile",
);
const categories = await rows(
  db.from("category").select("id,slug,name,icon,riskLevel").order("name"),
  "category",
);

const byId = (id) => users.find((u) => u.id === id);
if (!byId(CLIENT_ID) || !byId(HELPER_ID)) {
  throw new Error("Algum dos dois usuários demo não existe no banco.");
}

const out = {
  snapshotAt: new Date().toISOString(),
  clientId: CLIENT_ID,
  helperId: HELPER_ID,
  users,
  addresses,
  profiles,
  categories,
};

mkdirSync(new URL("../apps/native/lib/demo/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../apps/native/lib/demo/fixtures.json", import.meta.url),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(
  `ok: ${users.length} usuários (${users.map((u) => u.email).join(", ")}), ` +
    `${addresses.length} endereços, ${profiles.length} perfis, ${categories.length} categorias`,
);

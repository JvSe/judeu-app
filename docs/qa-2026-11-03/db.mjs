// Helper de banco (dev) — usa supabase-js com service role, igual ao backend.
// Uso: node db.mjs <cmd> [args]
//   q <tabela> [json-filtro] [cols]       -> select (eq por cada chave do filtro)
//   count <tabela> [json-filtro]
//   update <tabela> <json-filtro> <json-set>
//   insert <tabela> <json-row|json-array>
//   del <tabela> <json-filtro>
//   raw                                   -> lê JSON de stdin: {table, op, filter, set, rows, select, limit, order}
import { createRequire } from "node:module";
const require = createRequire("/Users/jvsen/Desktop/jobs/projects/mobile/judeu/packages/db/package.json");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: "/Users/jvsen/Desktop/jobs/projects/mobile/judeu/apps/web/.env", quiet: true });
export const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const J = (s, d = {}) => (s ? JSON.parse(s) : d);
function applyFilter(qb, f) { for (const [k, v] of Object.entries(f)) { if (Array.isArray(v)) qb = qb.in(k, v); else if (v === null) qb = qb.is(k, null); else if (typeof v === "string" && v.startsWith("like:")) qb = qb.like(k, v.slice(5)); else qb = qb.eq(k, v); } return qb; }
export async function run(a) {
  const [cmd, t, x, y] = a;
  let r;
  if (cmd === "q") { let qb = sb.from(t).select(y || "*"); qb = applyFilter(qb, J(x)); r = await qb.limit(200); }
  else if (cmd === "count") { let qb = sb.from(t).select("id", { count: "exact", head: true }); qb = applyFilter(qb, J(x)); r = await qb; r = { count: r.count, error: r.error }; }
  else if (cmd === "update") { let qb = sb.from(t).update(J(y)); qb = applyFilter(qb, J(x)); r = await qb.select(); }
  else if (cmd === "insert") { r = await sb.from(t).insert(J(x)).select(); }
  else if (cmd === "del") { let qb = sb.from(t).delete(); qb = applyFilter(qb, J(x)); r = await qb.select("id"); }
  else if (cmd === "raw") { const p = JSON.parse(await new Promise(res => { let s = ""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => res(s)); }));
    let qb = sb.from(p.table); if (p.op === "insert") qb = qb.insert(p.rows).select(); else if (p.op === "update") { qb = applyFilter(qb.update(p.set), p.filter || {}).select(); } else if (p.op === "delete") { qb = applyFilter(qb.delete(), p.filter || {}).select("id"); } else { qb = applyFilter(qb.select(p.select || "*"), p.filter || {}); if (p.order) qb = qb.order(p.order.col, { ascending: !!p.order.asc }); qb = qb.limit(p.limit || 200); } r = await qb; }
  else { console.error("cmd desconhecido"); process.exit(2); }
  if (r.error) { console.error(JSON.stringify(r.error)); process.exit(1); }
  console.log(JSON.stringify(r.data ?? r, null, 1));
}
if (process.argv[1] && process.argv[1].endsWith("db.mjs")) run(process.argv.slice(2));

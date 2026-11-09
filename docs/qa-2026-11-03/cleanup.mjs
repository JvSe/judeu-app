// Remove TODOS os dados criados pelo QA de 2026-11-03 (usuários qa-20261103-*@teste.app e tudo ligado a eles).
// Uso: node cleanup.mjs --dry   (só conta)   |   node cleanup.mjs --yes (apaga)
import { sb } from "./db.mjs";
const yes = process.argv.includes("--yes");
const { data: users } = await sb.from("user").select("id,email").like("email", "qa-20261103-%");
const uids = users.map((u) => u.id);
const { data: profs } = await sb.from("providerprofile").select("id").in("userId", uids);
const pids = profs.map((p) => p.id);
const { data: ordersA } = await sb.from("order").select("id").in("clientId", uids);
const { data: ordersB } = pids.length ? await sb.from("order").select("id").in("providerId", pids) : { data: [] };
const oids = [...new Set([...ordersA, ...ordersB].map((o) => o.id))];
console.log({ users: uids.length, profiles: pids.length, orders: oids.length });
if (!yes) { console.log("dry-run; use --yes para apagar"); process.exit(0); }
const del = async (t, col, vals) => { if (!vals.length) return; const { error } = await sb.from(t).delete().in(col, vals); if (error) console.error(t, error.message); else console.log("ok", t); };
// pedidos (cascade: orderevent, orderproposal, message, review, payment, supportticket? -> supportticket.orderId não tem cascade)
await del("supportticket", "orderId", oids); await del("supportticket", "userId", uids);
await del("review", "orderId", oids); await del("message", "orderId", oids); await del("payment", "orderId", oids); await del("orderproposal", "orderId", oids); await del("orderevent", "orderId", oids);
await del("order", "id", oids);
await del("jobapplication", "applicantId", uids);
const { data: jobs } = pids.length ? await sb.from("jobposting").select("id").in("providerId", pids) : { data: [] };
await del("jobapplication", "jobPostingId", jobs.map((j) => j.id)); await del("jobshift", "jobPostingId", jobs.map((j) => j.id)); await del("jobposting", "id", jobs.map((j) => j.id));
const { data: wallets } = await sb.from("wallet").select("id").in("userId", uids);
await del("wallettransaction", "walletId", wallets.map((w) => w.id)); await del("wallet", "userId", uids);
await del("notification", "userId", uids); await del("address", "userId", uids);
await del("service", "providerId", pids); await del("providercategory", "providerId", pids); await del("providerprofile", "userId", uids);
await del("refreshtoken", "userId", uids); await del("passwordresettoken", "userId", uids);
await del("user", "id", uids);
console.log("limpeza concluída");

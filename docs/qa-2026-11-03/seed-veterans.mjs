// Seed das contas VETERANAS (rodada 2). Idempotente por e-mail: se já existir, aborta.
import { randomUUID } from "node:crypto";
import { sb } from "./db.mjs";
import fs from "node:fs";

const API = "http://localhost:3001";
const PW = "Qa@123456";
const CAT = { reparos: "11208bee-287f-4d21-982a-4ee1820ad8e5", limpeza: "d8594028-70d0-450a-a489-91676d7d33d8", frete: "42c0f0bb-57e5-48fd-8666-9a9cc378b48e", beleza: "9001aafe-bb5c-4e26-90f6-67525eda4c4a" };
const P = { lat: -10.2317, lng: -48.3242 };
const uuid = () => randomUUID();
const now = Date.now();
const DAY = 86400000, H = 3600000, MIN = 60000;
const ago = (days, hours = 0) => new Date(now - days * DAY - hours * H).toISOString();
const ahead = (days, hours = 0) => new Date(now + days * DAY + hours * H).toISOString();
const iso = (t) => new Date(t).toISOString();

async function api(method, path, body, token) {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}
async function ins(table, rows) {
  const arr = Array.isArray(rows) ? rows : [rows];
  if (!arr.length) return [];
  for (let i = 0; i < arr.length; i += 200) {
    const { error } = await sb.from(table).insert(arr.slice(i, i + 200));
    if (error) throw new Error(`insert ${table}: ${error.message}`);
  }
  return arr;
}
async function upd(table, filter, set) { let q = sb.from(table).update(set); for (const [k, v] of Object.entries(filter)) q = q.eq(k, v); const { error } = await q; if (error) throw new Error(`update ${table}: ${error.message}`); }

async function register(email, fullName, role, phone) {
  const { data: exists } = await sb.from("user").select("id").eq("email", email).maybeSingle();
  if (exists) throw new Error(`já existe: ${email} — apague antes (ou rode a limpeza)`);
  const r = await api("POST", "/api/auth/register", { fullName, email, password: PW, phone, role, acceptedTerms: true });
  return r;
}

// ---------- contas ----------
const out = { createdAt: new Date().toISOString(), accounts: {} };
const cli = await register("qa-20261103-vet-cliente@teste.app", "Valéria Veterana", "CLIENT", "63999991001");
const hlpReg = await register("qa-20261103-vet-helper@teste.app", "Hugo Helper Veterano", "CLIENT", "63999991002");
const hlp = await api("POST", "/api/providers/me/helper", { fullName: "Hugo Helper Veterano", phone: "63999991002", bio: "Ajudo com mudanças, montagem e pequenos consertos há meses.", acceptedTerms: true, lat: P.lat, lng: P.lng }, hlpReg.accessToken);
const prs = await register("qa-20261103-vet-prestador@teste.app", "Pedro Prestador Veterano", "PROVIDER", "63999991003");
const oc1 = await register("qa-20261103-vet-outro1@teste.app", "Olívia Outra Cliente", "CLIENT", "63999991004");
const oc2 = await register("qa-20261103-vet-outro2@teste.app", "Otávio Outro Cliente", "CLIENT", "63999991005");
const oh = await register("qa-20261103-vet-outrohelper@teste.app", "Helena Outra Helper", "CLIENT", "63999991006");
await api("POST", "/api/providers/me/helper", { fullName: "Helena Outra Helper", phone: "63999991006", acceptedTerms: true, lat: P.lat + 0.01, lng: P.lng }, oh.accessToken);

const CLI = cli.user.id, HLP = hlpReg.user.id, PRS = prs.user.id, OC1 = oc1.user.id, OC2 = oc2.user.id, OH = oh.user.id;
await upd("user", { id: CLI }, { createdAt: ago(240), updatedAt: ago(1) });
await upd("user", { id: HLP }, { createdAt: ago(230), updatedAt: ago(2) });
await upd("user", { id: PRS }, { createdAt: ago(260), updatedAt: ago(1) });

// perfis
const { data: prsProf } = await sb.from("providerprofile").select("id").eq("userId", PRS).single();
const { data: hlpProf } = await sb.from("providerprofile").select("id").eq("userId", HLP).single();
const { data: ohProf } = await sb.from("providerprofile").select("id").eq("userId", OH).single();
const PRS_P = prsProf.id, HLP_P = hlpProf.id, OH_P = ohProf.id;
await upd("providerprofile", { id: PRS_P }, { headline: "Eletricista e reparos em geral", bio: "Atendo Palmas e região há 8 meses pela plataforma. Instalações elétricas, hidráulica básica e montagem de móveis.", yearsExperience: 12, status: "APPROVED", isAvailable: true, allowsNegotiation: true, isCompany: true, companyName: "Pedro Reparos ME", responsibleName: "Pedro Prestador Veterano", hiringEmployees: true, ratingAvg: 4.6, ratingCount: 40, documentUrl: "qa/fake-kyc.jpg", baseLat: P.lat, baseLng: P.lng, serviceRadiusKm: 25, lastLat: P.lat, lastLng: P.lng, lastLocationAt: ago(0, 0.1), createdAt: ago(258), updatedAt: ago(0) });
await upd("providerprofile", { id: HLP_P }, { bio: "Ajudo com mudanças, montagem e pequenos consertos.", serviceRadiusKm: 25, ratingAvg: 4.8, ratingCount: 30, isAvailable: true, lastLat: P.lat + 0.004, lastLng: P.lng - 0.003, lastLocationAt: ago(3), createdAt: ago(228), updatedAt: ago(3) });
await ins("providercategory", [CAT.reparos, CAT.limpeza, CAT.frete].map((c) => ({ providerId: PRS_P, categoryId: c })));
const services = [["Troca de tomada", 8000, CAT.reparos], ["Instalação de chuveiro", 15000, CAT.reparos], ["Troca de disjuntor", 12000, CAT.reparos], ["Instalação de ventilador de teto", 18000, CAT.reparos], ["Diária de limpeza pós-obra", 22000, CAT.limpeza], ["Limpeza de caixa d'água", 25000, CAT.limpeza], ["Frete pequeno (até 1 m³)", 9000, CAT.frete], ["Mudança pequena", 35000, CAT.frete]].map(([name, priceCents, categoryId]) => ({ id: uuid(), providerId: PRS_P, categoryId, name, priceCents, createdAt: ago(250) }));
await ins("service", services);

// outros prestadores aprovados existentes (seed @teste.app) para variar o histórico do cliente
const { data: otherProv } = await sb.from("providerprofile").select("id,userId").eq("status", "APPROVED").eq("isHelper", false).neq("id", PRS_P).limit(6);
const { data: otherServices } = await sb.from("service").select("id,providerId,categoryId,priceCents").in("providerId", otherProv.map((p) => p.id));

// endereços
const mkAddr = (userId, label, street, number, nb, lat, lng, isDefault = false, days = 200) => ({ id: uuid(), userId, label, cep: "77020-000", street, number, complement: null, neighborhood: nb, city: "Palmas", state: "TO", lat, lng, isDefault, createdAt: ago(days) });
const cliAddrs = [mkAddr(CLI, "Casa", "Quadra 104 Sul, Alameda 7", "12", "Plano Diretor Sul", P.lat, P.lng, true, 238), mkAddr(CLI, "Trabalho", "Avenida JK, Quadra 103 Norte", "1500", "Plano Diretor Norte", P.lat - 0.02, P.lng + 0.01, false, 200), mkAddr(CLI, "Casa", "Rua 5, Setor Aureny III", null, "Aureny III", P.lat + 0.06, P.lng + 0.03, false, 150), mkAddr(CLI, "Mãe", "Quadra 1106 Sul, Alameda 2", "3", "Plano Diretor Sul", P.lat + 0.03, P.lng - 0.01, false, 90), mkAddr(CLI, null, "Avenida Teotônio Segurado", "890", "Centro", P.lat - 0.005, P.lng - 0.004, false, 30)];
const oc1Addr = mkAddr(OC1, "Casa", "Quadra 604 Norte", "5", "Plano Diretor Norte", P.lat - 0.03, P.lng + 0.02, true, 100);
const oc2Addr = mkAddr(OC2, "Casa", "Quadra 1004 Sul", "8", "Plano Diretor Sul", P.lat + 0.02, P.lng - 0.02, true, 100);
const farAddr = mkAddr(OC2, "Sítio", "Zona rural", null, "Taquaruçu", P.lat + 0.5, P.lng, false, 1);
const hlpAddr = mkAddr(HLP, "Casa", "Quadra 403 Sul", "20", "Plano Diretor Sul", P.lat + 0.004, P.lng - 0.003, true, 220);
const prsAddr = mkAddr(PRS, "Casa", "Quadra 306 Norte", "1", "Plano Diretor Norte", P.lat - 0.01, P.lng, true, 250);
await ins("address", [...cliAddrs, oc1Addr, oc2Addr, farAddr, hlpAddr, prsAddr]);

// ---------- pedidos ----------
const orders = [], events = [], payments = [], reviews = [], messages = [], notifs = [], proposals = [], walletTx = { [PRS]: [], [HLP]: [] };
const FEE = 0.08;
const flowTimes = { CREATED: 0, ACCEPTED: 5, EN_ROUTE: 15, IN_PROGRESS: 40, AWAITING_CONFIRMATION: 100, COMPLETED: 110, CANCELLED: 8 };
function mkOrder({ clientId, providerP, providerUserId, serviceId, categoryId, addressId, status, daysAgo, hoursAgo = 0, price, method = "CASH", payStatus, isOpen = false, description, scheduledAt = null, cancelReason = null, pickupAddressId = null, detailsReady, review, msgs = 0, unreadFor = null }) {
  const id = uuid(); const t0 = now - daysAgo * DAY - hoursAgo * H; const fee = Math.round(price * FEE);
  const seq = ["CREATED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION", "COMPLETED"];
  const idx = status === "CANCELLED" ? -1 : seq.indexOf(status);
  const o = { id, clientId, providerId: providerP, serviceId, categoryId, addressId, pickupAddressId, isOpenRequest: isOpen, detailsReady: detailsReady ?? !isOpen, description, status, scheduledAt, priceCents: price, platformFeeCents: fee, totalCents: price + fee, couponCode: null, cancelReason, acceptedAt: idx >= 1 ? iso(t0 + 5 * MIN) : null, completedAt: status === "COMPLETED" ? iso(t0 + 110 * MIN) : null, cancelledAt: status === "CANCELLED" ? iso(t0 + 8 * MIN) : null, providerLat: idx >= 2 ? P.lat : null, providerLng: idx >= 2 ? P.lng : null, providerLocationAt: idx >= 2 ? iso(t0 + 20 * MIN) : null, createdAt: iso(t0), updatedAt: iso(t0 + (status === "CANCELLED" ? 8 : 110) * MIN) };
  orders.push(o);
  const evs = status === "CANCELLED" ? ["CREATED", "CANCELLED"] : seq.slice(0, idx + 1);
  for (const s of evs) events.push({ id: uuid(), orderId: id, status: s, note: s === "CREATED" ? (isOpen ? "Solicitação publicada" : "Chamada enviada") : s === "CANCELLED" ? cancelReason : null, createdAt: iso(t0 + flowTimes[s] * MIN) });
  if (payStatus) payments.push({ id: uuid(), orderId: id, method, status: payStatus, amountCents: price + fee, gatewayRef: method === "CASH" ? null : `pi_qa_${id.slice(0, 8)}`, createdAt: iso(t0 + 6 * MIN), updatedAt: iso(t0 + 110 * MIN) });
  if (status === "COMPLETED" && providerUserId && (payStatus === "PAID") && walletTx[providerUserId]) walletTx[providerUserId].push({ id: uuid(), type: "CREDIT", amountCents: price, description: "Repasse de pedido concluído", orderId: id, createdAt: iso(t0 + 110 * MIN) });
  if (review && status === "COMPLETED") {
    if (review.byClient) reviews.push({ id: uuid(), orderId: id, authorId: clientId, targetId: providerUserId, rating: review.byClient.rating, comment: review.byClient.comment ?? null, createdAt: iso(t0 + 120 * MIN) });
    if (review.byProvider) reviews.push({ id: uuid(), orderId: id, authorId: providerUserId, targetId: clientId, rating: review.byProvider.rating, comment: review.byProvider.comment ?? null, createdAt: iso(t0 + 125 * MIN) });
  }
  for (let i = 0; i < msgs; i++) { const fromClient = i % 2 === 0; const sender = fromClient ? clientId : providerUserId; messages.push({ id: uuid(), orderId: id, senderId: sender, body: fromClient ? ["Oi, tudo bem? Pode vir hoje?", "O portão é o azul.", "Ok, obrigada!", "Consegue trazer a escada?"][i % 4] : ["Chego em 20 min.", "Combinado.", "Estou a caminho.", "Terminei, pode conferir."][i % 4], readAt: unreadFor && sender !== unreadFor ? null : iso(t0 + (30 + i) * MIN), createdAt: iso(t0 + (25 + i) * MIN) }); }
  return o;
}
const comments = ["Excelente profissional, resolveu rápido.", "Chegou atrasado mas fez um bom trabalho.", "Muito educado e caprichoso. Recomendo!", null, "Deixou sujeira, mas o serviço ficou bom.", "Perfeito.", "Cobrou a mais do combinado.", "Rápido e eficiente, voltaria a contratar sem pensar duas vezes. Explicou tudo o que estava fazendo e deixou o local limpo.", null, "Bom."];
let k = 0;
const pick = (arr) => arr[k++ % arr.length];

// Cliente veterana: 25 concluídos (mistura prestador veterano, outros prestadores e helper veterano em ajudas abertas)
for (let i = 0; i < 25; i++) {
  const d = 235 - i * 9; const useVet = i % 3 === 0; const useHelper = i % 5 === 4;
  if (useHelper) mkOrder({ clientId: CLI, providerP: HLP_P, providerUserId: HLP, serviceId: null, categoryId: null, addressId: cliAddrs[i % 5].id, status: "COMPLETED", daysAgo: d, price: 6000 + (i % 4) * 1500, method: ["CASH", "PIX", "CARD"][i % 3], payStatus: "PAID", isOpen: true, description: pick(["Preciso de ajuda para carregar um sofá até o 3º andar", "Montar um guarda-roupa de 6 portas", "Levar 10 caixas para o depósito", "Trocar o botijão e instalar o fogão"]), review: { byClient: { rating: 5 - (i % 2), comment: pick(comments) }, byProvider: { rating: 5 } }, msgs: 4 });
  else { const sv = useVet ? services[i % services.length] : otherServices[i % otherServices.length]; const pp = useVet ? { id: PRS_P, userId: PRS } : otherProv.find((p) => p.id === sv.providerId); mkOrder({ clientId: CLI, providerP: pp.id, providerUserId: pp.userId, serviceId: sv.id, categoryId: sv.categoryId, addressId: cliAddrs[i % 5].id, status: "COMPLETED", daysAgo: d, price: sv.priceCents, method: ["CASH", "PIX", "CARD"][i % 3], payStatus: "PAID", description: i % 2 ? pick(["Tomada da cozinha parou de funcionar", "Chuveiro novo, já comprei", "Disjuntor desarmando toda hora", null]) : null, review: { byClient: { rating: [5, 4, 5, 3, 5][i % 5], comment: pick(comments) }, byProvider: i % 2 ? { rating: 5, comment: "Cliente pontual." } : undefined }, msgs: i % 3 ? 2 : 0 }); }
}
// 8 cancelados
for (let i = 0; i < 8; i++) { const sv = services[i % services.length]; mkOrder({ clientId: CLI, providerP: PRS_P, providerUserId: PRS, serviceId: sv.id, categoryId: sv.categoryId, addressId: cliAddrs[i % 5].id, status: "CANCELLED", daysAgo: 200 - i * 20, price: sv.priceCents, method: i % 2 ? "CARD" : "CASH", payStatus: i % 2 ? "REFUNDED" : (i % 3 ? "PENDING" : null), cancelReason: i % 2 ? "Cancelado pelo cliente" : (i % 3 ? "Prestador recusou: sem agenda" : null) }); }
// ativos em status diferentes (prestador veterano ocupado com o ACCEPTED pago)
const sv0 = services[0], sv1 = services[1], sv2 = services[4];
const oAccepted = mkOrder({ clientId: CLI, providerP: PRS_P, providerUserId: PRS, serviceId: sv0.id, categoryId: sv0.categoryId, addressId: cliAddrs[0].id, status: "ACCEPTED", daysAgo: 0, hoursAgo: 2, price: sv0.priceCents, method: "PIX", payStatus: "PAID", msgs: 3, unreadFor: PRS });
const oEnRoute = mkOrder({ clientId: CLI, providerP: otherProv[0].id, providerUserId: otherProv[0].userId, serviceId: otherServices.find((s) => s.providerId === otherProv[0].id)?.id ?? null, categoryId: CAT.reparos, addressId: cliAddrs[1].id, status: "EN_ROUTE", daysAgo: 0, hoursAgo: 1, price: 12000, method: "CASH", payStatus: "PENDING", msgs: 6, unreadFor: otherProv[0].userId });
const oAwait = mkOrder({ clientId: CLI, providerP: HLP_P, providerUserId: HLP, serviceId: null, categoryId: null, addressId: cliAddrs[2].id, status: "AWAITING_CONFIRMATION", daysAgo: 0, hoursAgo: 5, price: 7000, method: "CASH", payStatus: "PENDING", isOpen: true, description: "Ajuda para descer móveis da mudança", msgs: 6, unreadFor: HLP });
const oCreatedDirect = mkOrder({ clientId: CLI, providerP: PRS_P, providerUserId: PRS, serviceId: sv1.id, categoryId: sv1.categoryId, addressId: cliAddrs[0].id, status: "CREATED", daysAgo: 0, hoursAgo: 0.2, price: sv1.priceCents, description: "Chuveiro queimou, urgente" });
const oCreatedOpen = mkOrder({ clientId: CLI, providerP: null, providerUserId: null, serviceId: null, categoryId: null, addressId: cliAddrs[3].id, status: "CREATED", daysAgo: 0, hoursAgo: 3.5, price: 5000, isOpen: true, description: "Preciso de alguém para montar uma cama box hoje à tarde" });
// agendados (futuro)
mkOrder({ clientId: CLI, providerP: PRS_P, providerUserId: PRS, serviceId: sv2.id, categoryId: sv2.categoryId, addressId: cliAddrs[1].id, status: "ACCEPTED", daysAgo: 1, price: sv2.priceCents, method: "PIX", payStatus: "PAID", scheduledAt: ahead(5, 3), description: "Limpeza pós-obra, apartamento 80 m²" });
mkOrder({ clientId: CLI, providerP: otherProv[1].id, providerUserId: otherProv[1].userId, serviceId: otherServices.find((s) => s.providerId === otherProv[1].id)?.id ?? null, categoryId: CAT.beleza, addressId: cliAddrs[0].id, status: "CREATED", daysAgo: 0, hoursAgo: 6, price: 9000, scheduledAt: ahead(7, 1), description: "Agendar para sábado de manhã" });

// Helper veterano: 30 ajudas atendidas (clientes outros) + 2 ativas extras
for (let i = 0; i < 30; i++) { const c = i % 2 ? OC1 : OC2; mkOrder({ clientId: c, providerP: HLP_P, providerUserId: HLP, serviceId: null, categoryId: null, addressId: i % 2 ? oc1Addr.id : oc2Addr.id, status: "COMPLETED", daysAgo: 225 - i * 7, price: 5000 + (i % 5) * 1000, method: ["CASH", "PIX", "CARD"][i % 3], payStatus: "PAID", isOpen: true, description: pick(["Carregar compras do mercado", "Montar estante", "Ajudar a trocar pneu", "Levar cachorro ao veterinário", "Organizar garagem"]), review: { byClient: { rating: [5, 5, 4, 5, 3][i % 5], comment: pick(comments) }, byProvider: { rating: 4 + (i % 2) } }, msgs: 2 }); }
mkOrder({ clientId: OC1, providerP: HLP_P, providerUserId: HLP, serviceId: null, categoryId: null, addressId: oc1Addr.id, status: "ACCEPTED", daysAgo: 0, hoursAgo: 1.5, price: 6000, isOpen: true, description: "Preciso de ajuda com uma geladeira", msgs: 3, unreadFor: HLP });
mkOrder({ clientId: OC2, providerP: HLP_P, providerUserId: HLP, serviceId: null, categoryId: null, addressId: oc2Addr.id, status: "EN_ROUTE", daysAgo: 0, hoursAgo: 0.5, price: 8000, method: "CASH", payStatus: "PENDING", isOpen: true, description: "Levar 5 caixas para o correio", msgs: 2, unreadFor: HLP });

// Prestador veterano: histórico com outros clientes (cliente veterana já gerou vários) + 2 chamadas pendentes de clientes diferentes
for (let i = 0; i < 28; i++) { const sv = services[i % services.length]; const c = i % 2 ? OC1 : OC2; mkOrder({ clientId: c, providerP: PRS_P, providerUserId: PRS, serviceId: sv.id, categoryId: sv.categoryId, addressId: i % 2 ? oc1Addr.id : oc2Addr.id, status: i % 7 === 6 ? "CANCELLED" : "COMPLETED", daysAgo: 250 - i * 8, price: sv.priceCents, method: ["CASH", "PIX", "CARD"][i % 3], payStatus: i % 7 === 6 ? "REFUNDED" : "PAID", cancelReason: i % 7 === 6 ? "Cancelado pelo cliente" : null, review: { byClient: { rating: [5, 4, 5, 5, 3, 4, 2][i % 7], comment: pick(comments) }, byProvider: { rating: 5 } }, msgs: i % 2 ? 2 : 0 }); }
mkOrder({ clientId: OC1, providerP: PRS_P, providerUserId: PRS, serviceId: services[2].id, categoryId: CAT.reparos, addressId: oc1Addr.id, status: "CREATED", daysAgo: 0, hoursAgo: 0.1, price: services[2].priceCents, description: "Disjuntor geral desarmando" });
mkOrder({ clientId: OC2, providerP: PRS_P, providerUserId: PRS, serviceId: services[6].id, categoryId: CAT.frete, addressId: oc2Addr.id, status: "CREATED", daysAgo: 0, hoursAgo: 0.05, price: services[6].priceCents, description: "Frete de uma geladeira pequena" });

await ins("order", orders); await ins("orderevent", events); await ins("payment", payments); await ins("review", reviews); await ins("message", messages);

// propostas antigas (cliente veterana x prestador veterano) num pedido concluído
const negOrder = orders.find((o) => o.clientId === CLI && o.providerId === PRS_P && o.status === "COMPLETED");
proposals.push({ id: uuid(), orderId: negOrder.id, byRole: "provider", priceCents: negOrder.priceCents + 2000, note: "Material incluso", status: "SUPERSEDED", createdAt: iso(Date.parse(negOrder.createdAt) + 2 * MIN), respondedAt: null, clientAcceptedAt: null, providerAcceptedAt: null });
proposals.push({ id: uuid(), orderId: negOrder.id, byRole: "client", priceCents: negOrder.priceCents - 1000, note: "Consigo esse valor?", status: "REJECTED", createdAt: iso(Date.parse(negOrder.createdAt) + 3 * MIN), respondedAt: iso(Date.parse(negOrder.createdAt) + 4 * MIN), clientAcceptedAt: null, providerAcceptedAt: null });
proposals.push({ id: uuid(), orderId: negOrder.id, byRole: "provider", priceCents: negOrder.priceCents, note: null, status: "ACCEPTED", createdAt: iso(Date.parse(negOrder.createdAt) + 4.5 * MIN), respondedAt: iso(Date.parse(negOrder.createdAt) + 5 * MIN), clientAcceptedAt: null, providerAcceptedAt: null });
await ins("orderproposal", proposals);

// carteiras
for (const [userId, txs] of Object.entries(walletTx)) {
  const wid = uuid(); const debits = [{ id: uuid(), type: "DEBIT", amountCents: 20000, description: "Saque solicitado", orderId: null, createdAt: ago(120) }, { id: uuid(), type: "DEBIT", amountCents: 15000, description: "Saque solicitado", orderId: null, createdAt: ago(40) }];
  const all = [...txs, ...debits].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const bal = all.reduce((s, t) => s + (t.type === "CREDIT" ? t.amountCents : -t.amountCents), 0);
  await ins("wallet", { id: wid, userId, balanceCents: bal, updatedAt: ago(0) });
  await ins("wallettransaction", all.map((t) => ({ ...t, walletId: wid })));
}

// chamados do cliente
const tk = (status, days, cat, subject, message, orderId = null, adminResponse = null) => ({ id: uuid(), userId: CLI, orderId, category: cat, subject, message, status, adminResponse, resolvedAt: status === "RESOLVED" ? ago(days - 1) : null, createdAt: ago(days), updatedAt: ago(days - 1) });
const cancelledOrder = orders.find((o) => o.clientId === CLI && o.status === "CANCELLED");
await ins("supportticket", [tk("RESOLVED", 150, "PAYMENT", "Cobrança duplicada no cartão", "Fui cobrada duas vezes pelo pedido da semana passada, podem verificar?", null, "Olá! Verificamos e a segunda cobrança era uma pré-autorização que já foi estornada pelo banco. Qualquer dúvida, estamos à disposição."), tk("RESOLVED", 60, "DISPUTE", "Serviço incompleto", "O prestador não terminou a instalação e foi embora.", cancelledOrder?.id ?? null, "Entramos em contato com o prestador e o valor foi estornado."), tk("IN_PROGRESS", 3, "ACCOUNT", "Não consigo trocar meu e-mail", "Quero mudar o e-mail de login mas não encontro a opção no app."), tk("OPEN", 0.5, "OTHER", "Sugestão: filtro por data", "Seria ótimo filtrar as chamadas antigas por mês.")]);

// notificações (cliente: ~80; helper e prestador: ~40 cada)
function notifFor(userId, i, daysAgo, role) {
  const types = ["ORDER", "ORDER", "MESSAGE", "ORDER", "SUPPORT"]; const t = types[i % types.length];
  const o = orders.filter((x) => (role === "client" ? x.clientId === userId : x.providerId === (userId === PRS ? PRS_P : HLP_P)))[i % 20];
  const titles = { ORDER: ["Chamada aceita", "A caminho", "Serviço concluído", "Nova chamada", "Chamada cancelada"][i % 5], MESSAGE: "Nova mensagem", SUPPORT: "Resposta do suporte" };
  return { id: uuid(), userId, type: t, title: titles[t], body: t === "MESSAGE" ? "Chego em 20 min." : t === "SUPPORT" ? "Seu chamado foi respondido." : "Toque para ver os detalhes.", data: t === "SUPPORT" ? { type: "support", ticketId: null, role } : { type: t === "MESSAGE" ? "chat" : "order", orderId: o?.id ?? null, role }, readAt: i < 30 ? null : ago(daysAgo - 0.1), createdAt: ago(daysAgo) };
}
for (let i = 0; i < 80; i++) notifs.push(notifFor(CLI, i, i < 5 ? i * 0.1 : i * 2.5, "client"));
for (let i = 0; i < 40; i++) notifs.push(notifFor(HLP, i, i * 5, "provider"));
for (let i = 0; i < 40; i++) notifs.push(notifFor(PRS, i, i * 6, "provider"));
await ins("notification", notifs);

// vagas da empresa (prestador veterano é empresa)
const job1 = { id: uuid(), providerId: PRS_P, categoryId: CAT.reparos, title: "Ajudante de eletricista", description: "Auxiliar em instalações residenciais. Precisa ter NR-10 básica ou disposição para fazer.", contractType: "CLT", salaryCents: 220000, status: "OPEN", createdAt: ago(20), updatedAt: ago(20) };
const job2 = { id: uuid(), providerId: PRS_P, categoryId: CAT.limpeza, title: "Auxiliar de limpeza pós-obra", description: "Trabalho temporário por 2 meses em obra no Plano Diretor Norte.", contractType: "TEMPORARY", salaryCents: null, status: "CLOSED", createdAt: ago(90), updatedAt: ago(30) };
await ins("jobposting", [job1, job2]);
await ins("jobshift", [["MONDAY", "08:00", "17:00"], ["TUESDAY", "08:00", "17:00"], ["WEDNESDAY", "08:00", "17:00"], ["THURSDAY", "08:00", "17:00"], ["FRIDAY", "08:00", "16:00"]].map(([weekday, startTime, endTime]) => ({ id: uuid(), jobPostingId: job1.id, weekday, startTime, endTime })).concat([{ id: uuid(), jobPostingId: job2.id, weekday: "SATURDAY", startTime: "07:00", endTime: "13:00" }]));
// 12 candidaturas: usuários descartáveis
const applicants = [];
for (let i = 0; i < 12; i++) { const r = await register(`qa-20261103-vet-cand${i}@teste.app`, `Candidato ${i + 1} QA`, "CLIENT", `6399999200${i}`.slice(0, 11)); applicants.push(r.user.id); }
await ins("jobapplication", applicants.map((aid, i) => ({ id: uuid(), jobPostingId: job1.id, applicantId: aid, message: i % 3 ? `Tenho ${i + 1} anos de experiência na área e disponibilidade imediata.` : null, status: ["PENDING", "ACCEPTED", "REJECTED", "PENDING"][i % 4], createdAt: ago(18 - i), respondedAt: i % 4 === 1 || i % 4 === 2 ? ago(17 - i) : null })));
await ins("jobapplication", [{ id: uuid(), jobPostingId: job2.id, applicantId: HLP, message: "Posso começar amanhã.", status: "REJECTED", createdAt: ago(80), respondedAt: ago(70) }]);

out.accounts = { cliente: { email: "qa-20261103-vet-cliente@teste.app", userId: CLI, refreshToken: cli.refreshToken }, helper: { email: "qa-20261103-vet-helper@teste.app", userId: HLP, providerProfileId: HLP_P, refreshToken: hlp.refreshToken }, prestador: { email: "qa-20261103-vet-prestador@teste.app", userId: PRS, providerProfileId: PRS_P, refreshToken: prs.refreshToken, serviceIds: services.map((s) => s.id), jobIds: [job1.id, job2.id] }, outros: { oc1: OC1, oc2: OC2, outroHelper: OH, outroHelperProfile: OH_P, candidatos: applicants }, password: PW, counts: { orders: orders.length, events: events.length, payments: payments.length, reviews: reviews.length, messages: messages.length, notifications: notifs.length, proposals: proposals.length } };
fs.writeFileSync(new URL("./veterans.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.accounts.prestador.serviceIds.length ? { ok: true, counts: out.accounts.counts, CLI, HLP, PRS } : out, null, 1));

// Modo Apresentação: simula os DOIS aparelhos (duas instâncias isoladas do backend
// local) trocando eventos como o Multipeer faria, e percorre o fluxo perfeito inteiro.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  // bcrypt de "senha-demo-teste", no formato gravado no .env.
  const hash = "_2a_04_kIiAcASC89963Vg98WiYf.uaRBt1hs86kGQ1H4pbrUei7B2hInKu6";
  process.env.EXPO_PUBLIC_DEMO_HASH_CLIENT = hash;
  process.env.EXPO_PUBLIC_DEMO_HASH_HELPER = hash;
});
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/lib/device-id", () => ({ getDeviceId: async () => null }));
vi.mock("@/lib/tokens", () => ({
  getTokens: async () => null,
  saveTokens: async () => undefined,
  clearTokens: async () => undefined,
}));
vi.mock("expo-file-system", () => ({
  File: class {
    constructor() {
      throw new Error("sem disco no teste");
    }
  },
  Paths: { document: "/tmp" },
}));

type Device = {
  call: <T = any>(method: string, path: string, body?: unknown) => Promise<T>;
  store: typeof import("./store");
  script: typeof import("./script");
};

async function bootDevice(email: string): Promise<Device> {
  vi.resetModules();
  const routes = await import("./routes");
  const store = await import("./store");
  const script = await import("./script");
  const call = async <T,>(method: string, path: string, body?: unknown) => {
    const res = await routes.demoHandle(path, { method, body });
    if (!res) throw new Error(`não tratado pela demo: ${method} ${path}`);
    return res.value as T;
  };
  await call("POST", "/api/auth/login", { email, password: "senha-demo-teste" });
  return { call, store, script };
}

/** Multipeer simulado: cada lado manda o que tem e o outro junta. */
function sync(a: Device, b: Device) {
  const sa = a.store.getState();
  const sb = b.store.getState();
  b.store.mergeRemote(sa.epoch, sa.events);
  a.store.mergeRemote(sb.epoch, sb.events);
}

async function fixtureEmails() {
  const fx = (await import("./fixtures.json")).default as {
    clientId: string;
    helperId: string;
    users: { id: string; email: string }[];
  };
  const email = (id: string) => fx.users.find((u) => u.id === id)!.email;
  return { client: email(fx.clientId), helper: email(fx.helperId), clientId: fx.clientId, helperId: fx.helperId };
}

let now = Date.UTC(2026, 10, 9, 15, 0, 0);
const advance = (ms: number) => {
  now += ms;
  vi.setSystemTime(now);
};

beforeEach(() => {
  // Só o relógio: o bcrypt precisa do setImmediate de verdade.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("modo apresentação — fluxo perfeito entre dois aparelhos", () => {
  it("cliente pede, ajudante aceita, paga, atende, conclui e os dois avaliam", async () => {
    const ids = await fixtureEmails();
    const ipad = await bootDevice(ids.helper);
    const iphone = await bootDevice(ids.client);

    // Ajudante liga o modo atender ANTES de o iPhone conectar — não pode se perder.
    await ipad.call("POST", "/api/providers/me/availability", { isAvailable: true });
    advance(1000);

    const { order: created } = await iphone.call("POST", "/api/orders", {
      description: "Montar uma estante",
      priceCents: 8000,
      couponCode: "bemvindo",
      useCredits: true,
    });
    expect(created.status).toBe("CREATED");
    expect(created.isOpenRequest).toBe(true);
    expect(created.discountCents).toBe(800 + 1000);
    expect(created.totalCents).toBe(8000 - 1800);

    sync(iphone, ipad);
    expect(ipad.store.getState().helperAvailable).toBe(true);
    expect(iphone.store.getState().helperAvailable).toBe(true);

    const { profile } = await ipad.call("GET", "/api/providers/me");
    expect(profile.status).toBe("APPROVED");
    expect(profile.isAvailable).toBe(true);
    const { profile: clientProfile } = await iphone.call("GET", "/api/providers/me");
    expect(clientProfile).toBeNull();

    const { orders: incoming } = await ipad.call("GET", "/api/orders?as=provider");
    expect(incoming.map((o: { id: string }) => o.id)).toEqual([created.id]);

    // Cliente não pode aceitar o próprio pedido.
    await expect(iphone.call("POST", `/api/orders/${created.id}/transition`, { action: "accept" })).rejects.toThrow();

    advance(4000);
    await ipad.call("POST", `/api/orders/${created.id}/transition`, { action: "accept" });
    sync(iphone, ipad);
    const { order: accepted } = await iphone.call("GET", `/api/orders/${created.id}`);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.provider).not.toBeNull();
    expect(accepted.client.id).toBe(ids.clientId);

    const notes = await iphone.call("GET", "/api/notifications");
    expect(notes.notifications[0].data).toMatchObject({ type: "chat", orderId: created.id });

    advance(2000);
    await iphone.call("POST", `/api/orders/${created.id}/messages`, { body: "Oi! O portão é o azul." });
    sync(iphone, ipad);
    const { messages } = await ipad.call("GET", `/api/orders/${created.id}/messages`);
    expect(messages).toHaveLength(1);
    expect(messages[0].senderId).toBe(ids.clientId);

    // Sem pagamento o trajeto não libera.
    await expect(
      ipad.call("POST", `/api/orders/${created.id}/transition`, { action: "start_route" }),
    ).rejects.toThrow(/pagamento/i);

    advance(2000);
    const pay = await iphone.call("POST", `/api/orders/${created.id}/payment`, { method: "CARD" });
    expect(pay.payment.status).toBe("PAID");
    sync(iphone, ipad);

    advance(2000);
    await ipad.call("POST", `/api/orders/${created.id}/transition`, { action: "start_route" });
    sync(iphone, ipad);
    const { order: enRoute } = await iphone.call("GET", `/api/orders/${created.id}`);
    expect(enRoute.status).toBe("EN_ROUTE");
    expect(enRoute.tracking.arrived).toBe(false);
    expect(enRoute.tracking.etaMin).toBeGreaterThan(0);
    expect(enRoute.tracking.route.length).toBeGreaterThan(1);

    advance(10_000);
    const { order: midway } = await iphone.call("GET", `/api/orders/${created.id}`);
    expect(midway.tracking.distanceKm).toBeLessThan(enRoute.tracking.distanceKm);

    advance(20_000);
    const { order: arrived } = await ipad.call("GET", `/api/orders/${created.id}`);
    expect(arrived.tracking.arrived).toBe(true);

    const door = await iphone.call("GET", `/api/orders/${created.id}/door-code`);
    expect(door.code).toMatch(/^\d{4}$/);

    await ipad.call("POST", `/api/orders/${created.id}/transition`, { action: "start_work", doorCode: door.code });
    advance(5000);
    await ipad.call("POST", `/api/orders/${created.id}/transition`, { action: "complete" });
    sync(iphone, ipad);

    advance(3000);
    await iphone.call("POST", `/api/orders/${created.id}/transition`, { action: "confirm_completion" });
    sync(iphone, ipad);
    const { order: done } = await ipad.call("GET", `/api/orders/${created.id}`);
    expect(done.status).toBe("COMPLETED");
    expect(done.events.map((e: { status: string }) => e.status)).toEqual([
      "CREATED",
      "ACCEPTED",
      "EN_ROUTE",
      "IN_PROGRESS",
      "AWAITING_CONFIRMATION",
      "COMPLETED",
    ]);

    await iphone.call("POST", `/api/orders/${created.id}/review`, { rating: 5, comment: "Excelente" });
    await ipad.call("POST", `/api/orders/${created.id}/review`, { rating: 5 });
    sync(iphone, ipad);
    expect((await iphone.call("GET", `/api/orders/${created.id}/review`)).review.rating).toBe(5);

    const { wallet } = await ipad.call("GET", "/api/wallet");
    expect(wallet.balanceCents).toBe(8000 - 1600);

    // Os dois aparelhos terminam com exatamente o mesmo histórico.
    expect(ipad.store.getState().events.map((e) => e.id)).toEqual(
      iphone.store.getState().events.map((e) => e.id),
    );

    // O som de pedido novo é só do ajudante, e só na chegada do pedido.
    type Note = { title: string; data: { alert?: string } | null };
    const alerts = (list: Note[]) => list.filter((n) => n.data?.alert === "incoming_help").map((n) => n.title);
    const helperNotes = await ipad.call<{ notifications: Note[] }>("GET", "/api/notifications");
    const clientNotes = await iphone.call<{ notifications: Note[] }>("GET", "/api/notifications");
    expect(alerts(helperNotes.notifications)).toEqual(["Nova ajuda perto de você"]);
    expect(helperNotes.notifications.length).toBeGreaterThan(1);
    expect(alerts(clientNotes.notifications)).toEqual([]);
    expect(clientNotes.notifications.length).toBeGreaterThan(0);
  });

  it("zerar a rodada num aparelho zera o outro na próxima sincronização", async () => {
    const ids = await fixtureEmails();
    const ipad = await bootDevice(ids.helper);
    const iphone = await bootDevice(ids.client);
    await iphone.call("POST", "/api/orders", { description: "Trocar lâmpada", priceCents: 3000 });
    sync(iphone, ipad);
    expect(Object.keys(ipad.store.getState().orders)).toHaveLength(1);

    advance(1000);
    iphone.store.resetStore(now);
    sync(iphone, ipad);
    expect(Object.keys(ipad.store.getState().orders)).toHaveLength(0);
    expect(ipad.store.getState().epoch).toBe(now);
  });

  it("modo roteiro: sozinho, o iPhone vê a ajuda ser aceita e atendida até o fim", async () => {
    const ids = await fixtureEmails();
    const iphone = await bootDevice(ids.client);
    const { order } = await iphone.call("POST", "/api/orders", { description: "Carregar caixas", priceCents: 6000 });
    const tick = (ms: number) => {
      advance(ms);
      iphone.script.runScriptTick(ids.clientId, now);
    };
    const status = async () => (await iphone.call("GET", `/api/orders/${order.id}`)).order.status;

    tick(6000);
    expect(await status()).toBe("ACCEPTED");
    tick(3000);
    expect((await iphone.call("GET", `/api/orders/${order.id}/messages`)).messages).toHaveLength(1);

    await iphone.call("POST", `/api/orders/${order.id}/payment`, { method: "CASH" });
    tick(3500);
    expect(await status()).toBe("EN_ROUTE");
    tick(30_000);
    expect(await status()).toBe("IN_PROGRESS");
    tick(13_000);
    expect(await status()).toBe("AWAITING_CONFIRMATION");
    await iphone.call("POST", `/api/orders/${order.id}/transition`, { action: "confirm_completion" });
    tick(5000);
    const { order: final } = await iphone.call("GET", `/api/orders/${order.id}`);
    expect(final.status).toBe("COMPLETED");
    expect(final.payment.status).toBe("PAID");
  });

  it("modo roteiro: sozinho, o iPad recebe um pedido ao ligar o modo atender", async () => {
    const ids = await fixtureEmails();
    const ipad = await bootDevice(ids.helper);
    await ipad.call("POST", "/api/providers/me/availability", { isAvailable: true });
    advance(5000);
    ipad.script.runScriptTick(ids.helperId, now);
    const { orders } = await ipad.call("GET", "/api/orders?as=provider");
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("CREATED");

    await ipad.call("POST", `/api/orders/${orders[0].id}/transition`, { action: "accept" });
    advance(3000);
    ipad.script.runScriptTick(ids.helperId, now);
    advance(3500);
    ipad.script.runScriptTick(ids.helperId, now);
    const { order } = await ipad.call("GET", `/api/orders/${orders[0].id}`);
    expect(order.payment?.status).toBe("PAID");
  });

  it("usuário fora da demo segue para a API real", async () => {
    vi.resetModules();
    const routes = await import("./routes");
    expect(await routes.demoHandle("/api/auth/login", { method: "POST", body: { email: "outra@pessoa.com" } })).toBeNull();
    expect(await routes.demoHandle("/api/orders", { method: "GET" })).toBeNull();
  });

  it("e-mail demo com senha errada não entra na demo e segue para a API real", async () => {
    const { helper } = await fixtureEmails();
    vi.resetModules();
    const routes = await import("./routes");
    const login = (password?: string) =>
      routes.demoHandle("/api/auth/login", { method: "POST", body: { email: helper, password } });
    expect(await login("senha-errada")).toBeNull();
    expect(await login(undefined)).toBeNull();
    expect(await routes.demoHandle("/api/orders", { method: "GET" })).toBeNull();
    expect(await login("senha-demo-teste")).not.toBeNull();
  });

  it("sem o hash copiado da conta, ninguém entra na demo", async () => {
    const { helper } = await fixtureEmails();
    vi.stubEnv("EXPO_PUBLIC_DEMO_HASH_HELPER", "");
    vi.resetModules();
    const routes = await import("./routes");
    const res = await routes.demoHandle("/api/auth/login", {
      method: "POST",
      body: { email: helper, password: "senha-demo-teste" },
    });
    vi.unstubAllEnvs();
    expect(res).toBeNull();
  });
});

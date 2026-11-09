// Liga o estado da demo ao outro aparelho (Multipeer), dispara os banners de
// notificação e roda o modo roteiro quando não há par conectado.
import { AppState } from "react-native";
import notifee from "react-native-notify-kit";

import {
  demoPeerAvailable,
  onPeerMessage,
  onPeerState,
  sendToPeer,
  startPeer,
  stopPeer,
  type PeerStateEvent,
} from "@/modules/demo-peer";
import { INCOMING_HELP_CHANNEL, INCOMING_HELP_SOUND_FILE, isIncomingHelp } from "@/lib/push";

import { DEMO_HELPER_ID, firstName } from "./fixtures";
import { runScriptTick } from "./script";
import { onDemoSession } from "./session";
import { getState, loadPersisted, mergeRemote, resetStore, subscribe, type DemoEvent } from "./store";
import { notificationFor } from "./views";

/** Sem par por este tempo → o próprio aparelho simula o outro lado. */
const SCRIPT_AFTER_MS = 5000;
const TICK_MS = 1000;

type WireMessage =
  | { kind: "snapshot"; epoch: number; events: DemoEvent[] }
  | { kind: "events"; epoch: number; events: DemoEvent[] }
  | { kind: "reset"; epoch: number };

export type DemoStatus = {
  active: boolean;
  userId: string | null;
  peerAvailable: boolean;
  peerState: PeerStateEvent["state"] | "off";
  peerName: string | null;
  scriptActive: boolean;
  forceScript: boolean;
  eventCount: number;
  epoch: number;
};

let me: string | null = null;
let peerState: DemoStatus["peerState"] = "off";
let peerName: string | null = null;
let disconnectedSince = Date.now();
let forceScript = false;
let tick: ReturnType<typeof setInterval> | null = null;
let teardown: (() => void)[] = [];
let lastPeerRestart = 0;
let displayName = "";

const statusListeners = new Set<(s: DemoStatus) => void>();
const refreshListeners = new Set<() => void>();

export function demoStatus(): DemoStatus {
  const state = getState();
  return {
    active: me != null,
    userId: me,
    peerAvailable: demoPeerAvailable,
    peerState,
    peerName,
    scriptActive: scriptActive(Date.now()),
    forceScript,
    eventCount: state.events.length,
    epoch: state.epoch,
  };
}

export function onDemoStatus(fn: (s: DemoStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

/** Chamado a cada mudança do estado da demo (e durante o trajeto) — a UI refaz as queries. */
export function onDemoRefresh(fn: () => void): () => void {
  refreshListeners.add(fn);
  return () => refreshListeners.delete(fn);
}

function publishStatus() {
  const s = demoStatus();
  for (const fn of statusListeners) fn(s);
}

function refreshUi() {
  for (const fn of refreshListeners) fn();
}

function scriptActive(now: number): boolean {
  if (me == null) return false;
  if (forceScript) return true;
  return peerState !== "connected" && now - disconnectedSince >= SCRIPT_AFTER_MS;
}

function send(msg: WireMessage) {
  if (peerState !== "connected") return;
  sendToPeer(JSON.stringify(msg));
}

function showBanners(events: DemoEvent[]) {
  if (!me) return;
  const state = getState();
  const now = Date.now();
  for (const ev of events) {
    if (ev.actor === me || now - ev.at > 60_000) continue;
    const n = notificationFor(state, ev, me);
    if (!n) continue;
    const incomingHelp = isIncomingHelp(n.data);
    void notifee
      .displayNotification({
        id: n.id,
        title: n.title,
        body: n.body,
        data: (n.data ?? undefined) as Record<string, string> | undefined,
        android: { channelId: incomingHelp ? INCOMING_HELP_CHANNEL : "default", pressAction: { id: "default" } },
        ios: {
          sound: incomingHelp ? INCOMING_HELP_SOUND_FILE : "default",
          foregroundPresentationOptions: { banner: true, list: true, sound: true, badge: false },
        },
      })
      .catch(() => undefined);
  }
}

function handleWire(json: string) {
  let msg: WireMessage;
  try {
    msg = JSON.parse(json) as WireMessage;
  } catch {
    return;
  }
  const local = getState().epoch;
  if (msg.kind === "reset") {
    if (msg.epoch > local) resetStore(msg.epoch);
    return;
  }
  if (msg.epoch < local) {
    // O outro aparelho está numa rodada antiga (não viu o reset): manda a nossa.
    send({ kind: "snapshot", epoch: local, events: getState().events });
    return;
  }
  mergeRemote(msg.epoch, msg.events);
}

function restartPeer() {
  if (!demoPeerAvailable || !me) return;
  lastPeerRestart = Date.now();
  startPeer(displayName);
}

function onTick() {
  if (!me) return;
  const now = Date.now();
  if (scriptActive(now)) runScriptTick(me, now);
  // Ajudante a caminho: o pin anda e o ETA cai — atualiza as telas.
  if (Object.values(getState().orders).some((o) => o.status === "EN_ROUTE")) refreshUi();
  // Sem par há um tempo: reanuncia (o outro aparelho pode ter reaberto o app).
  if (peerState !== "connected" && peerState !== "connecting" && now - lastPeerRestart > 15_000) restartPeer();
  publishStatus();
}

function start(userId: string) {
  stop();
  me = userId;
  loadPersisted();
  disconnectedSince = Date.now();
  displayName = `${firstName(userId) || "demo"}-${userId === DEMO_HELPER_ID ? "ajudante" : "cliente"}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  teardown.push(
    subscribe((change) => {
      if (change.source === "local") {
        send({ kind: "events", epoch: getState().epoch, events: change.added });
        if (change.added.some((e) => e.scripted)) showBanners(change.added);
      }
      if (change.source === "peer") showBanners(change.added);
      refreshUi();
      publishStatus();
    }),
    onPeerState((e) => {
      const wasConnected = peerState === "connected";
      peerState = e.state === "connected" || e.connected > 0 ? "connected" : e.state;
      peerName = peerState === "connected" ? e.peer || peerName : null;
      if (peerState === "connected" && !wasConnected) {
        send({ kind: "snapshot", epoch: getState().epoch, events: getState().events });
      }
      if (peerState !== "connected" && wasConnected) disconnectedSince = Date.now();
      publishStatus();
    }),
    onPeerMessage((e) => handleWire(e.json)),
  );

  const appState = AppState.addEventListener("change", (s) => {
    if (s === "active" && peerState !== "connected") restartPeer();
  });
  teardown.push(() => appState.remove());

  peerState = demoPeerAvailable ? "searching" : "off";
  restartPeer();
  tick = setInterval(onTick, TICK_MS);
  publishStatus();
}

function stop() {
  if (tick) clearInterval(tick);
  tick = null;
  for (const fn of teardown) fn();
  teardown = [];
  if (me) stopPeer();
  me = null;
  peerState = "off";
  peerName = null;
  publishStatus();
}

// ---- Controles do apresentador ----

/** Zera a rodada nos dois aparelhos (o outro adota a época nova). */
export function demoReset(): void {
  const epoch = Date.now();
  resetStore(epoch);
  send({ kind: "reset", epoch });
  disconnectedSince = Date.now();
  publishStatus();
}

export function setForceScript(on: boolean): void {
  forceScript = on;
  publishStatus();
}

export function reconnectPeer(): void {
  restartPeer();
  publishStatus();
}

// Liga/desliga junto com a sessão demo (login/logout de um dos dois usuários).
onDemoSession((userId) => {
  if (userId) start(userId);
  else stop();
});

import { requireOptionalNativeModule, type EventSubscription } from "expo";

export type PeerStateEvent = {
  state: "searching" | "connecting" | "connected" | "disconnected" | "error";
  peer: string;
  connected: number;
  message?: string;
};

export type PeerMessageEvent = { json: string; peer: string };

type DemoPeerNative = {
  start(displayName: string): void;
  stop(): void;
  send(json: string): boolean;
  connectedCount(): number;
  addListener(event: "onPeerState", fn: (e: PeerStateEvent) => void): EventSubscription;
  addListener(event: "onMessage", fn: (e: PeerMessageEvent) => void): EventSubscription;
};

// Opcional: fora do build iOS com o módulo (Android, Expo Go) fica null e a demo
// segue no modo roteiro.
const native = requireOptionalNativeModule<DemoPeerNative>("DemoPeer");

export const demoPeerAvailable = native != null;

export function startPeer(displayName: string): void {
  native?.start(displayName);
}

export function stopPeer(): void {
  native?.stop();
}

export function sendToPeer(json: string): boolean {
  return native?.send(json) ?? false;
}

export function peerCount(): number {
  return native?.connectedCount() ?? 0;
}

export function onPeerState(fn: (e: PeerStateEvent) => void): () => void {
  const sub = native?.addListener("onPeerState", fn);
  return () => sub?.remove();
}

export function onPeerMessage(fn: (e: PeerMessageEvent) => void): () => void {
  const sub = native?.addListener("onMessage", fn);
  return () => sub?.remove();
}

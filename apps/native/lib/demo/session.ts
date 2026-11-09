// Sessão do Modo Apresentação: ativa quando um dos dois usuários demo entra.
// O token salvo é "demo.<userId>", então a sessão volta sozinha no boot e some no logout.
import { isDemoUserId } from "./fixtures";

const TOKEN_PREFIX = "demo.";

let currentUserId: string | null = null;
const listeners = new Set<(userId: string | null) => void>();

export function demoToken(userId: string): string {
  return `${TOKEN_PREFIX}${userId}`;
}

export function userIdFromToken(token: string | null | undefined): string | null {
  if (!token?.startsWith(TOKEN_PREFIX)) return null;
  const id = token.slice(TOKEN_PREFIX.length);
  return isDemoUserId(id) ? id : null;
}

/** Verdadeiro quando o usuário logado é um dos dois da apresentação. */
export function isDemoActive(): boolean {
  return currentUserId != null;
}

export function demoUserId(): string | null {
  return currentUserId;
}

export function setDemoUser(userId: string | null): void {
  if (currentUserId === userId) return;
  currentUserId = userId;
  for (const fn of listeners) fn(userId);
}

export function onDemoSession(fn: (userId: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// Identificador estável deste aparelho (gerado uma vez e guardado no Keychain/
// Keystore). Vai no login para a API limitar quem atende a um aparelho por vez.
const KEY = "ajuda.deviceId";
let cached: string | null = null;

export async function getDeviceId(): Promise<string | null> {
  if (cached) return cached;
  try {
    const stored = await SecureStore.getItemAsync(KEY);
    if (stored) return (cached = stored);
    const id = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, id);
    return (cached = id);
  } catch {
    return null; // web / ambiente sem SecureStore: segue sem vínculo de aparelho
  }
}

/** A API responde 428 quando quem atende precisa tirar uma selfie nova. */
export const REVERIFY_STATUS = 428;

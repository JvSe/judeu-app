import * as SecureStore from "expo-secure-store";

// Tokens de sessão guardados de forma segura (Keychain/Keystore).
const ACCESS_KEY = "ajuda.accessToken";
const REFRESH_KEY = "ajuda.refreshToken";

export type Tokens = { accessToken: string; refreshToken: string };

// AFTER_FIRST_UNLOCK: a task de localização em background precisa ler o token
// com o iPhone bloqueado (o default WHEN_UNLOCKED falha nesse caso).
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function saveTokens(tokens: Tokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken, STORE_OPTIONS),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, STORE_OPTIONS),
  ]);
}

export async function getTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

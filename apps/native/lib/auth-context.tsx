import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { authApi, pushApi, type AppUser } from "@/lib/api";
import { registerForPushNotificationsAsync } from "@/lib/push";
import { clearTokens, saveTokens } from "@/lib/tokens";

// Registra o token do dispositivo pro backend — best-effort, nunca bloqueia o login
// (sem projeto EAS configurado ainda, retorna null e isso é um no-op silencioso).
function syncPushToken() {
  registerForPushNotificationsAsync()
    .then((token) => (token ? pushApi.register(token) : undefined))
    .catch(() => undefined);
}

type Status = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AppUser | null;
  status: Status;
  signIn: (input: { email: string; password: string }) => Promise<AppUser>;
  signUp: (input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role?: AppUser["role"];
  }) => Promise<AppUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Restaura a sessão no boot (usa refresh automático se o access expirou).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { user } = await authApi.me();
        if (active) {
          setUser(user);
          setStatus("authenticated");
          syncPushToken();
        }
      } catch {
        if (active) {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async signIn(input) {
        const res = await authApi.login(input);
        await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        setUser(res.user);
        setStatus("authenticated");
        syncPushToken();
        return res.user;
      },
      async signUp(input) {
        const res = await authApi.register(input);
        await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        setUser(res.user);
        setStatus("authenticated");
        syncPushToken();
        return res.user;
      },
      async signOut() {
        await authApi.logout();
        await clearTokens();
        setUser(null);
        setStatus("unauthenticated");
      },
    }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

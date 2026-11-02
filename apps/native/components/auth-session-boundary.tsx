import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth-context";

/**
 * Limpa o cache do React Query quando a sessão muda (login/logout/troca de conta),
 * para um CLIENT novo não herdar perfil/disponibilidade de um helper anterior.
 */
export function AuthSessionBoundary() {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (status === "loading") return;

    const nextId = user?.id ?? null;
    if (previousUserId.current === undefined) {
      previousUserId.current = nextId;
      return;
    }

    if (previousUserId.current !== nextId) {
      queryClient.clear();
      previousUserId.current = nextId;
    }
  }, [user?.id, status, queryClient]);

  return null;
}

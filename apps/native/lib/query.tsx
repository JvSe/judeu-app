import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { onDemoRefresh } from "@/lib/demo";

// Cache de dados do servidor (TanStack Query).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  // Modo Apresentação: quando o estado local muda (ação aqui ou no outro aparelho),
  // as telas abertas se atualizam na hora em vez de esperar o próximo polling.
  useEffect(() => onDemoRefresh(() => void client.invalidateQueries()), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

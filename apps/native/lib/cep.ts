import { useState } from "react";

export type CepAddress = { street: string; neighborhood: string; city: string; state: string };

// Autofill via ViaCEP (API pública, sem chave, direto do device) — endereço final
// ainda é geocodificado no servidor via Nominatim ao salvar (RF-C6). Usado tanto
// no cadastro de pedido quanto no livro de endereços do perfil (RF-A6).
export function useCepAutofill(onResolved: (address: Partial<CepAddress>) => void) {
  const [loading, setLoading] = useState(false);

  const handleCepChange = async (digits: string) => {
    if (digits.length !== 8) return;
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (!data.erro) {
        const resolved: Partial<CepAddress> = {};
        if (data.logradouro) resolved.street = data.logradouro;
        if (data.bairro) resolved.neighborhood = data.bairro;
        if (data.localidade) resolved.city = data.localidade;
        if (data.uf) resolved.state = data.uf;
        onResolved(resolved);
      }
    } catch {
      // ViaCEP indisponível — segue com preenchimento manual.
    } finally {
      setLoading(false);
    }
  };

  return { loading, handleCepChange };
}

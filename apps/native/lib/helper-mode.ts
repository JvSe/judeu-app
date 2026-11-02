import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { useMyProviderProfile, useSetAvailability, useUpdateProviderLocation } from "@/lib/hooks";
import { readForegroundPosition } from "@/lib/location";
import { errorMessage, toast } from "@/lib/toast";

const LOCATION_MESSAGE = "Precisamos saber onde você está para achar pedidos perto.";

export function useHelperMode() {
  const { user } = useAuth();
  const profileQuery = useMyProviderProfile();
  const setAvailability = useSetAvailability();
  const updateLocation = useUpdateProviderLocation();
  const [arming, setArming] = useState(false);

  // Conta CLIENT nunca herda perfil em cache de outra sessão — só BOTH/PROVIDER
  // podem ter providerprofile válido neste fluxo.
  const role = user?.role;
  const profile =
    role === "BOTH" || role === "PROVIDER" ? (profileQuery.data ?? null) : null;

  const isHelper = role === "BOTH" && profile?.isHelper === true;
  // Só CLIENT precisa do formulário; BOTH helper já passou por ele.
  const needsSignup = role === "CLIENT";
  const blocked = profile?.status === "BLOCKED";
  const isOn = isHelper && profile?.isAvailable === true && !blocked;
  const profileLoading =
    (role === "BOTH" || role === "PROVIDER") && profileQuery.isLoading;
  const pending = setAvailability.isPending || updateLocation.isPending || profileLoading;

  const turnOn = async () => {
    if (profileLoading) return;

    // Prestador profissional (não-helper) não usa este fluxo.
    if (role === "PROVIDER" || (profile && !profile.isHelper)) {
      toast.info("Você já atende como prestador", {
        description: "Use a área de quem trabalha para receber chamadas.",
      });
      return;
    }

    // Conta nova / ainda sem cadastro de helper → formulário obrigatório.
    if (!isHelper) {
      router.push("/client/helper-signup" as never);
      return;
    }

    if (blocked) {
      toast.error("Cadastro bloqueado", {
        description: "Fale com o suporte para entender o motivo.",
      });
      return;
    }

    setArming(true);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      setArming(false);
      toast.warning("Localização", { description: LOCATION_MESSAGE });
      return;
    }
    try {
      const pos = await readForegroundPosition();
      const lat = pos?.lat ?? profile?.baseLat ?? null;
      const lng = pos?.lng ?? profile?.baseLng ?? null;
      if (lat == null || lng == null) {
        setArming(false);
        toast.warning("Localização", {
          description:
            "Não consegui ler o GPS agora. Ligue a Localização do celular e tente de novo.",
        });
        return;
      }
      await updateLocation.mutateAsync({ lat, lng });
      await setAvailability.mutateAsync(true);
      setArming(false);
      toast.success("Modo atendimento ligado");
    } catch (err) {
      setArming(false);
      const raw = err instanceof Error ? err.message : "";
      const locationFailed = /kCLError|getCurrentPosition|location/i.test(raw);
      toast.error(
        locationFailed || !raw
          ? "Não consegui ler o GPS agora. Ligue a Localização do celular e tente de novo."
          : raw,
      );
    }
  };

  const turnOff = () => {
    setArming(false);
    setAvailability.mutate(false, {
      onSuccess: () => toast.success("Modo atendimento desligado"),
      onError: (err) =>
        toast.error(errorMessage(err, "Não foi possível desligar o modo.")),
    });
  };

  const toggle = () => {
    if (pending) return;
    if (isOn) turnOff();
    else void turnOn();
  };

  return { isHelper, isOn, pending, blocked, arming, needsSignup, toggle, profile };
}

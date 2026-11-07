import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { useMyProviderProfile, useSetAvailability, useUpdateProviderLocation } from "@/lib/hooks";
import { readForegroundPosition } from "@/lib/location";
import { errorMessage, toast } from "@/lib/toast";

const LOCATION_MESSAGE = "Precisamos saber onde você está para achar pedidos perto.";

// "Modo trabalho" de quem atende pelo app — helper (cliente que atende ajudas
// abertas) ou prestador profissional (KYC). A UI decide pelo perfil, não pelo
// papel: o que muda entre os dois é só o gate de aprovação e o vocabulário.
export function useWorkMode() {
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

  const hasProfile = profile != null;
  const isHelper = hasProfile && profile.isHelper === true;
  const isProfessional = hasProfile && profile.isHelper !== true;
  const approved = profile?.status === "APPROVED";
  const blocked = profile?.status === "BLOCKED";
  // Só CLIENT sem perfil passa pelo formulário de helper; prestador nasce com perfil (vazio).
  const needsSignup = !hasProfile && role === "CLIENT";
  // Profissional só fica disponível depois do KYC aprovado (o backend também barra).
  // Helper também passa por aprovação (cadastro novo nasce PENDING).
  const needsApproval = hasProfile && !approved && !blocked;
  const isOn = hasProfile && profile.isAvailable === true && !blocked;
  const profileLoading =
    (role === "BOTH" || role === "PROVIDER") && profileQuery.isLoading;
  const pending = setAvailability.isPending || updateLocation.isPending || profileLoading;

  const turnOn = async () => {
    if (profileLoading) return;

    if (blocked) {
      toast.error("Cadastro bloqueado", {
        description: "Fale com o suporte para entender o motivo.",
      });
      return;
    }

    // Sem perfil: CLIENT faz o cadastro de helper; PROVIDER (caso raro) o profissional.
    if (!hasProfile) {
      router.push((role === "CLIENT" ? "/client/helper-signup" : "/client/kyc") as never);
      return;
    }

    if (needsApproval) {
      const incomplete = !profile.headline;
      toast.info(incomplete ? "Complete seu cadastro profissional" : "Cadastro em análise", {
        description: incomplete
          ? "Você só recebe chamadas depois do cadastro aprovado."
          : "Assim que for aprovado, você pode ficar disponível.",
      });
      if (incomplete) router.push("/client/kyc" as never);
      else if (!profile.hasDocument || !profile.hasSelfie) router.push("/client/verification" as never);
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
      const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesOn) {
        setArming(false);
        toast.warning("Localização", {
          description:
            "A Localização do sistema está desligada. Ligue em Ajustes e tente de novo.",
        });
        return;
      }

      const pos = await readForegroundPosition();
      const lat = pos?.lat ?? profile.baseLat ?? null;
      const lng = pos?.lng ?? profile.baseLng ?? null;
      if (lat == null || lng == null) {
        setArming(false);
        toast.warning("Localização", {
          description:
            "Não consegui ler o GPS agora. No emulador, defina um ponto em ⋯ → Location → Set Location e tente de novo.",
        });
        return;
      }
      await updateLocation.mutateAsync({ lat, lng });
      await setAvailability.mutateAsync(true);
      setArming(false);
      toast.success("Modo atendimento ligado");
    } catch (err) {
      setArming(false);
      const raw = errorMessage(err, "");
      const locationFailed = /kCLErrorDomain|Current location is unavailable|getCurrentPositionAsync/i.test(
        raw,
      );
      toast.error(
        locationFailed
          ? "Não consegui ler o GPS agora. Ligue a Localização do celular e tente de novo."
          : errorMessage(err, "Não foi possível ligar o modo atendimento."),
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

  return {
    profile,
    hasProfile,
    isHelper,
    isProfessional,
    approved,
    needsApproval,
    blocked,
    isOn,
    pending,
    arming,
    needsSignup,
    toggle,
  };
}

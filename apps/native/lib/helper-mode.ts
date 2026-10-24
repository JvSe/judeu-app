import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { useAuth } from "@/lib/auth-context";
import { useMyProviderProfile, useSetAvailability, useUpdateProviderLocation } from "@/lib/hooks";
import { readForegroundPosition } from "@/lib/location";

const LOCATION_MESSAGE = "Precisamos saber onde você está para achar pedidos perto.";

export function useHelperMode() {
  const { user } = useAuth();
  const profileQuery = useMyProviderProfile();
  const setAvailability = useSetAvailability();
  const updateLocation = useUpdateProviderLocation();
  const [arming, setArming] = useState(false);
  const profile = profileQuery.data ?? null;
  const isHelper = profile?.isHelper === true;
  const blocked = profile?.status === "BLOCKED";
  const isOn = isHelper && profile?.isAvailable === true && !blocked;
  const profileLoading =
    (user?.role === "BOTH" || user?.role === "PROVIDER") && profileQuery.isLoading;
  const pending = setAvailability.isPending || updateLocation.isPending || profileLoading;

  const turnOn = async () => {
    if (profileLoading) return;
    if (user?.role === "PROVIDER" || (profile && !profile.isHelper)) {
      Alert.alert(
        "Você já atende como prestador",
        "Use a área de quem trabalha para receber chamadas.",
      );
      return;
    }
    if (!isHelper) {
      router.push("/client/helper-signup" as never);
      return;
    }
    if (blocked) {
      Alert.alert("Cadastro bloqueado", "Fale com o suporte para entender o motivo.");
      return;
    }
    setArming(true);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      setArming(false);
      Alert.alert("Localização", LOCATION_MESSAGE);
      return;
    }
    try {
      const pos = await readForegroundPosition();
      const lat = pos?.lat ?? profile?.baseLat ?? null;
      const lng = pos?.lng ?? profile?.baseLng ?? null;
      if (lat == null || lng == null) {
        setArming(false);
        Alert.alert(
          "Localização",
          "Não consegui ler o GPS agora. Ligue a Localização do celular e tente de novo.",
        );
        return;
      }
      await updateLocation.mutateAsync({ lat, lng });
      await setAvailability.mutateAsync(true);
    } catch (err) {
      setArming(false);
      const raw = err instanceof Error ? err.message : "";
      const locationFailed = /kCLError|getCurrentPosition|location/i.test(raw);
      Alert.alert(
        "Ops",
        locationFailed || !raw
          ? "Não consegui ler o GPS agora. Ligue a Localização do celular e tente de novo."
          : raw,
      );
    }
  };

  const turnOff = () => {
    setArming(false);
    setAvailability.mutate(false, {
      onError: (err) =>
        Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível desligar o modo."),
    });
  };

  const toggle = () => {
    if (pending) return;
    if (isOn) turnOff();
    else void turnOn();
  };

  return { isHelper, isOn, pending, blocked, arming, toggle };
}

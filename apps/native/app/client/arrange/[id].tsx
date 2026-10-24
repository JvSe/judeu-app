import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { formatAddressLine } from "@/lib/format";
import { useAddresses, useArrangeOrder, useOrder } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

export default function ArrangeHelp() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { data: order, isLoading } = useOrder(id, { poll: true });
  const { data: addresses = [], isLoading: addressesLoading } = useAddresses();
  const arrange = useArrangeOrder();
  const [dropoffId, setDropoffId] = useState<string | null>(null);
  const [pickupId, setPickupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    if (order.detailsReady || order.status === "EN_ROUTE" || order.status === "IN_PROGRESS") {
      router.replace({ pathname: "/client/tracking/[id]", params: { id: order.id } });
    }
  }, [order]);

  useEffect(() => {
    if (!addresses.length) return;
    setDropoffId((current) => {
      if (current && addresses.some((a) => a.id === current)) return current;
      if (order?.address) {
        const match = addresses.find(
          (a) => a.lat === order.address.lat && a.lng === order.address.lng,
        );
        if (match) return match.id;
      }
      return addresses.find((a) => a.isDefault)?.id ?? addresses[0].id;
    });
  }, [addresses, order?.address]);

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const personName = order.provider?.name?.split(" ")[0] ?? "Essa pessoa";

  const finish = async (withLocations: boolean) => {
    setError(null);
    try {
      await arrange.mutateAsync({
        id: order.id,
        ...(withLocations && dropoffId ? { addressId: dropoffId } : {}),
        ...(withLocations ? { pickupAddressId: pickupId } : { pickupAddressId: null }),
        detailsReady: true,
      });
      router.replace({ pathname: "/client/tracking/[id]", params: { id: order.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível continuar.");
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>{personName} aceitou</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Se precisar de locais de busca e entrega, defina agora. Se não, combine no chat e libere o
          trajeto.
        </Text>
        <Text style={styles.desc}>{order.description}</Text>

        <Text style={styles.label}>Buscar em (opcional)</Text>
        {addressesLoading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <View style={{ gap: 8 }}>
            {addresses.map((address) => {
              const on = address.id === pickupId;
              return (
                <Pressable
                  key={address.id}
                  style={[styles.choice, on && styles.choiceOn]}
                  onPress={() => setPickupId(on ? null : address.id)}
                >
                  <Text style={styles.choiceLabel}>{formatAddressLine(address)}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => router.push("/client/address-form")}>
              <Text style={styles.link}>Adicionar endereço</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>Deixar em / te encontrar</Text>
        <View style={{ gap: 8 }}>
          {addresses.map((address) => {
            const on = address.id === dropoffId;
            return (
              <Pressable
                key={address.id}
                style={[styles.choice, on && styles.choiceOn]}
                onPress={() => setDropoffId(address.id)}
              >
                <Text style={styles.choiceLabel}>{formatAddressLine(address)}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={styles.secondary}
          onPress={() => router.push({ pathname: "/client/chat/[id]", params: { id: order.id } })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          <Text style={styles.secondaryText}>Chat</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, styles.ghost]}
          onPress={() => finish(false)}
          disabled={arrange.isPending}
        >
          <Text style={styles.secondaryText}>Combinar no chat</Text>
        </Pressable>
        <Pressable
          style={[styles.primary, arrange.isPending && { opacity: 0.7 }]}
          onPress={() => finish(true)}
          disabled={arrange.isPending || !dropoffId}
        >
          <Text style={styles.primaryText}>
            {arrange.isPending ? "Salvando..." : "Pronto"}
          </Text>
        </Pressable>
      </View>
      {error ? <Text style={[styles.error, { bottom: insets.bottom + 96 }]}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
  lead: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    lineHeight: 22,
  },
  desc: {
    marginTop: 14,
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  label: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  choice: {
    backgroundColor: "rgba(28,28,58,0.7)",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 16,
    padding: 14,
  },
  choiceOn: {
    borderColor: theme.colors.primary,
  },
  choiceLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  link: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: "#14142e",
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  ghost: {
    flex: 1,
    justifyContent: "center",
  },
  secondaryText: {
    color: "#fff",
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  primary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontFamily: fonts.extraBold,
    fontSize: 15,
  },
  error: {
    position: "absolute",
    left: 16,
    right: 16,
    color: theme.colors.destructive,
    fontFamily: fonts.medium,
    textAlign: "center",
  },
}));

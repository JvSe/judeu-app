import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import type { SavedAddress } from "@/lib/api";
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

export default function Addresses() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: addresses, isLoading } = useAddresses();
  const setDefault = useSetDefaultAddress();
  const removeAddress = useDeleteAddress();

  const confirmDelete = (address: SavedAddress) => {
    Alert.alert(
      "Excluir endereço",
      `Remover "${address.label ?? address.street}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => removeAddress.mutate(address.id),
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Meus endereços</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />
        ) : !addresses?.length ? (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={28} color={theme.colors.mutedForeground} />
            <Text style={styles.emptyText}>Você ainda não salvou nenhum endereço</Text>
          </View>
        ) : (
          addresses.map((address) => (
            <View key={address.id} style={styles.card}>
              <Pressable
                style={styles.cardMain}
                onPress={() => router.push(`/client/address-form?id=${address.id}` as never)}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="location" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardLabel}>{address.label || "Endereço"}</Text>
                    {address.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Padrão</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardDetail} numberOfLines={2}>
                    {address.street}
                    {address.number ? `, ${address.number}` : ""} — {address.city}/{address.state}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.cardActions}>
                {!address.isDefault && (
                  <Pressable
                    style={styles.actionButton}
                    disabled={setDefault.isPending}
                    onPress={() => setDefault.mutate(address.id)}
                  >
                    <Text style={styles.actionText}>Tornar padrão</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.actionButton}
                  disabled={removeAddress.isPending}
                  onPress={() => confirmDelete(address)}
                >
                  <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Pressable style={styles.addButton} onPress={() => router.push("/client/address-form" as never)}>
          <Ionicons name="add" size={18} color={theme.colors.primary} />
          <Text style={styles.addButtonText}>Novo endereço</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  heading: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 40,
  },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  card: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardMain: {
    flexDirection: "row",
    gap: 13,
    padding: 15,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,102,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardLabel: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  defaultBadge: {
    backgroundColor: "rgba(255,102,0,0.16)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 10.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  cardDetail: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 3,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  actionText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 6,
  },
  addButtonText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
}));

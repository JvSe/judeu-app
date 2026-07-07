import "@/unistyles";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { initialsOf } from "@/lib/format";
import { useMyProviderProfile } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Cadastro em análise",
  APPROVED: "Verificado",
  BLOCKED: "Bloqueado",
};

export default function ProviderProfileTab() {
  const { theme } = useUnistyles();
  const { user } = useAuth();
  const { data: profile } = useMyProviderProfile();

  const statusColor =
    profile?.status === "APPROVED"
      ? theme.colors.success
      : profile?.status === "BLOCKED"
        ? theme.colors.destructive
        : theme.colors.primary;

  return (
    <Screen>
      <View style={styles.container}>
        <Avatar initials={initialsOf(user?.fullName ?? "?")} size={88} fontSize={30} />
        <Text style={styles.name}>{user?.fullName ?? "Prestador"}</Text>
        <Text style={styles.subtitle}>{profile?.headline ?? "Complete seu cadastro profissional"}</Text>

        {profile && (
          <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABEL[profile.status]}
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.editButton, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push("/provider/kyc")}
        >
          <Text style={styles.editLabel}>
            {profile ? "Editar cadastro profissional" : "Completar cadastro"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.switchButton, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.switchLabel}>Trocar de perfil</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 40,
  },
  name: {
    fontFamily: fonts.extraBold,
    fontSize: theme.fontSize["2xl"],
    color: theme.colors.foreground,
    marginTop: 14,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.mutedForeground,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
  },
  editButton: {
    marginTop: 22,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.lg,
  },
  editLabel: {
    fontFamily: fonts.bold,
    color: "#fff",
    fontSize: theme.fontSize.sm,
  },
  switchButton: {
    marginTop: 14,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
  },
  switchLabel: {
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
  },
}));

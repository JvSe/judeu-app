import "@/unistyles";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

export default function ProviderProfileTab() {
  return (
    <Screen>
      <View style={styles.container}>
        <Avatar initials="CM" size={88} fontSize={30} />
        <Text style={styles.name}>Carlos Mendes</Text>
        <Text style={styles.subtitle}>Eletricista · Reparos gerais</Text>

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
  switchButton: {
    marginTop: 26,
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

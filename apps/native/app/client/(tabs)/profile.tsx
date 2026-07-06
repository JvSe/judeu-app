import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

const stats = [
  { value: "12", label: "Serviços" },
  { value: "4.9 ★", label: "Como cliente" },
  { value: "3", label: "Favoritos" },
];

const menu: {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  href?: string;
}[] = [
  { id: "addresses", icon: "location-outline", label: "Meus endereços" },
  { id: "payments", icon: "card-outline", label: "Formas de pagamento" },
  { id: "favorites", icon: "heart-outline", label: "Prestadores favoritos" },
  { id: "support", icon: "help-circle-outline", label: "Ajuda e suporte", href: "/client/support" },
];

export default function ClientProfile() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <LinearGradient colors={["#FF6600", "#d94f00"]} style={[styles.banner, { paddingTop: insets.top + 8 }]}>
          <View style={styles.bannerTop}>
            <Text style={styles.bannerTitle}>Perfil</Text>
            <Pressable style={styles.settingsButton} onPress={() => router.push("/client/privacy" as never)}>
              <Ionicons name="settings-outline" size={19} color="#fff" />
            </Pressable>
          </View>
          <LinearGradient
            colors={["transparent", "#0f0f26"]}
            style={styles.bannerFade}
            pointerEvents="none"
          />
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.identityRow}>
            <Avatar initials="JS" size={92} fontSize={30} radius={28} />
            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>João Silva</Text>
                <Ionicons name="star" size={17} color={theme.colors.primary} />
              </View>
              <Text style={styles.memberSince}>Membro desde 2024</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.menu}>
            {menu.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => item.href && router.push(item.href as never)}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon} size={19} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
                </Pressable>
              </Fragment>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.logout, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.replace("/")}
          >
            <Ionicons name="log-out-outline" size={18} color="#ff6b6b" />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  banner: {
    height: 200,
    paddingHorizontal: 20,
  },
  bannerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerTitle: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  body: {
    paddingHorizontal: 20,
    marginTop: -70,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 15,
  },
  identityText: {
    paddingBottom: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  name: {
    fontSize: 23,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  memberSince: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  statLabel: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  menu: {
    marginTop: 24,
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 20,
    padding: 6,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 15,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,102,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 14,
  },
  logout: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(255,80,80,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.25)",
    borderRadius: 16,
    paddingVertical: 15,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#ff6b6b",
  },
}));

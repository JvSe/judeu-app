import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet as RNStyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { initialsOf } from "@/lib/format";
import { useAttendButtonVisibility } from "@/lib/attend-button";
import { useWorkMode } from "@/lib/work-mode";
import { useClientStats } from "@/lib/hooks";
import { JudeuIcon } from "@/components/ui/judeu-icon";
import { Screen } from "@/components/ui/screen";
import { AnimatedScrollView } from "@/components/ui/templates/parallax-header";

const HEADER_HEIGHT_RATIO = 0.68;
const MAX_HEADER_HEIGHT = 290;

type MenuItem = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  href?: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Cadastro em análise",
  APPROVED: "Verificado",
  BLOCKED: "Bloqueado",
};

// O menu muda conforme o perfil de quem atende: prestador profissional vê o
// cadastro profissional (KYC); empresa vê suas vagas; quem tem qualquer perfil
// vê as vagas de empresas.
function buildMenu(work: {
  hasProfile: boolean;
  isProfessional: boolean;
  profile: { isCompany: boolean; headline: string | null } | null;
}): MenuItem[] {
  const items: MenuItem[] = [
    { id: "edit", icon: "person-outline", label: "Editar perfil", href: "/client/edit-profile" },
    { id: "addresses", icon: "location-outline", label: "Meus endereços", href: "/client/addresses" },
    { id: "family", icon: "people-outline", label: "Contato de confiança", href: "/client/trusted-contact" },
  ];
  if (work.isProfessional) {
    items.push({
      id: "kyc",
      icon: "shield-checkmark-outline",
      label: work.profile?.headline ? "Cadastro profissional" : "Completar cadastro profissional",
      href: "/client/kyc",
    });
  }
  if (work.hasProfile) {
    items.push({
      id: "verification",
      icon: "finger-print-outline",
      label: "Verificação de identidade",
      href: "/client/verification",
    });
  }
  if (work.profile?.isCompany) {
    items.push({ id: "vagas", icon: "briefcase-outline", label: "Minhas vagas", href: "/client/vaga" });
  } else if (work.hasProfile) {
    items.push({ id: "jobs", icon: "briefcase-outline", label: "Vagas de emprego", href: "/jobs" });
  }
  items.push({ id: "support", icon: "help-circle-outline", label: "Ajuda e suporte", href: "/client/support" });
  return items;
}

export default function ClientProfile() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, signOut } = useAuth();
  const { data: stats } = useClientStats();
  const helper = useWorkMode();
  const attendButton = useAttendButtonVisibility();
  const menu = buildMenu(helper);
  const statusColor =
    helper.profile?.status === "APPROVED"
      ? theme.colors.success
      : helper.profile?.status === "BLOCKED"
        ? theme.colors.destructive
        : theme.colors.primary;

  const memberSince = user?.createdAt ? new Date(user.createdAt).getFullYear() : null;

  const headerHeight = Math.min(windowWidth * HEADER_HEIGHT_RATIO, MAX_HEADER_HEIGHT);
  const navBarHeight = insets.top + 56;
  const avatarUrl = user?.avatarUrl;

  const navBar = (
    <View style={[styles.navBar, { height: navBarHeight, paddingTop: insets.top }]}>
      <Text style={styles.navBarTitle}>Perfil</Text>
      <Pressable style={styles.settingsButton} onPress={() => router.push("/client/privacy" as never)}>
        <Ionicons name="settings-outline" size={19} color="#fff" />
      </Pressable>
    </View>
  );

  const headerShade = (
    <LinearGradient
      colors={["rgba(0,0,0,0.45)", "transparent", "transparent", "#0f0f26"]}
      locations={[0, 0.3, 0.72, 1]}
      style={RNStyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );

  return (
    <Screen>
      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        headerMaxHeight={headerHeight}
        topBarHeight={navBarHeight}
        headerImage={avatarUrl ? { uri: avatarUrl } : undefined}
        imageStyle={{ width: windowWidth }}
        HeaderComponent={
          avatarUrl ? (
            headerShade
          ) : (
            <LinearGradient colors={["#FF6600", "#d94f00"]} style={styles.headerFallback}>
              <Text style={styles.headerInitials}>{initialsOf(user?.fullName ?? "?")}</Text>
              {headerShade}
            </LinearGradient>
          )
        }
        HeaderNavbarComponent={navBar}
        TopNavBarComponent={
          <BlurView intensity={50} tint="systemUltraThinMaterialDark" style={RNStyleSheet.absoluteFill}>
            {navBar}
          </BlurView>
        }
      >
        <View style={styles.body}>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user?.fullName ?? "Você"}</Text>
              {!!stats?.ratingCount && (
                <Ionicons name="star" size={17} color={theme.colors.primary} />
              )}
            </View>
            {memberSince && <Text style={styles.memberSince}>Membro desde {memberSince}</Text>}
            {helper.isProfessional && helper.profile && (
              <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {STATUS_LABEL[helper.profile.status]}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.completedOrders ?? "—"}</Text>
              <Text style={styles.statLabel}>Concluídos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats?.ratingCount ? `${stats.ratingAvg?.toFixed(1)} ★` : "Novo"}
              </Text>
              <Text style={styles.statLabel}>Como cliente</Text>
            </View>
          </View>

          <View style={styles.menu}>
            <Pressable
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={helper.toggle}
              disabled={helper.pending}
            >
              <View style={styles.menuIcon}>
                <JudeuIcon size={19} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>
                  {helper.pending
                    ? "Atualizando..."
                    : helper.isOn
                      ? helper.isProfessional
                        ? "Disponível para chamadas"
                        : "Procurando ajudas perto de você"
                      : helper.isProfessional
                        ? "Receber chamadas"
                        : "Atender ajudas"}
                </Text>
                <Text style={styles.menuHint}>
                  {helper.isProfessional
                    ? "Fique disponível para clientes te chamarem"
                    : "Receba pedidos de ajuda perto de você"}
                </Text>
              </View>
              <View style={[styles.switchTrack, helper.isOn && styles.switchTrackOn]}>
                <View style={[styles.switchKnob, helper.isOn && styles.switchKnobOn]} />
              </View>
            </Pressable>
            {attendButton.ready && (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => {
                    void (attendButton.hidden ? attendButton.show() : attendButton.hide()).catch(() => undefined);
                  }}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons
                      name={attendButton.hidden ? "eye-outline" : "eye-off-outline"}
                      size={19}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.menuLabel}>
                    {attendButton.hidden ? "Mostrar botão no mapa" : "Ocultar botão"}
                  </Text>
                </Pressable>
              </>
            )}
            {helper.isHelper && (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => router.push("/client/helper-profile" as never)}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name="options-outline" size={19} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuTitle}>Como você atende</Text>
                    <Text style={styles.menuHint}>Sua descrição e o raio de atendimento</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
                </Pressable>
              </>
            )}
            <View style={styles.divider} />
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
            onPress={() => {
              signOut();
              router.replace("/");
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#ff6b6b" />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </Pressable>

          <Text style={styles.version}>Versão {Constants.expoConfig?.version}</Text>
        </View>
      </AnimatedScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  navBarTitle: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  headerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInitials: {
    fontSize: 96,
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
  body: {
    paddingHorizontal: 20,
    marginTop: -28,
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
  menuTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  menuHint: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  switchTrackOn: { backgroundColor: theme.colors.primary },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  switchKnobOn: { alignSelf: "flex-end" },
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
  version: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: 16,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
  },
}));

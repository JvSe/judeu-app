import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Fragment, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Screen } from "@/components/ui/screen";

type PermissionRow = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail: string;
  granted: boolean | null; // null = ainda não checado
  request: () => Promise<boolean>;
};

// Status real das permissões do sistema (RNF-5) — sem app não pode "desligar" uma
// permissão já concedida, então o toque abre o Settings do device quando aplicável.
function usePermissionStatus() {
  const [location, setLocation] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<boolean | null>(null);
  const [camera, setCamera] = useState<boolean | null>(null);

  const refresh = async () => {
    const [loc, notif, cam] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
      ImagePicker.getCameraPermissionsAsync(),
    ]);
    setLocation(loc.status === "granted");
    setNotifications(notif.status === "granted");
    setCamera(cam.status === "granted");
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return { location, notifications, camera, refresh };
}

export default function Privacy() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const status = usePermissionStatus();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);

  const permissions: PermissionRow[] = [
    {
      id: "location",
      icon: "location-outline",
      label: "Localização",
      detail: "Enquanto usa o app · para achar profissionais perto",
      granted: status.location,
      request: async () => (await Location.requestForegroundPermissionsAsync()).status === "granted",
    },
    {
      id: "notifications",
      icon: "notifications-outline",
      label: "Notificações",
      detail: "Status do pedido, chat e chegada",
      granted: status.notifications,
      request: async () => (await Notifications.requestPermissionsAsync()).status === "granted",
    },
    {
      id: "camera",
      icon: "camera-outline",
      label: "Câmera",
      detail: "Foto do documento na verificação de prestador",
      granted: status.camera,
      request: async () => (await ImagePicker.requestCameraPermissionsAsync()).status === "granted",
    },
  ];

  const togglePermission = async (permission: PermissionRow) => {
    if (permission.granted) {
      Linking.openSettings();
      return;
    }
    await permission.request();
    await status.refresh();
  };

  const downloadData = async () => {
    setBusy("export");
    try {
      const { export: data, generatedAt } = await authApi.exportData();
      await Share.share({
        title: "Meus dados — Ajuda+",
        message: JSON.stringify({ generatedAt, data }, null, 2),
      });
    } catch {
      Alert.alert("Ops", "Não foi possível exportar seus dados agora. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      "Excluir sua conta",
      "Seus dados de identificação serão removidos e você será desconectado. Pedidos e avaliações já feitos continuam no histórico da outra parte, sem seu nome. Essa ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir conta",
          style: "destructive",
          onPress: async () => {
            setBusy("delete");
            try {
              await authApi.deleteAccount();
              await signOut();
              router.replace("/");
            } catch {
              Alert.alert("Ops", "Não foi possível excluir sua conta agora. Tente novamente.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const documents: {
    id: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    value?: string;
    danger?: boolean;
    loading?: boolean;
    onPress: () => void;
  }[] = [
    { id: "terms", icon: "document-text-outline", label: "Termos de uso", onPress: () => router.push("/terms" as never) },
    { id: "privacy", icon: "shield-checkmark-outline", label: "Política de privacidade", value: "LGPD", onPress: () => router.push("/privacy-policy" as never) },
    { id: "download", icon: "download-outline", label: "Baixar meus dados", loading: busy === "export", onPress: downloadData },
    { id: "delete", icon: "trash-outline", label: "Excluir minha conta", danger: true, loading: busy === "delete", onPress: deleteAccount },
  ];

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Privacidade & permissões</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>PERMISSÕES DO APP</Text>
        <View style={styles.group}>
          {permissions.map((permission, index) => (
            <Fragment key={permission.id}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable style={styles.permissionRow} onPress={() => togglePermission(permission)}>
                <View style={[styles.permissionIcon, !permission.granted && styles.permissionIconOff]}>
                  <Ionicons
                    name={permission.icon}
                    size={18}
                    color={permission.granted ? theme.colors.primary : theme.colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionLabel}>{permission.label}</Text>
                  <Text style={styles.permissionDetail}>{permission.detail}</Text>
                </View>
                <View style={[styles.toggle, permission.granted ? styles.toggleOn : styles.toggleOff]}>
                  <View
                    style={[
                      styles.knob,
                      permission.granted ? styles.knobOn : styles.knobOff,
                      !permission.granted && styles.knobOffColor,
                    ]}
                  />
                </View>
              </Pressable>
            </Fragment>
          ))}
        </View>

        <Text style={styles.sectionLabel}>DADOS & DOCUMENTOS</Text>
        <View style={styles.group}>
          {documents.map((doc, index) => (
            <Fragment key={doc.id}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable style={styles.docRow} onPress={doc.onPress} disabled={doc.loading}>
                <Ionicons
                  name={doc.icon}
                  size={18}
                  color={doc.danger ? "#ff6b6b" : theme.colors.primary}
                />
                <Text style={[styles.docLabel, doc.danger && styles.docLabelDanger]}>{doc.label}</Text>
                {doc.value && <Text style={styles.docValue}>{doc.value}</Text>}
                {doc.loading ? (
                  <Text style={styles.docValue}>...</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
                )}
              </Pressable>
            </Fragment>
          ))}
        </View>
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
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: "#6b699a",
    letterSpacing: 0.5,
    marginBottom: 11,
  },
  group: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 20,
    padding: 6,
    marginBottom: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 14,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
  },
  permissionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,102,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionIconOff: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  permissionLabel: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  permissionDetail: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: theme.colors.primary,
  },
  toggleOff: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: "absolute",
    backgroundColor: "#fff",
  },
  knobOn: {
    right: 3,
  },
  knobOff: {
    left: 3,
  },
  knobOffColor: {
    backgroundColor: "#8583a8",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  docLabel: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: fonts.semiBold,
    color: "#fff",
  },
  docLabelDanger: {
    color: "#ff6b6b",
  },
  docValue: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
}));

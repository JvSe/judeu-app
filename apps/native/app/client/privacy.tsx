import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Fragment, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";

type Permission = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail: string;
  on: boolean;
};

const initialPermissions: Permission[] = [
  { id: "location", icon: "location-outline", label: "Localização", detail: "Enquanto usa o app · para achar profissionais perto", on: true },
  { id: "notifications", icon: "notifications-outline", label: "Notificações", detail: "Status do pedido, chat e chegada", on: true },
  { id: "camera", icon: "camera-outline", label: "Câmera", detail: "Fotos do problema e verificação", on: false },
  { id: "mic", icon: "mic-outline", label: "Microfone", detail: "Áudios no chat com o profissional", on: false },
];

const documents: { id: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value?: string; danger?: boolean }[] = [
  { id: "terms", icon: "document-text-outline", label: "Termos de uso", value: "v3.2 · mai 2026" },
  { id: "privacy", icon: "shield-checkmark-outline", label: "Política de privacidade", value: "LGPD" },
  { id: "download", icon: "download-outline", label: "Baixar meus dados" },
  { id: "delete", icon: "trash-outline", label: "Excluir minha conta", danger: true },
];

export default function Privacy() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState(initialPermissions);

  const toggle = (id: string) =>
    setPermissions((current) => current.map((p) => (p.id === id ? { ...p, on: !p.on } : p)));

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
              <View style={styles.permissionRow}>
                <View style={[styles.permissionIcon, !permission.on && styles.permissionIconOff]}>
                  <Ionicons
                    name={permission.icon}
                    size={18}
                    color={permission.on ? theme.colors.primary : theme.colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionLabel}>{permission.label}</Text>
                  <Text style={styles.permissionDetail}>{permission.detail}</Text>
                </View>
                <Pressable
                  style={[styles.toggle, permission.on ? styles.toggleOn : styles.toggleOff]}
                  onPress={() => toggle(permission.id)}
                >
                  <View
                    style={[
                      styles.knob,
                      permission.on ? styles.knobOn : styles.knobOff,
                      !permission.on && styles.knobOffColor,
                    ]}
                  />
                </Pressable>
              </View>
            </Fragment>
          ))}
        </View>

        <Text style={styles.sectionLabel}>DADOS & DOCUMENTOS</Text>
        <View style={styles.group}>
          {documents.map((doc, index) => (
            <Fragment key={doc.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.docRow}>
                <Ionicons
                  name={doc.icon}
                  size={18}
                  color={doc.danger ? "#ff6b6b" : theme.colors.primary}
                />
                <Text style={[styles.docLabel, doc.danger && styles.docLabelDanger]}>{doc.label}</Text>
                {doc.value && <Text style={styles.docValue}>{doc.value}</Text>}
                <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
              </View>
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

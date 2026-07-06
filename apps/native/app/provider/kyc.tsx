import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";

export default function ProviderKyc() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <View style={styles.progress}>
          <View style={[styles.progressSeg, styles.progressSegDone]} />
          <View style={[styles.progressSeg, styles.progressSegDone]} />
          <View style={styles.progressSeg} />
          <View style={styles.progressSeg} />
        </View>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Verificação de identidade</Text>
        <Text style={styles.subtitle}>
          Para a segurança de todos, precisamos confirmar quem você é. Leva ~3 minutos.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.doneCard}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={20} color={theme.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doneTitle}>CPF validado</Text>
            <Text style={styles.doneMeta}>•••.456.789-••</Text>
          </View>
          <Text style={styles.doneBadge}>OK</Text>
        </View>

        <View style={styles.doneCard}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={20} color={theme.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doneTitle}>Documento com foto</Text>
            <Text style={styles.doneMeta}>CNH enviada · frente e verso</Text>
          </View>
          <Text style={styles.doneBadge}>OK</Text>
        </View>

        <View style={styles.uploadCard}>
          <View style={styles.uploadIcon}>
            <Ionicons name="camera-outline" size={26} color={theme.colors.primary} />
          </View>
          <Text style={styles.uploadTitle}>Selfie de verificação</Text>
          <Text style={styles.uploadText}>Tire uma selfie para compararmos com seu documento</Text>
          <View style={styles.uploadButton}>
            <Text style={styles.uploadButtonText}>Abrir câmera</Text>
          </View>
        </View>

        <View style={[styles.doneCard, styles.pendingCard]}>
          <View style={styles.pendingIcon}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doneTitle}>Certificados e experiência</Text>
            <Text style={styles.doneMeta}>Opcional · aumenta sua taxa de contratação</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.success} />
          <Text style={styles.secureText}>Seus dados são criptografados e nunca compartilhados</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.replace("/provider")}
        >
          <Text style={styles.submitText}>Continuar</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  progress: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  progressSegDone: {
    backgroundColor: theme.colors.primary,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.7,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 8,
    lineHeight: 21,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 30,
    gap: 12,
  },
  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(49,208,127,0.35)",
    borderRadius: 18,
    padding: 16,
  },
  doneIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(49,208,127,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  doneMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  doneBadge: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.success,
  },
  uploadCard: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,102,0,0.5)",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },
  uploadIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,102,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 12,
  },
  uploadText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 5,
    textAlign: "center",
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 13,
    marginTop: 14,
  },
  uploadButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  pendingCard: {
    borderColor: theme.colors.border,
    backgroundColor: "rgba(28,28,58,0.55)",
    opacity: 0.6,
  },
  pendingIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: "rgba(13,13,36,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  secureText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  submit: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  submitText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));

import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import type { KycFileKind } from "@/lib/api";
import { useMyProviderProfile, useUploadKycFile } from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";

const BACKGROUND_CHECK_URL = "https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais";

type Step = {
  kind: KycFileKind;
  title: string;
  hint: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  camera: "front" | "back";
  allowGallery: boolean;
};

const STEPS: Step[] = [
  {
    kind: "DOCUMENT",
    title: "Documento com foto",
    hint: "RG ou CNH. Foto nítida, sem reflexo, com o documento inteiro.",
    icon: "card-outline",
    camera: "back",
    allowGallery: true,
  },
  {
    kind: "SELFIE",
    title: "Selfie",
    hint: "Rosto bem iluminado, sem óculos escuros nem boné. Só pela câmera.",
    icon: "person-circle-outline",
    camera: "front",
    allowGallery: false,
  },
  {
    kind: "BACKGROUND_CHECK",
    title: "Certidão de antecedentes",
    hint: "Emitida de graça no site da Polícia Federal. Envie uma foto ou print da certidão.",
    icon: "document-text-outline",
    camera: "back",
    allowGallery: true,
  },
];

// Verificação de identidade de quem atende (helper e profissional). Quem entra
// na casa de alguém precisa de documento, selfie pela câmera e antecedentes;
// a equipe confere tudo antes de aprovar.
export default function Verification() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading } = useMyProviderProfile();
  const upload = useUploadKycFile();

  const done: Record<KycFileKind, boolean> = {
    DOCUMENT: !!profile?.hasDocument,
    SELFIE: !!profile?.hasSelfie,
    BACKGROUND_CHECK: !!profile?.hasBackgroundCheck,
  };

  const capture = async (step: Step, source: "camera" | "gallery") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.warning(source === "camera" ? "Precisamos da câmera para a verificação." : "Precisamos acessar suas fotos.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: "images", base64: true, quality: 0.6 };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            ...options,
            cameraType: step.camera === "front" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
          })
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    upload.mutate(
      { kind: step.kind, base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" },
      {
        onSuccess: () => toast.success(`${step.title} enviado`),
        onError: (e) => toast.error(errorMessage(e, "Não foi possível enviar.")),
      },
    );
  };

  const allDone = Object.values(done).every(Boolean);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Verificação de identidade</Text>
      </View>
      {isLoading || !profile ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Você vai entrar na casa de outras pessoas. Por isso conferimos sua identidade antes de
            liberar os pedidos. Leva uns 3 minutos.
          </Text>

          {STEPS.map((step) => (
            <View key={step.kind} style={styles.card}>
              <View style={styles.row}>
                <Ionicons name={step.icon} size={22} color={theme.colors.primary} />
                <Text style={styles.cardTitle}>{step.title}</Text>
                {done[step.kind] && <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />}
              </View>
              <Text style={styles.hint}>{step.hint}</Text>
              {step.kind === "BACKGROUND_CHECK" && (
                <Pressable onPress={() => void Linking.openURL(BACKGROUND_CHECK_URL)} hitSlop={6}>
                  <Text style={styles.link}>Emitir certidão no site da Polícia Federal</Text>
                </Pressable>
              )}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.button, upload.isPending && { opacity: 0.5 }]}
                  disabled={upload.isPending}
                  onPress={() => void capture(step, "camera")}
                >
                  <Ionicons name="camera-outline" size={16} color="#fff" />
                  <Text style={styles.buttonText}>
                    {done[step.kind] ? "Tirar de novo" : step.kind === "SELFIE" ? "Tirar selfie" : "Tirar foto"}
                  </Text>
                </Pressable>
                {step.allowGallery && (
                  <Pressable
                    style={[styles.ghost, upload.isPending && { opacity: 0.5 }]}
                    disabled={upload.isPending}
                    onPress={() => void capture(step, "gallery")}
                  >
                    <Text style={styles.ghostText}>Escolher da galeria</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          {upload.isPending && <ActivityIndicator color={theme.colors.primary} />}

          <View style={styles.status}>
            <Text style={styles.statusText}>
              {profile.status === "APPROVED"
                ? "Seu cadastro está aprovado."
                : allDone
                  ? "Tudo enviado. Vamos analisar e avisar você pelo app."
                  : "Envie os três itens para entrar na fila de análise."}
            </Text>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: fonts.extraBold, color: "#fff" },
  content: { paddingHorizontal: 20, gap: 12, paddingBottom: 40 },
  intro: { fontSize: 14, fontFamily: fonts.medium, color: theme.colors.mutedForeground, lineHeight: 21 },
  card: { backgroundColor: "rgba(28,28,58,0.92)", borderRadius: 18, padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: fonts.bold, color: "#fff" },
  hint: { fontSize: 13, fontFamily: fonts.medium, color: theme.colors.mutedForeground, lineHeight: 19 },
  link: { fontSize: 13, fontFamily: fonts.bold, color: theme.colors.primary },
  actions: { flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  buttonText: { fontSize: 14, fontFamily: fonts.bold, color: "#fff" },
  ghost: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border },
  ghostText: { fontSize: 14, fontFamily: fonts.bold, color: theme.colors.mutedForeground },
  status: { padding: 14, borderRadius: 14, backgroundColor: "rgba(255,102,0,0.08)" },
  statusText: { fontSize: 14, fontFamily: fonts.medium, color: "#fff", lineHeight: 20 },
}));

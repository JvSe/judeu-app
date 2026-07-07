import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { useCategories, useMyProviderProfile, useUploadProviderDocument, useUpsertProviderProfile } from "@/lib/hooks";

type DraftService = { name: string; priceCents: number };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Em análise",
  APPROVED: "Aprovado",
  BLOCKED: "Bloqueado",
};

export default function ProviderKyc() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  const { data: categories = [] } = useCategories();
  const { data: profile, isLoading } = useMyProviderProfile();
  const upsertProfile = useUpsertProviderProfile();
  const uploadDocument = useUploadProviderDocument();

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [serviceRadiusKm, setServiceRadiusKm] = useState("10");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [services, setServices] = useState<DraftService[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [document, setDocument] = useState<{ uri: string; base64: string; mimeType: string } | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pré-preenche o form quando o cadastro profissional já existe (edição).
  useEffect(() => {
    if (!profile) return;
    setHeadline(profile.headline ?? "");
    setBio(profile.bio ?? "");
    setYearsExperience(String(profile.yearsExperience));
    setServiceRadiusKm(String(profile.serviceRadiusKm));
    setCategoryId(profile.categoryIds[0] ?? null);
    setServices(profile.services.map((s) => ({ name: s.name, priceCents: s.priceCents })));
  }, [profile]);

  const hasDocument = document !== null || !!profile?.hasDocument;

  const canSubmit =
    headline.trim().length >= 2 && !!categoryId && services.length > 0 && hasDocument;

  async function pickDocument() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("Precisamos de acesso às fotos para enviar o documento.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setDocument({
      uri: asset.uri,
      base64: asset.base64!,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
    setErrorMsg(null);
  }

  function addService() {
    const priceCents = Math.round(Number(servicePrice.replace(",", ".")) * 100);
    if (serviceName.trim().length < 2 || !Number.isFinite(priceCents) || priceCents < 100) {
      setErrorMsg("Informe o nome do serviço e um preço válido.");
      return;
    }
    setServices((prev) => [...prev, { name: serviceName.trim(), priceCents }]);
    setServiceName("");
    setServicePrice("");
    setErrorMsg(null);
  }

  function removeService(index: number) {
    setServices((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setErrorMsg(null);
    if (!categoryId) {
      setErrorMsg("Escolha ao menos uma categoria.");
      return;
    }
    if (services.length === 0) {
      setErrorMsg("Adicione ao menos um serviço.");
      return;
    }
    if (!hasDocument) {
      setErrorMsg("Envie uma foto do seu documento de identidade.");
      return;
    }
    try {
      await upsertProfile.mutateAsync({
        headline: headline.trim(),
        bio: bio.trim() || undefined,
        yearsExperience: Number(yearsExperience) || 0,
        serviceRadiusKm: Number(serviceRadiusKm) || 10,
        categoryIds: [categoryId],
        services: services.map((s) => ({ ...s, categoryId })),
      });
      if (document) {
        await uploadDocument.mutateAsync({ base64: document.base64, mimeType: document.mimeType });
      }
      router.replace("/provider");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível enviar seu cadastro.");
    }
  }

  const submitting = upsertProfile.isPending || uploadDocument.isPending;
  const statusLabel = useMemo(
    () => (profile?.status ? STATUS_LABEL[profile.status] : null),
    [profile?.status],
  );

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        {statusLabel && (
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{statusLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Cadastro profissional</Text>
        <Text style={styles.subtitle}>
          Conte o que você faz e envie seu documento — clientes só te encontram depois da aprovação.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Categoria</Text>
          <View style={styles.chipRow}>
            {categories.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, categoryId === c.id && styles.chipActive]}
                onPress={() => setCategoryId(c.id)}
              >
                <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>O que você faz</Text>
          <TextInput
            value={headline}
            onChangeText={setHeadline}
            placeholder="Ex.: Eletricista"
            placeholderTextColor={theme.colors.mutedForeground}
            style={styles.input}
          />

          <Text style={styles.label}>Sobre você (opcional)</Text>
          <View style={styles.textArea}>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Experiência, especialidades..."
              placeholderTextColor={theme.colors.mutedForeground}
              multiline
              style={styles.textAreaInput}
            />
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Anos de experiência</Text>
              <TextInput
                value={yearsExperience}
                onChangeText={setYearsExperience}
                keyboardType="number-pad"
                placeholderTextColor={theme.colors.mutedForeground}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Raio de atuação (km)</Text>
              <TextInput
                value={serviceRadiusKm}
                onChangeText={setServiceRadiusKm}
                keyboardType="number-pad"
                placeholderTextColor={theme.colors.mutedForeground}
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Serviços e preços</Text>
          {services.map((s, i) => (
            <View key={`${s.name}-${i}`} style={styles.serviceRow}>
              <Text style={styles.serviceRowName}>{s.name}</Text>
              <Text style={styles.serviceRowPrice}>R$ {(s.priceCents / 100).toFixed(2)}</Text>
              <Pressable onPress={() => removeService(i)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.destructive} />
              </Pressable>
            </View>
          ))}
          <View style={styles.addServiceRow}>
            <TextInput
              value={serviceName}
              onChangeText={setServiceName}
              placeholder="Nome do serviço"
              placeholderTextColor={theme.colors.mutedForeground}
              style={[styles.input, { flex: 2 }]}
            />
            <TextInput
              value={servicePrice}
              onChangeText={setServicePrice}
              placeholder="Preço"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.colors.mutedForeground}
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable style={styles.addServiceButton} onPress={addService} hitSlop={10}>
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          </View>

          <Text style={styles.label}>Documento de identidade</Text>
          {document || profile?.hasDocument ? (
            <View style={[styles.doneCard]}>
              {document ? (
                <Image source={{ uri: document.uri }} style={styles.docThumb} />
              ) : (
                <View style={styles.doneIcon}>
                  <Ionicons name="checkmark" size={20} color={theme.colors.success} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.doneTitle}>Documento enviado</Text>
                <Text style={styles.doneMeta}>Toque em substituir para trocar a foto</Text>
              </View>
              <Pressable onPress={pickDocument}>
                <Text style={styles.replaceText}>Substituir</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.uploadCard} onPress={pickDocument}>
              <View style={styles.uploadIcon}>
                <Ionicons name="camera-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={styles.uploadTitle}>Enviar documento com foto</Text>
              <Text style={styles.uploadText}>RG, CNH ou outro documento oficial com foto</Text>
              <View style={styles.uploadButton}>
                <Text style={styles.uploadButtonText}>Escolher foto</Text>
              </View>
            </Pressable>
          )}

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.success} />
          <Text style={styles.secureText}>Seus dados são criptografados e nunca compartilhados</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { opacity: pressed || submitting || !canSubmit ? 0.7 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={submitting || !canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{profile ? "Atualizar cadastro" : "Enviar para análise"}</Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  statusChip: {
    backgroundColor: "rgba(255,102,0,0.14)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.7,
    lineHeight: 30,
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
    paddingTop: 20,
    paddingBottom: 30,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 9,
    marginTop: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  chipTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  input: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
  },
  textArea: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 17,
    padding: 15,
  },
  textAreaInput: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
    lineHeight: 22,
    minHeight: 66,
    textAlignVertical: "top",
  },
  row2: {
    flexDirection: "row",
    gap: 12,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  serviceRowName: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  serviceRowPrice: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  addServiceRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  addServiceButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
  docThumb: {
    width: 44,
    height: 44,
    borderRadius: 13,
  },
  doneTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  doneMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  replaceText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
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
  errorText: {
    marginTop: 16,
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
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

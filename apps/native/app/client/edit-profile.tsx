import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { initialsOf } from "@/lib/format";
import { formatPhone } from "@/lib/formatters/format-phone.helper";
import { useUpdateProfile, useUploadAvatar } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { Screen } from "@/components/ui/screen";

const editProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo."),
  phone: z.string(),
});

type EditProfileForm = z.infer<typeof editProfileSchema>;

const unformatPhone = (value: string) => value.replace(/\D/g, "");

export default function EditProfile() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: user?.fullName ?? "",
      phone: unformatPhone(user?.phone ?? ""),
    },
  });
  const fullName = useWatch({ control, name: "fullName" });

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setSubmitError("Precisamos de acesso às fotos para trocar sua foto de perfil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      base64: true,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setSubmitError(null);
    try {
      await uploadAvatar.mutateAsync({
        base64: asset.base64!,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    }
  }

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      await updateProfile.mutateAsync({
        fullName: data.fullName,
        phone: data.phone || undefined,
      });
      router.back();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  });

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Editar perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.avatarWrap} onPress={pickAvatar} disabled={uploadAvatar.isPending}>
          <Avatar
            initials={initialsOf(fullName || "?")}
            imageUri={user?.avatarUrl}
            size={96}
            fontSize={32}
            radius={30}
          />
          <View style={styles.avatarBadge}>
            {uploadAvatar.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </View>
        </Pressable>

        <FormTextField
          control={control}
          name="fullName"
          label="Nome completo"
          icon="person-outline"
          placeholder="Seu nome"
          autoCapitalize="words"
          containerStyle={styles.fieldSpacing}
        />

        <FormTextField
          control={control}
          name="phone"
          label="Celular"
          icon="phone-portrait-outline"
          placeholder="(11) 90000-0000"
          keyboardType="phone-pad"
          formatValue={formatPhone}
          parseValue={unformatPhone}
          containerStyle={styles.fieldSpacing}
        />

        <View style={[styles.fieldBlock, styles.fieldSpacing]}>
          <Text style={styles.label}>E-mail</Text>
          <View style={[styles.field, styles.fieldDisabled]}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.mutedForeground} />
            <Text style={styles.fieldStatic}>{user?.email}</Text>
          </View>
        </View>

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { opacity: pressed || updateProfile.isPending ? 0.9 : 1 },
          ]}
          onPress={onValid}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Salvar alterações</Text>
          )}
        </Pressable>
      </View>
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
    alignItems: "center",
  },
  avatarWrap: {
    marginBottom: 24,
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  fieldSpacing: {
    width: "100%",
  },
  fieldBlock: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 8,
  },
  field: {
    height: 54,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  fieldStatic: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  submitError: {
    marginTop: 6,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: "rgba(15,15,38,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  submit: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
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

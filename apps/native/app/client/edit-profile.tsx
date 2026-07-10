import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { initialsOf } from "@/lib/format";
import { useUpdateProfile, useUploadAvatar } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

export default function EditProfile() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("Precisamos de acesso às fotos para trocar sua foto de perfil.");
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
    setErrorMsg(null);
    try {
      await uploadAvatar.mutateAsync({
        base64: asset.base64!,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    }
  }

  async function handleSave() {
    if (fullName.trim().length < 2) {
      setErrorMsg("Informe seu nome completo.");
      return;
    }
    setErrorMsg(null);
    try {
      await updateProfile.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

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

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Nome completo</Text>
          <View style={styles.field}>
            <Ionicons name="person-outline" size={18} color={theme.colors.mutedForeground} />
            <TextInput
              style={styles.fieldValue}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Seu nome"
              placeholderTextColor={theme.colors.mutedForeground}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Celular</Text>
          <View style={styles.field}>
            <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.mutedForeground} />
            <TextInput
              style={styles.fieldValue}
              value={phone}
              onChangeText={setPhone}
              placeholder="(11) 90000-0000"
              placeholderTextColor={theme.colors.mutedForeground}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>E-mail</Text>
          <View style={[styles.field, styles.fieldDisabled]}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.mutedForeground} />
            <Text style={styles.fieldStatic}>{user?.email}</Text>
          </View>
        </View>

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || updateProfile.isPending ? 0.9 : 1 }]}
          onPress={handleSave}
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
  fieldBlock: {
    width: "100%",
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
  fieldValue: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.semiBold,
    color: "#fff",
  },
  fieldStatic: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  error: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    marginTop: 6,
    alignSelf: "flex-start",
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

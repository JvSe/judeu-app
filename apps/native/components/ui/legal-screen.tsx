import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";

export type LegalSection = { heading: string; body: string };

// Layout compartilhado pelas telas de conteúdo jurídico (Termos de uso,
// Política de privacidade) — só o texto muda entre elas (RNF-4, LGPD).
export function LegalScreen({
  title,
  updatedAt,
  sections,
}: {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.updatedAt}>Atualizado em {updatedAt}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  heading: {
    fontSize: 21,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.4,
  },
  updatedAt: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    lineHeight: 21,
  },
}));

import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { aiAvailable } from "@/lib/assistant";
import { useCategories } from "@/lib/hooks";
import { AiAssistant } from "@/components/ai-assistant";
import { Screen } from "@/components/ui/screen";

export default function Explore() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: categories = [], isLoading } = useCategories();

  // Caminho primário: assistente de IA conversacional on-device (RF-J).
  if (aiAvailable()) {
    return (
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <Text style={styles.eyebrow}>Assistente Ajuda+</Text>
          <Text style={styles.heading}>Do que você{"\n"}precisa hoje?</Text>
        </View>
        <AiAssistant />
      </Screen>
    );
  }

  // Fallback tradicional (RF-C4): grid de categorias — usado em Expo Go / web ou
  // dispositivo sem o runtime nativo do ExecuTorch (build de desenvolvimento necessário).
  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.eyebrow}>Explorar</Text>
        <Text style={styles.heading}>O que você{"\n"}precisa resolver?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.aiBanner}>
          <Ionicons name="sparkles" size={18} color={theme.colors.primary} />
          <Text style={styles.aiBannerText}>
            O assistente de IA roda no aparelho e precisa de um build de desenvolvimento. Enquanto
            isso, escolha uma categoria:
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.grid}>
            {categories.map((category) => (
              <View
                key={category.id}
                style={[styles.categoryCard, category.featured && styles.categoryCardFeatured]}
              >
                <Ionicons
                  name={(category.icon ?? "pricetag") as React.ComponentProps<typeof Ionicons>["name"]}
                  size={28}
                  color={category.featured ? "#fff" : theme.colors.primary}
                />
                <View>
                  <Text style={[styles.categoryName, category.featured && styles.categoryNameFeatured]}>
                    {category.name}
                  </Text>
                  <Text
                    style={[styles.categoryCount, category.featured && styles.categoryCountFeatured]}
                  >
                    {category.count} {category.count === 1 ? "prestador" : "prestadores"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  eyebrow: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontFamily: fonts.semiBold,
  },
  heading: {
    fontSize: 32,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.8,
    lineHeight: 36,
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
  },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    padding: 13,
    marginBottom: 18,
  },
  aiBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.foreground,
    lineHeight: 17,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
  },
  categoryCard: {
    width: "47%",
    height: 130,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xxl,
    padding: 18,
    justifyContent: "space-between",
  },
  categoryCardFeatured: {
    backgroundColor: theme.colors.primary,
    borderWidth: 0,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  categoryName: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  categoryNameFeatured: {
    color: "#fff",
  },
  categoryCount: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  categoryCountFeatured: {
    color: "rgba(255,255,255,0.85)",
  },
}));

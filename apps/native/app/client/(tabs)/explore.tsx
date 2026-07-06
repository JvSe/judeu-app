import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { useCategories } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

const popularRequests = [
  { id: "1", title: "Instalação de tomada", price: 80 },
  { id: "2", title: "Troca de chuveiro", price: 120 },
];

export default function Explore() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: categories = [], isLoading } = useCategories();

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.eyebrow}>Explorar</Text>
        <Text style={styles.heading}>O que você{"\n"}precisa resolver?</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.mutedForeground} />
          <Text style={styles.searchPlaceholder}>Buscar serviço</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <Text style={styles.sectionTitle}>Mais pedidos</Text>
        <View style={{ gap: 10 }}>
          {popularRequests.map((request) => (
            <Pressable
              key={request.id}
              style={({ pressed }) => [styles.requestRow, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.push("/client/create-order" as never)}
            >
              <View style={styles.requestIcon}>
                <Ionicons name="flash" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.requestPrice}>a partir de R$ {request.price}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
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
  searchBar: {
    marginTop: 18,
    height: 50,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 15,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: theme.colors.mutedForeground,
    fontFamily: fonts.medium,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 120,
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
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 22,
    marginBottom: 13,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 18,
    padding: 13,
  },
  requestIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  requestTitle: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  requestPrice: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
}));

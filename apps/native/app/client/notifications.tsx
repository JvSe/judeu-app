import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { notifications, type NotificationTone } from "@/lib/mock-data";
import { Screen } from "@/components/ui/screen";

const filters = ["Todas", "Pedidos", "Promoções"];

export default function Notifications() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  const toneColor = (tone: NotificationTone) => {
    switch (tone) {
      case "success":
        return theme.colors.success;
      case "info":
        return theme.colors.info;
      case "star":
        return "#FF9a2e";
      default:
        return theme.colors.primary;
    }
  };

  const toneBg = (tone: NotificationTone) => {
    switch (tone) {
      case "success":
        return "rgba(49,208,127,0.14)";
      case "info":
        return "rgba(90,169,255,0.14)";
      case "star":
        return "rgba(255,154,46,0.12)";
      default:
        return "rgba(255,102,0,0.14)";
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>
            <Text style={styles.heading}>Notificações</Text>
          </View>
          <Text style={styles.markRead}>Marcar lidas</Text>
        </View>
        <View style={styles.filters}>
          {filters.map((filter, index) => (
            <View key={filter} style={[styles.filter, index === 0 && styles.filterActive]}>
              <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{filter}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notifications.map((group) => (
          <Fragment key={group.label}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map((item) => (
              <View key={item.id} style={[styles.card, item.unread && styles.cardUnread, item.dim && styles.cardDim]}>
                <View style={[styles.cardIcon, { backgroundColor: toneBg(item.tone) }]}>
                  <Ionicons name={item.icon} size={20} color={toneColor(item.tone)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, item.dim && styles.cardTitleDim]}>{item.title}</Text>
                  <Text style={styles.cardMeta}>{item.meta}</Text>
                </View>
                {item.unread && <View style={styles.unreadDot} />}
              </View>
            ))}
          </Fragment>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heading: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
  },
  markRead: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  filters: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
  },
  filter: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  filterActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  filterTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  groupLabel: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: "#6b699a",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 10,
  },
  card: {
    flexDirection: "row",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: "rgba(255,102,0,0.3)",
  },
  cardDim: {
    backgroundColor: "rgba(28,28,58,0.55)",
    borderColor: "transparent",
    opacity: 0.85,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
    lineHeight: 20,
  },
  cardTitleDim: {
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 3,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
  },
}));

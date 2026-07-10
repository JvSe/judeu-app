import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { NotificationItem } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { dateGroupLabel, relativeTime } from "@/lib/format";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useSetNotificationPreferences,
} from "@/lib/hooks";
import { pathForNotification } from "@/lib/notifications";
import { Screen } from "@/components/ui/screen";

type Filter = "all" | "ORDER" | "MESSAGE";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "ORDER", label: "Pedidos" },
  { key: "MESSAGE", label: "Mensagens" },
];

function iconFor(type: NotificationItem["type"]): React.ComponentProps<typeof Ionicons>["name"] {
  return type === "MESSAGE" ? "chatbubble-ellipses" : "cube-outline";
}

export default function ProviderNotifications() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useNotifications({ poll: true });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { data: preferences } = useNotificationPreferences();
  const setPreferences = useSetNotificationPreferences();

  const items = useMemo(() => {
    const all = data?.notifications ?? [];
    return filter === "all" ? all : all.filter((n) => n.type === filter);
  }, [data, filter]);

  const groups = useMemo(() => {
    const byLabel = new Map<string, NotificationItem[]>();
    for (const item of items) {
      const label = dateGroupLabel(item.createdAt);
      const group = byLabel.get(label) ?? [];
      group.push(item);
      byLabel.set(label, group);
    }
    return Array.from(byLabel.entries()).map(([label, list]) => ({ label, items: list }));
  }, [items]);

  const openNotification = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    const path = pathForNotification(item.data ?? {});
    if (path) router.push(path as never);
  };

  const toneColor = (type: NotificationItem["type"]) =>
    type === "MESSAGE" ? theme.colors.info : theme.colors.primary;
  const toneBg = (type: NotificationItem["type"]) =>
    type === "MESSAGE" ? "rgba(90,169,255,0.14)" : "rgba(255,102,0,0.14)";

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
          <Pressable
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || !(data?.unreadCount ?? 0)}
            hitSlop={10}
          >
            <Text style={styles.markRead}>Marcar lidas</Text>
          </Pressable>
        </View>
        <View style={styles.filters}>
          {filters.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)}>
              <View style={[styles.filter, filter === f.key && styles.filterActive]}>
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>RECEBER NOTIFICAÇÕES DE</Text>
        <View style={styles.prefsGroup}>
          {(
            [
              { key: "notifyOrders" as const, icon: "cube-outline" as const, label: "Pedidos", detail: "Novo pedido e mudanças de status" },
              { key: "notifyMessages" as const, icon: "chatbubble-ellipses-outline" as const, label: "Mensagens", detail: "Chat com o cliente" },
            ]
          ).map((pref, index) => {
            const on = preferences?.[pref.key] ?? true;
            return (
              <Fragment key={pref.key}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.prefRow}>
                  <View style={[styles.prefIcon, !on && styles.prefIconOff]}>
                    <Ionicons
                      name={pref.icon}
                      size={18}
                      color={on ? theme.colors.primary : theme.colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prefLabel}>{pref.label}</Text>
                    <Text style={styles.prefDetail}>{pref.detail}</Text>
                  </View>
                  <Pressable
                    style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
                    disabled={setPreferences.isPending}
                    onPress={() => setPreferences.mutate({ [pref.key]: !on })}
                  >
                    <View style={[styles.knob, on ? styles.knobOn : styles.knobOff, !on && styles.knobOffColor]} />
                  </Pressable>
                </View>
              </Fragment>
            );
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={28} color={theme.colors.mutedForeground} />
            <Text style={styles.emptyText}>Nenhuma notificação por aqui ainda</Text>
          </View>
        ) : (
          groups.map((group) => (
            <Fragment key={group.label}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.items.map((item) => (
                <Pressable key={item.id} onPress={() => openNotification(item)}>
                  <View style={[styles.card, !item.readAt && styles.cardUnread]}>
                    <View style={[styles.cardIcon, { backgroundColor: toneBg(item.type) }]}>
                      <Ionicons name={iconFor(item.type)} size={20} color={toneColor(item.type)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.cardBody} numberOfLines={2}>
                        {item.body}
                      </Text>
                      <Text style={styles.cardMeta}>{relativeTime(item.createdAt)}</Text>
                    </View>
                    {!item.readAt && <View style={styles.unreadDot} />}
                  </View>
                </Pressable>
              ))}
            </Fragment>
          ))
        )}
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
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: "#6b699a",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  prefsGroup: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 18,
    padding: 6,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 12,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  prefIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(255,102,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  prefIconOff: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  prefLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  prefDetail: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  toggle: {
    width: 42,
    height: 25,
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
    width: 19,
    height: 19,
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
  cardBody: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    marginTop: 2,
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
  empty: {
    alignItems: "center",
    gap: 10,
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
}));

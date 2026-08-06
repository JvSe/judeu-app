import "@/unistyles";
import { Tabs } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

import { TabBarIcon } from "@/components/tabbar-icon";
import { isOrderActive } from "@/lib/format";
import { useOrders } from "@/lib/hooks";

export const clientFloatingTabBarStyle = {
  position: "absolute" as const,
  start: 16,
  end: 16,
  bottom: 26,
  height: 64,
  borderRadius: 22,
  backgroundColor: "#14142cE6",
  borderTopWidth: 0,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
};

export default function ClientTabLayout() {
  const { theme } = useUnistyles();
  const { data: orders = [] } = useOrders("client", { poll: true });
  const unreadMessages = orders
    .filter((o) => isOrderActive(o.status))
    .reduce((sum, o) => sum + o.unreadMessages, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarStyle: clientFloatingTabBarStyle,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontFamily: "PlusJakartaSans_700Bold",
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Buscar",
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          tabBarIcon: ({ color }) => <TabBarIcon name="receipt-outline" color={color} />,
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.destructive,
            color: theme.colors.destructiveForeground,
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <TabBarIcon name="person-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}

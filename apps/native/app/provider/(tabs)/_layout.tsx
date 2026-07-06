import "@/unistyles";
import { Tabs } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

import { TabBarIcon } from "@/components/tabbar-icon";

export default function ProviderTabLayout() {
  const { theme } = useUnistyles();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 26,
          height: 64,
          borderRadius: 22,
          backgroundColor: "#14142cE6",
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        },
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
          title: "Painel",
          tabBarIcon: ({ color }) => <TabBarIcon name="grid" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Mapa",
          tabBarIcon: ({ color }) => <TabBarIcon name="map-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Ganhos",
          tabBarIcon: ({ color }) => <TabBarIcon name="cash-outline" color={color} />,
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

import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";

export const PlaceholderScreen = ({
  icon,
  title,
  description,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
}) => {
  const { theme } = useUnistyles();
  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={30} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: theme.fontSize.xl,
    color: theme.colors.foreground,
  },
  description: {
    fontFamily: fonts.medium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
}));

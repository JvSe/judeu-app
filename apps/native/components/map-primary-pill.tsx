import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

type MapPrimaryPillProps = {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function MapPrimaryPill({
  label,
  icon,
  onPress,
  disabled = false,
  loading = false,
}: MapPrimaryPillProps) {
  const { theme } = useUnistyles();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        disabled && !loading && styles.pillDisabled,
        { opacity: disabled && !loading ? 0.72 : pressed && !loading ? 0.9 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={theme.colors.primaryForeground} /> : null}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    alignSelf: "stretch",
    height: 58,
    borderRadius: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pillDisabled: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  label: {
    color: theme.colors.primaryForeground,
    fontSize: 16.5,
    fontFamily: fonts.bold,
  },
}));

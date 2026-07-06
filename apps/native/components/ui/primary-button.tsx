import "@/unistyles";
import { Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

export const PrimaryButton = ({
  label,
  onPress,
  variant = "solid",
}: {
  label: string;
  onPress?: () => void;
  variant?: "solid" | "ghost";
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "ghost" && styles.ghost,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.label, variant === "ghost" && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create((theme) => ({
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    color: theme.colors.primaryForeground,
    fontFamily: fonts.bold,
    fontSize: theme.fontSize.base,
  },
  ghostLabel: {
    color: theme.colors.mutedForeground,
  },
}));

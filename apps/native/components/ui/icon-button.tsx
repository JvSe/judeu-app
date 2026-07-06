import "@/unistyles";
import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export const IconButton = ({
  children,
  onPress,
  size = 48,
  variant = "glass",
}: {
  children: ReactNode;
  onPress?: () => void;
  size?: number;
  variant?: "glass" | "solid";
}) => {
  if (variant === "solid") {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.solid,
          { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <BlurView
        intensity={40}
        tint="dark"
        style={[styles.glass, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {children}
      </BlurView>
    </Pressable>
  );
};

const styles = StyleSheet.create((theme) => ({
  glass: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28,28,58,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  solid: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
}));

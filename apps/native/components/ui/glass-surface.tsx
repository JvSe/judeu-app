import "@/unistyles";
import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export const GlassSurface = ({
  children,
  style,
  intensity = 40,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) => {
  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.surface, style]}>
      {children}
    </BlurView>
  );
};

const styles = StyleSheet.create((theme) => ({
  surface: {
    overflow: "hidden",
    backgroundColor: "rgba(28,28,58,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
}));

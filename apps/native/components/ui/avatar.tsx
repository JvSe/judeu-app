import "@/unistyles";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

export const Avatar = ({
  initials,
  size = 46,
  color,
  fontSize,
  radius,
}: {
  initials: string;
  size?: number;
  color?: string;
  fontSize?: number;
  radius?: number;
}) => {
  const { theme } = useUnistyles();
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius ?? size / 2,
          backgroundColor: color ?? theme.colors.primary,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: fontSize ?? size * 0.32 }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: theme.colors.primaryForeground,
    fontFamily: fonts.bold,
  },
}));

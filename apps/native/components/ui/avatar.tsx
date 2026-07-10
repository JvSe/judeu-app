import "@/unistyles";
import { Image, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

export const Avatar = ({
  initials,
  imageUri,
  size = 46,
  color,
  fontSize,
  radius,
}: {
  initials: string;
  imageUri?: string | null;
  size?: number;
  color?: string;
  fontSize?: number;
  radius?: number;
}) => {
  const { theme } = useUnistyles();
  const dimensions = { width: size, height: size, borderRadius: radius ?? size / 2 };

  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={dimensions} />;
  }

  return (
    <View style={[styles.circle, dimensions, { backgroundColor: color ?? theme.colors.primary }]}>
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

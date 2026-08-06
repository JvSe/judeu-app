import "@/unistyles";
import { StyleProp, Text, TextStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

export function FormErrorText({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.error, style]}>{children}</Text>;
}

const styles = StyleSheet.create((theme) => ({
  error: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    marginTop: 6,
  },
}));

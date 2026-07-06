import "@/unistyles";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export const Screen = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  return (
    <View style={[styles.screen, style]}>
      <StatusBar style="light" />
      {children}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

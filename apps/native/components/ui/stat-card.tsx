import "@/unistyles";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

export const StatCard = ({ value, label }: { value: string; label: string }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    flex: 1,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 13,
    alignItems: "center",
  },
  value: {
    fontSize: theme.fontSize.xl,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
}));

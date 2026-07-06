import "@/unistyles";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export const MapBackdrop = ({ children }: { children?: ReactNode }) => {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={["#1c1c40", "#0f0f26"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.gridLine, { top: "18%" }]} />
      <View style={[styles.gridLine, { top: "42%" }]} />
      <View style={[styles.gridLine, { top: "66%" }]} />
      <View style={[styles.gridColumn, { left: "22%" }]} />
      <View style={[styles.gridColumn, { left: "70%" }]} />
      <View style={[styles.block, { top: "28%", left: "32%" }]} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  wrap: {
    flex: 1,
    overflow: "hidden",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 9,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  gridColumn: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 9,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  block: {
    position: "absolute",
    width: 90,
    height: 110,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 6,
  },
}));

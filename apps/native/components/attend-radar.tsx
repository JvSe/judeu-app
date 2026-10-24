import "@/unistyles";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useUnistyles } from "react-native-unistyles";

function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return `rgba(255,102,0,${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function RadarPulse({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.62 * (1 - progress.value),
    transform: [{ scale: 0.2 + progress.value * 1.8 }],
  }));

  return <Animated.View style={[styles.pulse, { backgroundColor: color }, style]} />;
}

export function AttendRadar() {
  const { theme } = useUnistyles();
  const color = theme.colors.primary;
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false);
  }, [spin]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.disc}>
        <Animated.View style={[styles.sweep, sweep]}>
          <LinearGradient
            colors={["transparent", withAlpha(color, 0.05), withAlpha(color, 0.7)]}
            locations={[0.45, 0.72, 1]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 0.2 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <RadarPulse delay={0} color={color} />
        <RadarPulse delay={1100} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  disc: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  sweep: {
    width: 250,
    height: 250,
    borderRadius: 125,
    overflow: "hidden",
  },
});

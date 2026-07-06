import "@/unistyles";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Avatar } from "@/components/ui/avatar";

export const SelfMarker = ({ size = 22, top, left }: { size?: number; top: number; left: number }) => {
  const { theme } = useUnistyles();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 0.5 + pulse.value * 2.2 }],
  }));

  return (
    <View style={{ position: "absolute", top, left, transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }] }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.primary,
            top: 0,
            left: 0,
          },
          pulseStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.primary,
          borderWidth: 3,
          borderColor: "#fff",
        }}
      />
    </View>
  );
};

export const ProviderMarker = ({
  initials,
  color,
  size = 46,
  top,
  left,
  highlighted,
}: {
  initials: string;
  color: string;
  size?: number;
  top: number;
  left: number;
  highlighted?: boolean;
}) => {
  const { theme } = useUnistyles();
  return (
    <View
      style={[
        styles.wrap,
        {
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
          borderColor: highlighted ? theme.colors.primary : "rgba(255,255,255,0.2)",
        },
      ]}
    >
      <Avatar initials={initials} color={color} size={size - 6} />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  wrap: {
    position: "absolute",
    backgroundColor: "#1c1c40",
    borderWidth: 2,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
}));

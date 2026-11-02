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
import { JudeuPin } from "@/components/ui/judeu-pin";

export const SelfMarker = ({
  size = 22,
  color,
}: {
  size?: number;
  color?: string;
}) => {
  const { theme } = useUnistyles();
  const fill = color ?? theme.colors.primary;
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
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: fill,
          },
          pulseStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderWidth: 3,
          borderColor: "#fff",
        }}
      />
    </View>
  );
};

/** Pin das ajudas abertas no mapa (pin.svg). */
export const HelpMarker = ({
  size = 44,
  highlighted,
}: {
  size?: number;
  highlighted?: boolean;
}) => {
  const height = size * (566 / 482);
  return (
    <View style={{ width: size * 1.08, height: height * 1.08, alignItems: "center" }}>
      <JudeuPin size={size} highlighted={highlighted} />
    </View>
  );
};

export const ProviderMarker = ({
  initials,
  color,
  imageUri,
  size = 46,
  highlighted,
}: {
  initials: string;
  color: string;
  imageUri?: string | null;
  size?: number;
  highlighted?: boolean;
}) => {
  const { theme } = useUnistyles();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: highlighted ? theme.colors.primary : "rgba(255,255,255,0.2)",
        },
      ]}
    >
      <Avatar initials={initials} imageUri={imageUri} color={color} size={size - 6} />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  wrap: {
    backgroundColor: "#1c1c40",
    borderWidth: 2,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
}));

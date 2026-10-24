import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
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

/** Pin circular das ajudas acionadas no mapa. */
export const HelpMarker = ({
  size = 44,
  highlighted,
}: {
  size?: number;
  highlighted?: boolean;
}) => {
  const { theme } = useUnistyles();
  return (
    <View style={{ width: size, height: size + 6, alignItems: "center" }}>
      <View
        style={[
          helpStyles.pin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: highlighted ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        <Ionicons name="hand-left" size={size * 0.42} color={theme.colors.foreground} />
        <View style={[helpStyles.badge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
          <Ionicons name="flash" size={9} color={theme.colors.primaryForeground} />
        </View>
      </View>
    </View>
  );
};

const helpStyles = StyleSheet.create((theme) => ({
  pin: {
    backgroundColor: theme.colors.secondary,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
}));

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

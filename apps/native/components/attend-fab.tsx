import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

type AttendFabProps = {
  active: boolean;
  pending: boolean;
  onPress: () => void;
};

export function AttendFab({ active, pending, onPress }: AttendFabProps) {
  const pulse = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
    bob.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: active ? 0 : 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }));

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: active ? 0 : (bob.value - 0.5) * 6 }],
  }));

  return (
    <View style={styles.row}>
      {!active && (
        <Animated.View style={[styles.bubbleRow, bobStyle]}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>Deseja Atender</Text>
          </View>
          <View style={styles.tail} />
        </Animated.View>
      )}
      <Pressable
        onPress={onPress}
        disabled={pending}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={active ? "Parar de atender" : "Deseja Atender"}
        style={styles.hit}
      >
        {!active && <Animated.View style={[styles.pulse, pulseStyle]} />}
        <View style={[styles.button, pending && styles.buttonPending]}>
          <Ionicons name={active ? "close" : "hand-left"} size={26} color="#fff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  bubble: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  bubbleText: {
    color: "#14142C",
    fontSize: 14,
    fontFamily: fonts.extraBold,
  },
  tail: {
    width: 0,
    height: 0,
    marginLeft: -1,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#fff",
  },
  hit: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonPending: {
    opacity: 0.7,
  },
}));

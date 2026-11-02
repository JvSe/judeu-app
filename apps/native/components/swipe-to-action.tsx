import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

const THUMB = 48;
const COMPLETE_RATIO = 0.8;

type SwipeToActionProps = {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
  accentColor?: string;
  accessibilityHint?: string;
};

export function SwipeToAction({
  label,
  onComplete,
  disabled = false,
  accentColor,
  accessibilityHint = "Arraste até o fim ou mantenha pressionado para confirmar",
}: SwipeToActionProps) {
  const { theme } = useUnistyles();
  const color = accentColor ?? theme.colors.primary;
  const trackWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [label, disabled, translateX]);

  const finish = () => {
    onComplete();
    translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      "worklet";
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      "worklet";
      const max = Math.max(0, trackWidth.value - THUMB - 8);
      const next = Math.min(max, Math.max(0, startX.value + event.translationX));
      translateX.value = next;
    })
    .onEnd(() => {
      "worklet";
      const max = Math.max(0, trackWidth.value - THUMB - 8);
      if (max > 0 && translateX.value >= max * COMPLETE_RATIO) {
        translateX.value = withSpring(max, { damping: 18, stiffness: 220 });
        runOnJS(finish)();
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const longPress = Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(650)
    .onEnd((_event, success) => {
      "worklet";
      if (success) runOnJS(finish)();
    });

  const gesture = Gesture.Exclusive(pan, longPress);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB / 2,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        accessibilityActions={disabled ? undefined : [{ name: "activate" }]}
        onAccessibilityAction={(event) => {
          if (!disabled && event.nativeEvent.actionName === "activate") finish();
        }}
        style={[styles.track, disabled && styles.trackDisabled]}
        onLayout={(event) => {
          trackWidth.value = event.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[styles.fill, { backgroundColor: `${color}22` }, fillStyle]} />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Animated.View style={[styles.thumb, { backgroundColor: color }, thumbStyle]}>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
          <Ionicons name="chevron-forward" size={16} color="#fff" style={styles.chevronOverlap} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    overflow: "hidden",
    justifyContent: "center",
  },
  trackDisabled: {
    opacity: 0.55,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 28,
  },
  label: {
    textAlign: "center",
    paddingHorizontal: THUMB + 12,
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#14142e",
  },
  thumb: {
    position: "absolute",
    left: 4,
    top: 4,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  chevronOverlap: {
    marginLeft: -10,
  },
}));

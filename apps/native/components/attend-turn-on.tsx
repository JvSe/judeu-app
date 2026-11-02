import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet as RNStyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { MapStatusCard } from "@/components/map-status-card";
import { JudeuIcon } from "@/components/ui/judeu-icon";
import { fonts } from "@/constants/fonts";

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

const LAYOUT = LinearTransition.duration(220).easing(EASE_OUT);
const CARD_ENTER = FadeInDown.duration(260)
  .easing(EASE_OUT)
  .withInitialValues({
    opacity: 0,
    transform: [{ translateY: 12 }],
  });
const CARD_EXIT = FadeOutUp.duration(180).easing(EASE_IN);
const TRIGGER_ENTER = FadeIn.duration(200).easing(EASE_OUT);
const TRIGGER_EXIT = FadeOut.duration(140).easing(EASE_IN);

type AttendTurnOnProps = {
  needsSignup: boolean;
  pending?: boolean;
  onSwipe: () => void;
};

export function AttendTurnOn({
  needsSignup,
  pending = false,
  onSwipe,
}: AttendTurnOnProps) {
  const { theme } = useUnistyles();
  const [open, setOpen] = useState(false);

  // Primeiro acesso: botão leva direto ao cadastro.
  // Depois do cadastro: abre o card com swipe para ligar/desligar.
  const title = needsSignup ? "Quero atender" : "Pronto para ajudar?";
  const showPanel = open && !needsSignup;

  return (
    <Animated.View
      layout={LAYOUT}
      style={showPanel ? styles.openShell : styles.closedShell}
    >
      {showPanel ? (
        <Animated.View
          key="open"
          entering={CARD_ENTER}
          exiting={CARD_EXIT}
          style={[styles.panel, { backgroundColor: theme.colors.success }]}
        >
          <View style={styles.panelHeader}>
            <Text style={styles.panelKicker}>Atender</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={10}
              onPress={() => setOpen(false)}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
          <MapStatusCard
            embedded
            title={title}
            swipeLabel="Arraste para atender"
            onSwipe={onSwipe}
            swipeDisabled={pending}
            accentColor={theme.colors.success}
          />
        </Animated.View>
      ) : (
        <Animated.View
          key="closed"
          entering={TRIGGER_ENTER}
          exiting={TRIGGER_EXIT}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: false, disabled: pending }}
            disabled={pending}
            onPress={() => {
              if (needsSignup) {
                onSwipe();
                return;
              }
              setOpen(true);
            }}
            style={({ pressed }) => [
              styles.trigger,
              { backgroundColor: theme.colors.success, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <JudeuIcon size={18} />
            <Text style={styles.triggerLabel}>{title}</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  closedShell: {
    alignSelf: "flex-end",
  },
  openShell: {
    alignSelf: "stretch",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 16,
    borderWidth: RNStyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  triggerLabel: {
    color: "#fff",
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  panel: {
    alignSelf: "stretch",
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  panelKicker: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "rgba(255,255,255,0.85)",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
});

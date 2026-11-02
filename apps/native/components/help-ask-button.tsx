import "@/unistyles";
import { type ComponentType, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { JudeuIcon } from "@/components/ui/judeu-icon";
import { fonts } from "@/constants/fonts";

type ChromaRingProps = {
  width?: number;
  height?: number;
  borderRadius?: number;
  borderWidth?: number;
  speed?: number;
  base?: string;
  glow?: string;
  background?: string;
  children?: React.ReactNode;
};

function loadChromaRing(): ComponentType<ChromaRingProps> | null {
  try {
    // Skia is native-only; keep the home screen usable if the module is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/components/ui/organisms/chroma-ring").ChromaRing;
  } catch {
    return null;
  }
}

type HelpAskButtonProps = {
  width: number;
  onPress: () => void;
};

export function HelpAskButton({ width, onPress }: HelpAskButtonProps) {
  const { theme } = useUnistyles();
  const ChromaRing = useMemo(() => loadChromaRing(), []);

  if (!ChromaRing) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Precisa de ajuda?"
        onPress={onPress}
        style={styles.fallbackHit}
      >
        <View style={styles.fallbackPill}>
          <JudeuIcon size={22} />
          <Text style={styles.label}>Precisa de ajuda?</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Precisa de ajuda?"
      onPress={onPress}
      style={styles.hit}
    >
      <ChromaRing
        width={width}
        height={58}
        borderRadius={29}
        borderWidth={2.5}
        speed={1.15}
        base="#5C2800"
        glow="#FFB07A"
        background={theme.colors.primary}
      >
        <View style={styles.content}>
          <JudeuIcon size={22} />
          <Text style={styles.label}>Precisa de ajuda?</Text>
        </View>
      </ChromaRing>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  hit: {
    alignSelf: "stretch",
  },
  fallbackHit: {
    alignSelf: "stretch",
  },
  fallbackPill: {
    alignSelf: "stretch",
    height: 58,
    borderRadius: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.colors.primary,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    color: theme.colors.primaryForeground,
    fontSize: 16.5,
    fontFamily: fonts.bold,
  },
}));

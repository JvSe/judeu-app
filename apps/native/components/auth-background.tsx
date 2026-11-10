import { StyleSheet } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { GrainyGradient } from "@/components/ui/organisms/grainy-gradient";
import type { GrainyGradientColors } from "@/components/ui/organisms/grainy-gradient/types";

// Uma esfera por cor: laranja da marca a cerca de 11–15% sobre o fundo, bem discreto.
const SPHERES: GrainyGradientColors = ["#291922", "#331c20", "#2e1a21"];
const BACKGROUND = "#0f0f26";

/** Fundo animado das telas de autenticação. Deve ser o primeiro filho de `Screen`. */
export function AuthBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <GrainyGradient
      colors={SPHERES}
      background={BACKGROUND}
      sphereSharpness={3}
      amplitude={0.18}
      speed={0.8}
      animated={!reduceMotion}
      style={StyleSheet.absoluteFill}
    />
  );
}

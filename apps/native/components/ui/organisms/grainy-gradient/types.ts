import type { StyleProp, ViewStyle } from "react-native";

type GrainyGradientColors = [string, string?, string?, string?];

interface IGrainyGradient {
  width?: number;
  height?: number;
  colors?: GrainyGradientColors;
  speed?: number;
  animated?: boolean;
  intensity?: number;
  size?: number;
  enabled?: boolean;
  amplitude?: number;
  brightness?: number;
  /** Maior que 0: cada cor vira uma esfera sobre `background`. Valores maiores, esferas menores. */
  sphereSharpness?: number;
  background?: string;
  style?: StyleProp<ViewStyle>;
}

export type { IGrainyGradient, GrainyGradientColors };

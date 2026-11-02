import type { StyleProp, ViewStyle } from "react-native";

import { JudeuLogo } from "@/components/ui/judeu-logo";

type JudeuIconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Ícone compacto da marca (logo.svg) para botões e menus. */
export function JudeuIcon({
  size = 20,
  color = "#FFFFFF",
  style,
}: JudeuIconProps) {
  return <JudeuLogo size={size} color={color} style={style} />;
}

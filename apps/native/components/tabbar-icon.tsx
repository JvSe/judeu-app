import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";

type IoniconsProps = React.ComponentProps<typeof Ionicons>;

function ioniconColor(color: ColorValue): IoniconsProps["color"] {
  if (color == null || typeof color === "number") return undefined;
  return color;
}

export const TabBarIcon = ({
  color,
  ...props
}: {
  name: IoniconsProps["name"];
  color: ColorValue;
  focused?: boolean;
}) => {
  return <Ionicons size={22} color={ioniconColor(color)} {...props} />;
};

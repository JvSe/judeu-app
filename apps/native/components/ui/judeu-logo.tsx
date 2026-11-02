import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

const LOGO_ASPECT = 1415 / 1502;

type JudeuLogoProps = {
  /** Altura do símbolo. */
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Marca tipográfica do Judeu (logo.svg). */
export function JudeuLogo({
  size = 24,
  color = "#FFFFFF",
  style,
}: JudeuLogoProps) {
  const height = size;
  const width = size * LOGO_ASPECT;

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox="0 0 1415 1502" fill="none">
        <Path
          d="M716.898 653.066H41.3122C41.3122 653.066 0.0272575 660.572 0.0264338 619.286C0.0262983 612.495 0.0264079 144.875 0.0264301 50.2798L0.0264338 33.7793C0.0264341 -0.000182548 41.3122 0 41.3122 0H885.796C1062.2 0 1415 172.65 1415 608.027C1415 608.027 1411.25 653.066 1388.73 653.066H1223.59C1189.81 653.066 1189.81 619.286 1189.81 619.286C1187.31 495.429 1115.49 243.21 848.263 225.195H270.261C270.261 225.195 236.481 232.702 236.481 266.481V386.585C236.481 416.611 270.261 416.611 270.261 416.611H716.898C754.429 416.611 754.43 457.897 754.43 457.897V608.027C754.43 653.066 716.898 653.066 716.898 653.066Z"
          fill={color}
        />
        <Path
          d="M698.107 848.768L1373.69 848.768C1373.69 848.768 1414.98 841.262 1414.98 882.548C1414.98 889.339 1414.98 1356.96 1414.98 1451.55L1414.98 1468.05C1414.98 1501.83 1373.69 1501.83 1373.69 1501.83H529.209C352.806 1501.83 0.000366211 1329.18 0.000366211 893.807C0.000366211 893.807 3.75366 848.768 26.2732 848.768H191.416C225.196 848.768 225.196 882.548 225.196 882.548C227.698 1006.41 299.51 1258.62 566.742 1276.64H1144.74C1144.74 1276.64 1178.52 1269.13 1178.52 1235.35V1115.25C1178.52 1085.22 1144.74 1085.22 1144.74 1085.22H698.107C660.576 1085.22 660.575 1043.94 660.575 1043.94L660.575 893.807C660.575 848.768 698.107 848.768 698.107 848.768Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

type JudeuLogoBadgeProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Logo em badge laranja (substitui o icon.png em telas de marca). */
export function JudeuLogoBadge({ size = 62, style }: JudeuLogoBadgeProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: "#FF6600",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <JudeuLogo size={size * 0.52} color="#000052" />
    </View>
  );
}

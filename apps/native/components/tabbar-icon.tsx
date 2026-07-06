import Ionicons from "@expo/vector-icons/Ionicons";

type IoniconsProps = React.ComponentProps<typeof Ionicons>;

export const TabBarIcon = (props: {
  name: IoniconsProps["name"];
  color: IoniconsProps["color"];
  focused?: boolean;
}) => {
  return <Ionicons size={22} {...props} />;
};

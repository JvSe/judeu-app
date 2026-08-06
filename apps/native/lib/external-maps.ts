import { Linking, Platform } from "react-native";

type LatLng = { lat: number; lng: number };

export function openGoogleMapsNavigation(dest: LatLng, origin?: LatLng | null) {
  const destination = `${dest.lat},${dest.lng}`;
  const params = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  return Linking.openURL(`https://www.google.com/maps/dir/?${params.toString()}`);
}

export function openWazeNavigation(dest: LatLng) {
  const url = `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`;
  return Linking.openURL(url).catch(() => {
    if (Platform.OS === "ios") {
      return Linking.openURL(`waze://?ll=${dest.lat},${dest.lng}&navigate=yes`);
    }
    return Linking.openURL(url);
  });
}

import "@/unistyles";
import { Stack } from "expo-router";

export default function AiLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="offer" options={{ presentation: "transparentModal", animation: "fade" }} />
      <Stack.Screen name="chat" />
      <Stack.Screen name="result" />
    </Stack>
  );
}

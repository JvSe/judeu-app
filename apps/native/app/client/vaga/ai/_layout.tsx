import "@/unistyles";
import { Stack } from "expo-router";

export default function VagaAiLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="chat" />
      <Stack.Screen name="review" />
    </Stack>
  );
}

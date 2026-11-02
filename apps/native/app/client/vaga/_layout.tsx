import "@/unistyles";
import { Stack } from "expo-router";

export default function VagaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="applicants/[id]" />
      <Stack.Screen name="ai" />
    </Stack>
  );
}

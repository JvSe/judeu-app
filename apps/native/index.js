import notifee from "react-native-notify-kit";
import "./unistyles";

// Precisa ser registrado antes do app montar (doc do notifee) — eventos em
// background/killed de notificações exibidas pelo notifee (ver app/_layout.tsx).
notifee.onBackgroundEvent(async () => {});

import "expo-router/entry";

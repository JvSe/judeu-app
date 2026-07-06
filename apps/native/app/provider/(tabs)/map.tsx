import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Avatar } from "@/components/ui/avatar";
import { MapBackdrop } from "@/components/ui/map-backdrop";
import { SelfMarker } from "@/components/ui/map-marker";
import { Screen } from "@/components/ui/screen";

export default function ProviderMap() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const [hasRequest, setHasRequest] = useState(true);

  return (
    <Screen>
      <MapBackdrop>
        <Svg width="100%" height="100%" viewBox="0 0 402 874" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Path
            d="M115 440 L115 260 L294 260 L294 180"
            stroke={theme.colors.primary}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray="1 10"
            fill="none"
          />
        </Svg>
        <SelfMarker top={440} left={115} />
        <View style={styles.clientPin}>
          <View style={styles.clientPinBubble}>
            <Text style={styles.clientPinText}>Cliente · 2,4 km</Text>
          </View>
          <View style={styles.clientPinStem} />
        </View>
      </MapBackdrop>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable style={styles.onlinePill} onPress={() => setOnline((v) => !v)}>
          <View style={[styles.onlineDot, !online && styles.onlineDotOff]} />
          <Text style={[styles.onlineText, !online && styles.onlineTextOff]}>
            {online ? "Online" : "Offline"}
          </Text>
          <View style={[styles.toggle, online ? styles.toggleOn : styles.toggleOff]}>
            <View style={[styles.knob, online ? styles.knobOn : styles.knobOff]} />
          </View>
        </Pressable>
        <View style={styles.earningsPill}>
          <Ionicons name="logo-usd" size={15} color={theme.colors.primary} />
          <Text style={styles.earningsPillText}>R$ 350 hoje</Text>
        </View>
      </View>

      {hasRequest && online && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>NOVA CHAMADA</Text>
            </View>
            <View style={styles.countdown}>
              <Text style={styles.countdownText}>0:14 para aceitar</Text>
            </View>
          </View>

          <View style={styles.requestBody}>
            <Avatar initials="JS" color="#3a3a70" size={54} radius={16} />
            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>Instalação de tomada</Text>
              <View style={styles.requestMetaRow}>
                <View style={styles.ratingChip}>
                  <Text style={styles.ratingText}>★ 4.9</Text>
                </View>
                <Text style={styles.requestMeta}>João S. · 2,4 km · ~12 min</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.requestPrice}>R$ 80</Text>
              <Text style={styles.requestPix}>Pix na hora</Text>
            </View>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={theme.colors.mutedForeground} />
            <Text style={styles.addressText}>Rua das Acácias, 214 · Vila Mariana</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.declineButton} onPress={() => setHasRequest(false)}>
              <Text style={styles.declineText}>Recusar</Text>
            </Pressable>
            <Pressable style={styles.acceptButton} onPress={() => setHasRequest(false)}>
              <Text style={styles.acceptText}>Aceitar chamada</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  clientPin: {
    position: "absolute",
    top: 180,
    left: 294,
    alignItems: "center",
    transform: [{ translateX: -55 }, { translateY: -46 }],
  },
  clientPinBubble: {
    backgroundColor: "#fff",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  clientPinText: {
    fontSize: 12.5,
    fontFamily: fonts.extraBold,
    color: "#0d0d24",
  },
  clientPinStem: {
    width: 3,
    height: 12,
    backgroundColor: "#fff",
    borderRadius: 2,
    marginTop: 2,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: "rgba(49,208,127,0.4)",
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
  },
  onlineDotOff: {
    backgroundColor: theme.colors.mutedForeground,
  },
  onlineText: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: theme.colors.success,
  },
  onlineTextOff: {
    color: theme.colors.mutedForeground,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: theme.colors.success,
  },
  toggleOff: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    position: "absolute",
  },
  knobOn: {
    right: 3,
  },
  knobOff: {
    left: 3,
  },
  earningsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  earningsPillText: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#14142e",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  statusText: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  countdown: {
    backgroundColor: "rgba(255,102,0,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  countdownText: {
    fontSize: 12.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
  },
  requestBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  requestTitle: {
    fontSize: 16.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  requestMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  ratingChip: {
    backgroundColor: "rgba(255,102,0,0.16)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
  },
  requestMeta: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  requestPrice: {
    fontSize: 21,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  requestPix: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.success,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  addressText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  actions: {
    flexDirection: "row",
    gap: 11,
    marginTop: 15,
  },
  declineButton: {
    width: 110,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 15,
  },
  declineText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#c9c7e4",
  },
  acceptButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 15,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  acceptText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
}));

import "@/unistyles";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { SwipeToAction } from "@/components/swipe-to-action";
import { fonts } from "@/constants/fonts";

type MapStatusCardProps = {
  kicker?: string;
  title: string;
  meta?: string;
  accentColor?: string;
  /** Remove outer chrome when nested inside another surface (e.g. UnfoldMenu). */
  embedded?: boolean;
  /** Toque na área de texto (ex.: abrir detalhes). */
  onPress?: () => void;
} & (
  | {
      /** Botão branco no lugar do swipe — CTA único, sem pill abaixo. */
      actionLabel: string;
      onAction: () => void;
      actionDisabled?: boolean;
      actionLoading?: boolean;
      swipeLabel?: never;
      onSwipe?: never;
      swipeDisabled?: never;
    }
  | {
      swipeLabel: string;
      onSwipe: () => void;
      swipeDisabled?: boolean;
      actionLabel?: never;
      onAction?: never;
      actionDisabled?: never;
      actionLoading?: never;
    }
);

export function MapStatusCard({
  kicker,
  title,
  meta,
  accentColor,
  embedded = false,
  onPress,
  swipeLabel,
  onSwipe,
  swipeDisabled = false,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionLoading = false,
}: MapStatusCardProps) {
  const body = (
    <View style={[styles.body, !kicker && styles.bodyCompact]}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        !embedded && accentColor ? { backgroundColor: accentColor } : null,
      ]}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      <View style={styles.actionArea}>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: actionDisabled || actionLoading }}
            disabled={actionDisabled || actionLoading}
            onPress={onAction}
            style={({ pressed }) => [
              styles.actionBtn,
              (actionDisabled || actionLoading) && styles.actionBtnDisabled,
              { opacity: pressed && !actionDisabled && !actionLoading ? 0.92 : 1 },
            ]}
          >
            {actionLoading ? (
              <ActivityIndicator color="#14142e" />
            ) : (
              <Text style={styles.actionLabel} numberOfLines={1}>
                {actionLabel}
              </Text>
            )}
          </Pressable>
        ) : (
          <SwipeToAction
            label={swipeLabel!}
            onComplete={onSwipe!}
            disabled={swipeDisabled}
            accentColor={accentColor}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    alignSelf: "stretch",
    borderRadius: 28,
    // visible p/ a sombra laranja do botão branco não ser cortada
    overflow: "visible",
    backgroundColor: theme.colors.success,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cardEmbedded: {
    borderRadius: 0,
    backgroundColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  bodyCompact: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  kicker: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  meta: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "rgba(255,255,255,0.72)",
  },
  actionArea: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  actionBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  actionBtnDisabled: {
    opacity: 0.55,
  },
  actionLabel: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#14142e",
    textAlign: "center",
  },
}));

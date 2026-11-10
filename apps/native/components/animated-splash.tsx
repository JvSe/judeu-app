import { Canvas, Circle, DashPathEffect, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useAuth } from "@/lib/auth-context";

// Mesmos caminhos de assets/images/logo.svg, separados em uma mão por path.
const TOP_HAND =
  "M716.898 653.066H41.3122C41.3122 653.066 0.0272575 660.572 0.0264338 619.286C0.0262983 612.495 0.0264079 144.875 0.0264301 50.2798L0.0264338 33.7793C0.0264341 -0.000182548 41.3122 0 41.3122 0H885.796C1062.2 0 1415 172.65 1415 608.027C1415 608.027 1411.25 653.066 1388.73 653.066H1223.59C1189.81 653.066 1189.81 619.286 1189.81 619.286C1187.31 495.429 1115.49 243.21 848.263 225.195H270.261C270.261 225.195 236.481 232.702 236.481 266.481V386.585C236.481 416.611 270.261 416.611 270.261 416.611H716.898C754.429 416.611 754.43 457.897 754.43 457.897V608.027C754.43 653.066 716.898 653.066 716.898 653.066Z";
const BOTTOM_HAND =
  "M698.107 848.768L1373.69 848.768C1373.69 848.768 1414.98 841.262 1414.98 882.548C1414.98 889.339 1414.98 1356.96 1414.98 1451.55L1414.98 1468.05C1414.98 1501.83 1373.69 1501.83 1373.69 1501.83H529.209C352.806 1501.83 0.000366211 1329.18 0.000366211 893.807C0.000366211 893.807 3.75366 848.768 26.2732 848.768H191.416C225.196 848.768 225.196 882.548 225.196 882.548C227.698 1006.41 299.51 1258.62 566.742 1276.64H1144.74C1144.74 1276.64 1178.52 1269.13 1178.52 1235.35V1115.25C1178.52 1085.22 1144.74 1085.22 1144.74 1085.22H698.107C660.576 1085.22 660.575 1043.94 660.575 1043.94L660.575 893.807C660.575 848.768 698.107 848.768 698.107 848.768Z";

const LOGO_CENTER_X = 707.5;
const LOGO_CENTER_Y = 751;
// O splash nativo desenha a imagem com imageWidth 200 e a logo ocupa 60% do PNG:
// o primeiro frame precisa ter esse mesmo tamanho, senão há salto na passagem.
const LOGO_WIDTH = 120;
const LOGO_SCALE = LOGO_WIDTH / 1415;
const FIRST_FRAME_SIZE = 200; // imageWidth do expo-splash-screen no app.json

const BACKGROUND = "#1c1c3a";
const ORANGE = "#FF6600";
const WHITE = "#FFFFFF";
const STROKE_WIDTH = 30;

// Duração total sem espera extra: 3 s (traço laranja + aperto + laranja na tela).
const DRAW_MS = 2000;
const LAP_MS = 900;
const RETRACT_MS = 300;
const SPRING_MS = 560;
const CONTACT_MS = 380; // instante em que a mola encontra a posição final
const FLOOD_MS = 620;
const NOT_STARTED = Number.MAX_SAFE_INTEGER;
// Sem resposta da sessão (rede ruim), o app abre mesmo assim.
const MAX_WAIT_MS = 8000;

function clamp(value: number) {
  "worklet";
  return Math.min(1, Math.max(0, value));
}

function range(t: number, from: number, to: number) {
  "worklet";
  return clamp((t - from) / (to - from));
}

function easeInOut(p: number) {
  "worklet";
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function easeOut(p: number) {
  "worklet";
  return 1 - Math.pow(1 - p, 3);
}

function spring(p: number) {
  "worklet";
  return p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(11 * p);
}

function handshakeOffset(t: number, handshakeAt: number) {
  "worklet";
  if (t < handshakeAt) return 0;
  const elapsed = t - handshakeAt;
  return elapsed < RETRACT_MS
    ? easeInOut(elapsed / RETRACT_MS)
    : 1 - spring((elapsed - RETRACT_MS) / SPRING_MS);
}

function handTransform(direction: 1 | -1, offset: number) {
  "worklet";
  return [
    { translateX: direction * 300 * offset },
    { translateY: direction * 170 * offset },
    { translateX: LOGO_CENTER_X },
    { translateY: LOGO_CENTER_Y },
    { rotate: (-8 * offset * Math.PI) / 180 },
    { translateX: -LOGO_CENTER_X },
    { translateY: -LOGO_CENTER_Y },
  ];
}

function pathLength(path: ReturnType<typeof Skia.Path.Make>) {
  return Skia.ContourMeasureIter(path, false, 1).next()?.length() ?? 1;
}

function impact() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/**
 * Continua o splash nativo: forma a logo com um traço laranja, dá voltas com a borda laranja
 * se a sessão ainda estiver carregando e, com o app pronto, aperta as mãos e cobre a tela.
 * Precisa ficar dentro do AuthProvider.
 */
export function AnimatedSplash() {
  const { status } = useAuth();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [timedOut, setTimedOut] = useState(false);
  const [finished, setFinished] = useState(false);
  const appReady = status !== "loading" || timedOut;

  const hands = useMemo(() => {
    const top = Skia.Path.MakeFromSVGString(TOP_HAND)!;
    const bottom = Skia.Path.MakeFromSVGString(BOTTOM_HAND)!;
    return { top, bottom, topLength: pathLength(top), bottomLength: pathLength(bottom) };
  }, []);

  const time = useSharedValue(0);
  const ready = useSharedValue(false);
  // -1 para o fim do traço (volta 0) já poder disparar o aperto.
  const lapsDone = useSharedValue(-1);
  const handshakeAt = useSharedValue(NOT_STARTED);
  const hapticPlayed = useSharedValue(false);
  const finishScheduled = useSharedValue(false);
  const reducedOpacity = useSharedValue(1);

  const finish = useCallback(() => setFinished(true), []);

  const clock = useFrameCallback((frame) => {
    // Limita o passo para a animação não pular depois de um travamento.
    time.value += Math.min(frame.timeSincePreviousFrame ?? 0, 50);
    const t = time.value;

    if (handshakeAt.value === NOT_STARTED && t >= DRAW_MS) {
      const laps = Math.floor((t - DRAW_MS) / LAP_MS);
      if (laps > lapsDone.value) {
        lapsDone.value = laps;
        if (ready.value) handshakeAt.value = DRAW_MS + laps * LAP_MS;
      }
    }

    const contactAt = handshakeAt.value + CONTACT_MS;
    if (!hapticPlayed.value && t >= contactAt) {
      hapticPlayed.value = true;
      scheduleOnRN(impact);
    }
    if (!finishScheduled.value && t >= contactAt + FLOOD_MS) {
      finishScheduled.value = true;
      scheduleOnRN(finish);
    }
  }, false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    ready.value = appReady;
    if (appReady && reduceMotion) {
      reducedOpacity.value = withTiming(0, { duration: 300 }, (done) => {
        if (done) scheduleOnRN(finish);
      });
    }
  }, [appReady, reduceMotion, ready, reducedOpacity, finish]);

  const nativeSplashHandled = useRef(false);
  const handleFirstFrameLoaded = useCallback(() => {
    if (nativeSplashHandled.current) return;
    nativeSplashHandled.current = true;
    // O PNG do primeiro frame já está na tela: o splash nativo pode sair sem revelar as rotas.
    requestAnimationFrame(() => {
      void SplashScreen.hideAsync()
        .catch(() => {})
        .finally(() => {
          if (!reduceMotion) clock.setActive(true);
        });
    });
    // `clock` é recriado a cada render; só o primeiro carregamento importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const floodProgress = useDerivedValue(() =>
    clamp((time.value - (handshakeAt.value + CONTACT_MS)) / FLOOD_MS),
  );
  const offset = useDerivedValue(() => handshakeOffset(time.value, handshakeAt.value));
  const fillOpacity = useDerivedValue(() =>
    time.value < 1550 ? 1 - range(time.value, 120, 400) : range(time.value, 1550, 1900),
  );
  const drawEnd = useDerivedValue(() => easeInOut(range(time.value, 250, 1700)));
  const drawOpacity = useDerivedValue(() =>
    time.value < DRAW_MS ? 1 - range(time.value, 1800, DRAW_MS) : 0,
  );
  const lapProgress = useDerivedValue(() =>
    time.value < DRAW_MS ? 0 : ((time.value - DRAW_MS) % LAP_MS) / LAP_MS,
  );
  const cometOpacity = useDerivedValue(() => {
    if (time.value < DRAW_MS || time.value >= handshakeAt.value) return 0;
    return Math.min(1, lapProgress.value * 6, (1 - lapProgress.value) * 6);
  });
  // Só os números entram no worklet: os paths do Skia ficam na thread de JS.
  const { topLength, bottomLength } = hands;
  const topCometPhase = useDerivedValue(() => topLength * (1 - lapProgress.value));
  const bottomCometPhase = useDerivedValue(() => bottomLength * (1 - lapProgress.value));

  const centerX = width / 2;
  const centerY = height / 2;
  const floodMaxRadius = Math.hypot(width, height) / 2 + 24;
  const floodRadius = useDerivedValue(
    () => floodMaxRadius * easeOut(clamp(floodProgress.value / 0.62)),
  );
  const logoTransform = useDerivedValue(() => {
    const scale = LOGO_SCALE * (1 + 0.14 * easeOut(floodProgress.value));
    return [
      { translateX: centerX },
      { translateY: centerY },
      { scale },
      { translateX: -LOGO_CENTER_X },
      { translateY: -LOGO_CENTER_Y },
    ];
  });
  const topTransform = useDerivedValue(() => handTransform(-1, offset.value));
  const bottomTransform = useDerivedValue(() => handTransform(1, offset.value));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? reducedOpacity.value
      : 1 - clamp((floodProgress.value - 0.58) / 0.42),
  }));

  if (finished) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.background, containerStyle]}>
      <Image
        source={require("../assets/images/splash-icon.png")}
        fadeDuration={0}
        onLoadEnd={handleFirstFrameLoaded}
        style={{
          position: "absolute",
          left: (width - FIRST_FRAME_SIZE) / 2,
          top: (height - FIRST_FRAME_SIZE) / 2,
          width: FIRST_FRAME_SIZE,
          height: FIRST_FRAME_SIZE,
        }}
      />
      {/* O canvas é opaco: ao pintar, cobre o PNG e a animação assume. */}
      <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={width} height={height} color={BACKGROUND} />
          <Circle cx={centerX} cy={centerY} r={floodRadius} color={ORANGE} />
          <Group transform={logoTransform}>
            <Group transform={topTransform}>
              <Path path={hands.top} color={WHITE} opacity={fillOpacity} />
              <Path
                path={hands.top}
                style="stroke"
                strokeWidth={STROKE_WIDTH}
                color={ORANGE}
                end={drawEnd}
                opacity={drawOpacity}
              />
              <Path
                path={hands.top}
                style="stroke"
                strokeWidth={STROKE_WIDTH}
                color={ORANGE}
                opacity={cometOpacity}
              >
                <DashPathEffect
                  intervals={[hands.topLength * 0.18, hands.topLength * 0.82]}
                  phase={topCometPhase}
                />
              </Path>
            </Group>
            <Group transform={bottomTransform}>
              <Path path={hands.bottom} color={WHITE} opacity={fillOpacity} />
              <Path
                path={hands.bottom}
                style="stroke"
                strokeWidth={STROKE_WIDTH}
                color={ORANGE}
                end={drawEnd}
                opacity={drawOpacity}
              />
              <Path
                path={hands.bottom}
                style="stroke"
                strokeWidth={STROKE_WIDTH}
                color={ORANGE}
                opacity={cometOpacity}
              >
                <DashPathEffect
                  intervals={[hands.bottomLength * 0.18, hands.bottomLength * 0.82]}
                  phase={bottomCometPhase}
                />
              </Path>
            </Group>
          </Group>
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: BACKGROUND },
});

// Painel discreto do apresentador (Modo Apresentação). Abre com toque longo no
// avatar da home. Nada daqui aparece para quem assiste à demo.
import { OfflineManager } from "@maplibre/maplibre-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from "@/components/ui/real-map";
import {
  clientHomeAddress,
  demoReset,
  demoStatus,
  onDemoStatus,
  reconnectPeer,
  setForceScript,
  type DemoStatus,
} from "@/lib/demo";

const PACK_PREFIX = "judeu-demo";

const PEER_LABEL: Record<DemoStatus["peerState"], string> = {
  off: "Sem módulo P2P (só roteiro)",
  searching: "Procurando o outro aparelho…",
  connecting: "Conectando…",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Erro no P2P",
};

async function downloadOfflineMap(onProgress: (pct: number) => void): Promise<void> {
  const home = clientHomeAddress();
  const d = 0.04; // ~4 km para cada lado
  const bounds: [number, number, number, number] = [home.lng - d, home.lat - d, home.lng + d, home.lat + d];
  const existing = await OfflineManager.getPacks();
  for (const pack of existing) {
    const name = String(pack.metadata?.name ?? "");
    if (name.startsWith(PACK_PREFIX)) await OfflineManager.deletePack(pack.id);
  }
  const styles = [MAP_STYLE_DARK, MAP_STYLE_LIGHT];
  const progress = styles.map(() => 0);
  await Promise.all(
    styles.map(
      (mapStyle, i) =>
        new Promise<void>((resolve, reject) => {
          OfflineManager.createPack(
            { mapStyle, bounds, minZoom: 10, maxZoom: 17, metadata: { name: `${PACK_PREFIX}-${i}` } },
            (_pack, status) => {
              progress[i] = status.percentage;
              onProgress(Math.round(progress.reduce((a, b) => a + b, 0) / styles.length));
              if (status.state === "complete" || status.percentage >= 100) resolve();
            },
            (_pack, error) => reject(new Error(error.message)),
          ).catch(reject);
        }),
    ),
  );
}

export function DemoPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<DemoStatus>(demoStatus);
  const [mapState, setMapState] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => onDemoStatus(setStatus), []);
  useEffect(() => {
    if (!visible) setConfirmReset(false);
  }, [visible]);

  const dot =
    status.peerState === "connected" ? "#22c55e" : status.peerState === "off" ? "#a3a3a3" : "#ef4444";

  const startMapDownload = () => {
    setMapState("Baixando 0%…");
    downloadOfflineMap((pct) => setMapState(`Baixando ${pct}%…`))
      .then(() => setMapState("Mapa offline pronto ✓"))
      .catch((err: unknown) =>
        setMapState(`Falhou: ${err instanceof Error ? err.message : "sem internet?"}`),
      );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>Modo Apresentação</Text>

          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text style={styles.text}>
              {PEER_LABEL[status.peerState]}
              {status.peerName ? ` · ${status.peerName}` : ""}
            </Text>
          </View>
          <Text style={styles.muted}>
            {status.scriptActive ? "Roteiro ATIVO: o outro lado é simulado aqui." : "Roteiro em espera."} ·{" "}
            {status.eventCount} eventos
          </Text>

          <View style={styles.rowBetween}>
            <Text style={styles.text}>Forçar modo roteiro</Text>
            <Switch value={status.forceScript} onValueChange={setForceScript} />
          </View>

          <Pressable style={styles.button} onPress={reconnectPeer}>
            <Text style={styles.buttonText}>Reconectar ao outro aparelho</Text>
          </Pressable>

          <Pressable
            style={[styles.button, confirmReset && styles.danger]}
            onPress={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              demoReset();
              setConfirmReset(false);
              onClose();
            }}
          >
            <Text style={styles.buttonText}>
              {confirmReset ? "Toque de novo para zerar nos dois" : "Zerar rodada (nos dois aparelhos)"}
            </Text>
          </Pressable>

          <Pressable style={styles.button} onPress={startMapDownload}>
            <Text style={styles.buttonText}>Baixar mapa offline (com internet)</Text>
          </Pressable>
          {mapState ? <Text style={styles.muted}>{mapState}</Text> : null}

          <Pressable style={[styles.button, styles.ghost]} onPress={onClose}>
            <Text style={styles.buttonText}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#16163a",
    borderRadius: 18,
    padding: 20,
    gap: 12,
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  muted: { color: "rgba(255,255,255,0.6)", fontSize: 12.5 },
  button: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  danger: { backgroundColor: "#b91c1c" },
  ghost: { backgroundColor: "transparent" },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },
});

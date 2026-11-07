import { ensureUtcIso } from "./dates";
import { supabase } from "./db";
import { trackEvent } from "./events";

// Gatilho do pitch: "ETA erra > 20%" → hora de trocar o roteamento.
// Previsão: primeira posição recebida com o pedido a caminho (EN_ROUTE).
// Medição: na chegada (start_work), minutos reais desde a previsão.

/** Erro relativo do ETA (0.25 = errou 25%). */
export function etaErrorRatio(predictedMin: number, actualMin: number): number {
  return Math.abs(actualMin - predictedMin) / Math.max(predictedMin, 1);
}

export async function recordEtaPrediction(
  orderId: string,
  route: { etaMin: number | null; distanceKm: number | null },
): Promise<void> {
  if (route.etaMin == null) return;
  try {
    const { data: existing } = await supabase
      .from("appevent")
      .select("id")
      .eq("orderId", orderId)
      .eq("type", "order.eta_predicted")
      .limit(1)
      .maybeSingle();
    if (existing) return;
    await trackEvent({
      type: "order.eta_predicted",
      orderId,
      props: { etaMin: route.etaMin, distanceKm: route.distanceKm },
    });
  } catch (err) {
    console.warn("[eta] previsão não registrada:", err);
  }
}

export async function recordEtaMeasurement(orderId: string, now = new Date()): Promise<void> {
  try {
    const { data: predicted } = await supabase
      .from("appevent")
      .select("createdAt, props")
      .eq("orderId", orderId)
      .eq("type", "order.eta_predicted")
      .order("createdAt", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!predicted) return;
    const predictedMin = Number((predicted.props as { etaMin?: number } | null)?.etaMin);
    if (!Number.isFinite(predictedMin)) return;
    const actualMin =
      Math.round(((now.getTime() - new Date(ensureUtcIso(predicted.createdAt)).getTime()) / 60_000) * 10) / 10;
    await trackEvent({
      type: "order.eta_measured",
      orderId,
      props: { predictedMin, actualMin, errorRatio: etaErrorRatio(predictedMin, actualMin) },
    });
  } catch (err) {
    console.warn("[eta] medição não registrada:", err);
  }
}

import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import SpinButton from "@/components/ui/spin-button";
import { fonts } from "@/constants/fonts";
import type { Order, Proposal } from "@/lib/api";
import { moneyFromCents } from "@/lib/format";
import { useRespondToProposal } from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";

type ChatPricePanelProps = {
  order: Order;
  role: "client" | "provider";
  proposals: Proposal[];
  proposePathname: "/client/propose/[id]";
};

export function ChatPricePanel({ order, role, proposals, proposePathname }: ChatPricePanelProps) {
  const { theme } = useUnistyles();
  const respondToProposal = useRespondToProposal();
  const [respondAction, setRespondAction] = useState<"accept" | "reject" | null>(null);

  const openHelp = order.isOpenRequest && order.status === "ACCEPTED" && !order.payment;
  if (!openHelp) return null;

  const pending = proposals.find((p) => p.status === "PENDING");
  const canPay = !pending;
  const clientNeedsAccept = !!pending && !pending.clientAcceptedAt && role === "client";
  const helperNeedsAccept =
    !!pending && !!pending.clientAcceptedAt && !pending.providerAcceptedAt && role === "provider";

  const handleRespond = async (action: "accept" | "reject") => {
    if (!pending) return;
    setRespondAction(action);
    try {
      const updated = await respondToProposal.mutateAsync({
        orderId: order.id,
        proposalId: pending.id,
        action,
      });
      if (action === "reject") {
        toast.success("Valor recusado");
        return;
      }
      if (updated.status === "PENDING") {
        toast.success("Você confirmou. Agora quem ajuda precisa aceitar.");
        return;
      }
      toast.success("Valor atualizado");
      if (role === "client") {
        router.push({ pathname: "/client/payment/[id]", params: { id: order.id } });
      }
    } catch (e) {
      toast.error(errorMessage(e, "Não foi possível responder."));
    } finally {
      setRespondAction(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Valor da ajuda</Text>
          <Text style={styles.value}>{moneyFromCents(order.priceCents)}</Text>
        </View>
        {role === "client" && (
          <Pressable
            style={styles.adjustBtn}
            onPress={() => router.push({ pathname: proposePathname, params: { id: order.id } })}
          >
            <Ionicons name="cash-outline" size={16} color="#fff" />
            <Text style={styles.adjustText}>Ajustar valor</Text>
          </Pressable>
        )}
      </View>

      {pending && (
        <View style={styles.pending}>
          <Text style={styles.pendingLabel}>Novo valor: {moneyFromCents(pending.priceCents)}</Text>
          {clientNeedsAccept && (
            <View style={styles.actions}>
              <SpinButton
                controlled
                isActive={respondAction === "reject" && respondToProposal.isPending}
                disabled={respondToProposal.isPending}
                idleText="Cancelar"
                activeText="..."
                onPress={() => handleRespond("reject")}
                colors={{
                  idle: { background: "rgba(255,255,255,0.08)", text: theme.colors.mutedForeground },
                  active: {
                    background: "rgba(255,255,255,0.08)",
                    text: theme.colors.mutedForeground,
                  },
                }}
                buttonStyle={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, fontSize: 13 }}
                spinnerConfig={{
                  color: theme.colors.mutedForeground,
                  containerBackground: "rgba(255,255,255,0.08)",
                }}
              />
              <View style={{ flex: 1 }}>
                <SpinButton
                  controlled
                  isActive={respondAction === "accept" && respondToProposal.isPending}
                  disabled={respondToProposal.isPending}
                  idleText="Aceitar"
                  activeText="..."
                  onPress={() => handleRespond("accept")}
                  colors={{
                    idle: { background: theme.colors.primary, text: "#fff" },
                    active: { background: theme.colors.primary, text: "#fff" },
                  }}
                  buttonStyle={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, fontSize: 13 }}
                  spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                />
              </View>
            </View>
          )}
          {role === "client" && pending.clientAcceptedAt && !pending.providerAcceptedAt && (
            <Text style={styles.wait}>Aguardando quem ajuda aceitar…</Text>
          )}
          {role === "provider" && !pending.clientAcceptedAt && (
            <Text style={styles.wait}>Aguardando o solicitante aceitar…</Text>
          )}
          {helperNeedsAccept && (
            <View style={styles.actions}>
              <SpinButton
                controlled
                isActive={respondAction === "reject" && respondToProposal.isPending}
                disabled={respondToProposal.isPending}
                idleText="Recusar"
                activeText="..."
                onPress={() => handleRespond("reject")}
                colors={{
                  idle: { background: "rgba(255,255,255,0.08)", text: theme.colors.mutedForeground },
                  active: {
                    background: "rgba(255,255,255,0.08)",
                    text: theme.colors.mutedForeground,
                  },
                }}
                buttonStyle={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, fontSize: 13 }}
                spinnerConfig={{
                  color: theme.colors.mutedForeground,
                  containerBackground: "rgba(255,255,255,0.08)",
                }}
              />
              <View style={{ flex: 1 }}>
                <SpinButton
                  controlled
                  isActive={respondAction === "accept" && respondToProposal.isPending}
                  disabled={respondToProposal.isPending}
                  idleText="Aceitar"
                  activeText="..."
                  onPress={() => handleRespond("accept")}
                  colors={{
                    idle: { background: theme.colors.primary, text: "#fff" },
                    active: { background: theme.colors.primary, text: "#fff" },
                  }}
                  buttonStyle={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, fontSize: 13 }}
                  spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {role === "client" && canPay && (
        <Pressable
          style={styles.payBtn}
          onPress={() => router.push({ pathname: "/client/payment/[id]", params: { id: order.id } })}
        >
          <Text style={styles.payText}>Ir para pagamento</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(28,28,58,0.95)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 2,
  },
  adjustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  adjustText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  pending: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  pendingLabel: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  wait: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,102,0,0.2)",
    borderRadius: 12,
    paddingVertical: 12,
  },
  payText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));

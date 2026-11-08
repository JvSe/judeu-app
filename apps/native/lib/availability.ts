import type { OpenRequestAvailability } from "@/lib/api";
import { shortDateTime } from "@/lib/format";

/** Texto da prévia "N pessoas perto" antes de publicar uma ajuda aberta. */
export function availabilityLabel(a: OpenRequestAvailability): { title: string; detail: string } {
  if (a.area?.status === "OUTSIDE") {
    return {
      title: "Ainda não atendemos esse endereço",
      detail: "Estamos começando por algumas regiões. Use outro endereço ou tente mais tarde.",
    };
  }
  if (a.area?.status === "CLOSED") {
    return {
      title: "Fora do horário de atendimento",
      detail: a.area.nextOpenAt
        ? `Agende o pedido. Próximo horário: ${shortDateTime(a.area.nextOpenAt)}.`
        : "Agende o pedido para outro horário.",
    };
  }
  if (a.count === 0) {
    return {
      title: "Ninguém disponível perto agora",
      detail: "Você pode publicar mesmo assim: o pedido fica no ar e avisamos quem ficar disponível.",
    };
  }
  const people = a.count === 1 ? "1 pessoa disponível" : `${a.count} pessoas disponíveis`;
  return {
    title: `${people} perto de você`,
    detail:
      a.etaMin != null
        ? `A mais próxima chega em cerca de ${a.etaMin} min depois de aceitar.`
        : "Assim que alguém aceitar, você acompanha a chegada pelo mapa.",
  };
}

import type Ionicons from "@expo/vector-icons/Ionicons";

export type SupportRole = "client" | "provider";

export type SupportFaq = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  question: string;
  answer: string;
};

const account: SupportFaq = {
  id: "account",
  icon: "person-outline",
  question: "Posso exportar ou excluir meus dados?",
  answer:
    "Sim, a qualquer momento em Perfil > Privacidade: \"Baixar meus dados\" gera uma cópia de tudo que você cadastrou, e \"Excluir minha conta\" remove suas informações pessoais.",
};

/** Troca o marcador {taxa} pelo percentual atual (ex.: "20%"). */
export function fillFaqPlaceholders(answer: string, feeLabel: string): string {
  return answer.replaceAll("{taxa}", feeLabel);
}

// FAQ por papel. A tela de suporte é uma só (components/screens/support.tsx);
// só o conteúdo muda conforme quem está perguntando.
export const SUPPORT_FAQ: Record<SupportRole, SupportFaq[]> = {
  client: [
    {
      id: "payments",
      icon: "card-outline",
      question: "Como funciona o pagamento?",
      answer:
        "Você escolhe Pix, cartão de crédito ou dinheiro na hora de criar o pedido. No Pix e no cartão a cobrança é feita pela plataforma (Stripe); em dinheiro, você paga direto ao prestador na entrega. Você paga o valor do pedido: a taxa da plataforma é descontada de quem atende, não somada ao seu total.",
    },
    {
      id: "refund",
      icon: "cash-outline",
      question: "Cancelei um pedido já pago, recebo reembolso?",
      answer:
        "Sim. Pedidos pagos via Pix ou cartão que forem cancelados (por você ou pelo prestador) têm o valor estornado automaticamente — não é preciso abrir chamado para isso.",
    },
    {
      id: "cancel",
      icon: "close-circle-outline",
      question: "Até quando posso cancelar um pedido?",
      answer:
        "Você pode cancelar enquanto o pedido estiver Aguardando ou Aceito. Depois que o prestador sai a caminho ou começa o serviço, o cancelamento não fica mais disponível — nesse caso, abra um chamado.",
    },
    {
      id: "security",
      icon: "shield-checkmark-outline",
      question: "Como sei que o prestador é confiável?",
      answer:
        "Todo prestador passa por verificação de identidade (documento) antes de aparecer para os clientes. Você também pode ver a nota média e os comentários de quem já contratou.",
    },
    account,
  ],
  provider: [
    {
      id: "earnings",
      icon: "wallet-outline",
      question: "Como recebo pelos serviços concluídos?",
      answer:
        "Ao concluir um pedido pago pelo app, o valor já descontada a taxa da plataforma ({taxa}) entra no saldo da sua carteira, visível em Ganhos. Em pedido pago em dinheiro, você recebe o valor inteiro em mãos e a taxa fica como saldo a acertar na carteira. O saque depende de completar o cadastro de KYC.",
    },
    {
      id: "kyc",
      icon: "shield-checkmark-outline",
      question: "Por que meu perfil ainda não aparece pros clientes?",
      answer:
        "Todo prestador passa por verificação de documento antes de ficar visível no app. Complete seu cadastro profissional em Perfil > Completar cadastro e aguarde a aprovação.",
    },
    {
      id: "cancel",
      icon: "close-circle-outline",
      question: "Posso recusar ou cancelar um pedido?",
      answer:
        "Você pode recusar um pedido assim que ele chega. Depois de aceitar, o cancelamento pelo seu lado segue as regras de disputa — se algo impedir o atendimento, abra um chamado explicando o caso.",
    },
    {
      id: "availability",
      icon: "toggle-outline",
      question: "Como fico indisponível temporariamente?",
      answer:
        "Na Início (mapa) ou no Perfil, desligue o modo atender — enquanto estiver offline você continua listado, mas os clientes veem que não está atendendo no momento.",
    },
    account,
  ],
};

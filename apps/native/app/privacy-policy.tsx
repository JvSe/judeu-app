import "@/unistyles";
import { LegalScreen, type LegalSection } from "@/components/ui/legal-screen";

const sections: LegalSection[] = [
  {
    heading: "1. Quais dados coletamos",
    body: "Nome, e-mail, telefone e senha (cadastro); endereço e CEP (pra localizar prestadores e calcular rota); localização do dispositivo (achar profissionais perto de você e, durante um atendimento, compartilhar sua posição em tempo real); documento de identidade (apenas prestadores, para verificação/KYC); histórico de pedidos, mensagens de chat e avaliações; dados de pagamento, processados diretamente pelo Stripe — o Ajuda+ nunca armazena número de cartão.",
  },
  {
    heading: "2. Para que usamos esses dados",
    body: "Conectar você a prestadores/clientes próximos, processar pagamentos e repasses, viabilizar o chat e o acompanhamento do atendimento em tempo real, enviar notificações sobre seus pedidos, verificar a identidade de prestadores antes de aparecerem no app, e calcular sua reputação a partir das avaliações recebidas.",
  },
  {
    heading: "3. Com quem compartilhamos",
    body: "Com a outra parte de um pedido ativo (nome, avaliação, posição durante o atendimento), com o Stripe para processar pagamentos, e com serviços de mapas/geocodificação (Nominatim/Valhalla, OpenFreeMap) para localizar endereços e calcular rotas. Não vendemos seus dados a terceiros.",
  },
  {
    heading: "4. Notificações",
    body: "Enviamos notificações sobre novos pedidos, mudanças de status e mensagens de chat. Você pode desligar cada tipo de notificação a qualquer momento no centro de notificações, dentro do app.",
  },
  {
    heading: "5. Seus direitos (LGPD)",
    body: "Você pode acessar, corrigir, exportar (\"Baixar meus dados\") e excluir seus dados pessoais a qualquer momento, em Perfil > Privacidade e permissões. Ao excluir sua conta, seus dados de identificação são removidos; pedidos, avaliações e mensagens já trocados com outras pessoas são preservados como histórico dessas partes, sem seu nome ou contato associado.",
  },
  {
    heading: "6. Retenção",
    body: "Mantemos seus dados enquanto sua conta estiver ativa. Registros de pagamento podem ser retidos por período adicional quando exigido por obrigação legal ou fiscal.",
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalScreen title="Política de privacidade" updatedAt="julho de 2026" sections={sections} />
  );
}

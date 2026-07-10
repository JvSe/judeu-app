import "@/unistyles";
import { LegalScreen, type LegalSection } from "@/components/ui/legal-screen";

const sections: LegalSection[] = [
  {
    heading: "1. O que é o Ajuda+",
    body: "O Ajuda+ é uma plataforma que conecta clientes a prestadores de serviços independentes (reparos, limpeza, frete e beleza) em Palmas/TO. O Ajuda+ não presta os serviços contratados — atua como intermediário entre as duas partes, que celebram o contrato de prestação de serviço diretamente entre si.",
  },
  {
    heading: "2. Cadastro e conta",
    body: "Você precisa fornecer nome, e-mail, telefone e senha para criar uma conta, e é responsável por manter esses dados corretos e por toda atividade realizada com suas credenciais. Prestadores passam por verificação de identidade (KYC) antes de poderem ser contratados por clientes.",
  },
  {
    heading: "3. Pedidos e pagamento",
    body: "Ao contratar um serviço, o valor é cobrado via Pix, cartão ou combinado em dinheiro na entrega. Sobre o valor do serviço incide uma taxa de plataforma de 8%. Em caso de cancelamento antes do início da execução, pagamentos já capturados via Pix/cartão são estornados automaticamente.",
  },
  {
    heading: "4. Cancelamento e reembolso",
    body: "Clientes podem cancelar um pedido enquanto ele ainda não estiver em execução. Prestadores podem recusar um pedido antes de aceitá-lo. Após o início da execução, o cancelamento pode estar sujeito a cobrança parcial pelo trabalho já realizado, a critério do prestador.",
  },
  {
    heading: "5. Localização",
    body: "Durante um atendimento em andamento, a localização do prestador é compartilhada com o cliente para acompanhamento em tempo real e cálculo de tempo estimado de chegada. Fora de um atendimento ativo, sua localização não é compartilhada com outros usuários.",
  },
  {
    heading: "6. Avaliações e conduta",
    body: "Cliente e prestador se avaliam mutuamente ao final de cada serviço. Avaliações devem ser honestas e relacionadas ao serviço prestado. Contas que violarem estas condições — fraude, assédio, informações falsas no cadastro — podem ser suspensas ou bloqueadas.",
  },
  {
    heading: "7. Alterações destes termos",
    body: "Podemos atualizar estes termos para refletir mudanças no serviço. Alterações relevantes serão comunicadas dentro do app antes de entrarem em vigor.",
  },
];

export default function Terms() {
  return <LegalScreen title="Termos de uso" updatedAt="julho de 2026" sections={sections} />;
}

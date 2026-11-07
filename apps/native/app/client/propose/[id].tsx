import { ProposeForm } from "@/components/screens/propose-form";

// Mesma rota para os dois lados: o formulário descobre pelo pedido se quem abriu
// é o cliente ou quem está atendendo.
export default function Propose() {
  return <ProposeForm />;
}

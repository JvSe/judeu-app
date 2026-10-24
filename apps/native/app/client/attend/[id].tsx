import { AttendDelivery } from "@/components/screens/attend-delivery";

export default function ClientAttend() {
  return (
    <AttendDelivery
      exitTo="/client"
      chatPathname="/client/chat/[id]"
      startLabel="Iniciar caminho"
      replaceOnStartWork
    />
  );
}

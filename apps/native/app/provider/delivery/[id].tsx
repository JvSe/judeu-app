import { AttendDelivery } from "@/components/screens/attend-delivery";

export default function ProviderDelivery() {
  return <AttendDelivery exitTo="/provider" chatPathname="/provider/chat/[id]" />;
}

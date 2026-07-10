import { env } from "@judeu/env/server";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

// Re-exporta os tipos gerados para o código de aplicação (server-only).
export type { Prisma } from "../prisma/generated/client";
export type {
  OrderStatus,
  Role,
  ProviderStatus,
  PaymentMethod,
  PaymentStatus,
  NotificationType,
  SupportTicketCategory,
  SupportTicketStatus,
} from "../prisma/generated/client";

export function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();
export default prisma;

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma/generated/client/index.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.findFirst({
  where: {
    role: { in: ["CLIENT", "BOTH"] },
    deletedAt: null,
    addresses: { some: {} },
  },
  select: {
    id: true,
    fullName: true,
    email: true,
    role: true,
    addresses: {
      select: { id: true, label: true, city: true, state: true, lat: true, lng: true, isDefault: true },
    },
  },
});

console.log(JSON.stringify(user, null, 2));

await prisma.$disconnect();

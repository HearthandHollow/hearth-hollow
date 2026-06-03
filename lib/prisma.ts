import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Only create PrismaClient if DATABASE_URL is available
let prismaInstance: PrismaClient | null = null;

if (process.env.DATABASE_URL) {
  prismaInstance =
    globalForPrisma.prisma ||
    new PrismaClient({
      log: ["query"],
    });

  if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prismaInstance;
}

export const prisma = prismaInstance as PrismaClient;

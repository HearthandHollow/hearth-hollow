import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Only create PrismaClient if DATABASE_URL is available
let prismaInstance: PrismaClient | null = null;

if (process.env.DATABASE_URL) {
  prismaInstance =
    globalForPrisma.prisma ||
    new PrismaClient({
      // Avoid logging every query (and its parameters) in production, which is
      // noisy and can leak customer PII into logs.
      log:
        process.env.NODE_ENV === "production"
          ? ["error", "warn"]
          : ["query", "error", "warn"],
    });

  if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prismaInstance;
}

export const prisma = prismaInstance as PrismaClient;

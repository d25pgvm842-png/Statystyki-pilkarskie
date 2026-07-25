import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databasePoolConfig } from "@/lib/database-pool";
import { getRuntimeEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const { DATABASE_URL } = getRuntimeEnv();
  const adapter = new PrismaPg(databasePoolConfig(DATABASE_URL));

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

globalForPrisma.prisma ??= prisma;

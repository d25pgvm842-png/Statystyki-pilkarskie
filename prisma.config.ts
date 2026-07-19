import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI (migracje, Studio) preferuje połączenie bezpośrednie.
    // Runtime aplikacji nadal korzysta z puli przez DATABASE_URL.
    url:
      process.env.DIRECT_URL ??
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});

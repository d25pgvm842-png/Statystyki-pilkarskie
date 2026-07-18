import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";
import { DataSourceType, UserRole } from "../src/generated/prisma/enums";
import { validateDeploymentEnv } from "../src/lib/env";

const adminSchema = z.object({
  ADMIN_EMAIL: z
    .string()
    .email()
    .refine((value) => value.toLowerCase() !== "admin@staty.local", {
      message: "W produkcji użyj prawdziwego adresu e-mail administratora.",
    }),
  ADMIN_PASSWORD: z
    .string()
    .min(12)
    .refine((value) => !["Staty-Start-2026!", "zmien-mnie"].includes(value), {
      message: "W produkcji nie używaj lokalnego hasła startowego.",
    }),
});

const leagues = [
  { name: "Ekstraklasa", slug: "ekstraklasa", country: "Polska", code: "PL1" },
  { name: "Premier League", slug: "premier-league", country: "Anglia", code: "ENG1" },
  { name: "LaLiga", slug: "laliga", country: "Hiszpania", code: "ESP1" },
  { name: "Serie A", slug: "serie-a", country: "Włochy", code: "ITA1" },
  { name: "Bundesliga", slug: "bundesliga", country: "Niemcy", code: "GER1" },
  { name: "Ligue 1", slug: "ligue-1", country: "Francja", code: "FRA1" },
];

async function main() {
  const env = validateDeploymentEnv(process.env);
  const admin = adminSchema.parse(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  try {
    const passwordHash = await hash(admin.ADMIN_PASSWORD, 12);

    await prisma.user.upsert({
      where: { email: admin.ADMIN_EMAIL.toLowerCase() },
      update: {
        name: "Administrator",
        passwordHash,
        role: UserRole.ADMIN,
        active: true,
      },
      create: {
        email: admin.ADMIN_EMAIL.toLowerCase(),
        name: "Administrator",
        passwordHash,
        role: UserRole.ADMIN,
        active: true,
      },
    });

    for (const source of [
      { name: "Wprowadzanie ręczne", providerCode: "manual", type: DataSourceType.MANUAL },
      { name: "Import CSV", providerCode: "csv", type: DataSourceType.CSV },
      { name: "Import XLSX", providerCode: "xlsx", type: DataSourceType.XLSX },
    ]) {
      await prisma.dataSource.upsert({
        where: { providerCode: source.providerCode },
        update: { name: source.name, type: source.type, active: true },
        create: { ...source, active: true },
      });
    }

    for (const item of leagues) {
      const league = await prisma.league.upsert({
        where: { slug: item.slug },
        update: { name: item.name, country: item.country, code: item.code, active: true },
        create: { ...item, active: true },
      });

      await prisma.season.upsert({
        where: { leagueId_name: { leagueId: league.id, name: "2026/27" } },
        update: { active: true },
        create: {
          leagueId: league.id,
          name: "2026/27",
          startsAt: new Date("2026-07-01T00:00:00.000Z"),
          endsAt: new Date("2027-06-30T23:59:59.000Z"),
          active: true,
        },
      });
    }

    console.log("Produkcja zainicjalizowana: administrator, źródła, ligi i sezon 2026/27.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

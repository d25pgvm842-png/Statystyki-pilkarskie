import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DataSourceType, MatchStatus, UserRole } from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Brak DATABASE_URL");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const leagues = [
  { name: "Ekstraklasa", slug: "ekstraklasa", country: "Polska", code: "PL1", teams: ["Legia Warszawa", "Lech Poznań", "Raków Częstochowa", "Jagiellonia Białystok"] },
  { name: "Premier League", slug: "premier-league", country: "Anglia", code: "ENG1", teams: ["Arsenal", "Liverpool", "Manchester City", "Chelsea"] },
  { name: "LaLiga", slug: "laliga", country: "Hiszpania", code: "ESP1", teams: ["Real Madrid", "FC Barcelona", "Atlético Madryt", "Athletic Bilbao"] },
  { name: "Serie A", slug: "serie-a", country: "Włochy", code: "ITA1", teams: ["Inter", "AC Milan", "Juventus", "Napoli"] },
  { name: "Bundesliga", slug: "bundesliga", country: "Niemcy", code: "GER1", teams: ["Bayern Monachium", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig"] },
  { name: "Ligue 1", slug: "ligue-1", country: "Francja", code: "FRA1", teams: ["Paris Saint-Germain", "Olympique Marsylia", "Olympique Lyon", "AS Monaco"] },
];

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "zmien-mnie";
  const passwordHash = await hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      name: "Administrator",
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
    create: {
      email,
      name: "Administrator",
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
  });

  const manual = await prisma.dataSource.upsert({
    where: { providerCode: "manual" },
    update: { active: true },
    create: { name: "Wprowadzanie ręczne", providerCode: "manual", type: DataSourceType.MANUAL },
  });

  for (const item of leagues) {
    const league = await prisma.league.upsert({
      where: { slug: item.slug },
      update: { name: item.name, country: item.country, code: item.code, active: true },
      create: { name: item.name, slug: item.slug, country: item.country, code: item.code },
    });
    const season = await prisma.season.upsert({
      where: { leagueId_name: { leagueId: league.id, name: "2026/27" } },
      update: { active: true },
      create: { leagueId: league.id, name: "2026/27", startsAt: new Date("2026-07-01T00:00:00.000Z"), endsAt: new Date("2027-06-30T23:59:59.000Z"), active: true },
    });

    for (const teamName of item.teams) {
      const team = await prisma.team.upsert({
        where: { slug: slugify(teamName) },
        update: { name: teamName, country: item.country, active: true },
        create: { name: teamName, slug: slugify(teamName), country: item.country },
      });
      await prisma.seasonTeam.upsert({ where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } }, update: {}, create: { seasonId: season.id, teamId: team.id } });
    }

    for (const refereeName of [`Sędzia testowy ${item.code} A`, `Sędzia testowy ${item.code} B`]) {
      const referee = await prisma.referee.upsert({ where: { slug: slugify(refereeName) }, update: { name: refereeName }, create: { name: refereeName, slug: slugify(refereeName) } });
      await prisma.refereeSeason.upsert({ where: { refereeId_seasonId: { refereeId: referee.id, seasonId: season.id } }, update: {}, create: { refereeId: referee.id, seasonId: season.id } });
    }
  }

  const ekstraklasa = await prisma.league.findUniqueOrThrow({ where: { slug: "ekstraklasa" } });
  const season = await prisma.season.findUniqueOrThrow({ where: { leagueId_name: { leagueId: ekstraklasa.id, name: "2026/27" } } });
  const memberships = await prisma.seasonTeam.findMany({ where: { seasonId: season.id }, include: { team: true }, orderBy: { team: { name: "asc" } } });
  const referees = await prisma.refereeSeason.findMany({ where: { seasonId: season.id }, include: { referee: true } });

  const samples = [
    { home: 0, away: 1, date: "2026-07-10T18:30:00.000Z", score: [2, 1], stats: [6, 4, 2, 3, 0, 0, 7, 4, 15, 10, 11, 14, 2, 1] },
    { home: 2, away: 3, date: "2026-07-11T16:00:00.000Z", score: [1, 1], stats: [5, 7, 4, 2, 0, 0, 5, 6, 12, 13, 15, 12, 1, 3] },
    { home: 1, away: 2, date: "2026-07-17T18:30:00.000Z", score: [0, 2], stats: [3, 8, 3, 2, 1, 0, 2, 8, 9, 17, 16, 10, 2, 2] },
  ];
  for (const [index, sample] of samples.entries()) {
    const existing = await prisma.match.findUnique({ where: { seasonId_homeTeamId_awayTeamId_kickoffAt: { seasonId: season.id, homeTeamId: memberships[sample.home].teamId, awayTeamId: memberships[sample.away].teamId, kickoffAt: new Date(sample.date) } } });
    if (!existing) {
      const [homeCorners, awayCorners, homeYellowCards, awayYellowCards, homeRedCards, awayRedCards, homeShotsOnTarget, awayShotsOnTarget, homeShots, awayShots, homeFouls, awayFouls, homeOffsides, awayOffsides] = sample.stats;
      await prisma.match.create({ data: { seasonId: season.id, round: index + 1, kickoffAt: new Date(sample.date), homeTeamId: memberships[sample.home].teamId, awayTeamId: memberships[sample.away].teamId, homeScore: sample.score[0], awayScore: sample.score[1], status: MatchStatus.FINISHED, refereeId: referees[index % referees.length]?.refereeId, dataSourceId: manual.id, stats: { create: { homeCorners, awayCorners, homeYellowCards, awayYellowCards, homeRedCards, awayRedCards, homeShotsOnTarget, awayShotsOnTarget, homeShots, awayShots, homeFouls, awayFouls, homeOffsides, awayOffsides } } } });
    }
  }
}

main().finally(() => prisma.$disconnect());

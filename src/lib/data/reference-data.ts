import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { REFERENCE_DATA_CACHE_TAGS } from "@/lib/data/reference-data-tags";

export const REFERENCE_DATA_REVALIDATE_SECONDS = 300;

const REFERENCE_DATA_TAG = REFERENCE_DATA_CACHE_TAGS.all;

export const getCachedActiveLeagues = unstable_cache(
  async () => prisma.league.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      active: true,
    },
    orderBy: [
      { name: "asc" },
      { id: "asc" },
    ],
  }),
  ["reference-data-active-leagues-v1"],
  {
    revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
    tags: [REFERENCE_DATA_TAG, REFERENCE_DATA_CACHE_TAGS.leagues],
  },
);

export const getCachedSeasons = unstable_cache(
  async () => prisma.season.findMany({
    select: {
      id: true,
      name: true,
      active: true,
      leagueId: true,
      league: {
        select: {
          id: true,
          name: true,
          active: true,
        },
      },
    },
    orderBy: [
      { active: "desc" },
      { startsAt: "desc" },
      { league: { name: "asc" } },
      { id: "asc" },
    ],
  }),
  ["reference-data-seasons-v1"],
  {
    revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
    tags: [REFERENCE_DATA_TAG, REFERENCE_DATA_CACHE_TAGS.seasons],
  },
);

export const getCachedActiveTeams = unstable_cache(
  async () => prisma.team.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: [
      { name: "asc" },
      { id: "asc" },
    ],
  }),
  ["reference-data-active-teams-v1"],
  {
    revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
    tags: [REFERENCE_DATA_TAG, REFERENCE_DATA_CACHE_TAGS.teams],
  },
);

export const getCachedActiveReferees = unstable_cache(
  async () => prisma.referee.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: [
      { name: "asc" },
      { id: "asc" },
    ],
  }),
  ["reference-data-active-referees-v1"],
  {
    revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
    tags: [REFERENCE_DATA_TAG, REFERENCE_DATA_CACHE_TAGS.referees],
  },
);

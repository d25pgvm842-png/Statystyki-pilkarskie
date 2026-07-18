export const STAT_DEFINITIONS = [
  { key: "corners", label: "Rzuty rożne", home: "homeCorners", away: "awayCorners" },
  { key: "yellowCards", label: "Żółte kartki", home: "homeYellowCards", away: "awayYellowCards" },
  { key: "redCards", label: "Czerwone kartki", home: "homeRedCards", away: "awayRedCards" },
  { key: "shotsOnTarget", label: "Celne strzały", home: "homeShotsOnTarget", away: "awayShotsOnTarget" },
  { key: "shots", label: "Wszystkie strzały", home: "homeShots", away: "awayShots" },
  { key: "fouls", label: "Faule", home: "homeFouls", away: "awayFouls" },
  { key: "offsides", label: "Spalone", home: "homeOffsides", away: "awayOffsides" },
] as const;

type StatField = (typeof STAT_DEFINITIONS)[number]["home"] | (typeof STAT_DEFINITIONS)[number]["away"];

type Observation = {
  isHome: boolean;
  stats: Partial<Record<StatField, number | null>>;
};

export type Summary = {
  count: number;
  sum: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
};

function summarize(values: number[]): Summary {
  if (!values.length) return { count: 0, sum: 0, average: null, median: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const sum = values.reduce((total, value) => total + value, 0);
  return { count: values.length, sum, average: sum / values.length, median, min: sorted[0], max: sorted.at(-1) ?? null };
}

export function calculateTeamStats(observations: Observation[]) {
  return STAT_DEFINITIONS.map((definition) => {
    const team: number[] = [];
    const opponent: number[] = [];
    const total: number[] = [];

    for (const observation of observations) {
      const teamValue = observation.stats[observation.isHome ? definition.home : definition.away];
      const opponentValue = observation.stats[observation.isHome ? definition.away : definition.home];
      if (typeof teamValue === "number") team.push(teamValue);
      if (typeof opponentValue === "number") opponent.push(opponentValue);
      if (typeof teamValue === "number" && typeof opponentValue === "number") total.push(teamValue + opponentValue);
    }

    return { ...definition, team: summarize(team), opponent: summarize(opponent), total: summarize(total) };
  });
}

export function splitTeamStats(observations: Observation[]) {
  return {
    overall: calculateTeamStats(observations),
    home: calculateTeamStats(observations.filter((item) => item.isHome)),
    away: calculateTeamStats(observations.filter((item) => !item.isHome)),
  };
}

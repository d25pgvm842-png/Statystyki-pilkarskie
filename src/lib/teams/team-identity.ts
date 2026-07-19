export const AUTO_TEAM_MATCH_SCORE = 90;
export const DUPLICATE_SUGGESTION_SCORE = 88;

export type TeamIdentityRecord = {
  id: string;
  name: string;
  shortName?: string | null;
  slug?: string | null;
  historicalSeasonCount?: number;
  createdAt?: Date | string | null;
};

export type TeamIdentityScore = {
  score: number;
  reason: string;
};

export type RankedTeamIdentity<T extends TeamIdentityRecord> = TeamIdentityScore & {
  team: T;
};

const GENERIC_TOKENS = new Set([
  "1", "04", "05", "07", "08", "09", "18", "96", "98",
  "1846", "1899", "1904", "1907", "1910",
  "ac", "afc", "as", "cf", "club", "calcio", "cd", "fc", "football",
  "fsv", "futbol", "rcd", "rb", "sc", "ssc", "sv", "tsg", "ud", "us",
  "vfb", "vfl",
]);

const WEAK_SINGLE_TOKENS = new Set([
  "athletic", "borussia", "city", "club", "olympique", "racing", "real",
  "sporting", "united",
]);

const ALIAS_GROUPS: Array<[string, string[]]> = [
  ["bayern", ["bayern munchen", "bayern munich", "bayern monachium", "fc bayern munchen", "fc bayern munich"]],
  ["monchengladbach", ["borussia monchengladbach", "borussia m gladbach", "m gladbach", "monchengladbach", "gladbach"]],
  ["hamburg", ["hamburger sv", "hamburg"]],
  ["koln", ["1 fc koln", "fc koln", "koln", "cologne"]],
  ["inter", ["fc internazionale milano", "internazionale", "inter milan", "inter"]],
  ["psg", ["paris saint germain", "paris saint germain fc", "psg"]],
  ["marseille", ["olympique de marseille", "olympique marsylia", "marseille"]],
  ["lyon", ["olympique lyonnais", "olympique lyon", "lyon"]],
  ["wolves", ["wolverhampton wanderers", "wolverhampton", "wolves"]],
  ["manchester united", ["manchester united", "man united", "man utd"]],
  ["manchester city", ["manchester city", "man city"]],
  ["tottenham", ["tottenham hotspur", "tottenham", "spurs"]],
  ["brighton", ["brighton and hove albion", "brighton hove albion", "brighton"]],
  ["nottingham forest", ["nottingham forest", "nottm forest", "notts forest"]],
  ["newcastle", ["newcastle united", "newcastle"]],
  ["west ham", ["west ham united", "west ham"]],
  ["athletic bilbao", ["athletic club", "athletic bilbao", "ath bilbao"]],
  ["atletico", ["atletico madrid", "atletico madryt", "atletico"]],
  ["betis", ["real betis balompie", "real betis", "betis"]],
  ["st pauli", ["fc st pauli", "st pauli"]],
];

const ALIASES = new Map<string, string>();
for (const [canonical, values] of ALIAS_GROUPS) {
  for (const value of values) ALIASES.set(normalizeTeamText(value), canonical);
}

export function normalizeTeamText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceValues(team: TeamIdentityRecord) {
  return [team.name, team.shortName, team.slug]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function coreValue(value: string) {
  return normalizeTeamText(value)
    .split(" ")
    .filter((token) => token && !GENERIC_TOKENS.has(token))
    .join(" ");
}

function canonicalValue(value: string) {
  const normalized = normalizeTeamText(value);
  const core = coreValue(value);
  return ALIASES.get(normalized) ?? ALIASES.get(core) ?? null;
}

function variants(team: TeamIdentityRecord) {
  const full = new Set<string>();
  const core = new Set<string>();
  const canonical = new Set<string>();
  const tokenSets: string[][] = [];

  for (const value of sourceValues(team)) {
    const normalized = normalizeTeamText(value);
    const compact = coreValue(value);
    if (normalized) full.add(normalized);
    if (compact) {
      core.add(compact);
      tokenSets.push(compact.split(" ").filter(Boolean));
    }
    const alias = canonicalValue(value);
    if (alias) canonical.add(alias);
  }

  return { full, core, canonical, tokenSets };
}

function intersects(left: Set<string>, right: Set<string>) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function tokenSimilarity(left: string[], right: string[]) {
  const a = new Set(left);
  const b = new Set(right);
  const shared = [...a].filter((token) => b.has(token));
  if (!shared.length) return { score: 0, reason: "Brak wspólnego rdzenia nazwy" };

  const minSize = Math.min(a.size, b.size);
  const maxSize = Math.max(a.size, b.size);
  const subset = shared.length === minSize;
  const strongShared = shared.filter((token) => token.length >= 4 && !WEAK_SINGLE_TOKENS.has(token));

  if (subset && minSize >= 2) {
    return { score: 92, reason: "Jedna nazwa jest pełnym rozszerzeniem drugiej" };
  }
  if (subset && minSize === 1 && strongShared.length === 1) {
    return { score: 90, reason: "Wspólny jednoznaczny rdzeń nazwy" };
  }

  const jaccard = shared.length / (a.size + b.size - shared.length);
  if (jaccard >= 0.8 && maxSize <= 4) {
    return { score: 89, reason: "Bardzo podobny zestaw członów nazwy" };
  }
  return { score: 0, reason: "Niewystarczające podobieństwo" };
}

export function scoreTeamIdentity(
  left: TeamIdentityRecord,
  right: TeamIdentityRecord,
): TeamIdentityScore {
  const a = variants(left);
  const b = variants(right);

  if (intersects(a.canonical, b.canonical)) {
    return { score: 100, reason: "Znany alias tej samej drużyny" };
  }
  if (intersects(a.full, b.full)) {
    return { score: 98, reason: "Identyczna znormalizowana nazwa" };
  }
  if (intersects(a.core, b.core)) {
    return { score: 96, reason: "Identyczny rdzeń nazwy po usunięciu oznaczeń klubowych" };
  }

  let best: TeamIdentityScore = { score: 0, reason: "Brak bezpiecznego dopasowania" };
  for (const leftTokens of a.tokenSets) {
    for (const rightTokens of b.tokenSets) {
      const candidate = tokenSimilarity(leftTokens, rightTokens);
      if (candidate.score > best.score) best = candidate;
    }
  }
  return best;
}

function historyCount(team: TeamIdentityRecord) {
  return Number.isFinite(team.historicalSeasonCount)
    ? Number(team.historicalSeasonCount)
    : 0;
}

function createdTime(team: TeamIdentityRecord) {
  if (!team.createdAt) return Number.POSITIVE_INFINITY;
  const value = team.createdAt instanceof Date ? team.createdAt : new Date(team.createdAt);
  return Number.isNaN(value.getTime()) ? Number.POSITIVE_INFINITY : value.getTime();
}

export function rankTeamIdentityMatches<T extends TeamIdentityRecord>(
  incoming: TeamIdentityRecord,
  candidates: T[],
) {
  return candidates
    .map((team): RankedTeamIdentity<T> => ({ team, ...scoreTeamIdentity(incoming, team) }))
    .filter((item) => item.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || historyCount(right.team) - historyCount(left.team)
      || createdTime(left.team) - createdTime(right.team)
      || left.team.name.localeCompare(right.team.name, "pl"),
    );
}

export function resolveUniqueTeamIdentity<T extends TeamIdentityRecord>(
  incoming: TeamIdentityRecord,
  candidates: T[],
  minimumScore = AUTO_TEAM_MATCH_SCORE,
) {
  const ranked = rankTeamIdentityMatches(incoming, candidates)
    .filter((item) => item.score >= minimumScore);
  const first = ranked[0] ?? null;
  if (!first) return { match: null, ambiguous: [] as RankedTeamIdentity<T>[] };

  const second = ranked[1] ?? null;
  if (!second) return { match: first, ambiguous: [] as RankedTeamIdentity<T>[] };

  const firstHistory = historyCount(first.team);
  const secondHistory = historyCount(second.team);
  const clearlyMoreEstablished = firstHistory > secondHistory;
  const closeScore = first.score - second.score <= 1;

  if (closeScore && !clearlyMoreEstablished) {
    return {
      match: null,
      ambiguous: ranked.filter((item) => first.score - item.score <= 1).slice(0, 5),
    };
  }

  return { match: first, ambiguous: [] as RankedTeamIdentity<T>[] };
}

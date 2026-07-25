import Form from "next/form";
import Link from "next/link";
import {
  AlertTriangle,
  CircleAlert,
  DatabaseZap,
  Info,
  Pencil,
  RotateCcw,
  Search,
} from "lucide-react";
import { PagePurpose } from "@/components/layout/page-purpose";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  buildDataQualityContext,
  countSourceLimitedMatches,
  findDataQualityIssues,
  QUALITY_STAT_GROUPS,
  type CoverageCell,
  type QualityMatch,
  type SourceCapabilityProfile,
  type StatField,
} from "@/lib/data/data-quality";
import { loadDataQualityMatches } from "@/lib/data/data-quality-report";
import {
  getCachedActiveLeagues,
  getCachedSeasons,
} from "@/lib/data/reference-data";
import { normalizeDataQualityPagination } from "@/lib/data-quality/data-quality-pagination";

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function percentage(value: number) {
  return `${Math.round(value)}%`;
}

function coverageTone(cell: CoverageCell) {
  if (!cell.supported) {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300";
  }
  if (cell.rate >= 95) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
  if (cell.rate >= 80) {
    return "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900 dark:bg-lime-950/30 dark:text-lime-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
}

function coverageLabel(cell: CoverageCell) {
  if (!cell.supported) return "ograniczenie";
  return `${cell.available}/${cell.total}`;
}

function groupCoverage(
  profile: SourceCapabilityProfile,
  fields: readonly StatField[],
): CoverageCell {
  const cells = fields.map((field) => profile.stats[field]);
  const available = cells.reduce((sum, cell) => sum + cell.available, 0);
  const total = cells.reduce((sum, cell) => sum + cell.total, 0);
  return {
    available,
    total,
    rate: total ? (available / total) * 100 : 0,
    supported: cells.some((cell) => cell.supported),
  };
}

function CoverageBadge({ cell }: { cell: CoverageCell }) {
  return (
    <span className={`inline-flex min-w-[84px] flex-col rounded-lg border px-2.5 py-1.5 text-xs ${coverageTone(cell)}`}>
      <span className="font-semibold">{percentage(cell.rate)}</span>
      <span className="opacity-80">{coverageLabel(cell)}</span>
    </span>
  );
}

export default async function DataQualityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const leagueId = stringParam(params.leagueId);
  const requestedSeasonId = stringParam(params.seasonId);
  const providerCode = stringParam(params.providerCode);
  const severity = stringParam(params.severity);
  const type = stringParam(params.type);
  const requestedPage = Number.parseInt(
    stringParam(params.page),
    10,
  );
  const page = Number.isFinite(requestedPage)
    && requestedPage > 0
    ? requestedPage
    : 1;

  const [leagues, allSeasons] = await Promise.all([
    getCachedActiveLeagues(),
    getCachedSeasons(),
  ]);
  const availableSeasons = allSeasons.filter((season) => !leagueId || season.leagueId === leagueId);
  const requestedSeasonExists = availableSeasons.some((season) => season.id === requestedSeasonId);
  const seasonMode = requestedSeasonId === "ALL" || requestedSeasonId === "ACTIVE" || requestedSeasonExists
    ? requestedSeasonId || "ACTIVE"
    : "ACTIVE";
  const activeSeasonIds = availableSeasons.filter((season) => season.active).map((season) => season.id);
  const fallbackSeasonId = availableSeasons[0]?.id;
  const seasonIds = seasonMode === "ALL"
    ? []
    : seasonMode === "ACTIVE"
      ? (activeSeasonIds.length ? activeSeasonIds : fallbackSeasonId ? [fallbackSeasonId] : [])
      : [seasonMode];

  const qualityReport = await loadDataQualityMatches({
    seasonIds,
    leagueId: leagueId && !seasonIds.length
      ? leagueId
      : null,
  });

  const qualityMatches: QualityMatch[] =
    qualityReport.matches;
  const context = buildDataQualityContext(qualityMatches);
  const allIssues = findDataQualityIssues(qualityMatches, context);
  const sourceLimitedMatches = countSourceLimitedMatches(qualityMatches, context);

  const profiles = context.profiles.filter((profile) => (
    !providerCode || (profile.providerCode ?? "unknown") === providerCode
  ));
  const issues = allIssues.filter((issue) => (
    (!providerCode || (issue.providerCode ?? "unknown") === providerCode)
    && (!severity || issue.severity === severity)
    && (!type || issue.type === type)
  ));
  const pagination = normalizeDataQualityPagination({
    requestedPage: page,
    requestedPageSize: 50,
    totalItems: issues.length,
  });
  const paginatedIssues = issues.slice(
    pagination.skip,
    pagination.skip + pagination.pageSize,
  );

  const errors = allIssues.filter((issue) => issue.severity === "error").length;
  const limitationProfiles = context.profiles.filter((profile) => profile.limitations.length > 0);
  const seasons = availableSeasons;
  const sources = [...new Map(context.profiles.map((profile) => [
    profile.providerCode ?? "unknown",
    { code: profile.providerCode ?? "unknown", name: profile.sourceName },
  ])).values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const issueTypes = [...new Set(allIssues.map((issue) => issue.type))].sort((a, b) => a.localeCompare(b, "pl"));
  const filtersActive = Boolean(
    leagueId
    || (requestedSeasonId && requestedSeasonId !== "ACTIVE")
    || providerCode
    || severity
    || type,
  );
  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();

    if (leagueId) query.set("leagueId", leagueId);
    query.set("seasonId", seasonMode);
    if (providerCode) {
      query.set("providerCode", providerCode);
    }
    if (severity) query.set("severity", severity);
    if (type) query.set("type", type);
    if (targetPage > 1) {
      query.set("page", String(targetPage));
    }

    return `/data-quality?${query.toString()}`;
  };

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Dane</h1>
        <p className="text-sm text-zinc-500">Sprawdź, czy mecze mają kompletne statystyki i czy źródło danych działa poprawnie.</p>
      </div>

      <PagePurpose nextHref="/imports" nextLabel="Przejdź do importu">
        Domyślnie analizowane są aktywne sezony wszystkich lig, dzięki czemu strona nie pobiera całej historii. Opcję „Cała historia” wybieraj tylko wtedy, gdy naprawdę jej potrzebujesz.
      </PagePurpose>

      {qualityReport.truncated ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Osiągnięto limit bezpieczeństwa</div>
            <div className="mt-0.5 text-xs">
              Przeanalizowano {qualityReport.scanLimit.toLocaleString("pl-PL")} najnowszych meczów z {qualityReport.totalMatches.toLocaleString("pl-PL")}. Wybierz konkretny sezon, aby otrzymać pełny raport.
            </div>
          </div>
        </div>
      ) : null}

      {sourceLimitedMatches > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          <Info size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Wykryto ograniczenia źródeł danych</div>
            <div className="mt-0.5 text-xs opacity-90">
              {sourceLimitedMatches} zakończonych meczów ma puste pola, których ich źródło nie dostarcza regularnie.
              Nie są one liczone jako błędy ani ostrzeżenia pojedynczych meczów.
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-zinc-500">Wszystkie problemy</div>
          <div className="mt-1 text-3xl font-semibold">{allIssues.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-zinc-500">Błędy</div>
          <div className="mt-1 text-3xl font-semibold text-red-600">{errors}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-zinc-500">Ostrzeżenia</div>
          <div className="mt-1 text-3xl font-semibold text-amber-600">{allIssues.length - errors}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-zinc-500">Profile z ograniczeniami</div>
          <div className="mt-1 text-3xl font-semibold text-blue-600">{limitationProfiles.length}</div>
        </Card>
      </div>

      <Card className="p-4">
        <Form action="/data-quality" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Select name="leagueId" defaultValue={leagueId} aria-label="Liga">
            <option value="">Wszystkie ligi</option>
            {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
          </Select>
          <Select name="seasonId" defaultValue={seasonMode} aria-label="Sezon">
            <option value="ACTIVE">Aktywne sezony</option>
            <option value="ALL">Cała historia (wolniej)</option>
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}
          </Select>
          <Select name="providerCode" defaultValue={providerCode} aria-label="Źródło">
            <option value="">Wszystkie źródła</option>
            {sources.map((source) => <option key={source.code} value={source.code}>{source.name}</option>)}
          </Select>
          <Select name="severity" defaultValue={severity} aria-label="Poziom">
            <option value="">Każdy poziom</option>
            <option value="error">Błędy</option>
            <option value="warning">Ostrzeżenia</option>
          </Select>
          <Select name="type" defaultValue={type} aria-label="Typ problemu">
            <option value="">Każdy typ</option>
            {issueTypes.map((issueType) => <option key={issueType} value={issueType}>{issueType}</option>)}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1"><Search size={16} className="mr-2" />Filtruj</Button>
            {filtersActive ? (
              <Link href="/data-quality" className="inline-flex size-10 items-center justify-center rounded-lg border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" aria-label="Wyczyść filtry">
                <RotateCcw size={16} />
              </Link>
            ) : null}
          </div>
        </Form>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h2 className="font-semibold">Pokrycie źródeł</h2>
            <p className="text-xs text-zinc-500">Procent zakończonych meczów z dostępną wartością.</p>
          </div>
          <div className="text-xs text-zinc-500">{profiles.length} profili liga–sezon–źródło</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60">
              <tr>
                <th className="p-3">Liga i sezon</th>
                <th className="p-3">Źródło</th>
                <th className="p-3">Mecze</th>
                <th className="p-3">Sędzia</th>
                {QUALITY_STAT_GROUPS.map((group) => <th key={group.key} className="p-3">{group.label}</th>)}
                <th className="p-3">Ograniczenia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {profiles.map((profile) => (
                <tr key={profile.key}>
                  <td className="p-3">
                    <div className="font-medium">{profile.leagueName}</div>
                    <div className="text-xs text-zinc-500">{profile.seasonName}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{profile.sourceName}</div>
                    <div className="text-xs text-zinc-500">{profile.providerCode ?? "brak kodu"}</div>
                  </td>
                  <td className="p-3 font-semibold">{profile.finishedMatches}</td>
                  <td className="p-3"><CoverageBadge cell={profile.referee} /></td>
                  {QUALITY_STAT_GROUPS.map((group) => (
                    <td key={group.key} className="p-3">
                      <CoverageBadge cell={groupCoverage(profile, group.fields)} />
                    </td>
                  ))}
                  <td className="p-3">
                    {profile.limitations.length ? (
                      <div className="max-w-[220px] text-xs text-blue-700 dark:text-blue-300">
                        {profile.limitations.join(", ")}
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-600">Brak</span>
                    )}
                  </td>
                </tr>
              ))}
              {!profiles.length ? (
                <tr><td colSpan={12} className="p-10 text-center text-zinc-500">Brak profili dla wybranych filtrów.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h2 className="font-semibold">Problemy wymagające działania</h2>
            <p className="text-xs text-zinc-500">Ograniczenia całego źródła nie trafiają na tę listę.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <DatabaseZap size={16} />{filtersActive ? `${issues.length} z ${allIssues.length}` : allIssues.length}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60">
              <tr>
                <th className="p-3">Poziom</th>
                <th className="p-3">Typ</th>
                <th className="p-3">Mecz</th>
                <th className="p-3">Źródło</th>
                <th className="p-3">Opis</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedIssues.map((issue) => (
                <tr key={issue.key}>
                  <td className="p-3">
                    <Badge className={issue.severity === "error"
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}>
                      {issue.severity === "error" ? <CircleAlert size={13} className="mr-1" /> : <AlertTriangle size={13} className="mr-1" />}
                      {issue.severity === "error" ? "Błąd" : "Ostrzeżenie"}
                    </Badge>
                  </td>
                  <td className="p-3 font-medium">{issue.type}</td>
                  <td className="p-3">
                    <div className="font-medium">{issue.matchLabel}</div>
                    <div className="text-xs text-zinc-500">{issue.leagueSeason}</div>
                  </td>
                  <td className="p-3 text-xs">{issue.sourceName}</td>
                  <td className="p-3">{issue.message}</td>
                  <td className="p-3">
                    <Link href={`/matches/${issue.matchId}/edit`} className="inline-flex rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Pencil size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
              {!paginatedIssues.length ? (
                <tr><td colSpan={6} className="p-10 text-center text-zinc-500">Nie wykryto problemów dla wybranych filtrów.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {pagination.totalItems > 0 ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-zinc-500">
              Problemy {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.totalItems,
              )} z {pagination.totalItems.toLocaleString("pl-PL")}
            </span>
            <div className="flex items-center gap-2">
              {pagination.hasPreviousPage ? (
                <Link
                  href={pageHref(pagination.page - 1)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Poprzednia
                </Link>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-zinc-400 dark:border-zinc-800">
                  Poprzednia
                </span>
              )}
              <span className="px-2 font-medium">
                {pagination.page} / {pagination.totalPages}
              </span>
              {pagination.hasNextPage ? (
                <Link
                  href={pageHref(pagination.page + 1)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Następna
                </Link>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-zinc-400 dark:border-zinc-800">
                  Następna
                </span>
              )}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

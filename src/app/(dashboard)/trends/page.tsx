import Form from "next/form";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookmarkPlus,
  Flame,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createCustomLineAction,
  deleteCustomLineAction,
  toggleCustomLineAction,
} from "@/lib/actions/custom-line-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  analyzeTrendLine,
  extractTrendValues,
  presetLines,
  TREND_STAT_DEFINITIONS,
  type TrendScope,
  type TrendStatKey,
  type TrendVenue,
} from "@/lib/stats/trends";
import { formatNumber } from "@/lib/utils";

const scopes: Array<{ value: TrendScope; label: string; shortLabel: string }> = [
  { value: "MATCH_TOTAL", label: "Suma w meczu", shortLabel: "Suma" },
  { value: "TEAM_FOR", label: "Drużyna – wykonane", shortLabel: "Drużyna" },
  { value: "TEAM_AGAINST", label: "Drużyna – dopuszczone", shortLabel: "Rywal" },
];

const venues: Array<{ value: TrendVenue; label: string }> = [
  { value: "ALL", label: "Wszystkie mecze" },
  { value: "HOME", label: "Tylko u siebie" },
  { value: "AWAY", label: "Tylko na wyjeździe" },
];

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function percentage(value: number | null) {
  return value === null ? "—" : `${formatNumber(value, 0)}%`;
}

function rateClass(value: number | null) {
  if (value === null) return "text-zinc-500";
  if (value >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 60) return "text-lime-600 dark:text-lime-400";
  if (value <= 25) return "text-red-600 dark:text-red-400";
  if (value <= 40) return "text-orange-600 dark:text-orange-400";
  return "text-zinc-900 dark:text-zinc-100";
}

function resultLabel(result: "OVER" | "UNDER" | "PUSH") {
  if (result === "OVER") return "Over";
  if (result === "UNDER") return "Under";
  return "Zwrot";
}

function resultClass(result: "OVER" | "UNDER" | "PUSH") {
  if (result === "OVER") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (result === "UNDER") return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();

  const seasons = await prisma.season.findMany({
    where: { league: { active: true } },
    include: {
      league: true,
      teams: { include: { team: true }, orderBy: { team: { name: "asc" } } },
    },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
  });

  const selectedSeason =
    seasons.find((season) => season.id === stringParam(params.seasonId)) ??
    seasons.find((season) => season.active) ??
    seasons[0];
  const teams = selectedSeason?.teams.map((membership) => membership.team) ?? [];

  const requestedScope = stringParam(params.scope) as TrendScope;
  const scope = scopes.some((item) => item.value === requestedScope) ? requestedScope : "MATCH_TOTAL";
  const requestedTeamId = stringParam(params.teamId);
  const validTeamId = teams.some((team) => team.id === requestedTeamId) ? requestedTeamId : "";
  const teamId = scope === "MATCH_TOTAL" ? validTeamId : validTeamId || teams[0]?.id || "";
  const selectedTeam = teams.find((team) => team.id === teamId) ?? null;

  const requestedVenue = stringParam(params.venue) as TrendVenue;
  const venue = teamId && venues.some((item) => item.value === requestedVenue) ? requestedVenue : "ALL";
  const lookback = ["5", "10", "20", "50", "all"].includes(stringParam(params.lookback))
    ? stringParam(params.lookback)
    : "10";
  const limit = lookback === "all" ? null : Number(lookback);

  const requestedStatKey = stringParam(params.statKey) as TrendStatKey;
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === requestedStatKey)
    ? requestedStatKey
    : "corners";
  const definition = TREND_STAT_DEFINITIONS.find((item) => item.key === statKey)!;
  const defaultLine = presetLines(statKey, scope)[0] ?? 0.5;
  const requestedLine = Number(stringParam(params.line));
  const threshold = Number.isFinite(requestedLine) && requestedLine >= 0 ? requestedLine : defaultLine;

  const [matches, customLines] = selectedSeason
    ? await Promise.all([
        prisma.match.findMany({
          where: {
            seasonId: selectedSeason.id,
            status: "FINISHED",
            ...(teamId ? { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] } : {}),
          },
          select: {
            kickoffAt: true,
            homeTeamId: true,
            awayTeamId: true,
            stats: true,
          },
          orderBy: { kickoffAt: "desc" },
        }),
        prisma.customLine.findMany({
          where: { userId: user.id },
          orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        }),
      ])
    : [[], []];

  const analysisOptions = { teamId: teamId || null, venue, limit };
  const selectedValues = extractTrendValues(matches, { ...analysisOptions, statKey, scope });
  const selectedSummary = analyzeTrendLine(selectedValues, threshold);

  const marketRows = TREND_STAT_DEFINITIONS.map((market) => {
    const values = extractTrendValues(matches, {
      ...analysisOptions,
      statKey: market.key,
      scope,
    });
    return {
      ...market,
      count: values.length,
      average: values.length
        ? values.reduce((sum, item) => sum + item.value, 0) / values.length
        : null,
      lines: presetLines(market.key, scope).map((line) => analyzeTrendLine(values, line)),
    };
  });

  const currentParams = new URLSearchParams();
  if (selectedSeason) currentParams.set("seasonId", selectedSeason.id);
  if (teamId) currentParams.set("teamId", teamId);
  currentParams.set("venue", venue);
  currentParams.set("lookback", lookback);
  currentParams.set("scope", scope);
  currentParams.set("statKey", statKey);
  currentParams.set("line", String(threshold));
  const returnTo = `/trends?${currentParams.toString()}`;

  function lineHref(nextStatKey: TrendStatKey, nextLine: number, nextScope = scope) {
    const next = new URLSearchParams(currentParams);
    next.set("statKey", nextStatKey);
    next.set("scope", nextScope);
    next.set("line", String(nextLine));
    return `/trends?${next.toString()}`;
  }

  const customRows = customLines.map((line) => {
    const lineScope = line.scope as TrendScope;
    const values = extractTrendValues(matches, {
      ...analysisOptions,
      statKey: line.statKey as TrendStatKey,
      scope: lineScope,
    });
    return { line, summary: analyzeTrendLine(values, line.threshold) };
  });

  const sampleLabel = selectedTeam
    ? `${selectedTeam.name} · ${venues.find((item) => item.value === venue)?.label.toLowerCase()}`
    : `${selectedSeason?.league.name ?? "Liga"} · wszystkie mecze`;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Trendy i linie</h1>
        <p className="text-sm text-zinc-500">
          Historyczne pokrycie linii over/under z podziałem na sumę meczu, produkcję drużyny i wartości dopuszczane rywalom.
        </p>
      </div>

      {stringParam(params.created) === "1" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Własna linia została zapisana.
        </div>
      ) : null}

      <Card>
        <CardContent>
          <Form action="/trends" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select name="seasonId" defaultValue={selectedSeason?.id}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>
              ))}
            </Select>
            <Select name="teamId" defaultValue={teamId}>
              <option value="">Cała liga</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </Select>
            <Select name="venue" defaultValue={venue}>
              {venues.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <Select name="lookback" defaultValue={lookback}>
              <option value="5">Ostatnie 5</option>
              <option value="10">Ostatnie 10</option>
              <option value="20">Ostatnie 20</option>
              <option value="50">Ostatnie 50</option>
              <option value="all">Cały sezon</option>
            </Select>
            <Select name="scope" defaultValue={scope}>
              {scopes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <Select name="statKey" defaultValue={statKey}>
              {TREND_STAT_DEFINITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </Select>
            <Input name="line" type="number" min="0" max="500" step="0.5" defaultValue={threshold} aria-label="Linia" />
            <Button type="submit"><Search size={16} className="mr-2" />Analizuj</Button>
          </Form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {presetLines(statKey, scope).map((line) => (
          <Link
            key={line}
            href={lineHref(statKey, line)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${line === threshold ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-zinc-200 hover:border-emerald-400 dark:border-zinc-700"}`}
          >
            Linia {line}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-4"><div className="text-xs text-zinc-500">Próba</div><div className="mt-1 text-2xl font-semibold">{selectedSummary.count}</div><div className="mt-1 text-xs text-zinc-500">{sampleLabel}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Średnia</div><div className="mt-1 text-2xl font-semibold">{formatNumber(selectedSummary.average)}</div><div className="mt-1 text-xs text-zinc-500">Mediana {formatNumber(selectedSummary.median)}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Over {threshold}</div><div className={`mt-1 text-2xl font-semibold ${rateClass(selectedSummary.overRate)}`}>{percentage(selectedSummary.overRate)}</div><div className="mt-1 text-xs text-zinc-500">{selectedSummary.overCount} trafień</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Under {threshold}</div><div className={`mt-1 text-2xl font-semibold ${rateClass(selectedSummary.underRate)}`}>{percentage(selectedSummary.underRate)}</div><div className="mt-1 text-xs text-zinc-500">{selectedSummary.underCount} trafień</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Zakres</div><div className="mt-1 text-2xl font-semibold">{formatNumber(selectedSummary.min)}–{formatNumber(selectedSummary.max)}</div><div className="mt-1 text-xs text-zinc-500">Min–max w próbie</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Aktualna seria</div><div className="mt-1 flex items-center gap-2 text-2xl font-semibold"><Flame size={20} className="text-orange-500" />{selectedSummary.streak ? selectedSummary.streak.length : "—"}</div><div className="mt-1 text-xs text-zinc-500">{selectedSummary.streak ? resultLabel(selectedSummary.streak.result) : "Brak danych"}</div></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity size={18} className="text-emerald-600" />Ostatnie wyniki: {definition.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedSummary.recent.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedSummary.recent.map((item, index) => (
                <div key={`${item.kickoffAt.toISOString()}-${index}`} className={`rounded-lg border px-3 py-2 text-sm ${resultClass(item.result)}`}>
                  <div className="font-semibold">{formatNumber(item.value, 0)}</div>
                  <div className="text-xs opacity-80">{resultLabel(item.result)} · {new Intl.DateTimeFormat("pl-PL", { dateStyle: "short" }).format(item.kickoffAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-zinc-500">Brak zakończonych meczów z kompletną statystyką dla wybranego zestawu.</div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 size={18} className="text-emerald-600" />Macierz standardowych linii</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60">
              <tr><th className="p-3">Rynek</th><th className="p-3">Próba</th><th className="p-3">Średnia</th><th className="p-3">Pokrycie standardowych linii</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {marketRows.map((market) => (
                <tr key={market.key}>
                  <td className="p-3 font-medium">{market.label}</td>
                  <td className="p-3">{market.count}</td>
                  <td className="p-3">{formatNumber(market.average)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {market.lines.map((line) => (
                        <Link key={line.threshold} href={lineHref(market.key, line.threshold)} className="rounded-lg border border-zinc-200 px-2.5 py-1.5 hover:border-emerald-400 dark:border-zinc-700">
                          <span className="text-zinc-500">O {line.threshold}</span>{" "}
                          <span className={`font-semibold ${rateClass(line.overRate)}`}>{percentage(line.overRate)}</span>
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BookmarkPlus size={18} className="text-emerald-600" />Dodaj własną linię</CardTitle></CardHeader>
          <CardContent>
            <form action={createCustomLineAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value={returnTo} />
              <Input name="name" maxLength={80} required placeholder="Np. Rożne gospodarza 5.5" />
              <Select name="statKey" defaultValue={statKey}>
                {TREND_STAT_DEFINITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </Select>
              <Select name="scope" defaultValue={scope}>
                {scopes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
              <Input name="threshold" type="number" min="0" max="500" step="0.5" defaultValue={threshold} required />
              <Button type="submit"><Target size={16} className="mr-2" />Zapisz linię</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader><CardTitle>Moje linie</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60"><tr><th className="p-3">Nazwa</th><th className="p-3">Rynek</th><th className="p-3">Linia</th><th className="p-3">Próba</th><th className="p-3">Over</th><th className="p-3"></th></tr></thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {customRows.map(({ line, summary }) => {
                  const market = TREND_STAT_DEFINITIONS.find((item) => item.key === line.statKey);
                  const scopeLabel = scopes.find((item) => item.value === line.scope)?.shortLabel ?? line.scope;
                  return (
                    <tr key={line.id} className={!line.active ? "opacity-50" : ""}>
                      <td className="p-3 font-medium">{line.name}<div className="text-xs text-zinc-500">{line.active ? "Aktywna" : "Wyłączona"}</div></td>
                      <td className="p-3">{market?.shortLabel ?? line.statKey} · {scopeLabel}</td>
                      <td className="p-3 font-semibold">{line.threshold}</td>
                      <td className="p-3">{summary.count}</td>
                      <td className={`p-3 font-semibold ${rateClass(summary.overRate)}`}>{percentage(summary.overRate)}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Link href={lineHref(line.statKey as TrendStatKey, line.threshold, line.scope as TrendScope)} className="inline-flex h-8 items-center rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Analizuj</Link>
                          <form action={toggleCustomLineAction}><input type="hidden" name="id" value={line.id} /><input type="hidden" name="returnTo" value={returnTo} /><Button type="submit" size="sm" variant="secondary">{line.active ? "Wyłącz" : "Włącz"}</Button></form>
                          <form action={deleteCustomLineAction}><input type="hidden" name="id" value={line.id} /><input type="hidden" name="returnTo" value={returnTo} /><Button type="submit" size="sm" variant="ghost" aria-label="Usuń linię"><Trash2 size={15} /></Button></form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!customRows.length ? <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Nie masz jeszcze własnych linii.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        Pokrycie linii opisuje wyłącznie wyniki historyczne w wybranej próbie. Nie uwzględnia kursu, marży, składów ani informacji meczowych i nie jest automatyczną rekomendacją zakładu.
      </div>
    </div>
  );
}

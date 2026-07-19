import Form from "next/form";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Download,
  Save,
  Scale,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { createCustomLineAction } from "@/lib/actions/custom-line-actions";
import { saveMatchAnalysisNoteAction } from "@/lib/actions/match-analysis-actions";
import { requireUser } from "@/lib/auth";
import { loadMatchAnalysis, type AnalysisLookback } from "@/lib/data/match-analysis";
import { prisma } from "@/lib/db";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

const scopeLabels: Record<string, string> = {
  MATCH_TOTAL: "Suma w meczu",
  TEAM_FOR: "Drużyna – wykonane",
  TEAM_AGAINST: "Drużyna – dopuszczone",
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function rate(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, 0)}%`;
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formLabel(form: { wins: number; draws: number; losses: number }) {
  return `${form.wins}Z · ${form.draws}R · ${form.losses}P`;
}

export default async function MatchAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const seasons = await prisma.season.findMany({
    where: { league: { active: true } },
    include: { league: true },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
  });
  const selectedSeason =
    seasons.find((season) => season.id === stringParam(params.seasonId))
    ?? seasons.find((season) => season.active)
    ?? seasons[0];
  const matches = selectedSeason
    ? await prisma.match.findMany({
        where: { seasonId: selectedSeason.id },
        include: { homeTeam: true, awayTeam: true, referee: true },
        orderBy: { kickoffAt: "asc" },
      })
    : [];
  const requestedMatchId = stringParam(params.matchId);
  const now = new Date();
  const selectedMatch =
    matches.find((match) => match.id === requestedMatchId)
    ?? matches.find(
      (match) => match.kickoffAt >= now && ["SCHEDULED", "POSTPONED"].includes(match.status),
    )
    ?? matches.at(-1)
    ?? null;
  const lookbackText = stringParam(params.lookback);
  const lookback: AnalysisLookback = ["5", "10", "20"].includes(lookbackText)
    ? Number(lookbackText) as 5 | 10 | 20
    : lookbackText === "all"
      ? null
      : 10;
  const lookbackValue = lookback === null ? "all" : String(lookback);
  const analysis = selectedMatch
    ? await loadMatchAnalysis({ matchId: selectedMatch.id, userId: user.id, lookback })
    : null;

  const currentParams = new URLSearchParams();
  if (selectedSeason) currentParams.set("seasonId", selectedSeason.id);
  if (selectedMatch) currentParams.set("matchId", selectedMatch.id);
  currentParams.set("lookback", lookbackValue);
  const returnTo = `/analysis?${currentParams.toString()}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-semibold">Centrum analizy meczu</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Forma, splity dom/wyjazd, projekcje, linie over/under, H2H i profil sędziego w jednym miejscu.
          </p>
        </div>
        {analysis ? (
          <Link
            href={`/analysis/export?matchId=${analysis.match.id}&lookback=${lookbackValue}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Download size={16} className="mr-2" />Eksport CSV
          </Link>
        ) : null}
      </div>

      {stringParam(params.saved) === "1" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Notatka analityczna została zapisana.
        </div>
      ) : null}
      {stringParam(params.created) === "1" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Własna linia została dodana do analizy.
        </div>
      ) : null}

      <Card>
        <CardContent>
          <Form action="/analysis" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.6fr_0.7fr_auto]">
            <Select name="seasonId" defaultValue={selectedSeason?.id}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.league.name} · {season.name}
                </option>
              ))}
            </Select>
            <Select name="matchId" defaultValue={selectedMatch?.id}>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {new Intl.DateTimeFormat("pl-PL", { dateStyle: "short" }).format(match.kickoffAt)} · {match.homeTeam.name} – {match.awayTeam.name}
                </option>
              ))}
            </Select>
            <Select name="lookback" defaultValue={lookbackValue}>
              <option value="5">Ostatnie 5</option>
              <option value="10">Ostatnie 10</option>
              <option value="20">Ostatnie 20</option>
              <option value="all">Cały sezon</option>
            </Select>
            <Button type="submit"><Target size={16} className="mr-2" />Analizuj</Button>
          </Form>
        </CardContent>
      </Card>

      {!analysis ? (
        <Card className="p-10 text-center text-zinc-500">
          W wybranym sezonie nie ma jeszcze meczów do analizy.
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div>
                <div className="text-xs uppercase text-zinc-500">Gospodarz</div>
                <div className="mt-1 text-2xl font-semibold">{analysis.match.homeTeam.name}</div>
                <div className="mt-2 text-sm text-zinc-500">{formLabel(analysis.homeForm)} · {formatNumber(analysis.homeForm.pointsPerMatch)} pkt/mecz</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">{analysis.match.season.league.name} · {analysis.match.season.name}</div>
                <div className="mt-1 text-xs text-zinc-500">{dateTime(analysis.match.kickoffAt)}</div>
                <div className="mt-2 text-sm">Kolejka {analysis.match.round ?? "—"}</div>
              </div>
              <div className="lg:text-right">
                <div className="text-xs uppercase text-zinc-500">Gość</div>
                <div className="mt-1 text-2xl font-semibold">{analysis.match.awayTeam.name}</div>
                <div className="mt-2 text-sm text-zinc-500">{formLabel(analysis.awayForm)} · {formatNumber(analysis.awayForm.pointsPerMatch)} pkt/mecz</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="p-4"><CalendarDays size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Termin</div><div className="mt-1 font-medium">{dateTime(analysis.match.kickoffAt)}</div></Card>
            <Card className="p-4"><Users size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Próba formy</div><div className="mt-1 font-medium">{analysis.homeForm.count}/{analysis.awayForm.count} meczów</div></Card>
            <Card className="p-4"><TrendingUp size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Próba splitów</div><div className="mt-1 font-medium">{analysis.homeVenue.length}/{analysis.awayVenue.length} dom/wyjazd</div></Card>
            <Card className="p-4"><Scale size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Sędzia</div><div className="mt-1 font-medium">{analysis.match.referee?.name ?? "Brak w źródle"}</div></Card>
            <Card className="p-4"><Target size={18} className="mb-2 text-emerald-600" /><div className="text-xs text-zinc-500">Źródło meczu</div><div className="mt-1 font-medium">{analysis.match.dataSource?.name ?? "Brak"}</div></Card>
          </div>

          {analysis.weakMarkets.length ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Ograniczona próba dla części rynków</div>
                <div className="mt-1 text-xs">
                  {analysis.weakMarkets.map((market) => market.shortLabel).join(", ")}. Projekcje z próbą poniżej 3 meczów traktuj jako orientacyjne.
                </div>
              </div>
            </div>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Projekcja statystyk dom/wyjazd</CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr>
                    <th className="p-3">Rynek</th>
                    <th className="p-3">Gospodarz wykonuje</th>
                    <th className="p-3">Gość oddaje</th>
                    <th className="p-3">Prognoza gospodarza</th>
                    <th className="p-3">Gość wykonuje</th>
                    <th className="p-3">Gospodarz oddaje</th>
                    <th className="p-3">Prognoza gościa</th>
                    <th className="p-3">Prognoza sumy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analysis.projections.map((row) => (
                    <tr key={row.key}>
                      <td className="p-3 font-medium">{row.label}<div className="text-xs text-zinc-500">próba {row.homeSample}/{row.awaySample}</div></td>
                      <td className="p-3">{formatNumber(row.homeFor)}</td>
                      <td className="p-3">{formatNumber(row.awayAgainst)}</td>
                      <td className="p-3 font-semibold text-emerald-600">{formatNumber(row.projectedHome)}</td>
                      <td className="p-3">{formatNumber(row.awayFor)}</td>
                      <td className="p-3">{formatNumber(row.homeAgainst)}</td>
                      <td className="p-3 font-semibold text-emerald-600">{formatNumber(row.projectedAway)}</td>
                      <td className="p-3 text-lg font-semibold">{formatNumber(row.projectedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Pokrycie popularnych linii over/under</CardTitle>
              <p className="text-sm text-zinc-500">Połączona próba meczów gospodarza u siebie i gościa na wyjeździe.</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
                  <tr><th className="p-3">Rynek</th><th className="p-3">Próba</th><th className="p-3">Linie i skuteczność over</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analysis.projections.map((row) => (
                    <tr key={row.key}>
                      <td className="p-3 font-medium">{row.label}</td>
                      <td className="p-3">{row.totalSample}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {row.lines.map((line) => (
                            <span key={line.threshold} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700">
                              O {line.threshold}: <strong>{rate(line.overRate)}</strong> · U: <strong>{rate(line.underRate)}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Ostatnie H2H</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {analysis.h2h.map((item) => (
                  <Link key={item.id} href={`/matches/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:border-emerald-400 dark:border-zinc-800">
                    <div><div className="font-medium">{item.homeTeam.name} – {item.awayTeam.name}</div><div className="text-xs text-zinc-500">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(item.kickoffAt)}</div></div>
                    <div className="text-lg font-semibold">{item.homeScore ?? "—"}:{item.awayScore ?? "—"}</div>
                  </Link>
                ))}
                {!analysis.h2h.length ? <div className="py-8 text-center text-sm text-zinc-500">Brak wcześniejszych bezpośrednich spotkań w bazie.</div> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Profil sędziego</CardTitle></CardHeader>
              <CardContent>
                {analysis.match.referee ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><div className="text-xl font-semibold">{analysis.match.referee.name}</div><div className="text-sm text-zinc-500">{analysis.refereeSummary.count} wcześniejszych meczów w bazie</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Kartki</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.cards)}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Żółte</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.yellowCards)}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Faule</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.fouls)}</div></div>
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"><div className="text-xs text-zinc-500">Rożne</div><div className="mt-1 text-2xl font-semibold">{formatNumber(analysis.refereeSummary.corners)}</div></div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-zinc-500">Źródło nie przypisało sędziego do tego meczu.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader><CardTitle>Własne linie użytkownika</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {analysis.customLineRows.map((line) => (
                  <div key={line.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><div className="font-medium">{line.name}</div><div className="text-xs text-zinc-500">{line.statLabel} · {scopeLabels[line.scope]} · linia {line.threshold}</div></div>
                      {line.analysis.combined ? (
                        <div className="text-right"><div className="text-xs text-zinc-500">Over</div><div className="text-xl font-semibold text-emerald-600">{rate(line.analysis.combined.overRate)}</div><div className="text-xs text-zinc-500">próba {line.analysis.combined.count}</div></div>
                      ) : (
                        <div className="flex gap-5 text-right text-sm">
                          <div><div className="text-xs text-zinc-500">Gospodarz</div><div className="font-semibold text-emerald-600">{rate(line.analysis.home?.overRate)}</div><div className="text-xs text-zinc-500">n={line.analysis.home?.count ?? 0}</div></div>
                          <div><div className="text-xs text-zinc-500">Gość</div><div className="font-semibold text-emerald-600">{rate(line.analysis.away?.overRate)}</div><div className="text-xs text-zinc-500">n={line.analysis.away?.count ?? 0}</div></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!analysis.customLineRows.length ? <div className="py-6 text-center text-sm text-zinc-500">Nie masz jeszcze aktywnych własnych linii.</div> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dodaj własną linię</CardTitle></CardHeader>
              <CardContent>
                <form action={createCustomLineAction} className="grid gap-3">
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Input name="name" placeholder="Np. Rożne 10.5 — analiza meczu" maxLength={80} required />
                  <Select name="statKey" defaultValue="corners">
                    {TREND_STAT_DEFINITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </Select>
                  <Select name="scope" defaultValue="MATCH_TOTAL">
                    {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                  <Input name="threshold" type="number" min="0" max="500" step="0.5" defaultValue="9.5" required />
                  <Button type="submit"><Target size={16} className="mr-2" />Zapisz linię</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Notatka analityczna</CardTitle></CardHeader>
            <CardContent>
              <form action={saveMatchAnalysisNoteAction} className="grid gap-3">
                <input type="hidden" name="matchId" value={analysis.match.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <textarea
                  name="note"
                  rows={6}
                  maxLength={4000}
                  defaultValue={analysis.match.analysisNotes[0]?.content ?? ""}
                  placeholder="Wnioski, planowane linie, ograniczenia danych, uwagi do sędziego..."
                  aria-label="Notatka analityczna"
                  className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <div className="flex justify-end"><Button type="submit"><Save size={16} className="mr-2" />Zapisz notatkę</Button></div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

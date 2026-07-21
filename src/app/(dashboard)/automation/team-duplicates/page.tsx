import Form from "next/form";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Link2, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { mergeDuplicateTeamAction } from "@/lib/actions/team-duplicate-actions";
import { requireUser } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  DUPLICATE_SUGGESTION_SCORE,
  rankTeamIdentityMatches,
} from "@/lib/teams/team-identity";

const errorMessages: Record<string, string> = {
  "error-team": "Wybierz dwie różne drużyny.",
  "error-confirm": "Scalenie wymaga potwierdzenia.",
  "error-match": "Scalenie utworzyłoby duplikat istniejącego meczu. Operację zatrzymano.",
  "error-mapping": "Obie drużyny mają różne mapowania w tym samym źródle. Operację zatrzymano.",
  "error-league": "Drużyny nie należą do tej samej ligi.",
  "error-opponents": "Drużyny występują przeciwko sobie w jednym meczu. Automatyczne scalenie jest niedozwolone.",
  "error-unknown": "Nie udało się bezpiecznie scalić drużyn. Żadnych danych nie zmieniono.",
};

export default async function TeamDuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canAdminister(user.role)) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
          <ShieldCheck />Ten moduł jest dostępny wyłącznie dla administratora.
        </div>
      </Card>
    );
  }

  const params = await searchParams;
  const requestedSeasonId = typeof params.seasonId === "string" ? params.seasonId : "";
  const seasons = await prisma.season.findMany({
    where: { league: { active: true } },
    include: { league: true, _count: { select: { teams: true, matches: true } } },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
  });
  const selected = seasons.find((season) => season.id === requestedSeasonId)
    ?? seasons.find((season) => season.active)
    ?? seasons[0]
    ?? null;

  const teams = selected
    ? await prisma.team.findMany({
        where: { seasonMemberships: { some: { season: { leagueId: selected.leagueId } } } },
        include: {
          seasonMemberships: {
            where: { season: { leagueId: selected.leagueId } },
            include: { season: { select: { id: true, name: true, startsAt: true } } },
          },
          _count: { select: { homeMatches: true, awayMatches: true, seasonMemberships: true } },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const currentTeams = selected
    ? teams.filter((team) => team.seasonMemberships.some((item) => item.seasonId === selected.id))
    : [];

  const suggestions = currentTeams.flatMap((source) => {
    const sourceHistory = source.seasonMemberships.filter(
      (item) => selected && item.season.startsAt < selected.startsAt,
    ).length;
    const candidates = teams
      .filter((candidate) => candidate.id !== source.id)
      .map((candidate) => ({
        ...candidate,
        historicalSeasonCount: candidate.seasonMemberships.filter(
          (item) => selected && item.season.startsAt < selected.startsAt,
        ).length,
      }))
      .filter((candidate) =>
        candidate.historicalSeasonCount > sourceHistory
        || candidate.createdAt < source.createdAt,
      );

    const ranked = rankTeamIdentityMatches(
      { ...source, historicalSeasonCount: sourceHistory },
      candidates,
    ).filter((item) => item.score >= DUPLICATE_SUGGESTION_SCORE);

    return ranked.length ? [{ source, sourceHistory, candidates: ranked.slice(0, 5) }] : [];
  });

  const activeError = Object.keys(errorMessages).find((key) => params[key] === "1");

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-3">
        <Link href="/automation" className="mt-1 rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Wróć do automatyzacji">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Kontrola duplikatów drużyn</h1>
          <p className="text-sm text-zinc-500">
            Łączy różne nazwy tego samego klubu bez utraty meczów, sezonów i mapowań źródeł.
          </p>
        </div>
      </div>

      {params.merged === "1" ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} />Drużyny zostały scalone, a powiązania przeniesione w jednej transakcji.
        </div>
      ) : null}
      {activeError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={18} />{errorMessages[activeError]}
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Zakres kontroli</CardTitle></CardHeader>
        <CardContent>
          <Form action="/automation/team-duplicates" className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Select name="seasonId" defaultValue={selected?.id ?? ""}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.league.name} · {season.name} · {season._count.teams} drużyn · {season._count.matches} meczów
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary"><Search size={16} className="mr-2" />Sprawdź</Button>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-amber-300 dark:border-amber-900">
        <CardContent className="flex gap-3 p-4 text-sm text-zinc-600 dark:text-zinc-300">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100">Przed scaleniem pobierz kopię danych.</div>
            <p>Operacja jest atomowa i zatrzyma się przy kolizji meczu lub mapowania. Nie usuwaj drużyn ręcznie.</p>
            <a href="/api/admin/backup" className="mt-2 inline-flex items-center text-emerald-600 hover:underline">Pobierz kopię danych</a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {suggestions.map(({ source, sourceHistory, candidates }) => (
          <Card key={source.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{source.name}</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {sourceHistory} wcześniejszych sezonów · {source._count.homeMatches + source._count.awayMatches} meczów
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">podejrzany duplikat</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form action={mergeDuplicateTeamAction} className="grid gap-4">
                <input type="hidden" name="seasonId" value={selected?.id ?? ""} />
                <input type="hidden" name="sourceTeamId" value={source.id} />
                <div className="grid gap-2">
                  <label htmlFor={`target-${source.id}`} className="text-sm font-medium">Docelowa, właściwa drużyna</label>
                  <Select id={`target-${source.id}`} name="targetTeamId" defaultValue={candidates[0]?.team.id ?? ""}>
                    {candidates.map((candidate) => (
                      <option key={candidate.team.id} value={candidate.team.id}>
                        {candidate.team.name} · zgodność {candidate.score}% · {candidate.team.historicalSeasonCount} wcześniejszych sezonów
                      </option>
                    ))}
                  </Select>
                  <div className="text-xs text-zinc-500">
                    Najlepsze dopasowanie: {candidates[0]?.reason}. Scalenie zachowa nazwę drużyny docelowej.
                  </div>
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <input type="checkbox" name="confirmed" value="yes" required className="mt-1" />
                  <span>Potwierdzam, że <strong>{source.name}</strong> i wybrana drużyna oznaczają ten sam klub.</span>
                </label>
                <div className="flex justify-end">
                  <Button type="submit"><Link2 size={16} className="mr-2" />Scal bezpiecznie</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}

        {!suggestions.length ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-600" />
            <div className="font-medium">Nie znaleziono oczywistych duplikatów w wybranym sezonie.</div>
            <p className="mt-1 text-sm text-zinc-500">Niejednoznaczne nazwy będą zatrzymywane podczas kolejnych importów zamiast tworzyć nową drużynę.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

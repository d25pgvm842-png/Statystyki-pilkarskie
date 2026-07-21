import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createLeagueAction,
  createRefereeAction,
  createSeasonAction,
  createTeamAction,
  setActiveSeasonAction,
  toggleLeagueAction,
  toggleRefereeAction,
  toggleTeamAction,
} from "@/lib/actions/catalog-actions";
import { requireUser } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const messages: Record<string, string> = {
  league: "Liga została dodana.",
  season: "Sezon został dodany.",
  team: "Drużyna została dodana i przypisana do sezonu.",
  referee: "Sędzia został dodany i przypisany do sezonu.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const user = await requireUser();
  if (!canAdminister(user.role)) redirect("/");
  const params = await searchParams;

  const [leagues, seasons, teams, referees] = await Promise.all([
    prisma.league.findMany({
      include: {
        seasons: {
          include: { _count: { select: { teams: true, matches: true, refereeSeasons: true } } },
          orderBy: { startsAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.season.findMany({
      include: { league: true },
      orderBy: [{ active: "desc" }, { startsAt: "desc" }],
    }),
    prisma.team.findMany({
      include: {
        seasonMemberships: {
          include: { season: { include: { league: true } } },
          orderBy: { season: { startsAt: "desc" } },
        },
      },
      orderBy: { name: "asc" },
      take: 150,
    }),
    prisma.referee.findMany({
      include: {
        seasons: {
          include: { season: { include: { league: true } } },
          orderBy: { season: { startsAt: "desc" } },
        },
        _count: { select: { matches: true } },
      },
      orderBy: { name: "asc" },
      take: 150,
    }),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Konfiguracja bazy</h1>
        <p className="text-sm text-zinc-500">
          Ligi, aktywne sezony, składy lig i obsada sędziowska. Dostęp tylko dla administratora.
        </p>
      </div>

      {params.ok && messages[params.ok] ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {messages[params.ok]}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-sm text-zinc-500">Ligi</div><div className="text-2xl font-semibold">{leagues.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Sezony</div><div className="text-2xl font-semibold">{seasons.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Drużyny</div><div className="text-2xl font-semibold">{teams.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Sędziowie</div><div className="text-2xl font-semibold">{referees.length}</div></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Dodaj ligę</CardTitle></CardHeader>
          <CardContent>
            <form action={createLeagueAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Nazwa"><Input name="name" required /></Field>
              <Field label="Kraj"><Input name="country" required /></Field>
              <Field label="Kod"><Input name="code" placeholder="ENG1" required /></Field>
              <div className="flex items-end"><Button type="submit">Dodaj ligę</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dodaj sezon</CardTitle></CardHeader>
          <CardContent>
            <form action={createSeasonAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Liga">
                <Select name="leagueId" required>
                  <option value="">Wybierz</option>
                  {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                </Select>
              </Field>
              <Field label="Nazwa"><Input name="name" placeholder="2026/27" required /></Field>
              <Field label="Początek"><Input name="startsAt" type="date" required /></Field>
              <Field label="Koniec"><Input name="endsAt" type="date" required /></Field>
              <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" /> Ustaw jako aktywny</label>
              <div className="flex justify-end"><Button type="submit">Dodaj sezon</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dodaj drużynę do sezonu</CardTitle></CardHeader>
          <CardContent>
            <form action={createTeamAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Nazwa"><Input name="name" required /></Field>
              <Field label="Skrót"><Input name="shortName" maxLength={12} /></Field>
              <Field label="Kraj"><Input name="country" required /></Field>
              <Field label="Sezon">
                <Select name="seasonId" required>
                  <option value="">Wybierz</option>
                  {seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit">Dodaj drużynę</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dodaj sędziego do sezonu</CardTitle></CardHeader>
          <CardContent>
            <form action={createRefereeAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Imię i nazwisko"><Input name="name" required /></Field>
              <Field label="Sezon">
                <Select name="seasonId" required>
                  <option value="">Wybierz</option>
                  {seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit">Dodaj sędziego</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ligi i sezony</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {leagues.map((league) => (
            <div key={league.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {league.name}
                    <Badge>{league.code}</Badge>
                    {league.active
                      ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Aktywna</Badge>
                      : <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Wyłączona</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{league.country}</div>
                </div>
                <form action={toggleLeagueAction}>
                  <input type="hidden" name="id" value={league.id} />
                  <input type="hidden" name="active" value={String(league.active)} />
                  <Button type="submit" variant="secondary" size="sm">{league.active ? "Wyłącz ligę" : "Włącz ligę"}</Button>
                </form>
              </div>

              <div className="mt-4 grid gap-2">
                {league.seasons.map((season) => (
                  <div key={season.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {season.name}
                        {season.active ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Aktywny sezon</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {season._count.teams} drużyn · {season._count.refereeSeasons} sędziów · {season._count.matches} meczów
                      </div>
                    </div>
                    {!season.active ? (
                      <form action={setActiveSeasonAction}>
                        <input type="hidden" name="id" value={season.id} />
                        <Button type="submit" variant="secondary" size="sm">Ustaw aktywny</Button>
                      </form>
                    ) : null}
                  </div>
                ))}
                {!league.seasons.length ? <div className="text-sm text-zinc-500">Brak sezonów.</div> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Katalog drużyn</CardTitle></CardHeader>
          <CardContent className="grid max-h-[620px] gap-2 overflow-y-auto">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="truncate">{team.name}</span>
                    {team.shortName ? <Badge>{team.shortName}</Badge> : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-500">
                    {team.seasonMemberships.map(({ season }) => `${season.league.name} ${season.name}`).join(", ") || "bez sezonu"}
                  </div>
                </div>
                <form action={toggleTeamAction}>
                  <input type="hidden" name="id" value={team.id} />
                  <input type="hidden" name="active" value={String(team.active)} />
                  <Button type="submit" variant="secondary" size="sm">{team.active ? "Wyłącz" : "Włącz"}</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Katalog sędziów</CardTitle></CardHeader>
          <CardContent className="grid max-h-[620px] gap-2 overflow-y-auto">
            {referees.map((referee) => (
              <div key={referee.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="truncate font-medium">{referee.name}</div>
                  <div className="mt-1 truncate text-xs text-zinc-500">
                    {referee.seasons.map(({ season }) => `${season.league.name} ${season.name}`).join(", ") || "bez sezonu"} · {referee._count.matches} meczów
                  </div>
                </div>
                <form action={toggleRefereeAction}>
                  <input type="hidden" name="id" value={referee.id} />
                  <input type="hidden" name="active" value={String(referee.active)} />
                  <Button type="submit" variant="secondary" size="sm">{referee.active ? "Wyłącz" : "Włącz"}</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

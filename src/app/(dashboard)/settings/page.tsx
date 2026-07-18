import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createLeagueAction, createRefereeAction, createSeasonAction, createTeamAction, toggleLeagueAction } from "@/lib/actions/catalog-actions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const messages: Record<string, string> = {
  league: "Liga została dodana.",
  season: "Sezon został dodany.",
  team: "Drużyna została dodana i przypisana do sezonu.",
  referee: "Sędzia został dodany i przypisany do sezonu.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  const params = await searchParams;
  const [leagues, seasons, teamsCount, refereesCount] = await Promise.all([
    prisma.league.findMany({ include: { seasons: { orderBy: { startsAt: "desc" } } }, orderBy: { name: "asc" } }),
    prisma.season.findMany({ include: { league: true }, orderBy: [{ active: "desc" }, { startsAt: "desc" }] }),
    prisma.team.count(),
    prisma.referee.count(),
  ]);

  return (
    <div className="grid gap-5">
      <div><h1 className="text-2xl font-semibold">Konfiguracja bazy</h1><p className="text-sm text-zinc-500">Ligi, sezony, drużyny i sędziowie. Dostęp tylko dla administratora.</p></div>
      {params.ok && messages[params.ok] ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{messages[params.ok]}</div> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-sm text-zinc-500">Ligi</div><div className="text-2xl font-semibold">{leagues.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Sezony</div><div className="text-2xl font-semibold">{seasons.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Drużyny</div><div className="text-2xl font-semibold">{teamsCount}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Sędziowie</div><div className="text-2xl font-semibold">{refereesCount}</div></Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Dodaj ligę</CardTitle></CardHeader><CardContent><form action={createLeagueAction} className="grid gap-3 sm:grid-cols-2"><Field label="Nazwa"><Input name="name" required /></Field><Field label="Kraj"><Input name="country" required /></Field><Field label="Kod"><Input name="code" placeholder="ENG1" required /></Field><div className="flex items-end"><Button type="submit">Dodaj ligę</Button></div></form></CardContent></Card>
        <Card><CardHeader><CardTitle>Dodaj sezon</CardTitle></CardHeader><CardContent><form action={createSeasonAction} className="grid gap-3 sm:grid-cols-2"><Field label="Liga"><Select name="leagueId" required><option value="">Wybierz</option>{leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}</Select></Field><Field label="Nazwa"><Input name="name" placeholder="2026/27" required /></Field><Field label="Początek"><Input name="startsAt" type="date" required /></Field><Field label="Koniec"><Input name="endsAt" type="date" required /></Field><label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" /> Ustaw jako aktywny</label><div className="flex justify-end"><Button type="submit">Dodaj sezon</Button></div></form></CardContent></Card>
        <Card><CardHeader><CardTitle>Dodaj drużynę</CardTitle></CardHeader><CardContent><form action={createTeamAction} className="grid gap-3 sm:grid-cols-2"><Field label="Nazwa"><Input name="name" required /></Field><Field label="Skrót"><Input name="shortName" maxLength={12} /></Field><Field label="Kraj"><Input name="country" required /></Field><Field label="Sezon"><Select name="seasonId" required><option value="">Wybierz</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select></Field><div className="sm:col-span-2 flex justify-end"><Button type="submit">Dodaj drużynę</Button></div></form></CardContent></Card>
        <Card><CardHeader><CardTitle>Dodaj sędziego</CardTitle></CardHeader><CardContent><form action={createRefereeAction} className="grid gap-3 sm:grid-cols-2"><Field label="Imię i nazwisko"><Input name="name" required /></Field><Field label="Sezon"><Select name="seasonId" required><option value="">Wybierz</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}</Select></Field><div className="sm:col-span-2 flex justify-end"><Button type="submit">Dodaj sędziego</Button></div></form></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Ligi i sezony</CardTitle></CardHeader><CardContent className="grid gap-3">{leagues.map((league) => <div key={league.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><div><div className="flex items-center gap-2 font-medium">{league.name}<Badge>{league.code}</Badge>{league.active ? <Badge className="bg-emerald-100 text-emerald-700">Aktywna</Badge> : <Badge className="bg-zinc-100 text-zinc-600">Wyłączona</Badge>}</div><div className="mt-1 text-xs text-zinc-500">{league.country} · {league.seasons.map((season) => `${season.name}${season.active ? " (aktywny)" : ""}`).join(", ") || "brak sezonów"}</div></div><form action={toggleLeagueAction}><input type="hidden" name="id" value={league.id} /><input type="hidden" name="active" value={String(league.active)} /><Button type="submit" variant="secondary" size="sm">{league.active ? "Wyłącz" : "Włącz"}</Button></form></div>)}</CardContent></Card>
    </div>
  );
}

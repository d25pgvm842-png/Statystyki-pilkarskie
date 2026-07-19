import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  prepareApiFootballImportAction,
  syncApiFootballTeamsAction,
} from "@/lib/actions/api-sync-actions";
import { API_FOOTBALL_LEAGUE_IDS, API_FOOTBALL_PROVIDER_CODE } from "@/lib/api-football/provider";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listExternalMappings } from "@/lib/external-mappings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const errorMessages: Record<string, string> = {
  season: "Wybierz poprawny sezon.",
  "league-map": "Brak identyfikatora ligi API-Football. Uzupełnij go ręcznie.",
  key: "Brak API_FOOTBALL_KEY w zmiennych środowiskowych Vercela.",
  provider: "API-Football odrzuciło zapytanie. Sprawdź klucz, plan i dostępność ligi.",
  rate: "Przekroczono limit zapytań API-Football. Odczekaj i spróbuj ponownie.",
  unknown: "Nie udało się wykonać synchronizacji.",
  "no-teams": "Dostawca nie zwrócił drużyn dla wybranego sezonu.",
  "no-fixtures": "Brak meczów w wybranym zakresie dat.",
  "date-range": "Zakres dat musi mieć od 1 do 31 dni.",
};

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{
    seasonId?: string;
    ok?: string;
    error?: string;
    created?: string;
    linked?: string;
    total?: string;
  }>;
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
          <ShieldCheck />Ten moduł jest dostępny wyłącznie dla administratora.
        </div>
      </Card>
    );
  }

  const query = await searchParams;
  const [seasons, mappings, batches] = await Promise.all([
    prisma.season.findMany({
      where: { league: { active: true } },
      include: {
        league: true,
        _count: { select: { teams: true, matches: true } },
      },
      orderBy: [{ active: "desc" }, { startsAt: "desc" }],
    }),
    listExternalMappings({ providerCode: API_FOOTBALL_PROVIDER_CODE, active: true }),
    prisma.importBatch.findMany({
      where: { source: { providerCode: API_FOOTBALL_PROVIDER_CODE } },
      include: { source: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const selected = seasons.find((season) => season.id === query.seasonId)
    ?? seasons.find((season) => season.active)
    ?? seasons[0];
  const leagueMapping = selected
    ? mappings.find((mapping) => mapping.entityType === "LEAGUE" && mapping.internalId === selected.leagueId)
    : null;
  const suggestedLeagueId = selected
    ? leagueMapping?.externalId ?? String(API_FOOTBALL_LEAGUE_IDS[selected.league.code] ?? "")
    : "";
  const teamMappingCount = mappings.filter((mapping) => mapping.entityType === "TEAM").length;
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 14);
  const configured = Boolean(process.env.API_FOOTBALL_KEY?.trim());

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Automatyzacja danych</h1>
        <p className="text-sm text-zinc-500">
          Pobieranie drużyn, terminarzy, wyników i statystyk z API-Football do kolejki weryfikacyjnej.
        </p>
      </div>

      {query.error && errorMessages[query.error] ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={18} />{errorMessages[query.error]}
        </div>
      ) : null}
      {query.ok === "teams" ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} />Zsynchronizowano {query.total ?? 0} drużyn. Nowe: {query.created ?? 0}, połączone z istniejącymi: {query.linked ?? 0}.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <KeyRound size={18} className={configured ? "text-emerald-600" : "text-red-600"} />
          <div className="mt-2 text-xs text-zinc-500">Klucz dostawcy</div>
          <div className="font-medium">{configured ? "Skonfigurowany" : "Brak klucza"}</div>
        </Card>
        <Card className="p-4">
          <Link2 size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Mapowania drużyn</div>
          <div className="font-medium">{teamMappingCount}</div>
        </Card>
        <Card className="p-4">
          <CloudDownload size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Importy API</div>
          <div className="font-medium">{batches.length}</div>
        </Card>
        <Card className="p-4">
          <RefreshCw size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Tryb zapisu</div>
          <div className="font-medium">Najpierw weryfikacja</div>
        </Card>
      </div>

      {!configured ? (
        <Card className="border-amber-300 dark:border-amber-900">
          <CardHeader><CardTitle>Wymagana konfiguracja Vercela</CardTitle></CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
            Dodaj w projekcie Vercela zmienną <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">API_FOOTBALL_KEY</code> dla Production i Preview, a następnie wykonaj Redeploy. Klucz nigdy nie jest wyświetlany w aplikacji.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Wybór ligi i sezonu</CardTitle></CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Field label="Liga i sezon">
              <Select name="seasonId" defaultValue={selected?.id ?? ""}>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.league.name} · {season.name} · {season._count.teams} drużyn · {season._count.matches} meczów
                  </option>
                ))}
              </Select>
            </Field>
            <div className="self-end"><Button type="submit" variant="secondary">Wybierz</Button></div>
          </form>
        </CardContent>
      </Card>

      {selected ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users size={18} />1. Synchronizacja drużyn</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={syncApiFootballTeamsAction} className="grid gap-4">
                <input type="hidden" name="seasonId" value={selected.id} />
                <Field label="Identyfikator ligi API-Football">
                  <Input name="externalLeagueId" type="number" min="1" required defaultValue={suggestedLeagueId} />
                </Field>
                <p className="text-sm text-zinc-500">
                  Aplikacja automatycznie utworzy brakujące drużyny, przypisze je do sezonu i zachowa stabilne identyfikatory dostawcy.
                </p>
                <div className="flex justify-end"><Button type="submit" disabled={!configured}><RefreshCw size={16} className="mr-2" />Synchronizuj drużyny</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CloudDownload size={18} />2. Pobranie meczów</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={prepareApiFootballImportAction} className="grid gap-4">
                <input type="hidden" name="seasonId" value={selected.id} />
                <input type="hidden" name="externalLeagueId" value={suggestedLeagueId} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Data od"><Input name="from" type="date" required defaultValue={dateInput(from)} /></Field>
                  <Field label="Data do"><Input name="to" type="date" required defaultValue={dateInput(today)} /></Field>
                </div>
                <Field label="Maksymalna liczba meczów">
                  <Select name="limit" defaultValue="20">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                  </Select>
                </Field>
                <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <input name="includeStats" type="checkbox" defaultChecked className="mt-1" />
                  <span><span className="font-medium">Pobierz pełne statystyki</span><span className="block text-zinc-500">Rożne, kartki, strzały, faule i spalone. Aplikacja grupuje identyfikatory meczów w jedno dodatkowe zapytanie.</span></span>
                </label>
                <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
                  Pobranie tworzy import do weryfikacji. Nic nie trafi do tabeli meczów, dopóki ręcznie nie zatwierdzisz raportu.
                </div>
                <div className="flex justify-end"><Button type="submit" disabled={!configured || teamMappingCount === 0}><CloudDownload size={16} className="mr-2" />Pobierz do weryfikacji</Button></div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Ostatnie synchronizacje API</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/imports/${batch.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 hover:border-emerald-400 dark:border-zinc-800">
              <div>
                <div className="font-medium">{batch.fileName}</div>
                <div className="text-xs text-zinc-500">{batch.createdBy.name} · {new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(batch.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge>{batch.status}</Badge>
                <span className="text-emerald-600">{batch.rowsValid} poprawnych</span>
                <span className="text-red-600">{batch.rowsInvalid} błędnych</span>
              </div>
            </Link>
          ))}
          {!batches.length ? <div className="py-8 text-center text-sm text-zinc-500">Brak synchronizacji API.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

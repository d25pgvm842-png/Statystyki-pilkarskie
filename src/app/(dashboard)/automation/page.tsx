import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Database,
  Globe2,
  History,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  prepareApiFootballImportAction,
  syncApiFootballTeamsAction,
} from "@/lib/actions/api-sync-actions";
import {
  prepareCurrentPublicImportAction,
  prepareHistoricalPublicImportAction,
} from "@/lib/actions/public-data-actions";
import {
  API_FOOTBALL_LEAGUE_IDS,
  API_FOOTBALL_PROVIDER_CODE,
} from "@/lib/api-football/provider";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listExternalMappings } from "@/lib/external-mappings";
import { isFootballDataOrgConfigured } from "@/lib/public-data/client";
import { PUBLIC_PROVIDER_CODES } from "@/lib/public-data/provider";
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
  "public-provider": "Nie udało się przygotować importu z darmowego źródła.",
  "public-empty": "Darmowe źródła nie zwróciły meczów dla wybranej ligi i okresu.",
  "public-range": "Zakres danych bieżących musi mieć od 1 do 180 dni.",
  "public-season": "Nie udało się ustalić ligi lub sezonu.",
};

const historyYears = [2025, 2024, 2023, 2022];

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
    detail?: string;
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
  const [seasons, leagues, apiMappings, batches] = await Promise.all([
    prisma.season.findMany({
      where: { league: { active: true } },
      include: {
        league: true,
        _count: { select: { teams: true, matches: true } },
      },
      orderBy: [{ active: "desc" }, { startsAt: "desc" }],
    }),
    prisma.league.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    listExternalMappings({
      providerCode: API_FOOTBALL_PROVIDER_CODE,
      active: true,
    }),
    prisma.importBatch.findMany({
      where: {
        source: {
          providerCode: {
            in: [API_FOOTBALL_PROVIDER_CODE, ...PUBLIC_PROVIDER_CODES],
          },
        },
      },
      include: {
        source: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const selected = seasons.find((season) => season.id === query.seasonId)
    ?? seasons.find((season) => season.active)
    ?? seasons[0];
  const leagueMapping = selected
    ? apiMappings.find(
        (mapping) =>
          mapping.entityType === "LEAGUE"
          && mapping.internalId === selected.leagueId,
      )
    : null;
  const suggestedLeagueId = selected
    ? leagueMapping?.externalId
      ?? String(API_FOOTBALL_LEAGUE_IDS[selected.league.code] ?? "")
    : "";
  const teamMappingCount = apiMappings.filter(
    (mapping) => mapping.entityType === "TEAM",
  ).length;

  const today = new Date();
  const publicTo = new Date(today);
  publicTo.setUTCDate(publicTo.getUTCDate() + 45);
  const apiFrom = new Date(today);
  apiFrom.setUTCDate(apiFrom.getUTCDate() - 14);

  const apiFootballConfigured = Boolean(process.env.API_FOOTBALL_KEY?.trim());
  const footballDataOrgConfigured = isFootballDataOrgConfigured();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Automatyzacja danych</h1>
        <p className="text-sm text-zinc-500">
          Darmowe źródła jako podstawa. API-Football zostaje tylko jako awaryjne uzupełnienie.
        </p>
      </div>

      {query.error && errorMessages[query.error] ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div>{errorMessages[query.error]}</div>
            {query.detail ? <div className="mt-1 text-xs">{query.detail}</div> : null}
          </div>
        </div>
      ) : null}

      {query.ok === "teams" ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} />
          Zsynchronizowano {query.total ?? 0} drużyn. Nowe: {query.created ?? 0},
          połączone z istniejącymi: {query.linked ?? 0}.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <Globe2 size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Dane bieżące</div>
          <div className="font-medium">
            {footballDataOrgConfigured ? "football-data.org" : "OpenFootball"}
          </div>
        </Card>
        <Card className="p-4">
          <History size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Historia i statystyki</div>
          <div className="font-medium">Football-Data.co.uk</div>
        </Card>
        <Card className="p-4">
          <Database size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Tryb zapisu</div>
          <div className="font-medium">Najpierw weryfikacja</div>
        </Card>
        <Card className="p-4">
          <KeyRound
            size={18}
            className={apiFootballConfigured ? "text-amber-500" : "text-zinc-400"}
          />
          <div className="mt-2 text-xs text-zinc-500">API-Football</div>
          <div className="font-medium">
            {apiFootballConfigured ? "Awaryjne, aktywne" : "Awaryjne, wyłączone"}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wybór ligi i sezonu</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Field label="Liga i sezon">
              <Select name="seasonId" defaultValue={selected?.id ?? ""}>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.league.name} · {season.name} · {season._count.teams} drużyn ·{" "}
                    {season._count.matches} meczów
                  </option>
                ))}
              </Select>
            </Field>
            <div className="self-end">
              <Button type="submit" variant="secondary">Wybierz</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {selected ? (
        <>
          <div>
            <h2 className="text-lg font-semibold">Główne źródła darmowe</h2>
            <p className="text-sm text-zinc-500">
              Jeden import tworzy raport. Dane trafiają do bazy dopiero po zatwierdzeniu.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 size={18} />Bieżący terminarz i wyniki
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={prepareCurrentPublicImportAction} className="grid gap-4">
                  <input type="hidden" name="seasonId" value={selected.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Data od">
                      <Input
                        name="from"
                        type="date"
                        required
                        defaultValue={dateInput(today)}
                      />
                    </Field>
                    <Field label="Data do">
                      <Input
                        name="to"
                        type="date"
                        required
                        defaultValue={dateInput(publicTo)}
                      />
                    </Field>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
                    Kolejność: football-data.org, potem OpenFootball, na końcu
                    Football-Data.co.uk dla rozegranych spotkań. Ekstraklasa korzysta
                    z darmowego pliku polskiego, gdy pojawią się w nim mecze.
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">
                      <CloudDownload size={16} className="mr-2" />
                      Pobierz do weryfikacji
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History size={18} />Historia i pełne statystyki
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={prepareHistoricalPublicImportAction} className="grid gap-4">
                  <Field label="Liga">
                    <Select
                      name="leagueId"
                      defaultValue={selected.leagueId}
                    >
                      {leagues.map((league) => (
                        <option key={league.id} value={league.id}>
                          {league.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Sezon">
                    <Select name="startYear" defaultValue="2025">
                      {historyYears.map((year) => (
                        <option key={year} value={year}>
                          {year}/{String((year + 1) % 100).padStart(2, "0")}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
                    Pobierane pola: wyniki, sędzia, strzały, celne strzały, rożne,
                    faule, spalone oraz kartki. Brakujące pola pozostają puste.
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">
                      <Database size={16} className="mr-2" />
                      Pobierz cały sezon
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Awaryjne API-Football</h2>
            <p className="text-sm text-zinc-500">
              Używaj tylko wtedy, gdy darmowe źródła nie mają potrzebnych danych.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={18} />Synchronizacja drużyn API-Football
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={syncApiFootballTeamsAction} className="grid gap-4">
                  <input type="hidden" name="seasonId" value={selected.id} />
                  <Field label="Identyfikator ligi API-Football">
                    <Input
                      name="externalLeagueId"
                      type="number"
                      min="1"
                      required
                      defaultValue={suggestedLeagueId}
                    />
                  </Field>
                  <p className="text-sm text-zinc-500">
                    Ta ścieżka może zużywać płatny albo ograniczony limit dostawcy.
                  </p>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!apiFootballConfigured}>
                      <RefreshCw size={16} className="mr-2" />
                      Synchronizuj drużyny
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CloudDownload size={18} />Mecze i statystyki API-Football
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={prepareApiFootballImportAction} className="grid gap-4">
                  <input type="hidden" name="seasonId" value={selected.id} />
                  <input
                    type="hidden"
                    name="externalLeagueId"
                    value={suggestedLeagueId}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Data od">
                      <Input
                        name="from"
                        type="date"
                        required
                        defaultValue={dateInput(apiFrom)}
                      />
                    </Field>
                    <Field label="Data do">
                      <Input
                        name="to"
                        type="date"
                        required
                        defaultValue={dateInput(today)}
                      />
                    </Field>
                  </div>
                  <Field label="Maksymalna liczba meczów">
                    <Select name="limit" defaultValue="5">
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                    </Select>
                  </Field>
                  <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <input
                      name="includeStats"
                      type="checkbox"
                      defaultChecked
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">Pobierz pełne statystyki</span>
                      <span className="block text-zinc-500">
                        Rożne, kartki, strzały, faule i spalone.
                      </span>
                    </span>
                  </label>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!apiFootballConfigured || teamMappingCount === 0}
                    >
                      <CloudDownload size={16} className="mr-2" />
                      Pobierz awaryjnie
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ostatnie synchronizacje</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/imports/${batch.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 hover:border-emerald-400 dark:border-zinc-800"
            >
              <div>
                <div className="font-medium">{batch.fileName}</div>
                <div className="text-xs text-zinc-500">
                  {batch.source?.name ?? "Nieznane źródło"} · {batch.createdBy.name} ·{" "}
                  {new Intl.DateTimeFormat("pl-PL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(batch.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge>{batch.status}</Badge>
                <span className="text-emerald-600">
                  {batch.rowsValid} poprawnych
                </span>
                <span className="text-red-600">
                  {batch.rowsInvalid} błędnych
                </span>
              </div>
            </Link>
          ))}
          {!batches.length ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              Brak synchronizacji.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!footballDataOrgConfigured ? (
        <Card className="border-zinc-300 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Opcjonalny klucz football-data.org</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
            Bez klucza aplikacja korzysta z OpenFootball. Dodanie zmiennej{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
              FOOTBALL_DATA_ORG_KEY
            </code>{" "}
            daje stabilniejsze bieżące terminarze pięciu największych lig.
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, CloudDownload, Database, Globe2, History } from "lucide-react";
import {
  prepareCurrentPublicImportAction,
  prepareHistoricalPublicImportAction,
} from "@/lib/actions/public-data-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HistoricalDownloadSubmit } from "@/components/public-data/historical-download-submit";

const errorMessages: Record<string, string> = {
  "public-provider": "Nie udało się pobrać danych z darmowego źródła.",
  "public-empty": "Darmowe źródła nie zwróciły meczów dla wybranego okresu.",
  "public-range": "Zakres danych bieżących musi mieć od 1 do 180 dni.",
  "public-season": "Nie udało się ustalić ligi lub sezonu.",
};

const historyYears = [2025, 2024, 2023, 2022];

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function PublicDataPage({
  searchParams,
}: {
  searchParams: Promise<{
    seasonId?: string;
    error?: string;
    detail?: string;
  }>;
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return (
      <Card className="p-6">
        <div className="text-sm text-amber-700 dark:text-amber-300">
          Ten moduł jest dostępny wyłącznie dla administratora.
        </div>
      </Card>
    );
  }

  const query = await searchParams;
  let loadError: string | null = null;
  let seasons: Array<{
    id: string;
    leagueId: string;
    name: string;
    active: boolean;
    startsAt: Date;
    league: { id: string; name: string; code: string };
    _count: { teams: number; matches: number };
  }> = [];
  let leagues: Array<{ id: string; name: string }> = [];

  try {
    [seasons, leagues] = await Promise.all([
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
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Nie udało się odczytać konfiguracji lig.";
  }

  const selected = seasons.find((season) => season.id === query.seasonId)
    ?? seasons.find((season) => season.active)
    ?? seasons[0];

  const today = new Date();
  const publicTo = new Date(today);
  publicTo.setUTCDate(publicTo.getUTCDate() + 45);
  const footballDataOrgConfigured = Boolean(process.env.FOOTBALL_DATA_ORG_KEY?.trim());

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Darmowe źródła danych</h1>
          <p className="text-sm text-zinc-500">
            Terminarze i wyniki z football-data.org lub OpenFootball. Historia i statystyki z Football-Data.co.uk.
          </p>
        </div>
        <Link href="/automation" className="text-sm text-emerald-600 hover:underline">
          Wróć do automatyzacji
        </Link>
      </div>

      {(loadError || (query.error && errorMessages[query.error])) ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div>{loadError ?? errorMessages[query.error!]}</div>
            {query.detail ? <div className="mt-1 text-xs">{query.detail}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <Globe2 size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Dane bieżące</div>
          <div className="font-medium">{footballDataOrgConfigured ? "football-data.org" : "OpenFootball"}</div>
        </Card>
        <Card className="p-4">
          <History size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Historia i statystyki</div>
          <div className="font-medium">Football-Data.co.uk</div>
        </Card>
        <Card className="p-4">
          <Database size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Zapis</div>
          <div className="font-medium">Najpierw weryfikacja</div>
        </Card>
      </div>

      {!loadError && selected ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe2 size={18} />Bieżący terminarz i wyniki</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={prepareCurrentPublicImportAction} className="grid gap-4">
                <Field label="Liga i sezon">
                  <Select name="seasonId" defaultValue={selected.id}>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.league.name} · {season.name} · {season._count.matches} meczów
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Data od"><Input name="from" type="date" required defaultValue={dateInput(today)} /></Field>
                  <Field label="Data do"><Input name="to" type="date" required defaultValue={dateInput(publicTo)} /></Field>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
                  Bez klucza aplikacja próbuje OpenFootball. Z kluczem FOOTBALL_DATA_ORG_KEY najpierw używa football-data.org.
                </div>
                <div className="flex justify-end">
                  <Button type="submit"><CloudDownload size={16} className="mr-2" />Pobierz do weryfikacji</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History size={18} />Historia i pełne statystyki</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={prepareHistoricalPublicImportAction} className="grid gap-4">
                <Field label="Liga">
                  <Select name="leagueId" defaultValue={selected.leagueId}>
                    {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                  </Select>
                </Field>
                <Field label="Sezon">
                  <Select name="startYear" defaultValue="2025">
                    {historyYears.map((year) => (
                      <option key={year} value={year}>{year}/{String((year + 1) % 100).padStart(2, "0")}</option>
                    ))}
                  </Select>
                </Field>
                <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
                  Wyniki, sędzia, strzały, celne, rożne, faule, spalone i kartki. Brakujące pola zostaną puste.
                </div>
                <HistoricalDownloadSubmit />
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

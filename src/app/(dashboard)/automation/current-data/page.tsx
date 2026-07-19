import Link from "next/link";
import { Clock3, CloudDownload, Database, ShieldCheck } from "lucide-react";
import { CurrentSyncRunner } from "@/components/public-data/current-sync-runner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FOOTBALL_DATA_ORG_PROVIDER_CODE,
  FOOTBALL_DATA_UK_PROVIDER_CODE,
  OPEN_FOOTBALL_PROVIDER_CODE,
} from "@/lib/public-data/provider";

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function CurrentDataPage() {
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

  const seasons = await prisma.season.findMany({
    where: { active: true, league: { active: true } },
    include: {
      league: true,
      _count: { select: { matches: true } },
      currentDataSyncRuns: {
        orderBy: { lastSelectedAt: "desc" },
        take: 1,
        select: { lastSelectedAt: true },
      },
    },
    orderBy: { league: { name: "asc" } },
  });

  const freshness = await Promise.all(
    seasons.map((season) => prisma.match.findFirst({
      where: { seasonId: season.id, sourceUpdatedAt: { not: null } },
      orderBy: { sourceUpdatedAt: "desc" },
      select: { sourceUpdatedAt: true },
    })),
  );

  const recentBatches = await prisma.importBatch.findMany({
    where: {
      source: {
        providerCode: {
          in: [
            FOOTBALL_DATA_ORG_PROVIDER_CODE,
            FOOTBALL_DATA_UK_PROVIDER_CODE,
            OPEN_FOOTBALL_PROVIDER_CODE,
          ],
        },
      },
    },
    include: { source: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 3);
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() + 14);

  const options = seasons.map((season, index) => ({
    id: season.id,
    label: `${season.league.name} · ${season.name}`,
    matches: season._count.matches,
    lastUpdatedAt: freshness[index]?.sourceUpdatedAt?.toISOString() ?? null,
    lastPreparedAt: season.currentDataSyncRuns[0]?.lastSelectedAt.toISOString() ?? null,
  }));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bieżące aktualizacje lig</h1>
          <p className="text-sm text-zinc-500">
            Jedno uruchomienie przygotowuje osobny raport weryfikacyjny dla każdego aktywnego sezonu.
          </p>
        </div>
        <Link href="/automation" className="text-sm text-emerald-600 hover:underline">Wróć do automatyzacji</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <CloudDownload size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Aktywne sezony</div>
          <div className="text-2xl font-semibold">{seasons.length}</div>
        </Card>
        <Card className="p-4">
          <Database size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Mecze w aktywnych sezonach</div>
          <div className="text-2xl font-semibold">{seasons.reduce((sum, season) => sum + season._count.matches, 0)}</div>
        </Card>
        <Card className="p-4">
          <Clock3 size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Domyślny zakres</div>
          <div className="font-medium">3 dni wstecz · 14 dni naprzód</div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Aktualizacja wszystkich lig</CardTitle></CardHeader>
        <CardContent>
          <CurrentSyncRunner seasons={options} defaultFrom={dateInput(from)} defaultTo={dateInput(to)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ostatnio przygotowane raporty</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {recentBatches.map((batch) => (
            <Link key={batch.id} href={`/imports/${batch.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:border-emerald-400 dark:border-zinc-800">
              <div>
                <div className="font-medium">{batch.fileName}</div>
                <div className="text-xs text-zinc-500">{batch.source?.name ?? "Źródło publiczne"} · {new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(batch.createdAt)}</div>
              </div>
              <div className="text-sm"><span className="font-medium">{batch.rowsValid}</span> poprawnych · <span className="text-red-600">{batch.rowsInvalid}</span> błędnych</div>
            </Link>
          ))}
          {!recentBatches.length ? <div className="py-8 text-center text-sm text-zinc-500">Brak przygotowanych aktualizacji.</div> : null}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        Powtórne przygotowanie identycznego sezonu i zakresu otworzy istniejący aktywny raport zamiast tworzyć duplikat. Równoległe uruchomienia są blokowane w bazie.
      </div>
    </div>
  );
}

import { Database, History, ShieldCheck } from "lucide-react";
import { HistoricalBackfillRunner } from "@/components/history/historical-backfill-runner";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAdminister } from "@/lib/permissions";
import { percentage } from "@/lib/history/backfill-policy";

export const dynamic = "force-dynamic";

export default async function HistoricalDataPage() {
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

  const [leagues, jobs] = await Promise.all([
    prisma.league.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.historicalBackfillJob.findMany({
      include: {
        season: { include: { league: true } },
      },
      orderBy: [
        { season: { league: { name: "asc" } } },
        { providerSeason: "desc" },
      ],
    }),
  ]);

  const serializedJobs = jobs.map((job) => {
    const total = Math.min(
      job.fixturesTotal,
      job.fixturesProcessed + job.activeBatchSize,
    );
    return {
      id: job.id,
      leagueId: job.season.league.id,
      leagueName: job.season.league.name,
      leagueCode: job.season.league.code,
      seasonId: job.season.id,
      seasonName: job.season.name,
      providerSeason: job.providerSeason,
      status: job.status,
      fixturesTotal: job.fixturesTotal,
      fixturesProcessed: job.fixturesProcessed,
      requestsUsed: job.requestsUsed,
      importedRows: job.importedRows,
      duplicateRows: job.duplicateRows,
      invalidRows: job.invalidRows,
      lastError: job.lastError,
      coverage: {
        corners: percentage(job.cornersCovered, total),
        cards: percentage(job.cardsCovered, total),
        shots: percentage(job.shotsCovered, total),
        fouls: percentage(job.foulsCovered, total),
        offsides: percentage(job.offsidesCovered, total),
      },
    };
  });

  return (
    <div className="grid gap-5">
      <div>
        <div className="flex items-center gap-2">
          <History className="text-emerald-600" size={24} />
          <h1 className="text-2xl font-semibold">Historyczne zasilanie API</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Resumowalny backfill zakończonych sezonów API-Football dla lig używanych w aplikacji.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <Database size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Zaplanowane zadania</div>
          <div className="text-2xl font-semibold">{jobs.length}</div>
        </Card>
        <Card className="p-4">
          <History size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Zakończone sezony</div>
          <div className="text-2xl font-semibold">
            {jobs.filter((job) => job.status === "COMPLETED").length}
          </div>
        </Card>
        <Card className="p-4">
          <ShieldCheck size={18} className="text-emerald-600" />
          <div className="mt-2 text-xs text-zinc-500">Tryb zapisu</div>
          <div className="font-medium">Atomowy · audytowany · wznawialny</div>
        </Card>
      </div>

      <HistoricalBackfillRunner
        leagues={leagues}
        initialJobs={serializedJobs}
      />
    </div>
  );
}

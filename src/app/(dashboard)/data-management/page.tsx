import { redirect } from "next/navigation";
import { Archive, DatabaseBackup, Download, FileSpreadsheet, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function formatDate(value: Date | null) {
  if (!value) return "Brak danych";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function deletionLabel(changes: { fieldName: string; newValue: string | null }[]) {
  return changes.find((change) => change.fieldName === "matchLabel")?.newValue ?? "Usunięty mecz";
}

export default async function DataManagementPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");

  const [
    matchesCount,
    teamsCount,
    refereesCount,
    importsCount,
    auditCount,
    latestMatch,
    latestAudit,
    deletions,
  ] = await Promise.all([
    prisma.match.count(),
    prisma.team.count(),
    prisma.referee.count(),
    prisma.importBatch.count(),
    prisma.auditLog.count(),
    prisma.match.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.auditLog.findMany({
      where: { entityType: "MATCH", action: "DELETE" },
      include: { user: { select: { name: true } }, changes: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Dane i kopie bezpieczeństwa</h1>
        <p className="text-sm text-zinc-500">
          Eksport pełnej bazy, arkusz wszystkich meczów i rejestr operacji destrukcyjnych. Dostęp tylko dla administratora.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4"><div className="text-sm text-zinc-500">Mecze</div><div className="text-2xl font-semibold">{matchesCount}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Drużyny</div><div className="text-2xl font-semibold">{teamsCount}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Sędziowie</div><div className="text-2xl font-semibold">{refereesCount}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Importy</div><div className="text-2xl font-semibold">{importsCount}</div></Card>
        <Card className="p-4"><div className="text-sm text-zinc-500">Wpisy audytu</div><div className="text-2xl font-semibold">{auditCount}</div></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pełna kopia techniczna</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <DatabaseBackup className="mt-0.5 shrink-0 text-emerald-600" size={20} />
              <p>
                Plik JSON zawiera katalogi, mecze, statystyki, importy, korekty i historię audytu. Hasła użytkowników są celowo pomijane.
              </p>
            </div>
            <a
              href="/api/admin/backup"
              className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Download size={16} className="mr-2" />Pobierz pełną kopię JSON
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Eksport roboczy meczów</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <FileSpreadsheet className="mt-0.5 shrink-0 text-emerald-600" size={20} />
              <p>
                Plik CSV w kodowaniu zgodnym z Excelem zawiera pełne dane wszystkich spotkań i 14 pól statystycznych.
              </p>
            </div>
            <a
              href="/api/admin/matches-export"
              className="inline-flex h-10 w-fit items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <Download size={16} className="mr-2" />Pobierz mecze CSV
            </a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Stan ochrony danych</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <ShieldCheck className="mb-2 text-emerald-600" size={20} />
            <div className="font-medium">Eksport chroniony rolą ADMIN</div>
            <div className="mt-1 text-zinc-500">Pliki nie są buforowane przez przeglądarkę ani Vercel CDN.</div>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <Archive className="mb-2 text-emerald-600" size={20} />
            <div className="font-medium">Ostatnia aktualizacja meczu</div>
            <div className="mt-1 text-zinc-500">{formatDate(latestMatch?.updatedAt ?? null)}</div>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <ShieldCheck className="mb-2 text-emerald-600" size={20} />
            <div className="font-medium">Ostatni wpis audytu</div>
            <div className="mt-1 text-zinc-500">{formatDate(latestAudit?.createdAt ?? null)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rejestr usuniętych meczów</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {deletions.map((deletion) => (
            <div key={deletion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 shrink-0 text-red-600" size={18} />
                <div>
                  <div className="font-medium">{deletionLabel(deletion.changes)}</div>
                  <div className="mt-1 text-xs text-zinc-500">ID: {deletion.entityId}</div>
                </div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>{formatDate(deletion.createdAt)}</div>
                <div>{deletion.user.name}</div>
              </div>
            </div>
          ))}
          {!deletions.length ? <div className="py-8 text-center text-sm text-zinc-500">Nie usunięto jeszcze żadnego meczu.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

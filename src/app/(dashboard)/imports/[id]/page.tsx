import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Download,
  ExternalLink,
  RotateCcw,
  SkipForward,
  Upload,
  XCircle,
} from "lucide-react";
import {
  cancelCsvImportAction,
  commitCsvImportAction,
  toggleImportRowAction,
} from "@/lib/actions/import-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import {
  countImportRowStatuses,
  importRowData,
  importRowMessages,
} from "@/lib/imports/report";

const rowLabels: Record<string, string> = {
  VALID: "Poprawny",
  DUPLICATE: "Duplikat",
  INVALID: "Błąd",
  IMPORTED: "Zaimportowany",
  SKIPPED: "Pominięty",
};

const batchLabels: Record<string, string> = {
  PENDING: "Oczekuje",
  VALIDATING: "Walidacja",
  READY: "Gotowy do zatwierdzenia",
  COMPLETED: "Zakończony",
  FAILED: "Zatrzymany",
};

function rowBadge(status: string) {
  if (status === "VALID" || status === "IMPORTED") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (status === "DUPLICATE") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }
  if (status === "SKIPPED") {
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

function filterHref(id: string, status?: string) {
  return status ? `/imports/${id}?status=${status}` : `/imports/${id}`;
}

export default async function ImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: {
      rows: { orderBy: { rowNumber: "asc" } },
      createdBy: { select: { name: true } },
      source: true,
    },
  });
  if (!batch) notFound();

  const counts = countImportRowStatuses(batch.rows);
  const selectedStatus = query.status && query.status in rowLabels ? query.status : undefined;
  const visibleRows = selectedStatus
    ? batch.rows.filter((row) => row.status === selectedStatus)
    : batch.rows;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/imports"
            className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <ArrowLeft size={16} />Historia importów
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{batch.fileName}</h1>
            <Badge>{batchLabels[batch.status] ?? batch.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {batch.createdBy.name} · {new Intl.DateTimeFormat("pl-PL", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(batch.createdAt)}
            {batch.source ? ` · ${batch.source.name}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/imports/${batch.id}/report`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Download size={16} />Pobierz raport CSV
          </Link>

          {batch.status === "READY" ? (
            <form action={cancelCsvImportAction}>
              <input type="hidden" name="batchId" value={batch.id} />
              <Button type="submit" variant="danger">
                <Ban size={16} className="mr-2" />Anuluj import
              </Button>
            </form>
          ) : null}

          {batch.status === "READY" && counts.VALID > 0 ? (
            <form action={commitCsvImportAction}>
              <input type="hidden" name="batchId" value={batch.id} />
              <Button type="submit">
                <Upload size={16} className="mr-2" />{batch.source?.type === "API" ? "Zastosuj" : "Zaimportuj"} {counts.VALID} poprawnych
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {query.ok === "completed" ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} />Import zakończony. Przetworzono {counts.IMPORTED} meczów.
        </div>
      ) : null}
      {query.ok === "processed" ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle size={18} />Import przetworzono, ale nie utworzono nowych meczów. Sprawdź raport wierszy.
        </div>
      ) : null}
      {query.ok === "cancelled" ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <Ban size={18} />Import anulowano. Historia i raport zostały zachowane.
        </div>
      ) : null}
      {query.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <XCircle size={18} />Nie udało się wykonać tej operacji dla obecnego stanu importu.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="p-4"><div className="text-sm text-zinc-500">Wszystkie</div><div className="text-3xl font-semibold">{batch.rowsTotal}</div></Card>
        <Card className="p-4"><div className="text-sm text-blue-600">Do importu</div><div className="text-3xl font-semibold">{counts.VALID}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 size={16} />Zaimportowane</div><div className="text-3xl font-semibold">{counts.IMPORTED}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-amber-600"><AlertTriangle size={16} />Duplikaty</div><div className="text-3xl font-semibold">{counts.DUPLICATE}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-red-600"><XCircle size={16} />Błędy</div><div className="text-3xl font-semibold">{counts.INVALID}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-zinc-500"><SkipForward size={16} />Pominięte</div><div className="text-3xl font-semibold">{counts.SKIPPED}</div></Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4">
          <CardTitle>Podgląd i raport walidacji</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link className={!selectedStatus ? "rounded-full bg-emerald-600 px-3 py-1.5 text-white" : "rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800"} href={filterHref(batch.id)}>Wszystkie ({batch.rowsTotal})</Link>
            {Object.entries(rowLabels).map(([status, label]) => (
              <Link
                key={status}
                href={filterHref(batch.id, status)}
                className={selectedStatus === status ? "rounded-full bg-emerald-600 px-3 py-1.5 text-white" : "rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800"}
              >
                {label} ({counts[status as keyof typeof counts]})
              </Link>
            ))}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
              <tr>
                <th className="p-3">Wiersz</th>
                <th className="p-3">Status</th>
                <th className="p-3">Termin</th>
                <th className="p-3">Mecz</th>
                <th className="p-3">Wynik</th>
                <th className="p-3">Sędzia</th>
                <th className="p-3">Raport</th>
                <th className="p-3">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visibleRows.map((row) => {
                const data = importRowData(row.rawData);
                const errors = importRowMessages(row.errors);
                const relatedMatchId = data.importedMatchId ?? data.duplicateMatchId;
                return (
                  <tr key={row.id} className={row.status === "INVALID" ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                    <td className="p-3 font-mono text-xs">{row.rowNumber}</td>
                    <td className="p-3"><Badge className={rowBadge(row.status)}>{rowLabels[row.status] ?? row.status}</Badge></td>
                    <td className="p-3 whitespace-nowrap">
                      {data.kickoffAt
                        ? new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.kickoffAt))
                        : "—"}
                      {data.round ? <div className="text-xs text-zinc-500">Kolejka {data.round}</div> : null}
                    </td>
                    <td className="p-3 font-medium">
                      <div>{data.homeTeamName || "—"} – {data.awayTeamName || "—"}</div>
                      {data.operation ? <div className="mt-1 text-xs text-zinc-500">{data.operation === "UPDATE" ? "Aktualizacja istniejącego meczu" : "Nowy mecz"}{data.sourceExternalId ? ` · ID ${data.sourceExternalId}` : ""}</div> : null}
                    </td>
                    <td className="p-3">{data.homeScore ?? "—"}:{data.awayScore ?? "—"}</td>
                    <td className="p-3">{data.refereeName ?? "—"}</td>
                    <td className="p-3">
                      {errors.length ? (
                        <ul className={`grid gap-1 text-xs ${row.status === "DUPLICATE" ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}`}>
                          {errors.map((error) => <li key={error}>• {error}</li>)}
                        </ul>
                      ) : row.status === "IMPORTED" ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-300">Mecz zapisano lub zaktualizowano i dodano wpis audytowy.</span>
                      ) : row.status === "SKIPPED" ? (
                        <span className="text-xs text-zinc-500">Wiersz pominięty ręcznie.</span>
                      ) : (
                        <span className="text-xs text-zinc-500">Brak uwag.</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {relatedMatchId ? (
                          <Link className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline" href={`/matches/${relatedMatchId}`}>
                            <ExternalLink size={14} />Otwórz mecz
                          </Link>
                        ) : null}
                        {batch.status === "READY" && row.status === "VALID" ? (
                          <form action={toggleImportRowAction}>
                            <input type="hidden" name="batchId" value={batch.id} />
                            <input type="hidden" name="rowId" value={row.id} />
                            <input type="hidden" name="target" value="SKIPPED" />
                            <Button size="sm" type="submit" variant="ghost"><SkipForward size={14} className="mr-1" />Pomiń</Button>
                          </form>
                        ) : null}
                        {batch.status === "READY" && row.status === "SKIPPED" ? (
                          <form action={toggleImportRowAction}>
                            <input type="hidden" name="batchId" value={batch.id} />
                            <input type="hidden" name="rowId" value={row.id} />
                            <input type="hidden" name="target" value="VALID" />
                            <Button size="sm" type="submit" variant="secondary"><RotateCcw size={14} className="mr-1" />Przywróć</Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visibleRows.length ? (
                <tr><td colSpan={8} className="p-10 text-center text-sm text-zinc-500">Brak wierszy o wybranym statusie.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

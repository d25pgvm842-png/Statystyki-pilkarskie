import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Upload } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { commitCsvImportAction } from "@/lib/actions/import-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";

type StoredRow = {
  kickoffAt?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  refereeName?: string | null;
  round?: number | null;
};

function rowData(value: Prisma.JsonValue): StoredRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as StoredRow : {};
}

function errorList(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const rowLabels: Record<string, string> = {
  VALID: "Poprawny",
  DUPLICATE: "Duplikat",
  INVALID: "Błąd",
  IMPORTED: "Zaimportowany",
  SKIPPED: "Pominięty",
};

function rowBadge(status: string) {
  if (status === "VALID" || status === "IMPORTED") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "DUPLICATE") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

export default async function ImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
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

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/imports" className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <ArrowLeft size={16} />Historia importów
          </Link>
          <h1 className="text-2xl font-semibold">{batch.fileName}</h1>
          <p className="text-sm text-zinc-500">
            {batch.createdBy.name} · {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(batch.createdAt)}
          </p>
        </div>
        {batch.status === "READY" && batch.rowsValid > 0 ? (
          <form action={commitCsvImportAction}>
            <input type="hidden" name="batchId" value={batch.id} />
            <Button type="submit"><Upload size={16} className="mr-2" />Zaimportuj {batch.rowsValid} poprawnych</Button>
          </form>
        ) : null}
      </div>

      {query.ok === "completed" ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} />Import został zakończony.
        </div>
      ) : null}
      {query.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <XCircle size={18} />Tego importu nie można teraz zatwierdzić.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-sm text-zinc-500">Wiersze</div><div className="text-3xl font-semibold">{batch.rowsTotal}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 size={16} />Poprawne</div><div className="text-3xl font-semibold">{batch.rowsValid}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-amber-600"><AlertTriangle size={16} />Duplikaty</div><div className="text-3xl font-semibold">{batch.rowsDuplicate}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-red-600"><XCircle size={16} />Błędy</div><div className="text-3xl font-semibold">{batch.rowsInvalid}</div></Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle>Podgląd i raport walidacji</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/70">
              <tr>
                <th className="p-3">Wiersz</th>
                <th className="p-3">Status</th>
                <th className="p-3">Termin</th>
                <th className="p-3">Mecz</th>
                <th className="p-3">Wynik</th>
                <th className="p-3">Sędzia</th>
                <th className="p-3">Uwagi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {batch.rows.map((row) => {
                const data = rowData(row.rawData);
                const errors = errorList(row.errors);
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
                    <td className="p-3 font-medium">{data.homeTeamName || "—"} – {data.awayTeamName || "—"}</td>
                    <td className="p-3">{data.homeScore ?? "—"}:{data.awayScore ?? "—"}</td>
                    <td className="p-3">{data.refereeName ?? "—"}</td>
                    <td className="p-3">
                      {errors.length ? (
                        <ul className="grid gap-1 text-xs text-red-700 dark:text-red-300">
                          {errors.map((error) => <li key={error}>• {error}</li>)}
                        </ul>
                      ) : row.status === "DUPLICATE" ? (
                        <span className="text-xs text-amber-700 dark:text-amber-300">Taki mecz jest już w bazie lub powtarza się w pliku.</span>
                      ) : (
                        <span className="text-xs text-zinc-500">Brak uwag.</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

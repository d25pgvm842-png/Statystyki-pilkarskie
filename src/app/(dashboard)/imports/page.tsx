import Link from "next/link";
import { FileSpreadsheet, Upload, Eye, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { uploadCsvImportAction } from "@/lib/actions/import-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";

const errorMessages: Record<string, string> = {
  season: "Wybierz sezon docelowy.",
  file: "Wybierz plik CSV.",
  size: "Plik jest za duży. Maksymalny rozmiar to 5 MB.",
  type: "Do tego importu wymagany jest plik CSV.",
  empty: "Plik nie zawiera rekordów.",
  rows: "Jednorazowo można zaimportować maksymalnie 5000 wierszy.",
};

const statusLabels: Record<string, string> = {
  PENDING: "Oczekuje",
  VALIDATING: "Walidacja",
  READY: "Gotowy",
  COMPLETED: "Zakończony",
  FAILED: "Błąd",
};

function statusBadge(status: string) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "READY") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (status === "FAILED") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [seasons, batches] = await Promise.all([
    prisma.season.findMany({
      where: { league: { active: true } },
      include: { league: true, _count: { select: { teams: true } } },
      orderBy: [{ active: "desc" }, { startsAt: "desc" }],
    }),
    prisma.importBatch.findMany({
      include: { createdBy: { select: { name: true } }, source: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Import danych</h1>
        <p className="text-sm text-zinc-500">
          Walidacja, wykrywanie duplikatów i podgląd przed zapisaniem meczów.
        </p>
      </div>

      {error && errorMessages[error] ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <XCircle size={18} />
          {errorMessages[error]}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload size={18} className="text-emerald-600" />
              Nowy import CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={uploadCsvImportAction} className="grid gap-4">
              <Field label="Liga i sezon">
                <Select name="seasonId" required defaultValue={seasons.find((season) => season.active)?.id ?? ""}>
                  <option value="">Wybierz sezon</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.league.name} · {season.name} · {season._count.teams} drużyn
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Plik CSV">
                <input
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  required
                  className="block w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-white hover:file:bg-emerald-700 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </Field>

              <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                <div className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">Obsługiwane formaty nagłówków</div>
                <p>
                  Własny szablon aplikacji oraz popularne skróty Football-Data:
                  HomeTeam, AwayTeam, FTHG, FTAG, HC, AC, HY, AY, HR, AR, HST, AST, HS, AS, HF i AF.
                </p>
                <Link
                  href="/templates/matches-import.csv"
                  download
                  className="mt-3 inline-flex items-center gap-2 font-medium text-emerald-600 hover:underline"
                >
                  <FileSpreadsheet size={16} />
                  Pobierz przykładowy szablon
                </Link>
              </div>

              <div className="flex justify-end">
                <Button type="submit">
                  <Upload size={16} className="mr-2" />
                  Wczytaj i sprawdź
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Jak działa import</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="flex gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-950">1</div>
              <div><div className="font-medium">Wybierasz sezon i plik</div><div className="text-zinc-500">Nazwy drużyn oraz sędziów są porównywane z katalogiem sezonu.</div></div>
            </div>
            <div className="flex gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-950">2</div>
              <div><div className="font-medium">Aplikacja waliduje każdy wiersz</div><div className="text-zinc-500">Sprawdza daty, wyniki, statystyki, relacje i istniejące duplikaty.</div></div>
            </div>
            <div className="flex gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-950">3</div>
              <div><div className="font-medium">Zatwierdzasz tylko poprawne rekordy</div><div className="text-zinc-500">Błędne i powtórzone wiersze pozostają w raporcie, ale nie trafiają do meczów.</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Historia importów</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/imports/${batch.id}`}
              className="grid gap-3 rounded-lg border border-zinc-200 p-4 transition hover:border-emerald-400 sm:grid-cols-[1fr_auto] dark:border-zinc-800"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{batch.fileName}</span>
                  <Badge className={statusBadge(batch.status)}>{statusLabels[batch.status] ?? batch.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(batch.createdAt)}
                  {" · "}{batch.createdBy.name}
                  {batch.source ? ` · ${batch.source.name}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={15} />{batch.rowsValid}</span>
                <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle size={15} />{batch.rowsDuplicate}</span>
                <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={15} />{batch.rowsInvalid}</span>
                <Eye size={17} />
              </div>
            </Link>
          ))}
          {!batches.length ? <div className="py-8 text-center text-sm text-zinc-500">Nie wykonano jeszcze żadnego importu.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

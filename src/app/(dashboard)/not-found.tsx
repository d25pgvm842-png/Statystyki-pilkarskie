import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <SearchX size={36} className="mx-auto text-zinc-400" />
        <h1 className="mt-4 text-xl font-semibold">Nie znaleziono strony</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Widok nie istnieje albo został przeniesiony.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <ArrowLeft size={16} className="mr-2" />
          Wróć na Dziś
        </Link>
      </div>
    </div>
  );
}

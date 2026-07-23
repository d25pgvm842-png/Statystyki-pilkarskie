import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <section className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-500">Błąd 404</p>
        <h1 className="mt-2 text-2xl font-semibold">Nie znaleziono strony</h1>
        <p className="mt-3 text-sm text-zinc-500">
          Adres jest nieprawidłowy albo widok został przeniesiony.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Wróć na Dziś
        </Link>
      </section>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PublicDataError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public data route error", error);
  }, [error]);

  return (
    <div className="grid gap-4 rounded-xl border border-red-900/60 bg-red-950/20 p-6">
      <h1 className="text-xl font-semibold">Moduł darmowych źródeł nie załadował się</h1>
      <p className="text-sm text-zinc-400">Główna część aplikacji nadal działa. Możesz spróbować ponownie albo wrócić do automatyzacji.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">Spróbuj ponownie</button>
        <Link href="/automation" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">Wróć</Link>
      </div>
    </div>
  );
}

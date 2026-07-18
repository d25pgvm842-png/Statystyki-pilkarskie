import Link from "next/link";
import { AlertTriangle, CircleAlert, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { findDataQualityIssues } from "@/lib/data/data-quality";
import { prisma } from "@/lib/db";

export default async function DataQualityPage() {
  const matches = await prisma.match.findMany({ include: { stats: true, season: { include: { league: true } }, homeTeam: true, awayTeam: true }, orderBy: { kickoffAt: "desc" } });
  const issues = findDataQualityIssues(matches);
  const errors = issues.filter((issue) => issue.severity === "error").length;

  return (
    <div className="grid gap-5">
      <div><h1 className="text-2xl font-semibold">Kontrola danych</h1><p className="text-sm text-zinc-500">Automatyczne wykrywanie braków i nielogicznych wartości.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5"><div className="text-sm text-zinc-500">Wszystkie problemy</div><div className="mt-1 text-3xl font-semibold">{issues.length}</div></Card>
        <Card className="p-5"><div className="text-sm text-zinc-500">Błędy</div><div className="mt-1 text-3xl font-semibold text-red-600">{errors}</div></Card>
        <Card className="p-5"><div className="text-sm text-zinc-500">Ostrzeżenia</div><div className="mt-1 text-3xl font-semibold text-amber-600">{issues.length - errors}</div></Card>
      </div>
      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-950/60"><tr><th className="p-3">Poziom</th><th className="p-3">Typ</th><th className="p-3">Mecz</th><th className="p-3">Opis</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {issues.map((issue) => <tr key={issue.key}><td className="p-3"><Badge className={issue.severity === "error" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}>{issue.severity === "error" ? <CircleAlert size={13} className="mr-1" /> : <AlertTriangle size={13} className="mr-1" />}{issue.severity === "error" ? "Błąd" : "Ostrzeżenie"}</Badge></td><td className="p-3 font-medium">{issue.type}</td><td className="p-3"><div className="font-medium">{issue.matchLabel}</div><div className="text-xs text-zinc-500">{issue.leagueSeason}</div></td><td className="p-3">{issue.message}</td><td className="p-3"><Link href={`/matches/${issue.matchId}/edit`} className="inline-flex rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Pencil size={16} /></Link></td></tr>)}
        {!issues.length ? <tr><td colSpan={5} className="p-10 text-center text-zinc-500">Nie wykryto problemów.</td></tr> : null}
      </tbody></table></div></Card>
    </div>
  );
}

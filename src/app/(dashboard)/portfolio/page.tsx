import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  approveStrategyForwardAction,
  archiveStrategyVersionAction,
  pauseStrategyForwardAction,
  prepareNewStrategyVersionAction,
  syncStrategyForwardSignalsAction,
} from "@/lib/actions/strategy-forward-actions";
import { requireUser } from "@/lib/auth";
import {
  loadStrategyPortfolio,
  type LoadedStrategyVersion,
} from "@/lib/data/strategy-portfolio";
import {
  forwardStakeModeLabel,
  type ForwardFinancialMetrics,
} from "@/lib/stats/strategy-forward";
import {
  strategyRuleSummary,
  strategyStabilityLabel,
} from "@/lib/stats/strategy-lab";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function percent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, digits)}%`;
}

function currency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function statusLabel(value: string) {
  if (value === "APPROVED") return "zaakceptowana";
  if (value === "FORWARD_TEST") return "test forward";
  if (value === "PAUSED") return "wstrzymana";
  if (value === "ARCHIVED") return "archiwalna";
  return value.toLocaleLowerCase("pl");
}

function statusClass(value: string) {
  if (value === "APPROVED") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (value === "FORWARD_TEST") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (value === "PAUSED") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function FinancialCard({
  title,
  metrics,
}: {
  title: string;
  metrics: ForwardFinancialMetrics;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-zinc-500">{title}</div>
      <div className={`mt-1 text-2xl font-semibold ${metrics.roi === null ? "" : metrics.roi >= 0 ? "text-emerald-600" : "text-red-600"}`}>
        {percent(metrics.roi)}
      </div>
      <div className="mt-2 text-xs text-zinc-500">
        {metrics.financialEntries} rozliczeń · {currency(metrics.profit)} / {currency(metrics.turnover)}
      </div>
      <div className="mt-1 text-xs text-zinc-500">drawdown {currency(metrics.maxDrawdown)}</div>
    </Card>
  );
}

function VersionList({
  versions,
  selectedId,
}: {
  versions: LoadedStrategyVersion[];
  selectedId: string | null;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Wersje strategii</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {versions.length ? versions.map((item) => (
          <Link
            key={item.version.id}
            href={`/portfolio?versionId=${item.version.id}`}
            className={`rounded-lg border p-3 transition hover:border-emerald-400 ${item.version.id === selectedId ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-zinc-200 dark:border-zinc-800"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{item.version.strategy.name} · v{item.version.version}</div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.version.status)}`}>
                {statusLabel(item.version.status)}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              od {dateTime(item.version.activatedAt)} · {item.forward.totalSignals} sygnałów · ROI {percent(item.forward.selected.roi)}
            </div>
          </Link>
        )) : <div className="py-8 text-center text-sm text-zinc-500">Brak aktywowanych wersji strategii.</div>}
      </CardContent>
    </Card>
  );
}

function exposureSummary(signals: LoadedStrategyVersion["version"]["signals"]) {
  const groups = new Map<string, { label: string; stake: number; count: number }>();
  const add = (key: string, label: string, stake: number | null) => {
    if (stake === null) return;
    const current = groups.get(key);
    if (current) {
      current.stake += stake;
      current.count += 1;
    } else {
      groups.set(key, { label, stake, count: 1 });
    }
  };

  for (const signal of signals) {
    if (signal.settledAt !== null) continue;
    const day = signal.kickoffAt.toISOString().slice(0, 10);
    add(`M:${signal.matchId}`, `${signal.homeTeamName} – ${signal.awayTeamName}`, signal.recommendedStake);
    add(`L:${signal.leagueId}:${day}`, `${signal.leagueName} · ${day}`, signal.recommendedStake);
    add(`R:${signal.statKey}:${day}`, `${signal.statLabel} · ${day}`, signal.recommendedStake);
    add(`D:${day}`, `Wszystkie rynki · ${day}`, signal.recommendedStake);
  }

  return [...groups.values()]
    .sort((left, right) => right.stake - left.stake || right.count - left.count)
    .slice(0, 10);
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const selectedVersionId = stringParam(params.versionId) || null;
  const portfolio = await loadStrategyPortfolio({ userId: user.id, selectedVersionId });
  const selected = portfolio.selected;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards size={25} className="text-emerald-600" />
            <h1 className="text-2xl font-semibold">Portfel strategii i test forward</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">Niezmienialne wersje reguł, decyzje zapisane przed meczem i wynik na nowych danych.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={syncStrategyForwardSignalsAction}>
            {selected ? <input type="hidden" name="versionId" value={selected.version.id} /> : null}
            <Button type="submit" variant="secondary"><RefreshCw size={16} className="mr-2" />Synchronizuj</Button>
          </form>
          <Link href="/strategies" className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
            <PlayCircle size={16} className="mr-2" />Laboratorium
          </Link>
        </div>
      </div>

      {stringParam(params.activated) ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Uruchomiono nową, zamrożoną wersję strategii.</div> : null}
      {stringParam(params.approved) ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Wersja została zaakceptowana.</div> : null}
      {stringParam(params.paused) ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Test forward został zatrzymany. Historia pozostała bez zmian.</div> : null}
      {stringParam(params.archived) ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">Wersja została zarchiwizowana. Historia i eksport pozostały dostępne.</div> : null}
      {stringParam(params.error) === "invalidStatus" ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">Ta operacja nie pasuje do aktualnego statusu wersji.</div> : null}
      {stringParam(params.synced) ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">Synchronizacja zakończona. Nowe sygnały: {stringParam(params.synced)}.</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4"><div className="text-xs text-zinc-500">Aktywne wersje</div><div className="mt-1 text-2xl font-semibold">{portfolio.versions.filter((item) => item.version.endedAt === null).length}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Sygnały portfela</div><div className="mt-1 text-2xl font-semibold">{portfolio.aggregate.totalSignals}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">ROI portfela</div><div className="mt-1 text-2xl font-semibold">{percent(portfolio.aggregate.selected.roi)}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Średnie CLV</div><div className="mt-1 text-2xl font-semibold">{percent(portfolio.aggregate.averageClv)}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Ostrzeżenia ekspozycji</div><div className="mt-1 text-2xl font-semibold">{portfolio.aggregate.exposureWarnings}</div></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <VersionList versions={portfolio.versions} selectedId={selected?.version.id ?? null} />

        {selected ? (
          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{selected.version.strategy.name} · wersja {selected.version.version}</CardTitle>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(selected.version.status)}`}>
                        {statusLabel(selected.version.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">Aktywacja: {dateTime(selected.version.activatedAt)}{selected.version.endedAt ? ` · koniec: ${dateTime(selected.version.endedAt)}` : ""}</div>
                    <div className="mt-2 text-xs text-zinc-500">{strategyRuleSummary(selected.config)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/portfolio/export?versionId=${selected.version.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"><Download size={16} className="mr-2" />Eksport</Link>
                    {selected.version.endedAt === null && selected.version.status === "FORWARD_TEST" ? (
                      <form action={approveStrategyForwardAction}><input type="hidden" name="versionId" value={selected.version.id} /><Button type="submit"><CheckCircle2 size={16} className="mr-2" />Akceptuj</Button></form>
                    ) : null}
                    {selected.version.endedAt === null ? (
                      <form action={pauseStrategyForwardAction}><input type="hidden" name="versionId" value={selected.version.id} /><Button type="submit" variant="secondary"><PauseCircle size={16} className="mr-2" />Wstrzymaj</Button></form>
                    ) : null}
                    {selected.version.endedAt !== null && selected.version.status !== "ARCHIVED" ? (
                      <form action={archiveStrategyVersionAction}><input type="hidden" name="versionId" value={selected.version.id} /><Button type="submit" variant="secondary"><Archive size={16} className="mr-2" />Archiwizuj</Button></form>
                    ) : null}
                    <form action={prepareNewStrategyVersionAction}><input type="hidden" name="strategyId" value={selected.version.strategyId} /><Button type="submit" variant="secondary"><RefreshCw size={16} className="mr-2" />Nowa wersja</Button></form>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FinancialCard title="Wybrany sposób stawki" metrics={selected.forward.selected} />
              <FinancialCard title="Stała stawka" metrics={selected.forward.fixed} />
              <FinancialCard title="Procent kapitału" metrics={selected.forward.percentage} />
              <FinancialCard title="Częściowy Kelly" metrics={selected.forward.kelly} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck size={18} />Backtest przed aktywacją</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><div className="text-xs text-zinc-500">Walidacja</div><div className="font-medium">{strategyStabilityLabel(selected.historical.stability)}</div></div>
                  <div><div className="text-xs text-zinc-500">Próba 30%</div><div className="font-medium">{selected.historical.validation.resolvedEntries}</div></div>
                  <div><div className="text-xs text-zinc-500">Trafność</div><div className="font-medium">{percent(selected.historical.validation.hitRate)}</div></div>
                  <div><div className="text-xs text-zinc-500">ROI</div><div className="font-medium">{percent(selected.historical.validation.roi)}</div></div>
                  <div><div className="text-xs text-zinc-500">CLV</div><div className="font-medium">{percent(selected.historical.validation.averageClv)}</div></div>
                  <div><div className="text-xs text-zinc-500">Drawdown</div><div className="font-medium">{currency(selected.historical.validation.maxDrawdown)}</div></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Target size={18} />Wynik forward</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><div className="text-xs text-zinc-500">Sygnały</div><div className="font-medium">{selected.forward.totalSignals}</div></div>
                  <div><div className="text-xs text-zinc-500">Rozliczone W/L</div><div className="font-medium">{selected.forward.resolvedSignals}</div></div>
                  <div><div className="text-xs text-zinc-500">Trafność</div><div className="font-medium">{percent(selected.forward.hitRate)}</div></div>
                  <div><div className="text-xs text-zinc-500">ROI</div><div className="font-medium">{percent(selected.forward.selected.roi)}</div></div>
                  <div><div className="text-xs text-zinc-500">CLV</div><div className="font-medium">{percent(selected.forward.averageClv)}</div></div>
                  <div><div className="text-xs text-zinc-500">Drawdown</div><div className="font-medium">{currency(selected.forward.selected.maxDrawdown)}</div></div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Ustawienia ryzyka</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><div className="text-xs text-zinc-500">Tryb stawki</div><div className="font-medium">{forwardStakeModeLabel(selected.version.stakeMode as "FIXED" | "BANKROLL_PERCENT" | "KELLY")}</div></div>
                <div><div className="text-xs text-zinc-500">Kapitał początkowy</div><div className="font-medium">{currency(selected.version.initialBankroll)}</div></div>
                <div><div className="text-xs text-zinc-500">Stała / procent</div><div className="font-medium">{currency(selected.version.fixedStake)} / {formatNumber(selected.version.bankrollPercent, 2)}%</div></div>
                <div><div className="text-xs text-zinc-500">Kelly / limit stawki</div><div className="font-medium">{formatNumber(selected.version.kellyFraction, 2)} / {formatNumber(selected.version.maxStakePercent, 2)}%</div></div>
                <div><div className="text-xs text-zinc-500">Limit meczu</div><div className="font-medium">{formatNumber(selected.version.maxMatchExposurePercent, 2)}%</div></div>
                <div><div className="text-xs text-zinc-500">Limit ligi dziennie</div><div className="font-medium">{formatNumber(selected.version.maxLeagueExposurePercent, 2)}%</div></div>
                <div><div className="text-xs text-zinc-500">Limit rynku dziennie</div><div className="font-medium">{formatNumber(selected.version.maxMarketExposurePercent, 2)}%</div></div>
                <div><div className="text-xs text-zinc-500">Limit dnia</div><div className="font-medium">{formatNumber(selected.version.maxDailyExposurePercent, 2)}%</div></div>
              </CardContent>
            </Card>

            {selected.forward.exposureWarnings ? (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                <div><div className="font-medium">{selected.forward.exposureWarnings} sygnałów przekracza limit lub nie ma danych do wyliczenia stawki</div><div className="mt-1 text-xs">Sygnał nie jest usuwany. Otrzymuje znacznik ryzyka, żeby historia decyzji pozostała pełna.</div></div>
              </div>
            ) : null}

            <Card>
              <CardHeader><CardTitle>Największe otwarte ekspozycje</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {exposureSummary(selected.version.signals).map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <div><div className="font-medium">{row.label}</div><div className="text-xs text-zinc-500">{row.count} sygnałów</div></div>
                    <div className="font-semibold">{currency(row.stake)}</div>
                  </div>
                ))}
                {!selected.version.signals.some((signal) => signal.settledAt === null) ? <div className="text-sm text-zinc-500">Brak otwartych sygnałów do policzenia ekspozycji.</div> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp size={18} />Historia decyzji forward</CardTitle></CardHeader>
              <CardContent className="p-0">
                {selected.version.signals.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1500px] w-full text-sm">
                      <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                        <tr>
                          <th className="p-3">Mecz</th><th className="p-3">Decyzja</th><th className="p-3">Rynek</th><th className="p-3">Kurs</th><th className="p-3">Kurs zamk.</th><th className="p-3">p modelu</th><th className="p-3">EV</th><th className="p-3">Stawka</th><th className="p-3">Ekspozycja</th><th className="p-3">Wynik</th><th className="p-3">Analiza</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.version.signals.map((signal) => (
                          <tr key={signal.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                            <td className="p-3"><div className="font-medium">{signal.homeTeamName} – {signal.awayTeamName}</div><div className="text-xs text-zinc-500">{signal.leagueName} · {dateTime(signal.kickoffAt)}</div></td>
                            <td className="p-3">{dateTime(signal.decisionAt)}</td>
                            <td className="p-3">{signal.statLabel}<div className="text-xs text-zinc-500">{signal.target} · {signal.side} {formatNumber(signal.threshold, 1)}</div></td>
                            <td className="p-3">{signal.oddsAtSignal === null ? "—" : formatNumber(signal.oddsAtSignal, 2)}</td>
                            <td className="p-3">{signal.closingOdds === null ? "—" : formatNumber(signal.closingOdds, 2)}</td>
                            <td className="p-3">{percent(signal.modelProbability)}</td>
                            <td className="p-3">{percent(signal.expectedValue)}</td>
                            <td className="p-3"><div>{currency(signal.recommendedStake)}</div><div className="text-xs text-zinc-500">kapitał {currency(signal.bankrollAtSignal)}</div></td>
                            <td className={`p-3 text-xs font-medium ${signal.exposureStatus === "OK" ? "text-emerald-600" : "text-amber-600"}`}>{signal.exposureStatus}</td>
                            <td className={`p-3 font-medium ${signal.result === "WIN" ? "text-emerald-600" : signal.result === "LOSS" ? "text-red-600" : "text-zinc-500"}`}>{signal.result ?? "OTWARTY"}</td>
                            <td className="p-3"><Link href={`/analysis?matchId=${signal.matchId}`} className="inline-flex items-center font-medium text-emerald-600 hover:underline">Otwórz <ExternalLink size={12} className="ml-1" /></Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="p-10 text-center text-zinc-500">Brak nowych decyzji po aktywacji tej wersji.</div>}
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"><ShieldCheck size={18} className="mb-2 text-emerald-600" /><strong>Snapshot reguły</strong><div className="mt-1 text-xs text-zinc-500">Pola wersji nie zmieniają się po aktywacji.</div></div>
              <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"><TrendingDown size={18} className="mb-2 text-amber-600" /><strong>Brak cofania typów</strong><div className="mt-1 text-xs text-zinc-500">Decyzja musi powstać po aktywacji i przed rozpoczęciem meczu.</div></div>
              <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"><Target size={18} className="mb-2 text-blue-600" /><strong>Bez automatycznego grania</strong><div className="mt-1 text-xs text-zinc-500">Moduł zapisuje i ocenia sygnały. Nie wysyła zakładów do bukmachera.</div></div>
            </div>
          </div>
        ) : (
          <Card className="p-10 text-center text-zinc-500">
            <WalletCards size={32} className="mx-auto mb-3" />
            Aktywuj strategię w Laboratorium, aby rozpocząć test forward.
          </Card>
        )}
      </div>
    </div>
  );
}

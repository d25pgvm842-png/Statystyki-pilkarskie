import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gauge,
  History,
  PauseCircle,
  Radar,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import {
  refreshAllStrategyHealthAction,
  refreshStrategyHealthAction,
  updateStrategyMonitoringSettingsAction,
} from "@/lib/actions/strategy-monitoring-actions";
import {
  pauseStrategyForwardAction,
  prepareNewStrategyVersionAction,
} from "@/lib/actions/strategy-forward-actions";
import { requireUser } from "@/lib/auth";
import {
  loadStrategyMonitoring,
  type LoadedMonitoredStrategyVersion,
} from "@/lib/data/strategy-monitoring";
import {
  strategyHealthStatusClass,
  strategyHealthStatusLabel,
  type StrategyConfidenceInterval,
} from "@/lib/stats/strategy-monitoring";
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

function dateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function interval(value: StrategyConfidenceInterval | null) {
  return value ? `${percent(value.lower)} – ${percent(value.upper)}` : "—";
}

function confidenceLabel(value: string) {
  if (value === "HIGH") return "wysoka";
  if (value === "MEDIUM") return "średnia";
  if (value === "LOW") return "niska";
  return "brak";
}

function operationalStatusLabel(value: string) {
  if (value === "APPROVED") return "zaakceptowana";
  if (value === "FORWARD_TEST") return "test forward";
  if (value === "PAUSED") return "wstrzymana";
  if (value === "ARCHIVED") return "archiwalna";
  return value.toLocaleLowerCase("pl");
}

function scoreClass(score: number | null) {
  if (score === null) return "text-zinc-500";
  if (score >= 75) return "text-emerald-600";
  if (score >= 45) return "text-amber-600";
  return "text-red-600";
}

function MonitoringList({
  versions,
  selectedId,
}: {
  versions: LoadedMonitoredStrategyVersion[];
  selectedId: string | null;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Ranking kondycji</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {versions.length ? versions.map((item) => (
          <Link
            key={item.version.id}
            href={`/monitoring?versionId=${item.version.id}`}
            className={`rounded-lg border p-3 transition hover:border-emerald-400 ${item.version.id === selectedId ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-zinc-200 dark:border-zinc-800"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.version.strategy.name} · v{item.version.version}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {operationalStatusLabel(item.version.status)} · {item.forward.resolvedSignals} rozliczeń
                </div>
              </div>
              <div className={`text-xl font-semibold ${scoreClass(item.health.score)}`}>
                {item.health.score ?? "—"}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${strategyHealthStatusClass(item.health.status)}`}>
                {strategyHealthStatusLabel(item.health.status)}
              </span>
              <span className="text-xs text-zinc-500">ROI {percent(item.forward.selected.roi)}</span>
              <span className="text-xs text-zinc-500">CLV {percent(item.forward.averageClv)}</span>
            </div>
          </Link>
        )) : <div className="py-8 text-center text-sm text-zinc-500">Brak wersji strategii do nadzoru.</div>}
      </CardContent>
    </Card>
  );
}

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const selectedVersionId = stringParam(params.versionId) || null;
  const monitoring = await loadStrategyMonitoring({
    userId: user.id,
    selectedVersionId,
  });
  const selected = monitoring.selected;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radar size={25} className="text-emerald-600" />
            <h1 className="text-2xl font-semibold">Nadzór strategii</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Porównanie backtestu z testem forward, przedziały ufności i kontrola limitów ryzyka.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={refreshAllStrategyHealthAction}>
            <Button type="submit" variant="secondary"><RefreshCw size={16} className="mr-2" />Przelicz aktywne</Button>
          </form>
          <Link href="/portfolio" className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
            Portfel
          </Link>
        </div>
      </div>

      {stringParam(params.evaluated) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Oceniono wersje: {stringParam(params.evaluated)}. Zmienione oceny: {stringParam(params.changed) || "0"}.
        </div>
      ) : null}
      {stringParam(params.settings) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Ustawienia nadzoru zapisane i przeliczone.
        </div>
      ) : null}
      {stringParam(params.error) === "missing" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          Nie znaleziono wersji strategii.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="p-4"><div className="text-xs text-zinc-500">Aktywne</div><div className="mt-1 text-2xl font-semibold">{monitoring.summary.active}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Zdrowe</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{monitoring.summary.healthy}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Obserwacja</div><div className="mt-1 text-2xl font-semibold text-amber-600">{monitoring.summary.watch}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Zagrożone</div><div className="mt-1 text-2xl font-semibold text-red-600">{monitoring.summary.atRisk}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Limit ryzyka</div><div className="mt-1 text-2xl font-semibold text-red-600">{monitoring.summary.stopped}</div></Card>
        <Card className="p-4"><div className="text-xs text-zinc-500">Mała próba</div><div className="mt-1 text-2xl font-semibold text-zinc-500">{monitoring.summary.insufficient}</div></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <MonitoringList versions={monitoring.versions} selectedId={selected?.version.id ?? null} />

        {selected ? (
          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{selected.version.strategy.name} · wersja {selected.version.version}</CardTitle>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${strategyHealthStatusClass(selected.health.status)}`}>
                        {strategyHealthStatusLabel(selected.health.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Status: {operationalStatusLabel(selected.version.status)} · ostatni zapis oceny: {dateTime(selected.version.healthEvaluatedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={refreshStrategyHealthAction}>
                      <input type="hidden" name="versionId" value={selected.version.id} />
                      <Button type="submit" variant="secondary"><RefreshCw size={16} className="mr-2" />Przelicz</Button>
                    </form>
                    <Link href={`/portfolio?versionId=${selected.version.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                      Portfel <ExternalLink size={14} className="ml-2" />
                    </Link>
                    {selected.version.endedAt === null ? (
                      <form action={pauseStrategyForwardAction}>
                        <input type="hidden" name="versionId" value={selected.version.id} />
                        <Button type="submit" variant="secondary"><PauseCircle size={16} className="mr-2" />Wstrzymaj ręcznie</Button>
                      </form>
                    ) : (
                      <form action={prepareNewStrategyVersionAction}>
                        <input type="hidden" name="strategyId" value={selected.version.strategyId} />
                        <Button type="submit" variant="secondary"><RefreshCw size={16} className="mr-2" />Przygotuj nową wersję</Button>
                      </form>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className={`rounded-lg border p-4 ${selected.health.status === "HEALTHY" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : selected.health.status === "INSUFFICIENT_DATA" ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" : selected.health.status === "WATCH" ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"}`}>
              <div className="flex items-start gap-3">
                {selected.health.status === "HEALTHY" ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" /> : selected.health.status === "INSUFFICIENT_DATA" ? <Clock3 size={20} className="mt-0.5 shrink-0 text-zinc-500" /> : <ShieldAlert size={20} className="mt-0.5 shrink-0 text-red-600" />}
                <div>
                  <div className="font-medium">{selected.health.reason}</div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    Nadzór nie zatrzymuje wersji sam. Decyzja o wstrzymaniu pozostaje ręczna. Mała próba i brak danych nigdy nie dają statusu limitu ryzyka.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs text-zinc-500">Wynik kondycji</div>
                <div className={`mt-1 text-3xl font-semibold ${scoreClass(selected.health.score)}`}>{selected.health.score ?? "—"}<span className="text-base text-zinc-400"> / 100</span></div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-500">Próba forward</div>
                <div className="mt-1 text-2xl font-semibold">{selected.forward.resolvedSignals} / {selected.version.minForwardSample}</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className="h-full bg-emerald-600" style={{ width: `${selected.health.sampleProgress}%` }} /></div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-500">Pewność oceny</div>
                <div className="mt-1 text-2xl font-semibold">{confidenceLabel(selected.health.confidence)}</div>
                <div className="mt-2 text-xs text-zinc-500">Wilson 95%</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-500">Ostrzeżenia ekspozycji</div>
                <div className="mt-1 text-2xl font-semibold">{selected.forward.exposureWarnings}</div>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck size={18} />Backtest walidacyjny</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><div className="text-xs text-zinc-500">Próba</div><div className="font-medium">{selected.historical.validation.resolvedEntries}</div></div>
                  <div><div className="text-xs text-zinc-500">Trafność</div><div className="font-medium">{percent(selected.historical.validation.hitRate)}</div></div>
                  <div><div className="text-xs text-zinc-500">Przedział 95%</div><div className="font-medium">{interval(selected.health.historicalHitRateInterval)}</div></div>
                  <div><div className="text-xs text-zinc-500">ROI</div><div className="font-medium">{percent(selected.historical.validation.roi)}</div></div>
                  <div><div className="text-xs text-zinc-500">CLV</div><div className="font-medium">{percent(selected.historical.validation.averageClv)}</div></div>
                  <div><div className="text-xs text-zinc-500">Drawdown</div><div className="font-medium">{currency(selected.historical.validation.maxDrawdown)}</div></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Gauge size={18} />Test forward</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><div className="text-xs text-zinc-500">Próba</div><div className="font-medium">{selected.forward.resolvedSignals}</div></div>
                  <div><div className="text-xs text-zinc-500">Trafność</div><div className="font-medium">{percent(selected.forward.hitRate)}</div></div>
                  <div><div className="text-xs text-zinc-500">Przedział 95%</div><div className="font-medium">{interval(selected.health.forwardHitRateInterval)}</div></div>
                  <div><div className="text-xs text-zinc-500">ROI</div><div className="font-medium">{percent(selected.forward.selected.roi)}</div></div>
                  <div><div className="text-xs text-zinc-500">CLV</div><div className="font-medium">{percent(selected.forward.averageClv)}</div></div>
                  <div><div className="text-xs text-zinc-500">Drawdown</div><div className="font-medium">{currency(selected.forward.selected.maxDrawdown)}</div></div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown size={18} />Zmiana względem backtestu</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><div className="text-xs text-zinc-500">Różnica ROI</div><div className="mt-1 text-lg font-semibold">{percent(selected.health.roiDelta)}</div></div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><div className="text-xs text-zinc-500">Różnica CLV</div><div className="mt-1 text-lg font-semibold">{percent(selected.health.clvDelta)}</div></div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><div className="text-xs text-zinc-500">Różnica trafności</div><div className="mt-1 text-lg font-semibold">{percent(selected.health.hitRateDelta)}</div></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 size={18} />Polityka nadzoru</CardTitle></CardHeader>
              <CardContent>
                <form action={updateStrategyMonitoringSettingsAction} className="grid gap-4 sm:grid-cols-3">
                  <input type="hidden" name="versionId" value={selected.version.id} />
                  <label className="grid gap-1 text-sm">
                    <span>Minimalna próba</span>
                    <input name="minForwardSample" type="number" min="5" max="1000" step="1" defaultValue={selected.version.minForwardSample} className="h-10 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Limit drawdownu %</span>
                    <input name="maxDrawdownPercent" type="number" min="0.1" max="100" step="0.1" defaultValue={selected.version.maxDrawdownPercent} className="h-10 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Limit straty % kapitału</span>
                    <input name="maxLossPercent" type="number" min="0.1" max="100" step="0.1" defaultValue={selected.version.maxLossPercent} className="h-10 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700" />
                  </label>
                  <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Aktualnie: drawdown {percent(selected.health.drawdownPercent)} · strata {percent(selected.health.lossPercent)}.
                    </div>
                    <Button type="submit">Zapisz i przelicz</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><History size={18} />Historia ocen</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {monitoring.events.length ? monitoring.events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${strategyHealthStatusClass(event.status)}`}>
                          {strategyHealthStatusLabel(event.status)}
                        </span>
                        <span className="font-medium">wynik {event.score ?? "—"}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{dateTime(event.createdAt)} · {event.source.toLocaleLowerCase("pl")}</span>
                    </div>
                    {event.reason ? <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{event.reason}</div> : null}
                  </div>
                )) : <div className="py-6 text-center text-sm text-zinc-500">Brak zapisanych zmian oceny. Uruchom przeliczenie.</div>}
              </CardContent>
            </Card>

            {selected.health.status === "STOPPED" || selected.health.status === "AT_RISK" ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Wymagana decyzja właściciela</div>
                  <div className="mt-1 text-xs">Sprawdź sygnały i ręcznie wstrzymaj wersję, jeżeli ryzyko jest realne. Wznowienie odbywa się przez nową, zatwierdzoną wersję strategii.</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="p-10 text-center text-zinc-500">
            <Radar size={32} className="mx-auto mb-3" />
            Brak wersji strategii. Najpierw aktywuj test forward w Laboratorium.
          </Card>
        )}
      </div>
    </div>
  );
}

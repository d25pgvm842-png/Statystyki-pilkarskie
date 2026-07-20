import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FlaskConical,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  Save,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  createAnalysisStrategyAction,
  duplicateAnalysisStrategyAction,
  toggleAnalysisStrategyAction,
  updateAnalysisStrategyAction,
} from "@/lib/actions/strategy-lab-actions";
import { requireUser } from "@/lib/auth";
import {
  loadStrategyLab,
  type LoadedStrategy,
} from "@/lib/data/strategy-lab";
import {
  strategyConfidenceLabel,
  strategyRuleSummary,
  strategyStabilityLabel,
  type StrategyConfig,
  type StrategyMetrics,
  type StrategySegmentRow,
  type StrategyStability,
} from "@/lib/stats/strategy-lab";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

const decisionModeLabels = {
  ALL: "Wszystkie snapshoty",
  PLAYED: "Zagrane i rozliczone",
  SETTLED: "Tylko rozliczone",
  WATCHING: "Tylko obserwowane",
} as const;

const scopeLabels: Record<string, string> = {
  MATCH_TOTAL: "Suma meczu",
  TEAM_FOR: "Suma drużyny",
  TEAM_AGAINST: "Oddawane rywalom",
};

const targetLabels: Record<string, string> = {
  MATCH_TOTAL: "Suma meczu",
  HOME_TEAM: "Gospodarz",
  AWAY_TEAM: "Gość",
};

const sourceLabels: Record<string, string> = {
  SCANNER: "Skaner",
  MANUAL: "Ręczne",
};

const marketStatusLabels: Record<string, string> = {
  INSUFFICIENT_DATA: "Za mało danych",
  NO_ODDS: "Brak kursu",
  NO_EDGE: "Brak przewagi",
  WATCH: "Obserwacja",
  POTENTIAL_VALUE: "Potencjalne value",
};

const evidenceLabels: Record<string, string> = {
  SUPPORTED: "Wsparte historią",
  WATCH: "Do obserwacji",
  WEAK: "Słaba historia",
  UNVERIFIED: "Niezweryfikowane",
};

const templates: Record<string, StrategyConfig> = {
  conservative: {
    name: "Value konserwatywne",
    description: "Wysokie EV, kompletna próba i minimum średnia wiarygodność modelu.",
    decisionMode: "ALL",
    marketStatus: "POTENTIAL_VALUE",
    minModelProbability: 55,
    minExpectedValue: 5,
    minModelSample: 10,
    minCoverage: 70,
    minimumConfidence: "MEDIUM",
  },
  broad: {
    name: "Szeroka obserwacja",
    description: "Szerszy filtr do zbierania większej próby i późniejszego zawężania reguł.",
    decisionMode: "ALL",
    minExpectedValue: 2,
    minModelSample: 5,
    minCoverage: 50,
    minimumConfidence: "LIMITED",
  },
  strong: {
    name: "Mocny model",
    description: "Wysokie prawdopodobieństwo, pełne pokrycie i mocna wiarygodność modelu.",
    decisionMode: "ALL",
    minModelProbability: 60,
    minModelSample: 20,
    minCoverage: 100,
    minimumConfidence: "STRONG",
  },
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function percent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, digits)}%`;
}

function signedPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)} pp`;
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

function fieldValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function stabilityClass(value: StrategyStability) {
  if (value === "STABLE") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (value === "WATCH") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (value === "UNSTABLE") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function MetricCard({
  label,
  value,
  note,
  tone = "normal",
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "normal" | "positive" | "negative";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : ""}`}>
        {value}
      </div>
      {note ? <div className="mt-1 text-xs text-zinc-500">{note}</div> : null}
    </Card>
  );
}

function SegmentTable({
  title,
  rows,
}: {
  title: string;
  rows: StrategySegmentRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 size={18} />{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="p-3">Segment</th>
                  <th className="p-3">Sygnały</th>
                  <th className="p-3">Rozliczone</th>
                  <th className="p-3">Bilans</th>
                  <th className="p-3">Trafność</th>
                  <th className="p-3">Kalibracja n</th>
                  <th className="p-3">Śr. p modelu</th>
                  <th className="p-3">Luka</th>
                  <th className="p-3">Brier</th>
                  <th className="p-3">Śr. EV</th>
                  <th className="p-3">ROI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="p-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.label}</span>
                        {row.smallSample ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">mała próba</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">{row.totalEntries}</td>
                    <td className="p-3">{row.resolvedEntries}</td>
                    <td className="p-3">{row.wins}T · {row.losses}N · {row.pushes}P</td>
                    <td className="p-3 font-medium">{percent(row.hitRate)}</td>
                    <td className="p-3">{row.calibrationEntries}</td>
                    <td className="p-3">{percent(row.averageModelProbability)}</td>
                    <td className="p-3">{signedPercent(row.calibrationGap)}</td>
                    <td className="p-3">{row.brierScore === null ? "—" : formatNumber(row.brierScore, 3)}</td>
                    <td className="p-3">{percent(row.averageExpectedValue)}</td>
                    <td className="p-3 font-medium">{row.financialEntries ? percent(row.roi) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-zinc-500">Brak danych dla tej strategii.</div>
        )}
      </CardContent>
    </Card>
  );
}

function ValidationTable({ training, validation }: { training: StrategyMetrics; validation: StrategyMetrics }) {
  const rows = [
    { key: "training", label: "Próba robocza 70%", metrics: training },
    { key: "validation", label: "Walidacja 30%", metrics: validation },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck size={18} />Walidacja chronologiczna</CardTitle>
        <p className="text-sm text-zinc-500">Najstarsze 70% rozliczonych sygnałów tworzy próbę roboczą, a najnowsze 30% sprawdza stabilność reguły.</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
              <tr>
                <th className="p-3">Zbiór</th>
                <th className="p-3">n</th>
                <th className="p-3">Bilans</th>
                <th className="p-3">Trafność</th>
                <th className="p-3">Kalibracja n</th>
                <th className="p-3">Śr. p modelu</th>
                <th className="p-3">Luka</th>
                <th className="p-3">Brier</th>
                <th className="p-3">ROI</th>
                <th className="p-3">Max DD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="p-3 font-medium">{row.label}</td>
                  <td className="p-3">{row.metrics.resolvedEntries}</td>
                  <td className="p-3">{row.metrics.wins}T · {row.metrics.losses}N</td>
                  <td className="p-3">{percent(row.metrics.hitRate)}</td>
                  <td className="p-3">{row.metrics.calibrationEntries}</td>
                  <td className="p-3">{percent(row.metrics.averageModelProbability)}</td>
                  <td className="p-3">{signedPercent(row.metrics.calibrationGap)}</td>
                  <td className="p-3">{row.metrics.brierScore === null ? "—" : formatNumber(row.metrics.brierScore, 3)}</td>
                  <td className="p-3">{row.metrics.financialEntries ? percent(row.metrics.roi) : "—"}</td>
                  <td className="p-3">{row.metrics.maxDrawdown === null ? "—" : currency(row.metrics.maxDrawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StrategyEditor({
  defaults,
  editId,
  seasons,
  leagues,
  modelVersions,
  bookmakers,
  returnTo,
}: {
  defaults: StrategyConfig;
  editId: string | null;
  seasons: Array<{ id: string; name: string; league: { name: string } }>;
  leagues: Array<{ id: string; name: string }>;
  modelVersions: string[];
  bookmakers: string[];
  returnTo: string;
}) {
  const action = editId ? updateAnalysisStrategyAction : createAnalysisStrategyAction;
  return (
    <Card id="editor" className="scroll-mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Beaker size={18} />{editId ? "Edytuj strategię" : "Nowa strategia"}</CardTitle>
        <p className="text-sm text-zinc-500">Reguły mogą korzystać wyłącznie z informacji zapisanych w chwili decyzji. Wynik, CLV i kurs zamknięcia służą tylko do późniejszej oceny.</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-5">
          {editId ? <input type="hidden" name="id" value={editId} /> : null}
          <input type="hidden" name="returnTo" value={returnTo} />

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Nazwa</label>
              <Input name="name" required minLength={3} maxLength={80} defaultValue={defaults.name} placeholder="Np. rożne over — mocny model" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Status decyzji</label>
              <Select name="decisionMode" defaultValue={defaults.decisionMode}>
                {Object.entries(decisionModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-500">Opis</label>
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={defaults.description ?? ""}
                className="min-h-24 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Cel reguły, hipoteza i warunki użycia"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 font-medium">Zakres danych</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select name="leagueId" defaultValue={defaults.leagueId ?? ""}>
                <option value="">Wszystkie ligi</option>
                {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
              </Select>
              <Select name="seasonId" defaultValue={defaults.seasonId ?? ""}>
                <option value="">Wszystkie sezony</option>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.league.name} · {season.name}</option>)}
              </Select>
              <Select name="statKey" defaultValue={defaults.statKey ?? ""}>
                <option value="">Wszystkie rynki</option>
                {TREND_STAT_DEFINITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </Select>
              <Select name="scope" defaultValue={defaults.scope ?? ""}>
                <option value="">Każdy zakres</option>
                {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select name="target" defaultValue={defaults.target ?? ""}>
                <option value="">Gospodarz, gość i suma meczu</option>
                {Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select name="side" defaultValue={defaults.side ?? ""}>
                <option value="">OVER i UNDER</option>
                <option value="OVER">OVER</option>
                <option value="UNDER">UNDER</option>
              </Select>
              <Select name="source" defaultValue={defaults.source ?? ""}>
                <option value="">Każde źródło wpisu</option>
                {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <div>
                <Input name="modelVersion" list="strategy-model-versions" defaultValue={defaults.modelVersion ?? ""} placeholder="Wersja modelu" />
                <datalist id="strategy-model-versions">{modelVersions.map((value) => <option key={value} value={value} />)}</datalist>
              </div>
              <div>
                <Input name="bookmaker" list="strategy-bookmakers" defaultValue={defaults.bookmaker ?? ""} placeholder="Bukmacher" />
                <datalist id="strategy-bookmakers">{bookmakers.map((value) => <option key={value} value={value} />)}</datalist>
              </div>
              <Select name="marketStatus" defaultValue={defaults.marketStatus ?? ""}>
                <option value="">Każdy status rynku</option>
                {Object.entries(marketStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select name="evidenceStatus" defaultValue={defaults.evidenceStatus ?? ""}>
                <option value="">Każdy status historii</option>
                {Object.entries(evidenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select name="minimumConfidence" defaultValue={defaults.minimumConfidence ?? ""}>
                <option value="">Dowolna wiarygodność</option>
                {(["NO_DATA", "WEAK", "LIMITED", "MEDIUM", "STRONG"] as const).map((value) => (
                  <option key={value} value={value}>minimum: {strategyConfidenceLabel(value)}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-2 font-medium">Progi reguły</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["minModelProbability", "Min. p modelu %", 0, 100, 0.1],
                ["maxModelProbability", "Maks. p modelu %", 0, 100, 0.1],
                ["minExpectedValue", "Min. EV %", -100, 1000, 0.1],
                ["maxExpectedValue", "Maks. EV %", -100, 1000, 0.1],
                ["minOdds", "Min. kurs", 1.01, 1000, 0.01],
                ["maxOdds", "Maks. kurs", 1.01, 1000, 0.01],
                ["minThreshold", "Min. linia", 0, 500, 0.5],
                ["maxThreshold", "Maks. linia", 0, 500, 0.5],
                ["minEdge", "Min. przewaga", 0, 500, 0.01],
                ["minModelSample", "Min. próba modelu", 1, 10000, 1],
                ["minCoverage", "Min. pokrycie %", 0, 100, 0.1],
                ["minBacktestSignals", "Min. sygnały backtestu", 1, 100000, 1],
                ["minBacktestHitRate", "Min. trafność backtestu %", 0, 100, 0.1],
              ].map(([name, placeholder, min, max, step]) => (
                <Input
                  key={String(name)}
                  name={String(name)}
                  type="number"
                  min={Number(min)}
                  max={Number(max)}
                  step={Number(step)}
                  defaultValue={fieldValue(defaults[name as keyof StrategyConfig])}
                  placeholder={String(placeholder)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit"><Save size={16} className="mr-2" />{editId ? "Zapisz strategię" : "Utwórz strategię"}</Button>
            {editId ? (
              <Link href={`${returnTo}#comparison`} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Anuluj edycję</Link>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StrategyComparison({ strategies, selectedId }: { strategies: LoadedStrategy[]; selectedId: string | null }) {
  return (
    <Card id="comparison" className="scroll-mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FlaskConical size={18} />Porównanie zapisanych strategii</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {strategies.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1350px] w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="p-3">Strategia</th>
                  <th className="p-3">Reguła</th>
                  <th className="p-3">Sygnały</th>
                  <th className="p-3">Rozliczone</th>
                  <th className="p-3">Trafność</th>
                  <th className="p-3">Brier</th>
                  <th className="p-3">ROI</th>
                  <th className="p-3">Max DD</th>
                  <th className="p-3">Walidacja</th>
                  <th className="p-3">Akcja</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map(({ strategy, config, evaluation }) => (
                  <tr key={strategy.id} className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800 ${strategy.id === selectedId ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}>
                    <td className="p-3">
                      <div className="font-medium">{strategy.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                        <span className={`rounded-full px-2 py-0.5 ${strategy.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                          {strategy.active ? "aktywna" : "wstrzymana"}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[420px] p-3 text-xs text-zinc-600 dark:text-zinc-300">{strategyRuleSummary(config)}</td>
                    <td className="p-3 font-medium">{evaluation.metrics.totalEntries}</td>
                    <td className="p-3">{evaluation.metrics.resolvedEntries}</td>
                    <td className="p-3">{percent(evaluation.metrics.hitRate)}</td>
                    <td className="p-3">{evaluation.metrics.brierScore === null ? "—" : formatNumber(evaluation.metrics.brierScore, 3)}</td>
                    <td className="p-3 font-medium">{evaluation.metrics.financialEntries ? percent(evaluation.metrics.roi) : "—"}</td>
                    <td className="p-3">{evaluation.metrics.maxDrawdown === null ? "—" : currency(evaluation.metrics.maxDrawdown)}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${stabilityClass(evaluation.stability)}`}>{strategyStabilityLabel(evaluation.stability)}</span></td>
                    <td className="p-3"><Link href={`/strategies?strategyId=${strategy.id}#details`} className="font-medium text-emerald-600 hover:underline">Otwórz</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-8 text-center text-zinc-500">Nie zapisano jeszcze żadnej strategii.</div>}
      </CardContent>
    </Card>
  );
}

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const selectedId = stringParam(params.strategyId) || null;
  const lab = await loadStrategyLab({ userId: user.id, selectedId });
  const selected = lab.selected;
  const editRequested = stringParam(params.edit) === "1" && selected !== null;
  const template = templates[stringParam(params.template)] ?? null;
  const defaults: StrategyConfig = editRequested && selected
    ? selected.config
    : template ?? { name: "", description: "", decisionMode: "ALL" };
  const editId = editRequested && selected ? selected.strategy.id : null;
  const returnTo = selected ? `/strategies?strategyId=${selected.strategy.id}` : "/strategies";
  const modelVersions = [...new Set(lab.entries.map((entry) => entry.modelVersion).filter((value): value is string => Boolean(value)))].sort();
  const bookmakers = [...new Set(lab.entries.map((entry) => entry.bookmaker).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right, "pl"));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Beaker size={25} className="text-emerald-600" />
            <h1 className="text-2xl font-semibold">Laboratorium strategii</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">Budowanie, zapisywanie i porównywanie reguł na snapshotach Dziennika decyzji.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/strategies#editor" className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"><PlusCircle size={16} className="mr-2" />Nowa strategia</Link>
          {selected ? (
            <Link href={`/strategies/export?strategyId=${selected.strategy.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"><Download size={16} className="mr-2" />Eksport CSV</Link>
          ) : null}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle size={19} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">To laboratorium decyzji, nie pełny backtest całego rynku</div>
          <div className="mt-1 text-xs">Analiza obejmuje wpisy, które zostały wcześniej zapisane w Dzienniku. Wynik może zawierać bias selekcji. Reguły nie filtrują po wyniku, CLV ani kursie zamknięcia, ponieważ byłyby to informacje z przyszłości.</div>
        </div>
      </div>

      {stringParam(params.created) ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Strategia została utworzona.</div> : null}
      {stringParam(params.updated) ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Strategia została zaktualizowana.</div> : null}
      {stringParam(params.duplicated) ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">Utworzono wstrzymaną kopię strategii.</div> : null}
      {stringParam(params.error) ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">Nie udało się zapisać strategii. Sprawdź wartości i unikalność nazwy.</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/strategies?template=conservative#editor" className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="font-medium">Szablon: Value konserwatywne</div><div className="mt-1 text-xs text-zinc-500">EV ≥ 5%, p ≥ 55%, dobra próba i wiarygodność.</div>
        </Link>
        <Link href="/strategies?template=broad#editor" className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="font-medium">Szablon: Szeroka obserwacja</div><div className="mt-1 text-xs text-zinc-500">Większa próba do poszukiwania działających segmentów.</div>
        </Link>
        <Link href="/strategies?template=strong#editor" className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="font-medium">Szablon: Mocny model</div><div className="mt-1 text-xs text-zinc-500">p ≥ 60%, próba ≥ 20, pełne pokrycie i mocna wiarygodność.</div>
        </Link>
      </div>

      <StrategyEditor
        defaults={defaults}
        editId={editId}
        seasons={lab.seasons}
        leagues={lab.leagues}
        modelVersions={modelVersions}
        bookmakers={bookmakers}
        returnTo={returnTo}
      />

      <StrategyComparison strategies={lab.strategies} selectedId={selected?.strategy.id ?? null} />

      {selected ? (
        <section id="details" className="grid scroll-mt-5 gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{selected.strategy.name}</CardTitle>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${selected.strategy.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>{selected.strategy.active ? "aktywna" : "wstrzymana"}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stabilityClass(selected.evaluation.stability)}`}>{strategyStabilityLabel(selected.evaluation.stability)}</span>
                  </div>
                  {selected.strategy.description ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{selected.strategy.description}</p> : null}
                  <p className="mt-2 text-xs text-zinc-500">{strategyRuleSummary(selected.config)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/strategies?strategyId=${selected.strategy.id}&edit=1#editor`} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"><Edit3 size={16} className="mr-2" />Edytuj</Link>
                  <form action={duplicateAnalysisStrategyAction}><input type="hidden" name="id" value={selected.strategy.id} /><Button type="submit" variant="secondary"><Copy size={16} className="mr-2" />Duplikuj</Button></form>
                  <form action={toggleAnalysisStrategyAction}><input type="hidden" name="id" value={selected.strategy.id} /><Button type="submit" variant="secondary">{selected.strategy.active ? <PauseCircle size={16} className="mr-2" /> : <PlayCircle size={16} className="mr-2" />}{selected.strategy.active ? "Wstrzymaj" : "Aktywuj"}</Button></form>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Sygnały" value={selected.evaluation.metrics.totalEntries} note={`${selected.evaluation.metrics.openEntries} otwartych`} />
            <MetricCard label="Rozliczone W/L" value={selected.evaluation.metrics.resolvedEntries} note={`${selected.evaluation.metrics.wins}T · ${selected.evaluation.metrics.losses}N`} />
            <MetricCard label="Trafność" value={percent(selected.evaluation.metrics.hitRate)} note={`kalibracja n=${selected.evaluation.metrics.calibrationEntries} · model ${percent(selected.evaluation.metrics.averageModelProbability)}`} />
            <MetricCard label="Brier Score" value={selected.evaluation.metrics.brierScore === null ? "—" : formatNumber(selected.evaluation.metrics.brierScore, 3)} note="niżej = lepiej" />
            <MetricCard label="ROI" value={selected.evaluation.metrics.financialEntries ? percent(selected.evaluation.metrics.roi) : "—"} note={selected.evaluation.metrics.financialEntries ? `${currency(selected.evaluation.metrics.profit)} / ${currency(selected.evaluation.metrics.turnover)}` : "brak pełnych danych finansowych"} tone={selected.evaluation.metrics.roi === null ? "normal" : selected.evaluation.metrics.roi >= 0 ? "positive" : "negative"} />
            <MetricCard label="Maks. obsunięcie" value={selected.evaluation.metrics.maxDrawdown === null ? "—" : currency(selected.evaluation.metrics.maxDrawdown)} note={`serie: ${selected.evaluation.metrics.longestWinStreak}W / ${selected.evaluation.metrics.longestLossStreak}L`} />
          </div>

          <ValidationTable training={selected.evaluation.training} validation={selected.evaluation.validation} />

          {selected.evaluation.currentEntries.length ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Target size={18} />Aktualne pozycje spełniające regułę</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selected.evaluation.currentEntries.slice(0, 18).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500">{entry.leagueName} · {dateTime(entry.kickoffAt)}</div>
                    <div className="mt-1 font-medium">{entry.homeTeamName} – {entry.awayTeamName}</div>
                    <div className="mt-2 text-sm">{entry.statLabel} · {targetLabels[entry.target] ?? entry.target} · <strong>{entry.side} {formatNumber(entry.threshold, 1)}</strong></div>
                    <div className="mt-1 text-xs text-zinc-500">p {percent(entry.modelProbability)} · EV {percent(entry.expectedValue)} · status {entry.status}</div>
                    <Link href={`/analysis?matchId=${entry.matchId}`} className="mt-2 inline-flex items-center text-xs font-medium text-emerald-600 hover:underline">Otwórz analizę <ExternalLink size={12} className="ml-1" /></Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <SegmentTable title="Stabilność miesięczna" rows={selected.evaluation.byMonth} />
            <SegmentTable title="Według ligi" rows={selected.evaluation.byLeague} />
            <SegmentTable title="Według rynku" rows={selected.evaluation.byMarket} />
            <SegmentTable title="OVER / UNDER" rows={selected.evaluation.bySide} />
            <div className="xl:col-span-2"><SegmentTable title="Według wersji modelu" rows={selected.evaluation.byModelVersion} /></div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp size={18} />Ostatnie decyzje pasujące do strategii</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {selected.evaluation.matchedEntries.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-[1350px] w-full text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                      <tr>
                        <th className="p-3">Mecz</th><th className="p-3">Rynek</th><th className="p-3">Status</th><th className="p-3">Wynik</th><th className="p-3">p modelu</th><th className="p-3">EV</th><th className="p-3">Kurs</th><th className="p-3">CLV</th><th className="p-3">Data</th><th className="p-3">Analiza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selected.evaluation.matchedEntries].reverse().slice(0, 40).map((entry) => {
                        const clv = entry.odds !== null && entry.closingOdds !== null && entry.odds > 1 && entry.closingOdds > 1
                          ? ((entry.odds / entry.closingOdds) - 1) * 100
                          : null;
                        return (
                          <tr key={entry.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                            <td className="p-3"><div className="font-medium">{entry.homeTeamName} – {entry.awayTeamName}</div><div className="text-xs text-zinc-500">{entry.leagueName} · {entry.seasonName}</div></td>
                            <td className="p-3">{entry.statLabel}<div className="text-xs text-zinc-500">{targetLabels[entry.target] ?? entry.target} · {entry.scope} · {entry.side}</div></td>
                            <td className="p-3">{entry.status}</td>
                            <td className={`p-3 font-medium ${entry.result === "WIN" ? "text-emerald-600" : entry.result === "LOSS" ? "text-red-600" : "text-zinc-500"}`}>{entry.result ?? "—"}</td>
                            <td className="p-3">{percent(entry.modelProbability)}</td>
                            <td className="p-3">{percent(entry.expectedValue)}</td>
                            <td className="p-3">{entry.odds === null ? "—" : formatNumber(entry.odds, 2)}</td>
                            <td className="p-3">{percent(clv)}</td>
                            <td className="p-3">{dateTime(entry.kickoffAt)}</td>
                            <td className="p-3"><Link href={`/analysis?matchId=${entry.matchId}`} className="font-medium text-emerald-600 hover:underline">Otwórz</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <div className="p-8 text-center text-zinc-500">Żaden zapisany snapshot nie spełnia tej reguły.</div>}
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card className="p-10 text-center text-zinc-500">
          <FlaskConical size={30} className="mx-auto mb-3" />
          Utwórz pierwszą strategię, aby rozpocząć porównywanie reguł.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"><CheckCircle2 size={18} className="mb-2 text-emerald-600" /><strong>Brak wycieku przyszłości</strong><div className="mt-1 text-xs text-zinc-500">Reguła używa tylko pól znanych przy zapisie decyzji.</div></div>
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"><TrendingDown size={18} className="mb-2 text-amber-600" /><strong>Ryzyko widoczne</strong><div className="mt-1 text-xs text-zinc-500">Obsunięcie i serie porażek są pokazywane obok ROI.</div></div>
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"><ShieldCheck size={18} className="mb-2 text-blue-600" /><strong>Walidacja 70/30</strong><div className="mt-1 text-xs text-zinc-500">Najnowsze 30% sygnałów nie służy do budowania reguły.</div></div>
      </div>
    </div>
  );
}

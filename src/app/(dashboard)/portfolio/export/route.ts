import { requireUser } from "@/lib/auth";
import { loadStrategyPortfolio } from "@/lib/data/strategy-portfolio";
import { selectionClv, selectionProfit } from "@/lib/stats/analysis-journal";
import { strategyRuleSummary, strategyStabilityLabel } from "@/lib/stats/strategy-lab";
import { BETTING_METRICS_VERSION } from "@/lib/stats/betting-metrics";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function safeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "strategia";
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const versionId = url.searchParams.get("versionId")?.trim() ?? "";
  if (!versionId) return new Response("Brak wersji strategii.", { status: 400 });

  const portfolio = await loadStrategyPortfolio({
    userId: user.id,
    selectedVersionId: versionId,
  });
  const selected = portfolio.versions.find((item) => item.version.id === versionId);
  if (!selected) return new Response("Nie znaleziono wersji strategii.", { status: 404 });

  const { version, config, historical, forward } = selected;
  const rows: unknown[][] = [
    ["PORTFEL STRATEGII - TEST FORWARD"],
    ["strategia", version.strategy.name],
    ["wersja", version.version],
    ["status", version.status],
    ["wersja_metryk", BETTING_METRICS_VERSION],
    ["aktywowano", version.activatedAt.toISOString()],
    ["zakonczono", version.endedAt?.toISOString() ?? null],
    ["regula", strategyRuleSummary(config)],
    ["tryb_stawki", version.stakeMode],
    ["kapital_poczatkowy", version.initialBankroll],
    ["stala_stawka", version.fixedStake],
    ["procent_kapitalu", version.bankrollPercent],
    ["udzial_kelly", version.kellyFraction],
    ["limit_stawki_procent", version.maxStakePercent],
    ["limit_meczu_procent", version.maxMatchExposurePercent],
    ["limit_ligi_procent", version.maxLeagueExposurePercent],
    ["limit_rynku_procent", version.maxMarketExposurePercent],
    ["limit_dnia_procent", version.maxDailyExposurePercent],
    [],
    ["POROWNANIE"],
    ["metryka", "backtest_walidacja_30", "forward"],
    ["liczba_sygnalow", historical.validation.resolvedEntries, forward.resolvedSignals],
    ["trafnosc_procent", historical.validation.hitRate, forward.hitRate],
    ["roi_procent", historical.validation.roi, forward.selected.roi],
    ["srednie_clv_procent", historical.validation.averageClv, forward.averageClv],
    ["maksymalne_obsuniecie", historical.validation.maxDrawdown, forward.selected.maxDrawdown],
    ["stabilnosc_backtestu", strategyStabilityLabel(historical.stability), null],
    [],
    ["SYMULACJE STAWEK"],
    ["wariant", "liczba", "obrot", "profit", "roi_procent", "max_drawdown"],
    ["wybrany", forward.selected.financialEntries, forward.selected.turnover, forward.selected.profit, forward.selected.roi, forward.selected.maxDrawdown],
    ["stala", forward.fixed.financialEntries, forward.fixed.turnover, forward.fixed.profit, forward.fixed.roi, forward.fixed.maxDrawdown],
    ["procent_kapitalu", forward.percentage.financialEntries, forward.percentage.turnover, forward.percentage.profit, forward.percentage.roi, forward.percentage.maxDrawdown],
    ["kelly", forward.kelly.financialEntries, forward.kelly.turnover, forward.kelly.profit, forward.kelly.roi, forward.kelly.maxDrawdown],
    [],
    ["KONFIGURACJA SNAPSHOT"],
    ["pole", "wartosc"],
    ...Object.entries(config).map(([field, value]) => [field, value]),
    [],
    ["HISTORIA SYGNALOW FORWARD"],
    [
      "id",
      "data_decyzji",
      "data_meczu",
      "liga",
      "sezon",
      "gospodarz",
      "gosc",
      "rynek",
      "zakres",
      "cel",
      "kierunek",
      "linia",
      "zrodlo",
      "bukmacher",
      "kurs_sygnalu",
      "kurs_zamkniecia",
      "clv_procent",
      "p_modelu",
      "ev_procent",
      "projekcja",
      "przewaga",
      "wersja_modelu",
      "kapital_wybrany_przy_sygnale",
      "kapital_stala_przy_sygnale",
      "kapital_procent_przy_sygnale",
      "kapital_kelly_przy_sygnale",
      "stawka_stala",
      "stawka_procent",
      "stawka_kelly",
      "stawka_rekomendowana",
      "tryb_stawki",
      "status_ekspozycji",
      "wynik",
      "wartosc_rzeczywista",
      "profit_rekomendowany",
      "data_rozliczenia",
    ],
  ];

  for (const signal of version.signals) {
    rows.push([
      signal.id,
      signal.decisionAt.toISOString(),
      signal.kickoffAt.toISOString(),
      signal.leagueName,
      signal.seasonName,
      signal.homeTeamName,
      signal.awayTeamName,
      signal.statLabel,
      signal.scope,
      signal.target,
      signal.side,
      signal.threshold,
      signal.source,
      signal.bookmaker,
      signal.oddsAtSignal,
      signal.closingOdds,
      selectionClv({ odds: signal.oddsAtSignal, closingOdds: signal.closingOdds }),
      signal.modelProbability,
      signal.expectedValue,
      signal.projection,
      signal.edge,
      signal.modelVersion,
      signal.bankrollAtSignal,
      signal.fixedBankrollAtSignal,
      signal.percentageBankrollAtSignal,
      signal.kellyBankrollAtSignal,
      signal.fixedStake,
      signal.percentageStake,
      signal.kellyStake,
      signal.recommendedStake,
      signal.stakeMode,
      signal.exposureStatus,
      signal.result,
      signal.actualValue,
      selectionProfit({
        result: signal.result,
        odds: signal.oddsAtSignal,
        stake: signal.recommendedStake,
      }),
      signal.settledAt?.toISOString() ?? null,
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="forward-${safeName(version.strategy.name)}-v${version.version}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

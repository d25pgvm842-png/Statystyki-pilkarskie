import { requireUser } from "@/lib/auth";
import { loadAnalysisJournal } from "@/lib/data/analysis-journal";
import type { CalibrationSegmentRow } from "@/lib/stats/journal-calibration";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function dateText(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "" : value;
}

function utcDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function nextUtcDay(value: string) {
  const date = utcDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function appendSection(rows: unknown[][], title: string, entries: CalibrationSegmentRow[]) {
  rows.push([title]);
  rows.push([
    "segment",
    "pozycje_w_filtrze",
    "snapshoty",
    "pokrycie_snapshotow_procent",
    "snapshoty_z_probability",
    "snapshoty_z_ev",
    "rozliczone_win_loss",
    "trafione",
    "nietrafione",
    "srednie_probability_modelu",
    "faktyczna_trafnosc_procent",
    "luka_kalibracji_pp",
    "brier_score",
    "srednie_ev_procent",
    "pozycje_finansowe",
    "obrot",
    "profit",
    "roi_procent",
    "mala_proba",
  ]);

  for (const entry of entries) {
    rows.push([
      entry.label,
      entry.totalEntries,
      entry.snapshotEntries,
      entry.snapshotCoverage,
      entry.probabilityEntries,
      entry.expectedValueEntries,
      entry.resolvedEntries,
      entry.wins,
      entry.losses,
      entry.averageModelProbability,
      entry.actualHitRate,
      entry.calibrationGap,
      entry.brierScore,
      entry.averageExpectedValue,
      entry.financialEntries,
      entry.financialEntries ? entry.turnover : null,
      entry.financialEntries ? entry.profit : null,
      entry.financialEntries ? entry.roi : null,
      entry.smallSample ? "TAK" : "NIE",
    ]);
  }
  rows.push([]);
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const seasonId = url.searchParams.get("seasonId");
  const leagueId = url.searchParams.get("leagueId");
  const statusParam = url.searchParams.get("status");
  const status = ["WATCHING", "PLAYED", "REJECTED", "SETTLED", "VOID"].includes(statusParam ?? "")
    ? statusParam
    : null;
  const statParam = url.searchParams.get("statKey");
  const statKey = TREND_STAT_DEFINITIONS.some((item) => item.key === statParam)
    ? statParam
    : null;
  const sourceParam = url.searchParams.get("source");
  const source = ["SCANNER", "MANUAL"].includes(sourceParam ?? "") ? sourceParam : null;
  const fromText = dateText(url.searchParams.get("from"));
  const toText = dateText(url.searchParams.get("to"));

  const { calibration } = await loadAnalysisJournal({
    userId: user.id,
    seasonId,
    leagueId,
    status,
    statKey,
    source,
    from: utcDate(fromText),
    to: nextUtcDay(toText),
  });
  const summary = calibration.summary;
  const rows: unknown[][] = [
    ["KALIBRACJA MODELU I JAKOSCI EV"],
    ["filtr_liga_id", leagueId],
    ["filtr_sezon_id", seasonId],
    ["filtr_rynek", statKey],
    ["filtr_status", status],
    ["filtr_zrodlo", source],
    ["filtr_data_od", fromText],
    ["filtr_data_do", toText],
    [],
    ["PODSUMOWANIE"],
    ["metryka", "wartosc"],
    ["pozycje_w_filtrze", summary.totalEntries],
    ["snapshoty_modelu", summary.snapshotEntries],
    ["pokrycie_snapshotow_procent", summary.snapshotCoverage],
    ["obserwowane", summary.watching],
    ["zagrane_otwarte", summary.playedOpen],
    ["odrzucone", summary.rejected],
    ["rozliczone", summary.settled],
    ["void", summary.voided],
    ["rozliczone_win_loss", summary.resolvedEntries],
    ["trafione", summary.wins],
    ["nietrafione", summary.losses],
    ["srednie_probability_modelu", summary.averageModelProbability],
    ["faktyczna_trafnosc_procent", summary.actualHitRate],
    ["luka_kalibracji_pp", summary.calibrationGap],
    ["brier_score", summary.brierScore],
    ["srednie_ev_procent", summary.averageExpectedValue],
    ["pozycje_finansowe", summary.financialEntries],
    ["obrot", summary.financialEntries ? summary.turnover : null],
    ["profit", summary.financialEntries ? summary.profit : null],
    ["roi_procent", summary.financialEntries ? summary.roi : null],
    [],
  ];

  appendSection(rows, "WEDLUG PRAWDOPODOBIENSTWA", calibration.byProbability);
  appendSection(rows, "WEDLUG EV", calibration.byExpectedValue);
  appendSection(rows, "WEDLUG LIGI", calibration.byLeague);
  appendSection(rows, "WEDLUG RYNKU", calibration.byMarket);
  appendSection(rows, "OVER_UNDER", calibration.bySide);
  appendSection(rows, "WEDLUG WERSJI MODELU", calibration.byModelVersion);
  appendSection(rows, "WEDLUG STATUSU DECYZJI", calibration.byDecisionStatus);

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kalibracja-modelu-ev.csv"',
      "Cache-Control": "no-store",
    },
  });
}

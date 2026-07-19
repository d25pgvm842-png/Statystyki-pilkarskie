import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadMatchAnalysis, type AnalysisLookback } from "@/lib/data/match-analysis";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "analiza-meczu";
}

function lookbackFrom(value: string | null): AnalysisLookback {
  if (value === "5" || value === "10" || value === "20") return Number(value) as 5 | 10 | 20;
  return value === "all" ? null : 10;
}

function number(value: number | null | undefined) {
  return value === null || value === undefined ? "" : value.toFixed(2);
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId") ?? "";
  if (!matchId) notFound();
  const lookback = lookbackFrom(url.searchParams.get("lookback"));
  const analysis = await loadMatchAnalysis({ matchId, userId: user.id, lookback });
  if (!analysis) notFound();

  const rows: unknown[][] = [
    ["sekcja", "rynek", "metryka", "gospodarz", "gość", "suma_lub_wartość", "próba", "uwagi"],
    ["mecz", "", "liga", "", "", analysis.match.season.league.name, "", analysis.match.season.name],
    ["mecz", "", "spotkanie", analysis.match.homeTeam.name, analysis.match.awayTeam.name, "", "", analysis.match.kickoffAt.toISOString()],
    ["mecz", "", "sędzia", "", "", analysis.match.referee?.name ?? "", "", analysis.match.dataSource?.name ?? ""],
    ["forma", "", "bilans", `${analysis.homeForm.wins}-${analysis.homeForm.draws}-${analysis.homeForm.losses}`, `${analysis.awayForm.wins}-${analysis.awayForm.draws}-${analysis.awayForm.losses}`, "", `${analysis.homeForm.count}/${analysis.awayForm.count}`, "Z-R-P"],
    ["forma", "", "punkty_na_mecz", number(analysis.homeForm.pointsPerMatch), number(analysis.awayForm.pointsPerMatch), "", "", ""],
  ];

  for (const market of analysis.projections) {
    rows.push([
      "projekcja",
      market.label,
      "średnie_i_prognoza",
      number(market.projectedHome),
      number(market.projectedAway),
      number(market.projectedTotal),
      `${market.homeSample}/${market.awaySample}`,
      `gospodarz wykonuje ${number(market.homeFor)}; gość oddaje ${number(market.awayAgainst)}; gość wykonuje ${number(market.awayFor)}; gospodarz oddaje ${number(market.homeAgainst)}`,
    ]);
    for (const line of market.lines) {
      rows.push([
        "linie",
        market.label,
        `over_${line.threshold}`,
        "",
        "",
        number(line.overRate),
        line.count,
        `trafienia ${line.overCount}; under ${number(line.underRate)}%`,
      ]);
    }
  }

  for (const item of analysis.h2h) {
    rows.push([
      "h2h",
      "",
      item.kickoffAt.toISOString(),
      item.homeTeam.name,
      item.awayTeam.name,
      `${item.homeScore ?? ""}:${item.awayScore ?? ""}`,
      "",
      "",
    ]);
  }

  if (analysis.match.referee) {
    rows.push(["sędzia", "", "mecze", "", "", analysis.refereeSummary.count, "", analysis.match.referee.name]);
    rows.push(["sędzia", "kartki", "średnia", "", "", number(analysis.refereeSummary.cards), analysis.refereeSummary.count, ""]);
    rows.push(["sędzia", "faule", "średnia", "", "", number(analysis.refereeSummary.fouls), analysis.refereeSummary.count, ""]);
    rows.push(["sędzia", "rożne", "średnia", "", "", number(analysis.refereeSummary.corners), analysis.refereeSummary.count, ""]);
  }

  for (const line of analysis.customLineRows) {
    rows.push([
      "własna_linia",
      line.statLabel,
      `${line.scope}_${line.threshold}`,
      number(line.analysis.home?.overRate),
      number(line.analysis.away?.overRate),
      number(line.analysis.combined?.overRate),
      line.analysis.combined?.count ?? `${line.analysis.home?.count ?? 0}/${line.analysis.away?.count ?? 0}`,
      line.name,
    ]);
  }

  rows.push(["notatka", "", "", "", "", "", "", analysis.match.analysisNotes[0]?.content ?? ""]);
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  const fileName = safeFileName(`${analysis.match.homeTeam.name}-${analysis.match.awayTeam.name}-analiza.csv`);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

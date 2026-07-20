export type StrategyHealthStatus =
  | "INSUFFICIENT_DATA"
  | "HEALTHY"
  | "WATCH"
  | "AT_RISK"
  | "STOPPED";

export type StrategyHealthSettings = {
  minForwardSample: number;
  maxDrawdownPercent: number;
  maxLossPercent: number;
};

export type StrategyHealthMetricSet = {
  resolvedEntries: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  roi: number | null;
  averageClv: number | null;
  maxDrawdown: number | null;
  profit: number;
  turnover: number;
  financialEntries: number;
};

export type StrategyHealthInput = {
  historical: StrategyHealthMetricSet;
  forward: StrategyHealthMetricSet;
  initialBankroll: number;
  exposureWarnings: number;
  settings: StrategyHealthSettings;
};

export type StrategyConfidenceInterval = {
  lower: number;
  upper: number;
};

export type StrategyHealthEvaluation = {
  status: StrategyHealthStatus;
  score: number | null;
  reason: string;
  reasons: string[];
  sampleProgress: number;
  confidence: "NO_DATA" | "LOW" | "MEDIUM" | "HIGH";
  forwardHitRateInterval: StrategyConfidenceInterval | null;
  historicalHitRateInterval: StrategyConfidenceInterval | null;
  roiDelta: number | null;
  clvDelta: number | null;
  hitRateDelta: number | null;
  drawdownPercent: number | null;
  lossPercent: number | null;
  hardStop: boolean;
};

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentOf(value: number | null, total: number) {
  if (value === null || !Number.isFinite(total) || total <= 0) return null;
  return (value / total) * 100;
}

export function wilsonInterval(input: {
  wins: number;
  total: number;
  z?: number;
}): StrategyConfidenceInterval | null {
  const total = Math.floor(input.total);
  const wins = Math.floor(input.wins);
  if (total <= 0 || wins < 0 || wins > total) return null;

  const z = finite(input.z) ?? 1.96;
  const probability = wins / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const centre = probability + zSquared / (2 * total);
  const margin = z * Math.sqrt(
    (probability * (1 - probability) + zSquared / (4 * total)) / total,
  );

  return {
    lower: round(clamp(((centre - margin) / denominator) * 100, 0, 100)),
    upper: round(clamp(((centre + margin) / denominator) * 100, 0, 100)),
  };
}

function sampleConfidence(resolved: number, minimum: number) {
  if (resolved <= 0) return "NO_DATA" as const;
  if (resolved < minimum) return "LOW" as const;
  if (resolved < Math.max(minimum * 2, 50)) return "MEDIUM" as const;
  return "HIGH" as const;
}

function metricDelta(current: number | null, baseline: number | null) {
  return current === null || baseline === null ? null : current - baseline;
}

function penaltyForNegativeDelta(delta: number | null, thresholds: [number, number, number]) {
  if (delta === null || delta >= thresholds[0]) return 0;
  if (delta >= thresholds[1]) return 8;
  if (delta >= thresholds[2]) return 16;
  return 28;
}

export function evaluateStrategyHealth(
  input: StrategyHealthInput,
): StrategyHealthEvaluation {
  const minimum = Math.max(1, Math.floor(input.settings.minForwardSample));
  const resolved = Math.max(0, Math.floor(input.forward.resolvedEntries));
  const sampleProgress = round(clamp((resolved / minimum) * 100, 0, 100), 0);
  const confidence = sampleConfidence(resolved, minimum);

  const historicalInterval = wilsonInterval({
    wins: input.historical.wins,
    total: input.historical.wins + input.historical.losses,
  });
  const forwardInterval = wilsonInterval({
    wins: input.forward.wins,
    total: input.forward.wins + input.forward.losses,
  });

  const roiDelta = metricDelta(input.forward.roi, input.historical.roi);
  const clvDelta = metricDelta(input.forward.averageClv, input.historical.averageClv);
  const hitRateDelta = metricDelta(input.forward.hitRate, input.historical.hitRate);
  const bankroll = finite(input.initialBankroll);
  const drawdown = finite(input.forward.maxDrawdown);
  const drawdownPercent = bankroll !== null && bankroll > 0
    ? percentOf(drawdown, bankroll)
    : null;
  const forwardProfit = finite(input.forward.profit) ?? 0;
  const lossPercent = bankroll !== null && bankroll > 0
    ? percentOf(Math.max(0, -forwardProfit), bankroll)
    : null;

  const enoughSample = resolved >= minimum;
  const hasFinancialData = input.forward.financialEntries > 0
    && input.forward.roi !== null;
  const drawdownLimit = Math.max(0.01, input.settings.maxDrawdownPercent);
  const lossLimit = Math.max(0.01, input.settings.maxLossPercent);
  const hardStop = enoughSample && (
    (drawdownPercent !== null && drawdownPercent >= drawdownLimit)
    || (lossPercent !== null && lossPercent >= lossLimit)
  );

  if (!enoughSample || !hasFinancialData) {
    const reasons = [
      resolved < minimum
        ? `Za mała próba: ${resolved}/${minimum} rozliczonych sygnałów.`
        : "Brak rozliczeń z kompletem kursu i stawki.",
    ];
    if (input.forward.averageClv === null) {
      reasons.push("CLV nie jest jeszcze dostępne.");
    }
    return {
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: reasons.join(" "),
      reasons,
      sampleProgress,
      confidence,
      forwardHitRateInterval: forwardInterval,
      historicalHitRateInterval: historicalInterval,
      roiDelta,
      clvDelta,
      hitRateDelta,
      drawdownPercent,
      lossPercent,
      hardStop: false,
    };
  }

  let score = 100;
  const reasons: string[] = [];

  const roiPenalty = penaltyForNegativeDelta(roiDelta, [-2, -5, -10]);
  score -= roiPenalty;
  if (roiPenalty > 0) reasons.push("ROI forward jest słabsze od walidacji historycznej.");

  const clvPenalty = penaltyForNegativeDelta(clvDelta, [-1, -3, -6]);
  score -= clvPenalty;
  if (clvPenalty > 0) reasons.push("CLV pogorszyło się względem backtestu.");
  if (input.forward.averageClv !== null && input.forward.averageClv < 0) {
    score -= 12;
    reasons.push("Średnie CLV jest ujemne.");
  } else if (input.forward.averageClv === null) {
    score -= 5;
    reasons.push("Brak CLV dla części sygnałów forward.");
  }

  if (
    input.historical.roi === null
    || input.historical.hitRate === null
    || input.historical.resolvedEntries <= 0
  ) {
    score -= 10;
    reasons.push("Historyczna baza porównawcza jest niepełna.");
  }

  const intervalsSeparated = forwardInterval !== null
    && historicalInterval !== null
    && forwardInterval.upper < historicalInterval.lower;
  if (intervalsSeparated) {
    score -= 24;
    reasons.push("Przedział trafności forward leży poniżej backtestu.");
  } else if (hitRateDelta !== null && hitRateDelta < -8) {
    score -= 10;
    reasons.push("Trafność forward wyraźnie spadła.");
  }

  if (drawdownPercent !== null) {
    const ratio = drawdownPercent / drawdownLimit;
    if (ratio >= 1) {
      score -= 35;
      reasons.push("Przekroczono limit obsunięcia kapitału.");
    } else if (ratio >= 0.75) {
      score -= 18;
      reasons.push("Obsunięcie zbliża się do limitu.");
    } else if (ratio >= 0.5) {
      score -= 8;
    }
  }

  if (lossPercent !== null) {
    const ratio = lossPercent / lossLimit;
    if (ratio >= 1) {
      score -= 35;
      reasons.push("Przekroczono limit łącznej straty.");
    } else if (ratio >= 0.75) {
      score -= 18;
      reasons.push("Łączna strata zbliża się do limitu.");
    } else if (ratio >= 0.5) {
      score -= 8;
    }
  }

  if (input.exposureWarnings > 0) {
    score -= Math.min(10, input.exposureWarnings * 2);
    reasons.push("Portfel zawiera ostrzeżenia ekspozycji.");
  }

  score = Math.round(clamp(score, 0, 100));
  if (hardStop) score = Math.min(score, 35);

  let status: StrategyHealthStatus;
  if (hardStop) {
    status = "STOPPED";
  } else if (
    score < 45
    || intervalsSeparated
    || (
      input.forward.roi !== null
      && input.forward.roi < -10
      && input.forward.averageClv !== null
      && input.forward.averageClv < 0
    )
  ) {
    status = "AT_RISK";
  } else if (score < 75 || reasons.length > 0) {
    status = "WATCH";
  } else {
    status = "HEALTHY";
  }

  if (!reasons.length) reasons.push("Wyniki forward są spójne z walidacją historyczną.");

  return {
    status,
    score,
    reason: reasons.join(" "),
    reasons,
    sampleProgress,
    confidence,
    forwardHitRateInterval: forwardInterval,
    historicalHitRateInterval: historicalInterval,
    roiDelta,
    clvDelta,
    hitRateDelta,
    drawdownPercent,
    lossPercent,
    hardStop,
  };
}

export function strategyHealthStatusLabel(status: StrategyHealthStatus | string) {
  if (status === "HEALTHY") return "zdrowa";
  if (status === "WATCH") return "obserwacja";
  if (status === "AT_RISK") return "zagrożona";
  if (status === "STOPPED") return "limit ryzyka";
  return "za mała próba";
}

export function strategyHealthStatusClass(status: StrategyHealthStatus | string) {
  if (status === "HEALTHY") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (status === "WATCH") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }
  if (status === "AT_RISK" || status === "STOPPED") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

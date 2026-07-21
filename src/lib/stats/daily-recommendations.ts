export type DailyRecommendationPriority = "TOP" | "VALUE" | "WATCH" | "BLOCKED";

export type DailyStrategySupport = {
  strategyVersionId: string;
  strategyName: string;
  version: number;
  operationalStatus: string;
  healthStatus: string;
  healthScore: number | null;
  exposureStatus: string;
  recommendedStake: number | null;
  stakeMode: string;
};

export type DailyRecommendationInput = {
  id: string;
  matchId: string;
  kickoffAt: Date;
  status: string;
  source: string;
  odds: number | null;
  modelProbability: number | null;
  expectedValue: number | null;
  modelSample: number | null;
  modelCoverage: number | null;
  modelConfidence: string | null;
  marketStatus: string | null;
  evidenceStatus: string | null;
  backtestSignals: number | null;
  backtestHitRate: number | null;
  edgeBacktestSignals: number | null;
  edgeBacktestHitRate: number | null;
  conflict: boolean;
  strategies: DailyStrategySupport[];
};

export type DailyRecommendationEvaluation = {
  score: number;
  priority: DailyRecommendationPriority;
  reasons: string[];
  warnings: string[];
  blockers: string[];
  bestStrategy: DailyStrategySupport | null;
  hasSafeStrategy: boolean;
  hasExposureWarning: boolean;
  missingMarketData: boolean;
};

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function healthRank(status: string) {
  if (status === "HEALTHY") return 0;
  if (status === "WATCH") return 1;
  if (status === "INSUFFICIENT_DATA") return 2;
  if (status === "AT_RISK") return 3;
  if (status === "STOPPED") return 4;
  return 5;
}

function operationalRank(status: string) {
  if (status === "APPROVED") return 0;
  if (status === "FORWARD_TEST") return 1;
  return 2;
}

function strategyRank(item: DailyStrategySupport) {
  const exposure = item.exposureStatus === "OK" ? 0 : 1;
  return healthRank(item.healthStatus) * 1000
    + exposure * 100
    + operationalRank(item.operationalStatus) * 10
    - (item.healthScore ?? -1) / 100;
}

export function selectBestStrategySupport(
  strategies: DailyStrategySupport[],
): DailyStrategySupport | null {
  return [...strategies].sort((left, right) => strategyRank(left) - strategyRank(right))[0] ?? null;
}

function bestBacktest(input: DailyRecommendationInput) {
  const candidates = [
    {
      signals: finite(input.backtestSignals),
      hitRate: finite(input.backtestHitRate),
    },
    {
      signals: finite(input.edgeBacktestSignals),
      hitRate: finite(input.edgeBacktestHitRate),
    },
  ].flatMap((item) => {
    if (item.signals === null || item.hitRate === null) return [];
    return [{
      signals: Math.max(0, Math.floor(item.signals)),
      hitRate: item.hitRate,
    }];
  });

  return candidates.sort((left, right) => {
    const sample = right.signals - left.signals;
    return sample !== 0 ? sample : right.hitRate - left.hitRate;
  })[0] ?? null;
}

export function evaluateDailyRecommendation(
  input: DailyRecommendationInput,
): DailyRecommendationEvaluation {
  let score = 20;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const odds = finite(input.odds);
  const probability = finite(input.modelProbability);
  const ev = finite(input.expectedValue);
  const sample = finite(input.modelSample);
  const coverage = finite(input.modelCoverage);
  const bestStrategy = selectBestStrategySupport(input.strategies);
  const safeStrategies = input.strategies.filter(
    (item) =>
      item.exposureStatus === "OK"
      && (item.healthStatus === "HEALTHY" || item.healthStatus === "WATCH"),
  );
  const hasSafeStrategy = safeStrategies.length > 0;
  const hasExposureWarning = input.strategies.some((item) => item.exposureStatus !== "OK");
  const onlyRiskStrategies = input.strategies.length > 0
    && input.strategies.every(
      (item) => item.healthStatus === "AT_RISK" || item.healthStatus === "STOPPED",
    );
  const allStrategiesBlockedByExposure = input.strategies.length > 0
    && input.strategies.every((item) => item.exposureStatus !== "OK");
  const missingMarketData = odds === null || ev === null || probability === null;

  if (input.conflict) {
    blockers.push("Sprzeczne kierunki dla tego samego meczu, rynku i linii.");
    score -= 35;
  }

  if (input.marketStatus === "POTENTIAL_VALUE") {
    score += 24;
    reasons.push("Warsztat rynku wskazuje potencjalne value.");
  } else if (input.marketStatus === "WATCH") {
    score += 10;
    warnings.push("Warsztat rynku wskazuje jedynie obserwację.");
  } else if (input.marketStatus === "NO_EDGE") {
    score -= 25;
    blockers.push("Warsztat rynku nie wykazuje przewagi.");
  } else if (input.marketStatus === "INSUFFICIENT_DATA") {
    score -= 12;
    warnings.push("Model rynku ma za mało danych.");
  } else if (input.marketStatus === "NO_ODDS") {
    warnings.push("Brak kursu do oceny value.");
  }

  if (ev !== null) {
    if (ev >= 10) {
      score += 20;
      reasons.push("EV wynosi co najmniej 10%.");
    } else if (ev >= 5) {
      score += 15;
      reasons.push("EV wynosi co najmniej 5%.");
    } else if (ev >= 2) {
      score += 8;
      warnings.push("EV jest dodatnie, ale umiarkowane.");
    } else if (ev > 0) {
      score += 3;
      warnings.push("EV jest minimalnie dodatnie.");
    } else {
      score -= 18;
      blockers.push("EV nie jest dodatnie.");
    }
  } else {
    warnings.push("Brak EV.");
  }

  if (probability !== null) {
    if (probability >= 60) score += 14;
    else if (probability >= 55) score += 10;
    else if (probability >= 50) score += 5;
  }

  if (odds !== null && odds > 1) score += 4;
  else warnings.push("Brak prawidłowego kursu.");

  if (input.modelConfidence === "STRONG") score += 12;
  else if (input.modelConfidence === "MEDIUM") score += 9;
  else if (input.modelConfidence === "LIMITED") score += 4;
  else if (input.modelConfidence === "WEAK") {
    score -= 5;
    warnings.push("Wiarygodność modelu jest słaba.");
  } else if (input.modelConfidence === "NO_DATA") {
    score -= 10;
    warnings.push("Brak wiarygodności modelu.");
  }

  if (sample !== null) {
    if (sample >= 20) score += 6;
    else if (sample >= 10) score += 4;
    else if (sample < 5) score -= 4;
  }
  if (coverage !== null) {
    if (coverage >= 90) score += 6;
    else if (coverage >= 70) score += 4;
    else if (coverage < 50) {
      score -= 5;
      warnings.push("Pokrycie danych modelu jest niskie.");
    }
  }

  if (input.evidenceStatus === "SUPPORTED") {
    score += 12;
    reasons.push("Sygnał jest wsparty historią skanera.");
  } else if (input.evidenceStatus === "WATCH") {
    score += 5;
  } else if (input.evidenceStatus === "WEAK") {
    score -= 20;
    blockers.push("Historyczny backtest sygnału jest słaby.");
  } else if (input.evidenceStatus === "POTENTIAL_VALUE") {
    score += 8;
  }

  const backtest = bestBacktest(input);
  if (backtest && backtest.hitRate !== null) {
    if (backtest.signals >= 20 && backtest.hitRate >= 55) score += 8;
    else if (backtest.signals >= 10 && backtest.hitRate >= 50) score += 4;
    else if (backtest.signals >= 10 && backtest.hitRate < 50) {
      score -= 7;
      warnings.push("Największa dostępna próba backtestu ma trafność poniżej 50%.");
    }
  }

  if (bestStrategy) {
    if (bestStrategy.healthStatus === "HEALTHY" && bestStrategy.exposureStatus === "OK") {
      score += 16;
      reasons.push(`Zdrowa strategia wspiera sygnał: ${bestStrategy.strategyName}.`);
    } else if (bestStrategy.healthStatus === "WATCH" && bestStrategy.exposureStatus === "OK") {
      score += 8;
      warnings.push(`Strategia ${bestStrategy.strategyName} jest w obserwacji.`);
    } else if (bestStrategy.healthStatus === "INSUFFICIENT_DATA") {
      score += 2;
      warnings.push(`Strategia ${bestStrategy.strategyName} ma za małą próbę forward.`);
    }
  } else {
    warnings.push("Brak dopasowanej aktywnej strategii.");
  }

  if (hasExposureWarning) {
    score -= 10;
    warnings.push("Co najmniej jedna strategia zgłasza ostrzeżenie ekspozycji.");
  }
  if (allStrategiesBlockedByExposure) {
    score -= 15;
    blockers.push("Wszystkie dopasowane strategie przekraczają limit ekspozycji lub nie mają stawki.");
  }
  if (onlyRiskStrategies) {
    score -= 25;
    blockers.push("Sygnał wspierają wyłącznie strategie zagrożone lub zatrzymane limitem ryzyka.");
  }

  score = Math.round(clamp(score, 0, 100));

  const hardBlocked = blockers.length > 0;
  const topReady = !hardBlocked
    && score >= 75
    && input.marketStatus === "POTENTIAL_VALUE"
    && ev !== null
    && ev >= 5
    && odds !== null
    && probability !== null
    && hasSafeStrategy;
  const valueReady = !hardBlocked
    && score >= 58
    && ev !== null
    && ev >= 2
    && odds !== null
    && probability !== null;

  const priority: DailyRecommendationPriority = hardBlocked
    ? "BLOCKED"
    : topReady
      ? "TOP"
      : valueReady
        ? "VALUE"
        : "WATCH";

  return {
    score,
    priority,
    reasons,
    warnings,
    blockers,
    bestStrategy,
    hasSafeStrategy,
    hasExposureWarning,
    missingMarketData,
  };
}

export function dailyRecommendationPriorityLabel(value: DailyRecommendationPriority) {
  if (value === "TOP") return "Priorytet A";
  if (value === "VALUE") return "Priorytet B";
  if (value === "BLOCKED") return "Odrzuć";
  return "Obserwuj";
}

export function dailyRecommendationPriorityClass(value: DailyRecommendationPriority) {
  if (value === "TOP") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (value === "VALUE") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (value === "BLOCKED") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

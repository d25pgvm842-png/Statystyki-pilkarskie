export type AnalysisDecisionTiming = "PRE_MATCH" | "LATE" | "UNKNOWN";

export function decisionAtForPick(input: {
  quoteCapturedAt: Date | null;
  createdAt: Date;
}) {
  return input.quoteCapturedAt ?? input.createdAt;
}

export function classifyDecisionTiming(input: {
  decisionAt: Date;
  kickoffAt: Date;
}): Exclude<AnalysisDecisionTiming, "UNKNOWN"> {
  return input.decisionAt.getTime() < input.kickoffAt.getTime()
    ? "PRE_MATCH"
    : "LATE";
}

export function isHistoricalDecisionEligible(input: {
  decisionTiming: AnalysisDecisionTiming;
  decisionAt: Date;
  kickoffAt: Date;
}) {
  return input.decisionTiming === "PRE_MATCH"
    && input.decisionAt.getTime() < input.kickoffAt.getTime();
}

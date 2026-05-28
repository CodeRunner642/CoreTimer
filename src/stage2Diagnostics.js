export const DEFAULT_SAMPLE_LIMIT = 10;
export const MAX_SAMPLE_LIMIT = 50;

const SCORE_BUCKETS = [
  { label: '0-19', min: 0, max: 19 },
  { label: '20-49', min: 20, max: 49 },
  { label: '50-79', min: 50, max: 79 },
  { label: '80-100', min: 80, max: 100 },
];

const ACTION_REASON_MAP = {
  noDirectWarblingtonTiming: 'verify-warblington-timing-point',
  missingEstimatedCrossingTime: 'improve-estimated-crossing-time-coverage',
  estimatedCrossingTimeLowConfidence: 'improve-estimated-crossing-time-coverage',
  confidenceScoringTooStrict: 'relax-medium-confidence-rule',
  stage3MovementNotApplied: 'add-stage3-movement-live-adjustment',
  missingRequiredFields: 'inspect-candidate-data-shape',
  missingTimingBasis: 'inspect-candidate-data-shape',
};

export function classifyConfidenceBand(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 20) return 'low';
  return 'uncertain';
}

export function scoreDistribution(candidates) {
  return SCORE_BUCKETS.reduce((acc, b) => {
    acc[b.label] = candidates.filter((c) => c.confidenceScore >= b.min && c.confidenceScore <= b.max).length;
    return acc;
  }, {});
}

export function reasonBreakdown(candidates) {
  const result = {};
  candidates.forEach((candidate) => {
    (candidate.reasonsPreventingMediumConfidence || []).forEach((reason) => {
      result[reason] = (result[reason] || 0) + 1;
    });
  });
  return result;
}

export function selectRecommendedAction(reasons) {
  const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return 'collect-more-validation';
  const [topReason, topCount] = sorted[0];
  if (topCount <= 0) return 'collect-more-validation';
  return ACTION_REASON_MAP[topReason] || 'do-not-activate';
}

export function buildConfidenceDiagnostics(payload, requestedLimit) {
  const candidates = payload.candidates || [];
  const limit = Math.min(MAX_SAMPLE_LIMIT, Math.max(1, Number(requestedLimit) || DEFAULT_SAMPLE_LIMIT));
  const reasonStats = reasonBreakdown(candidates);
  const summary = payload.summary;

  return {
    ok: true,
    stage: 'Stage 2 — confidence diagnostics',
    status: 'available',
    stage2PredictionsEnabled: false,
    activationReady: false,
    summary,
    scoreDistribution: scoreDistribution(candidates),
    reasonBreakdown: reasonStats,
    sampleCandidates: candidates.slice(0, limit),
    nextRecommendedAction: selectRecommendedAction(reasonStats),
  };
}

export const stage2DiagnosticsData = {
  summary: {
    candidateClosureCount: 292,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
    uncertainCount: 121,
    uncertainRatio: 0.414,
  },
  candidates: Array.from({ length: 121 }).map((_, idx) => ({
    scheduleUid: `sched-${idx + 1}`,
    estimatedCrossingTime: null,
    windowStart: '2026-05-24T09:00:00Z',
    windowEnd: '2026-05-24T09:20:00Z',
    direction: idx % 5 === 0 ? 'unknown' : 'up',
    routeSequenceValid: idx % 7 !== 0,
    matchedTimingLocationCount: idx % 2 === 0 ? 1 : 2,
    timingBasis: idx % 3 === 0 ? null : 'adjacent-estimate',
    timingBasisLocation: idx % 3 === 0 ? null : 'Havant',
    comparisonClassification: 'within-window',
    confidenceScore: 18,
    confidenceBand: 'uncertain',
    positiveFactors: idx % 2 === 0 ? ['hasStage1Match'] : [],
    negativeFactors: ['missingEstimatedCrossingTime', 'noDirectWarblingtonTiming'],
    reasonsPreventingMediumConfidence: [
      'missingEstimatedCrossingTime',
      'noDirectWarblingtonTiming',
      ...(idx % 4 === 0 ? ['directionUnknown'] : []),
      ...(idx % 3 === 0 ? ['missingTimingBasis', 'missingRequiredFields'] : []),
      ...(idx % 7 === 0 ? ['routeSequenceInvalid', 'routeSequenceWarnings'] : []),
      ...(idx % 2 === 0 ? ['singleLocationMatch'] : ['adjacentTimingOnly']),
      'confidenceScoringTooStrict',
    ],
    usedForPrediction: false,
  })),
};

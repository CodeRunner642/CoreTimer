export const DEFAULT_SAMPLE_LIMIT = 10;
export const MAX_SAMPLE_LIMIT = 50;

const SCORE_BUCKETS = [
  { label: '0-19', min: 0, max: 19 },
  { label: '20-49', min: 20, max: 49 },
  { label: '50-79', min: 50, max: 79 },
  { label: '80-100', min: 80, max: 100 },
];

const REQUIRED_FIELDS = [
  'scheduleUid',
  'direction',
  'routeSequenceValid',
  'estimatedCrossingTime',
  'windowStart',
  'windowEnd',
  'timingBasis',
  'timingBasisType',
  'usedForPrediction',
];

const DATA_COMPLETENESS_REASONS = new Set(['missingEstimatedCrossingTime', 'missingTimingBasis', 'missingRequiredFields']);
const ACTIVATION_BLOCKER_REASONS = new Set(['stage3MovementNotApplied', 'plannedOnlyNotLiveAdjusted']);
const QUALITY_BLOCKER_REASONS = new Set([
  'noDirectWarblingtonTiming',
  'noStage1Match',
  'directionUnknown',
  'routeSequenceInvalid',
  'routeSequenceWarnings',
  'singleLocationMatch',
  'adjacentTimingOnly',
  'confidenceScoringTooStrict',
]);

const ACTION_REASON_MAP = {
  noDirectWarblingtonTiming: 'verify-warblington-timing-point',
  missingEstimatedCrossingTime: 'improve-estimated-crossing-time-coverage',
  estimatedCrossingTimeLowConfidence: 'improve-estimated-crossing-time-coverage',
  confidenceScoringTooStrict: 'relax-medium-confidence-rule',
  stage3MovementNotApplied: 'add-stage3-movement-live-adjustment',
  missingRequiredFields: 'inspect-candidate-data-shape',
  missingTimingBasis: 'inspect-candidate-data-shape',
};

function deriveEstimatedCrossingTime(candidate) {
  return candidate.estimatedCrossingTime || candidate.scheduledPass || candidate.scheduledDeparture || candidate.scheduledArrival || null;
}

function deriveTimingBasis(candidate) {
  const timingBasis = candidate.timingBasis || (candidate.timingBasisLocation || candidate.timingBasisTiploc ? 'adjacent-estimate' : null);
  const timingBasisType = candidate.timingBasisType || (timingBasis ? 'planned' : null);
  return { timingBasis, timingBasisType };
}

export function enrichCandidateClosure(candidate) {
  const estimatedCrossingTime = deriveEstimatedCrossingTime(candidate);
  const { timingBasis, timingBasisType } = deriveTimingBasis(candidate);
  return {
    ...candidate,
    estimatedCrossingTime,
    timingBasis,
    timingBasisType,
    routeSequenceValid: candidate.routeSequenceValid ?? false,
    matchedTimingLocationCount: candidate.matchedTimingLocationCount ?? 0,
    validationWarnings: candidate.validationWarnings || [],
    usedForPrediction: false,
  };
}

function hasTimingBasisLocation(candidate) {
  return Boolean(candidate.timingBasisLocation || candidate.timingBasisTiploc);
}

function countMissingFields(candidates) {
  const breakdown = {
    estimatedCrossingTime: 0,
    timingBasis: 0,
    timingBasisType: 0,
    windowStart: 0,
    windowEnd: 0,
    direction: 0,
  };

  candidates.forEach((c) => {
    if (!c.estimatedCrossingTime) breakdown.estimatedCrossingTime += 1;
    if (!c.timingBasis) breakdown.timingBasis += 1;
    if (!c.timingBasisType) breakdown.timingBasisType += 1;
    if (!c.windowStart) breakdown.windowStart += 1;
    if (!c.windowEnd) breakdown.windowEnd += 1;
    if (!c.direction || c.direction === 'unknown') breakdown.direction += 1;
  });

  return breakdown;
}

function hasMissingRequiredFields(candidate) {
  const missingBase = REQUIRED_FIELDS.some((field) => candidate[field] === null || candidate[field] === undefined || candidate[field] === '');
  return missingBase || !hasTimingBasisLocation(candidate);
}

function evaluateConfidenceBand(candidate) {
  const hasCoreStructure = Boolean(candidate.estimatedCrossingTime) && candidate.direction !== 'unknown' && candidate.routeSequenceValid;
  const strongPlanned = hasCoreStructure && candidate.matchedTimingLocationCount >= 2;
  const activationBlocked = candidate.reasonsPreventingMediumConfidence?.some((r) => ACTIVATION_BLOCKER_REASONS.has(r));
  const qualityBlocked = candidate.reasonsPreventingMediumConfidence?.includes('noDirectWarblingtonTiming');

  if (!hasCoreStructure) return 'uncertain';
  if (strongPlanned && !activationBlocked && !qualityBlocked) return 'medium';
  if (strongPlanned) return 'medium-preview';
  return 'low';
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

function partitionReasons(reasons) {
  const partitions = { dataCompletenessBlockers: {}, confidenceQualityBlockers: {}, activationBlockers: {} };
  Object.entries(reasons).forEach(([reason, count]) => {
    if (DATA_COMPLETENESS_REASONS.has(reason)) partitions.dataCompletenessBlockers[reason] = count;
    else if (ACTIVATION_BLOCKER_REASONS.has(reason)) partitions.activationBlockers[reason] = count;
    else if (QUALITY_BLOCKER_REASONS.has(reason)) partitions.confidenceQualityBlockers[reason] = count;
  });
  return partitions;
}

export function selectRecommendedAction(reasons) {
  const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return 'collect-more-validation';
  const [topReason, topCount] = sorted[0];
  if (topCount <= 0) return 'collect-more-validation';
  return ACTION_REASON_MAP[topReason] || 'do-not-activate';
}

export function buildConfidenceDiagnostics(payload, requestedLimit) {
  const rawCandidates = payload.candidates || [];
  const candidates = rawCandidates.map(enrichCandidateClosure).map((c) => ({ ...c, confidenceBand: evaluateConfidenceBand(c) }));
  const limit = Math.min(MAX_SAMPLE_LIMIT, Math.max(1, Number(requestedLimit) || DEFAULT_SAMPLE_LIMIT));
  const reasonStats = reasonBreakdown(candidates);
  const summary = payload.summary;
  const missingFieldBreakdown = countMissingFields(candidates);
  const missingRequiredFieldsCount = candidates.filter(hasMissingRequiredFields).length;

  return {
    ok: true,
    stage: 'Stage 2 — confidence diagnostics',
    status: 'available',
    stage2PredictionsEnabled: false,
    activationReady: false,
    summary,
    sourceInfo: {
      candidateSource: payload.candidateSource || 'candidate-closures-enriched',
      generatedAt: payload.generatedAt || new Date().toISOString(),
      candidateCountFromSource: rawCandidates.length,
      enrichedCandidateCount: candidates.length - missingRequiredFieldsCount,
      missingRequiredFieldsCount,
    },
    scoreDistribution: scoreDistribution(candidates),
    reasonBreakdown: reasonStats,
    reasonBreakdownByCategory: partitionReasons(reasonStats),
    missingFieldBreakdown,
    sampleCandidates: candidates.slice(0, limit),
    nextRecommendedAction: selectRecommendedAction(reasonStats),
  };
}

export const stage2DiagnosticsData = {
  candidateSource: '/api/debug/stage2/candidate-closures',
  generatedAt: '2026-05-28T00:00:00.000Z',
  summary: {
    candidateClosureCount: 292,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 171,
    uncertainCount: 121,
    uncertainRatio: 0.414,
  },
  candidates: Array.from({ length: 121 }).map((_, idx) => ({
    scheduleUid: `sched-${idx + 1}`,
    scheduledPass: idx % 3 === 0 ? null : `2026-05-24T09:${String((idx % 50) + 10).padStart(2, '0')}:00Z`,
    scheduledDeparture: idx % 3 === 0 ? `2026-05-24T09:${String((idx % 50) + 11).padStart(2, '0')}:00Z` : null,
    windowStart: '2026-05-24T09:00:00Z',
    windowEnd: '2026-05-24T09:20:00Z',
    direction: idx % 5 === 0 ? 'unknown' : 'up',
    routeSequenceValid: idx % 7 !== 0,
    matchedTimingLocationCount: idx % 2 === 0 ? 1 : 2,
    timingBasis: idx % 4 === 0 ? null : 'adjacent-estimate',
    timingBasisType: idx % 4 === 0 ? null : 'planned',
    timingBasisLocation: idx % 4 === 0 ? null : 'Havant',
    comparisonClassification: 'within-window',
    confidenceScore: idx % 2 === 0 ? 38 : 52,
    positiveFactors: idx % 2 === 0 ? ['hasStage1Match'] : ['hasStage1Match', 'multiTimingMatch'],
    negativeFactors: ['noDirectWarblingtonTiming'],
    reasonsPreventingMediumConfidence: [
      ...(idx % 4 === 0 ? ['missingTimingBasis', 'missingRequiredFields'] : []),
      ...(idx % 5 === 0 ? ['directionUnknown'] : []),
      ...(idx % 7 === 0 ? ['routeSequenceInvalid', 'routeSequenceWarnings'] : []),
      ...(idx % 2 === 0 ? ['singleLocationMatch'] : []),
      'stage3MovementNotApplied',
      'plannedOnlyNotLiveAdjusted',
      'noDirectWarblingtonTiming',
    ],
    validationWarnings: idx % 7 === 0 ? ['route-order-warning'] : [],
  })),
};

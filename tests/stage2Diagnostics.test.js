import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfidenceDiagnostics } from '../src/stage2Diagnostics.js';

const payload = {
  candidateSource: '/api/debug/stage2/candidate-closures',
  generatedAt: '2026-05-28T00:00:00.000Z',
  summary: {
    candidateClosureCount: 4,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 2,
    uncertainCount: 2,
    uncertainRatio: 0.5,
  },
  candidates: [
    { scheduleUid: 'a', scheduledPass: '2026-05-28T09:10:00Z', windowStart: '2026-05-28T09:00:00Z', windowEnd: '2026-05-28T09:20:00Z', direction: 'up', routeSequenceValid: true, matchedTimingLocationCount: 2, timingBasisLocation: 'Havant', reasonsPreventingMediumConfidence: ['plannedOnlyNotLiveAdjusted', 'stage3MovementNotApplied'], confidenceScore: 55 },
    { scheduleUid: 'b', scheduledDeparture: '2026-05-28T09:12:00Z', windowStart: '2026-05-28T09:00:00Z', windowEnd: '2026-05-28T09:20:00Z', direction: 'up', routeSequenceValid: true, matchedTimingLocationCount: 2, timingBasisLocation: 'Bedhampton', reasonsPreventingMediumConfidence: ['noDirectWarblingtonTiming'], confidenceScore: 52 },
    { scheduleUid: 'c', windowStart: '2026-05-28T09:00:00Z', windowEnd: '2026-05-28T09:20:00Z', direction: 'unknown', routeSequenceValid: false, matchedTimingLocationCount: 1, reasonsPreventingMediumConfidence: ['missingEstimatedCrossingTime', 'missingRequiredFields'], confidenceScore: 12 },
    { scheduleUid: 'd', scheduledArrival: '2026-05-28T09:15:00Z', windowStart: '2026-05-28T09:00:00Z', windowEnd: '2026-05-28T09:20:00Z', direction: 'up', routeSequenceValid: true, matchedTimingLocationCount: 1, timingBasis: 'adjacent-estimate', timingBasisType: 'planned', timingBasisTiploc: 'HVT', reasonsPreventingMediumConfidence: ['stage3MovementNotApplied'], confidenceScore: 35 },
  ],
};

test('confidence diagnostics uses enriched candidate closure data', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.sampleCandidates[0].estimatedCrossingTime, '2026-05-28T09:10:00Z');
  assert.equal(data.sampleCandidates[1].timingBasis, 'adjacent-estimate');
  assert.equal(data.sampleCandidates.every((c) => c.usedForPrediction === false), true);
});

test('sourceInfo and missingFieldBreakdown are returned', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.sourceInfo.candidateSource, '/api/debug/stage2/candidate-closures');
  assert.equal(typeof data.sourceInfo.generatedAt, 'string');
  assert.equal(data.missingFieldBreakdown.estimatedCrossingTime, 1);
});

test('activation and quality blockers do not force structurally strong candidates to uncertain', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.sampleCandidates[0].confidenceBand, 'medium-preview');
  assert.equal(data.sampleCandidates[1].confidenceBand, 'medium-preview');
  assert.equal(data.reasonBreakdownByCategory.activationBlockers.stage3MovementNotApplied, 2);
});

test('stage2 remains disabled, activation remains false, live estimate behavior unchanged guard', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.stage2PredictionsEnabled, false);
  assert.equal(data.activationReady, false);
  assert.equal(data.sampleCandidates.some((candidate) => candidate.usedForPrediction), false);
});

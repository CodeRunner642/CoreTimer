import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfidenceDiagnostics } from '../src/stage2Diagnostics.js';

const payload = {
  summary: {
    candidateClosureCount: 3,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
    uncertainCount: 3,
    uncertainRatio: 1,
  },
  candidates: [
    { confidenceScore: 18, reasonsPreventingMediumConfidence: ['missingEstimatedCrossingTime', 'noDirectWarblingtonTiming'], positiveFactors: ['hasStage1Match'], negativeFactors: ['missingEstimatedCrossingTime'], usedForPrediction: false },
    { confidenceScore: 12, reasonsPreventingMediumConfidence: ['missingEstimatedCrossingTime', 'missingRequiredFields'], positiveFactors: [], negativeFactors: ['missingRequiredFields'], usedForPrediction: false },
    { confidenceScore: 19, reasonsPreventingMediumConfidence: ['confidenceScoringTooStrict'], positiveFactors: ['timingWindowMatch'], negativeFactors: ['confidenceScoringTooStrict'], usedForPrediction: false },
  ],
};

test('confidence diagnostics returns reason breakdown and score distribution', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.reasonBreakdown.missingEstimatedCrossingTime, 2);
  assert.deepEqual(data.scoreDistribution, { '0-19': 3, '20-49': 0, '50-79': 0, '80-100': 0 });
});

test('candidates can contribute to multiple reason buckets', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.reasonBreakdown.noDirectWarblingtonTiming, 1);
  assert.equal(data.reasonBreakdown.missingEstimatedCrossingTime, 2);
});

test('sample candidate includes positive and negative factors', () => {
  const data = buildConfidenceDiagnostics(payload, 1);
  assert.ok(Array.isArray(data.sampleCandidates[0].positiveFactors));
  assert.ok(Array.isArray(data.sampleCandidates[0].negativeFactors));
});

test('nextRecommendedAction is based on blocker reasons', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.nextRecommendedAction, 'improve-estimated-crossing-time-coverage');
});

test('stage 2 remains disabled and activation readiness false and usedForPrediction false', () => {
  const data = buildConfidenceDiagnostics(payload, 10);
  assert.equal(data.stage2PredictionsEnabled, false);
  assert.equal(data.activationReady, false);
  assert.equal(data.sampleCandidates.some((candidate) => candidate.usedForPrediction), false);
});

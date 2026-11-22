import { describe, expect, it } from 'vitest';
import { QualityEstimator, classifyQualityLevel, estimateMos, pickWorstQuality } from './phone-quality';

function makeReport(opts: {
  packetsReceived?: number;
  packetsLost?: number;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  rttSec?: number;
  includeInbound?: boolean;
}) {
  const entries: Record<string, unknown>[] = [];
  if (opts.includeInbound !== false) {
    entries.push({
      type: 'inbound-rtp',
      kind: 'audio',
      packetsReceived: opts.packetsReceived ?? 0,
      packetsLost: opts.packetsLost ?? 0,
      jitterBufferDelay: opts.jitterBufferDelay ?? 0,
      jitterBufferEmittedCount: opts.jitterBufferEmittedCount ?? 0,
    });
  }
  entries.push({
    type: 'candidate-pair',
    nominated: true,
    currentRoundTripTime: opts.rttSec ?? 0.04,
  });
  return entries;
}

describe('phone-quality', () => {
  it('returns null when there are no packets or no inbound audio stats', () => {
    const estimator = new QualityEstimator();
    expect(estimator.sample([])).toBeNull();
    expect(estimator.sample(makeReport({ includeInbound: false }))).toBeNull();
    expect(estimator.sample(makeReport({ packetsReceived: 0, packetsLost: 0 }))).toBeNull();
  });

  it('classifies loss thresholds at 0.5%, 2%, and 6%', () => {
    expect(classifyQualityLevel(null)).toBe('measuring');
    expect(classifyQualityLevel(0.5)).toBe('good');
    expect(classifyQualityLevel(2)).toBe('fair');
    expect(classifyQualityLevel(6)).toBe('poor');

    const goodEst = new QualityEstimator();
    expect(goodEst.sample(makeReport({ packetsReceived: 199, packetsLost: 1 }))?.level).toBe('good');

    const fairEst = new QualityEstimator();
    expect(fairEst.sample(makeReport({ packetsReceived: 196, packetsLost: 4 }))?.level).toBe('fair');

    const poorEst = new QualityEstimator();
    expect(poorEst.sample(makeReport({ packetsReceived: 188, packetsLost: 12 }))?.level).toBe('poor');
  });

  it('applies exponential smoothing with weight 1/4 across intervals', () => {
    const estimator = new QualityEstimator();

    // Sample 1: 199 received, 1 lost -> 0.5% loss
    const first = estimator.sample(
      makeReport({
        packetsReceived: 199,
        packetsLost: 1,
        jitterBufferDelay: 2,
        jitterBufferEmittedCount: 200,
        rttSec: 0.04,
      }),
    );
    expect(first).not.toBeNull();
    expect(first?.lossPct).toBe(0.5);

    // Sample 2: +95 received, +5 lost -> 5% instantaneous loss
    // Smoothed = 0.5 * 0.75 + 5 * 0.25 = 1.625 -> rounded 1.63%
    const second = estimator.sample(
      makeReport({
        packetsReceived: 294,
        packetsLost: 6,
        jitterBufferDelay: 3,
        jitterBufferEmittedCount: 300,
        rttSec: 0.04,
      }),
    );
    expect(second?.lossPct).toBe(1.63);
    expect(second?.level).toBe('fair');
  });

  it('keeps MOS bounded between 1 and 4.5', () => {
    const clean = estimateMos(0, 0, 0);
    const degraded = estimateMos(80, 300, 1500);
    expect(clean).toBeGreaterThanOrEqual(1);
    expect(clean).toBeLessThanOrEqual(4.5);
    expect(degraded).toBe(1);
  });

  it('picks the worst quality sample across conference legs', () => {
    const worst = pickWorstQuality([
      null,
      { level: 'good', lossPct: 0.2, jitterMs: 5, rttMs: 20, mos: 4.3 },
      { level: 'poor', lossPct: 6, jitterMs: 25, rttMs: 120, mos: 2.1 },
      { level: 'fair', lossPct: 2, jitterMs: 15, rttMs: 60, mos: 3.4 },
    ]);
    expect(worst?.level).toBe('poor');
  });
});

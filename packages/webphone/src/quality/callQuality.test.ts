import { describe, expect, it } from 'vitest';
import {
  callQualityHue,
  diffCallQuality,
  estimateMos,
  smoothCallQuality,
  type CallQualityCounters,
} from './callQuality';

function counters(over: Partial<CallQualityCounters> = {}): CallQualityCounters {
  return {
    packetsReceived: 0,
    packetsLost: 0,
    jitterBufferDelay: 0,
    jitterBufferEmittedCount: 0,
    rttMs: 0,
    at: 0,
    ...over,
  };
}

describe('diffCallQuality', () => {
  // The counters are cumulative. Reading them raw reports the average since the
  // call began, which is why every number the UI shows comes from a difference.
  it('measures the interval, not the call so far', () => {
    const previous = counters({ packetsReceived: 10_000, packetsLost: 500 });
    const current = counters({ packetsReceived: 10_099, packetsLost: 501 });

    const sample = diffCallQuality(previous, current);

    // 1 lost of 100 in this window, despite 500 of 10_500 over the call.
    expect(sample?.lossPct).toBeCloseTo(1, 5);
  });

  // Nothing arriving is not a perfect connection. A held call, a stalled
  // network and a finished call all produce this, and reporting 0% would paint
  // every one of them green.
  it('reports nothing rather than zero loss when no packets moved', () => {
    const still = counters({ packetsReceived: 5_000, packetsLost: 10 });

    expect(diffCallQuality(still, { ...still, at: 3_000 })).toBeNull();
  });

  it('converts the jitter buffer total into a per-packet wait', () => {
    const previous = counters();
    const current = counters({
      packetsReceived: 150,
      jitterBufferDelay: 6,
      jitterBufferEmittedCount: 150,
    });

    // 6 seconds of accumulated delay across 150 packets is 40ms each.
    expect(diffCallQuality(previous, current)?.jitterBufferMs).toBeCloseTo(40, 5);
  });

  // A counter that goes backwards is a renegotiated stream, not negative loss.
  it('never reports negative loss when a counter resets', () => {
    const previous = counters({ packetsReceived: 1_000, packetsLost: 90 });
    const current = counters({ packetsReceived: 1_100, packetsLost: 10 });

    expect(diffCallQuality(previous, current)?.lossPct).toBe(0);
  });
});

describe('callQualityHue', () => {
  it('runs green to red across the loss range without stopping anywhere else', () => {
    expect(callQualityHue(0)).toBe(120);
    expect(callQualityHue(8)).toBe(0);
  });

  // Green, yellow, orange, red is one hue sweep, so each step down the scale
  // must be a smaller number than the one before it — no plateaus, no reversals.
  it('falls monotonically as loss grows', () => {
    const hues = [0, 0.5, 1, 2, 3, 5, 8, 20].map(callQualityHue);
    const sorted = [...hues].sort((a, b) => b - a);
    expect(hues).toEqual(sorted);
  });

  it('is already visibly off-green at the one percent that is audible', () => {
    // Linear would still be at 105° here, which reads as plain green.
    expect(callQualityHue(1)).toBeLessThan(90);
  });

  it('clamps rather than wrapping past red on a catastrophic call', () => {
    expect(callQualityHue(100)).toBe(0);
  });
});

describe('smoothCallQuality', () => {
  // A single burst must not own the colour, or the indicator flickers red on
  // calls that are fine and stops meaning anything.
  it('lets one bad sample move the average only part of the way', () => {
    const calm = { lossPct: 0, jitterBufferMs: 20, rttMs: 40 };
    const burst = { lossPct: 8, jitterBufferMs: 20, rttMs: 40 };

    const blended = smoothCallQuality(calm, burst);

    expect(blended.lossPct).toBeGreaterThan(0);
    expect(blended.lossPct).toBeLessThan(3);
  });

  it('takes the first sample whole, having nothing to blend with', () => {
    const first = { lossPct: 4, jitterBufferMs: 30, rttMs: 50 };
    expect(smoothCallQuality(null, first)).toEqual(first);
  });

  it('converges on a sustained level rather than lagging forever', () => {
    let current = smoothCallQuality(null, { lossPct: 0, jitterBufferMs: 0, rttMs: 0 });
    for (let i = 0; i < 25; i += 1) {
      current = smoothCallQuality(current, { lossPct: 6, jitterBufferMs: 0, rttMs: 0 });
    }
    expect(current.lossPct).toBeCloseTo(6, 0);
  });
});

describe('estimateMos', () => {
  it('puts a clean local call near the top of the scale', () => {
    const mos = estimateMos({ lossPct: 0, jitterBufferMs: 20, rttMs: 30 });
    expect(mos).toBeGreaterThan(4.2);
  });

  it('drops below usable once loss is severe', () => {
    const mos = estimateMos({ lossPct: 10, jitterBufferMs: 60, rttMs: 200 });
    expect(mos).toBeLessThan(3);
  });

  it('falls as delay grows even with no loss at all', () => {
    const near = estimateMos({ lossPct: 0, jitterBufferMs: 20, rttMs: 40 });
    const far = estimateMos({ lossPct: 0, jitterBufferMs: 200, rttMs: 600 });
    expect(far).toBeLessThan(near);
  });

  it('stays inside the scale the model is defined on', () => {
    const worst = estimateMos({ lossPct: 100, jitterBufferMs: 2_000, rttMs: 5_000 });
    expect(worst).toBeGreaterThanOrEqual(1);
    expect(worst).toBeLessThanOrEqual(4.5);
  });
});

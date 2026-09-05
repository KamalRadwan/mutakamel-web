/**
 * How a live call is actually going, read off the peer connection.
 *
 * ## Why the numbers need work before they mean anything
 *
 * `RTCPeerConnection.getStats()` reports **cumulative** counters: total packets
 * received, total lost, total jitter-buffer delay. Rendering those directly
 * would show the average since the call began, so a call that was clean for ten
 * minutes and has been unusable for the last thirty seconds still reads as
 * clean. Everything here is a delta between two samples, which is the only form
 * in which "how is it going right now" exists.
 *
 * Inbound is what this measures — what this browser failed to receive, which is
 * what the person holding it can hear. `remote-inbound-rtp` describes the other
 * direction and is a different question.
 */

export type CallQualitySample = {
  /** Percentage of inbound packets lost since the previous sample. */
  lossPct: number;
  /** Mean time a packet waited in the jitter buffer, in milliseconds. */
  jitterBufferMs: number;
  /** Round trip time on the active candidate pair, in milliseconds. */
  rttMs: number;
};

/** The raw cumulative counters, as one sample of them. */
export type CallQualityCounters = {
  packetsReceived: number;
  packetsLost: number;
  jitterBufferDelay: number;
  jitterBufferEmittedCount: number;
  rttMs: number;
  at: number;
};

/**
 * The window before the first measurement is trusted, and the gap between
 * samples afterwards.
 *
 * The opening seconds of a call are noisy for reasons that have nothing to do
 * with the network: ICE is still settling, the jitter buffer is filling from
 * empty, and the first packets arrive out of order by design. A measurement
 * taken then reports a problem that is not there, so the indicator states
 * plainly that it is not measuring yet rather than showing a number it would
 * have to take back.
 */
export const CALL_QUALITY_GRACE_MS = 3_000;
export const CALL_QUALITY_INTERVAL_MS = 3_000;

/**
 * How many samples the smoothing keeps in play.
 *
 * One burst of loss is not a bad call, and a colour that flips to red on every
 * burst is a colour nobody trusts. Four samples at three seconds is a twelve
 * second view: slow enough to ignore a hiccup, fast enough that a call going
 * bad is visibly going bad while it still matters.
 */
export const CALL_QUALITY_SMOOTHING = 4;

/**
 * Reads the three numbers this cares about out of a stats report.
 *
 * Returns null when the report has no inbound audio yet — which is normal for
 * the first moments of a call and must not be confused with a report of zero
 * loss.
 */
export function readCallQualityCounters(
  report: RTCStatsReport,
  now: number,
): CallQualityCounters | null {
  let inbound: Record<string, number> | null = null;
  let rttSeconds = 0;

  report.forEach((entry) => {
    const stat = entry as unknown as Record<string, unknown>;
    if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
      inbound = stat as unknown as Record<string, number>;
      return;
    }
    // Only the pair actually carrying media; the others are candidates that
    // lost, and their timings describe paths this call is not using.
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
      rttSeconds = Number(stat.currentRoundTripTime ?? 0);
    }
  });

  if (!inbound) return null;
  const audio = inbound as Record<string, number>;

  return {
    packetsReceived: Number(audio.packetsReceived ?? 0),
    packetsLost: Number(audio.packetsLost ?? 0),
    jitterBufferDelay: Number(audio.jitterBufferDelay ?? 0),
    jitterBufferEmittedCount: Number(audio.jitterBufferEmittedCount ?? 0),
    rttMs: rttSeconds * 1000,
    at: now,
  };
}

/**
 * Turns two cumulative readings into what happened between them.
 *
 * Returns null when nothing moved. No packets in the interval is not zero
 * percent loss — it is no information, and a held call or a stalled connection
 * would otherwise be reported as perfect.
 */
export function diffCallQuality(
  previous: CallQualityCounters,
  current: CallQualityCounters,
): CallQualitySample | null {
  const received = current.packetsReceived - previous.packetsReceived;
  const lost = Math.max(0, current.packetsLost - previous.packetsLost);
  const expected = received + lost;
  if (expected <= 0) return null;

  const emitted = current.jitterBufferEmittedCount - previous.jitterBufferEmittedCount;
  const delay = current.jitterBufferDelay - previous.jitterBufferDelay;

  return {
    lossPct: (lost / expected) * 100,
    jitterBufferMs: emitted > 0 ? (delay / emitted) * 1000 : 0,
    rttMs: current.rttMs,
  };
}

/** Exponential smoothing, weighted so a single bad sample cannot own the colour. */
export function smoothCallQuality(
  previous: CallQualitySample | null,
  next: CallQualitySample,
  window = CALL_QUALITY_SMOOTHING,
): CallQualitySample {
  if (!previous) return next;
  const weight = 1 / window;
  const blend = (a: number, b: number) => a + (b - a) * weight;
  return {
    lossPct: blend(previous.lossPct, next.lossPct),
    jitterBufferMs: blend(previous.jitterBufferMs, next.jitterBufferMs),
    rttMs: blend(previous.rttMs, next.rttMs),
  };
}

/**
 * Loss percentage to a hue on the green→red arc.
 *
 * Green, yellow, orange and red are not four chosen colours — they are what one
 * hue channel produces on its way from 120° to 0°, which is why this is a
 * single interpolation rather than a table of thresholds with muddy blends
 * between them.
 *
 * The curve is deliberately not linear. One percent loss is already audible and
 * eight percent is a call nobody can hold, so the steepest part of the colour
 * change sits where the listening experience actually changes.
 */
export function callQualityHue(lossPct: number): number {
  const clamped = Math.max(0, Math.min(8, lossPct));
  const severity = Math.min(1, (clamped / 8) ** 0.6);
  return Math.round(120 * (1 - severity));
}

/**
 * A MOS *estimate*, from the simplified E-model (ITU-T G.107).
 *
 * WebRTC does not report MOS and cannot: it is a model of human opinion, not a
 * measurement. This derives one from delay and loss the way the E-model does,
 * which is the standard approach and still an estimate — the UI labels it as
 * one, because a bare "MOS: 3.8" claims a precision nothing here has.
 */
export function estimateMos(sample: CallQualitySample): number {
  // One-way delay: half the round trip plus what the jitter buffer holds.
  const delayMs = sample.rttMs / 2 + sample.jitterBufferMs;
  const excess = Math.max(0, delayMs - 177.3);
  const delayImpairment = 0.024 * delayMs + 0.11 * excess;

  // G.711 with random (non-bursty) loss: Ie = 0, Bpl = 4.3.
  const loss = Math.max(0, sample.lossPct);
  const lossImpairment = (95 * loss) / (loss + 4.3);

  const r = Math.max(0, Math.min(100, 93.2 - delayImpairment - lossImpairment));
  const mos = 1 + 0.035 * r + r * (r - 60) * (100 - r) * 7e-6;
  return Math.max(1, Math.min(4.5, mos));
}

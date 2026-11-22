import { Quality } from './phone.model';

export const QUALITY_SMOOTHING_WEIGHT = 0.25;
const G711_R0 = 93.2;
const G711_BPL = 4.3;

export interface InboundAudioStats {
  packetsReceived: number;
  packetsLost: number;
  jitterBufferDelay: number;
  jitterBufferEmittedCount: number;
  jitterSec: number | null;
  rttMs: number;
}

export type StatsEntry = Record<string, unknown>;
export type StatsReportLike = RTCStatsReport | Iterable<StatsEntry>;

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Classifies packet loss percentage into a discrete quality level. */
export function classifyQualityLevel(lossPct: number | null): Quality['level'] {
  if (lossPct === null || !Number.isFinite(lossPct)) return 'measuring';
  if (lossPct < 1) return 'good';
  if (lossPct < 4) return 'fair';
  return 'poor';
}

/** Applies exponential smoothing with weight 1/4 (`0.25`) to a metric sample. */
export function smoothMetric(previous: number | null, sample: number, weight = QUALITY_SMOOTHING_WEIGHT): number {
  if (previous === null) return sample;
  return previous * (1 - weight) + sample * weight;
}

/** Estimates MOS (1..4.5) using the simplified ITU-T G.107 E-model for G.711 (Bpl = 4.3). */
export function estimateMos(lossPct: number, jitterMs: number, rttMs: number): number {
  const safeLoss = Math.max(0, Math.min(100, Number.isFinite(lossPct) ? lossPct : 0));
  const safeJitter = Math.max(0, Number.isFinite(jitterMs) ? jitterMs : 0);
  const safeRtt = Math.max(0, Number.isFinite(rttMs) ? rttMs : 0);

  const oneWayDelay = safeRtt / 2 + safeJitter;
  const h = oneWayDelay > 177.3 ? 1 : 0;
  const id = 0.024 * oneWayDelay + 0.11 * (oneWayDelay - 177.3) * h;
  const ieEff = 95 * (safeLoss / (safeLoss + G711_BPL));
  const r = Math.max(0, Math.min(100, G711_R0 - id - ieEff));

  let mos: number;
  if (r <= 0) {
    mos = 1;
  } else if (r >= 100) {
    mos = 4.5;
  } else {
    mos = 1 + 0.035 * r + r * (r - 60) * (100 - r) * 7e-6;
  }

  const clamped = Math.max(1, Math.min(4.5, mos));
  return Math.round(clamped * 100) / 100;
}

function entriesOf(report: StatsReportLike): StatsEntry[] {
  const entries: StatsEntry[] = [];
  if (typeof (report as RTCStatsReport).forEach === 'function') {
    (report as RTCStatsReport).forEach((value) => {
      if (value && typeof value === 'object') entries.push(value as StatsEntry);
    });
    return entries;
  }
  for (const value of report as Iterable<StatsEntry>) {
    if (value && typeof value === 'object') entries.push(value);
  }
  return entries;
}

/** Extracts inbound audio packet/jitter counters and nominated pair RTT from a WebRTC stats report. */
export function extractInboundAudioStats(report: StatsReportLike | null | undefined): InboundAudioStats | null {
  if (!report) return null;
  const entries = entriesOf(report);
  let inbound: StatsEntry | null = null;
  let nominatedPair: StatsEntry | null = null;
  let selectedPairId: string | null = null;
  const pairsById = new Map<string, StatsEntry>();

  for (const entry of entries) {
    const type = entry['type'];
    if (type === 'inbound-rtp' && (entry['kind'] === 'audio' || entry['mediaType'] === 'audio')) {
      inbound = entry;
    } else if (type === 'transport' && typeof entry['selectedCandidatePairId'] === 'string') {
      selectedPairId = entry['selectedCandidatePairId'];
    } else if (type === 'candidate-pair') {
      if (typeof entry['id'] === 'string') pairsById.set(entry['id'], entry);
      if (entry['nominated'] === true || entry['selected'] === true || entry['state'] === 'succeeded') {
        if (!nominatedPair || entry['nominated'] === true || entry['selected'] === true) {
          nominatedPair = entry;
        }
      }
    }
  }

  if (!inbound) return null;
  const pair = (selectedPairId ? pairsById.get(selectedPairId) : null) ?? nominatedPair;
  const rttSec = pair ? num(pair['currentRoundTripTime'], 0) : 0;

  return {
    packetsReceived: Math.max(0, num(inbound['packetsReceived'], 0)),
    packetsLost: Math.max(0, num(inbound['packetsLost'], 0)),
    jitterBufferDelay: Math.max(0, num(inbound['jitterBufferDelay'], 0)),
    jitterBufferEmittedCount: Math.max(0, num(inbound['jitterBufferEmittedCount'], 0)),
    jitterSec: typeof inbound['jitter'] === 'number' ? Math.max(0, inbound['jitter']) : null,
    rttMs: Math.round(rttSec * 1000 * 100) / 100,
  };
}

/** Tracks delta counters across `getStats()` polls and produces exponentially smoothed quality samples. */
export class QualityEstimator {
  private prev: InboundAudioStats | null = null;
  private smoothedLoss: number | null = null;
  private smoothedJitter: number | null = null;
  private smoothedRtt: number | null = null;
  private lastQuality: Quality | null = null;

  reset(): void {
    this.prev = null;
    this.smoothedLoss = null;
    this.smoothedJitter = null;
    this.smoothedRtt = null;
    this.lastQuality = null;
  }

  sample(report: StatsReportLike | null | undefined): Quality | null {
    const curr = extractInboundAudioStats(report);
    if (!curr) return this.lastQuality;

    const prevReceived = this.prev?.packetsReceived ?? 0;
    const prevLost = this.prev?.packetsLost ?? 0;
    const prevDelay = this.prev?.jitterBufferDelay ?? 0;
    const prevEmitted = this.prev?.jitterBufferEmittedCount ?? 0;

    // Handle counter resets on ICE restart gracefully by treating curr as the fresh window.
    const counterReset = curr.packetsReceived < prevReceived || curr.packetsLost < prevLost;
    const deltaReceived = counterReset ? curr.packetsReceived : curr.packetsReceived - prevReceived;
    const deltaLost = counterReset ? curr.packetsLost : curr.packetsLost - prevLost;
    const deltaPackets = deltaReceived + deltaLost;

    if (deltaPackets <= 0) {
      return this.lastQuality;
    }

    const deltaDelay = counterReset ? curr.jitterBufferDelay : Math.max(0, curr.jitterBufferDelay - prevDelay);
    const deltaEmitted = counterReset ? curr.jitterBufferEmittedCount : Math.max(0, curr.jitterBufferEmittedCount - prevEmitted);

    const rawLossPct = Math.max(0, Math.min(100, (deltaLost / deltaPackets) * 100));
    const rawJitterMs =
      deltaEmitted > 0
        ? (deltaDelay / deltaEmitted) * 1000
        : curr.jitterSec !== null
          ? curr.jitterSec * 1000
          : 0;
    const rawRttMs = curr.rttMs;

    this.prev = curr;
    this.smoothedLoss = smoothMetric(this.smoothedLoss, rawLossPct);
    this.smoothedJitter = smoothMetric(this.smoothedJitter, rawJitterMs);
    this.smoothedRtt = smoothMetric(this.smoothedRtt, rawRttMs);

    const lossPct = Math.round(this.smoothedLoss * 100) / 100;
    const jitterMs = Math.round(this.smoothedJitter * 100) / 100;
    const rttMs = Math.round(this.smoothedRtt * 100) / 100;

    this.lastQuality = {
      level: classifyQualityLevel(lossPct),
      lossPct,
      jitterMs,
      rttMs,
      mos: estimateMos(lossPct, jitterMs, rttMs),
    };
    return this.lastQuality;
  }
}

const QUALITY_RANK: Record<Quality['level'], number> = {
  poor: 3,
  fair: 2,
  good: 1,
  measuring: 0,
};

/** Selects the worst quality sample across multiple conference legs. */
export function pickWorstQuality(samples: (Quality | null)[]): Quality | null {
  let worst: Quality | null = null;
  for (const item of samples) {
    if (!item) continue;
    if (!worst) {
      worst = item;
      continue;
    }
    const rankDiff = QUALITY_RANK[item.level] - QUALITY_RANK[worst.level];
    if (rankDiff > 0 || (rankDiff === 0 && item.mos < worst.mos)) {
      worst = item;
    }
  }
  return worst;
}

import { describe, expect, it } from 'vitest';
import { callLogTypeFor } from './useWebRTCPhone';
import type { ActiveCallContext } from '../types';

function call(over: Partial<ActiveCallContext> = {}): ActiveCallContext {
  return {
    direction: 'incoming',
    number: '1001',
    startedAt: '2026-09-03T10:00:00.000Z',
    ...over,
  };
}

describe('callLogTypeFor', () => {
  it('files an answered call by direction, in both directions', () => {
    expect(callLogTypeFor(call({ answeredAt: '2026-09-03T10:00:04.000Z' }))).toBe('IN_ANS');
    expect(
      callLogTypeFor(call({ direction: 'outgoing', answeredAt: '2026-09-03T10:00:04.000Z' })),
    ).toBe('OUT_ANS');
  });

  // A conversation that happened is not a failed call, however it ended. Filing
  // it by the disconnect cause would put a red arrow on a call that connected.
  it('keeps a call that connected as answered even when it ended badly', () => {
    const dropped = call({
      answeredAt: '2026-09-03T10:00:04.000Z',
      cause: 'callFailed: Connection Error',
    });

    expect(callLogTypeFor(dropped)).toBe('IN_ANS');
  });

  // Busy and unanswered are indistinguishable in the timings and completely
  // different to the person reading the log: one is a line to try later, the
  // other is a call that nobody picked up.
  it('separates a busy line from nobody answering', () => {
    expect(callLogTypeFor(call({ cause: 'callFailed: Busy' }))).toBe('IN_BUSY');
    expect(callLogTypeFor(call({ direction: 'outgoing', cause: 'callFailed: Busy' }))).toBe(
      'OUT_BUSY',
    );
    expect(callLogTypeFor(call({ cause: 'callFailed: Canceled' }))).toBe('IN_NOANS');
  });

  // JsSIP spells the cause differently across versions and SIP itself has two
  // busy responses, so the match is deliberately loose.
  it('recognises the cause however the stack spelled it', () => {
    for (const cause of ['Busy', 'busy', 'BUSY EVERYWHERE', 'callFailed: Busy Here']) {
      expect(callLogTypeFor(call({ cause }))).toBe('IN_BUSY');
    }
  });

  // 603 Decline is somebody saying no, not a phone nobody picked up -- and the
  // commonest source of it is the local user pressing decline on this very
  // widget. Filing that as unanswered would put a red arrow on a call the
  // operator deliberately refused.
  it('files a declined call as refused, not as unanswered', () => {
    expect(callLogTypeFor(call({ cause: 'callFailed: Rejected' }))).toBe('IN_BUSY');
    expect(callLogTypeFor(call({ direction: 'outgoing', cause: 'Declined' }))).toBe('OUT_BUSY');
  });

  it('files an unanswered call by direction', () => {
    expect(callLogTypeFor(call())).toBe('IN_NOANS');
    expect(callLogTypeFor(call({ direction: 'outgoing' }))).toBe('OUT_NOANS');
  });

  // Nothing writes the legacy `OUT` any more; this pins that.
  it('never produces the legacy outgoing value', () => {
    const produced = [
      callLogTypeFor(call({ direction: 'outgoing' })),
      callLogTypeFor(call({ direction: 'outgoing', answeredAt: '2026-09-03T10:00:04.000Z' })),
      callLogTypeFor(call({ direction: 'outgoing', cause: 'Busy' })),
    ];

    expect(produced).not.toContain('OUT');
  });
});

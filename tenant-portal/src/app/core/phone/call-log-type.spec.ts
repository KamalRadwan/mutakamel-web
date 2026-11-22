import { describe, expect, it } from 'vitest';
import { clampCallDuration, formatCallCause, resolveCallLogType } from './phone.model';

describe('call-log-type & helpers', () => {
  it('returns *_ANS whenever answered is true, even if cause contains busy/rejected/decline', () => {
    expect(resolveCallLogType('incoming', true, null)).toBe('IN_ANS');
    expect(resolveCallLogType('outgoing', true, null)).toBe('OUT_ANS');
    expect(resolveCallLogType('incoming', true, '486: Busy Here')).toBe('IN_ANS');
    expect(resolveCallLogType('outgoing', true, 'Rejected / Declined')).toBe('OUT_ANS');
  });

  it('maps unanswered calls with busy/rejected/decline causes to *_BUSY', () => {
    expect(resolveCallLogType('incoming', false, '486: Busy Here')).toBe('IN_BUSY');
    expect(resolveCallLogType('outgoing', false, 'Busy')).toBe('OUT_BUSY');
    expect(resolveCallLogType('incoming', false, 'Call Rejected')).toBe('IN_BUSY');
    expect(resolveCallLogType('outgoing', false, '603: Declined')).toBe('OUT_BUSY');
  });

  it('maps other unanswered calls to *_NOANS and never returns legacy OUT', () => {
    const incomingNoAns = resolveCallLogType('incoming', false, '408: Request Timeout');
    const outgoingNoAns = resolveCallLogType('outgoing', false, null);
    const outgoingCancelled = resolveCallLogType('outgoing', false, '487: Cancelled');

    expect(incomingNoAns).toBe('IN_NOANS');
    expect(outgoingNoAns).toBe('OUT_NOANS');
    expect(outgoingCancelled).toBe('OUT_NOANS');
    expect(outgoingNoAns).not.toBe('OUT');
  });

  it('clamps answered call duration between 0 and 86400 seconds', () => {
    const answeredAt = '2026-11-21T10:00:00.000Z';
    const startMs = Date.parse(answeredAt);

    expect(clampCallDuration(null, startMs + 5000)).toBeNull();
    expect(clampCallDuration(answeredAt, startMs - 2000)).toBe(0);
    expect(clampCallDuration(answeredAt, startMs + 42_500)).toBe(42);
    expect(clampCallDuration(answeredAt, startMs + 100_000_000)).toBe(86_400);
  });

  it('formats cause string and truncates to 120 characters', () => {
    expect(formatCallCause(486, 'Busy Here')).toBe('486: Busy Here');
    expect(formatCallCause(null, 'Terminated')).toBe('Terminated');
    expect(formatCallCause(null, null)).toBeNull();

    const longDetail = 'x'.repeat(200);
    const formatted = formatCallCause(500, longDetail);
    expect(formatted?.length).toBe(120);
  });
});

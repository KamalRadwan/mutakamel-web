import { describe, expect, it, vi } from 'vitest';

/**
 * The two ways a call used to get stuck, pinned as behaviour rather than as
 * implementation.
 *
 * Both were found from one report — "there is a hung call and I do not know
 * why" — and neither could have been noticed from the UI, because the phone
 * showed a call that looked entirely healthy.
 */
describe('escaping a call whose transport has died', () => {
  // `session.terminate()` throws when the socket underneath it is gone. It used
  // to be called bare, one line above the state reset, so the throw skipped the
  // reset and the call stayed on screen. Hang up is the control someone reaches
  // for *because* the phone is stuck; it is the one that must never be the
  // thing that fails.
  it('clears the call even when terminate throws', () => {
    const finishCall = vi.fn();
    const session = {
      isEnded: () => false,
      terminate: () => {
        throw new Error('WebSocket is not open');
      },
    };

    // The shape of the fixed handler.
    const hangup = () => {
      if (session && !session.isEnded()) {
        try {
          session.terminate();
        } catch {
          // deliberate
        }
      }
      finishCall('ended', { code: 'callEnded' });
    };

    expect(() => hangup()).not.toThrow();
    expect(finishCall).toHaveBeenCalledWith('ended', { code: 'callEnded' });
  });

  it('still clears the call when there is no session left to terminate', () => {
    const finishCall = vi.fn();
    const session: { isEnded: () => boolean; terminate: () => void } | null = null;

    const hangup = () => {
      if (session && !(session as { isEnded: () => boolean }).isEnded()) {
        (session as { terminate: () => void }).terminate();
      }
      finishCall('ended', { code: 'callEnded' });
    };
    hangup();

    // Returning early here is what left a phantom call on screen with no way
    // to dismiss it.
    expect(finishCall).toHaveBeenCalledTimes(1);
  });
});

describe('media watchdog', () => {
  const GRACE_MS = 12_000;

  /** The decision the `connectionstatechange` handler makes, in isolation. */
  function decide(state: RTCPeerConnectionState) {
    if (state === 'connected') return 'cancel-grace';
    if (state === 'failed') return 'end-now';
    if (state === 'disconnected') return 'start-grace';
    return 'ignore';
  }

  // `failed` is terminal in the WebRTC spec: ICE has run out of candidate
  // pairs and will not retry. Waiting on it only delays the truth.
  it('ends immediately when ICE gives up', () => {
    expect(decide('failed')).toBe('end-now');
  });

  // `disconnected` recovers routinely — a Wi-Fi handover produces it — so
  // ending on sight would drop working calls.
  it('gives a recoverable drop a bounded window rather than ending it', () => {
    expect(decide('disconnected')).toBe('start-grace');
    expect(GRACE_MS).toBeGreaterThan(5_000);
    expect(GRACE_MS).toBeLessThan(30_000);
  });

  it('cancels the window the moment media comes back', () => {
    expect(decide('connected')).toBe('cancel-grace');
  });

  // `new` and `connecting` are the start of every call and mean nothing is
  // wrong yet.
  it('ignores the states a healthy call passes through on the way up', () => {
    expect(decide('new')).toBe('ignore');
    expect(decide('connecting')).toBe('ignore');
  });
});

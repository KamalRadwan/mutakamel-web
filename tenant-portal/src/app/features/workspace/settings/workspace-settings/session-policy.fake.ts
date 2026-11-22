import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay } from '../../../../core/fake/fake-utils';

/**
 * FAKE-ONLY, no backend route wired yet.
 * Future endpoints:
 *   GET /api/tenant/core/v1/workspace-settings/session-policy
 *   PUT /api/tenant/core/v1/workspace-settings/session-policy
 *
 * Refresh credentials are opaque and follow the earlier of the session's idle and absolute deadlines.
 */

export const SESSION_POLICY_FIELDS = [
  'accessTokenTtlSeconds',
  'idleTimeoutSeconds',
  'absoluteTimeoutSeconds',
] as const;

export type SessionPolicyFieldKey = (typeof SESSION_POLICY_FIELDS)[number];

export interface SessionLifetimeBound {
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

export type SessionPolicyViewModel = Readonly<Record<SessionPolicyFieldKey, SessionLifetimeBound>>;
export type UpdateSessionPolicyDraft = Partial<Record<SessionPolicyFieldKey, number>>;

export const FAKE_SESSION_POLICY_FAIL_NEXT = { error: null as ApiError | null };

const INITIAL_SESSION_POLICY: SessionPolicyViewModel = {
  accessTokenTtlSeconds: { value: 900, min: 60, max: 86_400 },
  idleTimeoutSeconds: { value: 259_200, min: 300, max: 2_592_000 },
  absoluteTimeoutSeconds: { value: 2_592_000, min: 1_800, max: 31_536_000 },
};

let store = INITIAL_SESSION_POLICY;

export function resetSessionPolicyFake(): void {
  store = INITIAL_SESSION_POLICY;
  FAKE_SESSION_POLICY_FAIL_NEXT.error = null;
}

function consumeFailNext(): void {
  const { error } = FAKE_SESSION_POLICY_FAIL_NEXT;
  FAKE_SESSION_POLICY_FAIL_NEXT.error = null;
  if (error) throw error;
}

export async function fakeGetSessionPolicy(): Promise<SessionPolicyViewModel> {
  await fakeDelay();
  consumeFailNext();
  return structuredClone(store);
}

export async function fakeUpdateSessionPolicy(
  patch: UpdateSessionPolicyDraft,
): Promise<SessionPolicyViewModel> {
  await fakeDelay();
  consumeFailNext();

  const next = { ...store };
  for (const key of SESSION_POLICY_FIELDS) {
    const value = patch[key];
    if (value === undefined) continue;
    const bound = store[key];
    if (!Number.isSafeInteger(value) || value < bound.min || value > bound.max) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    next[key] = { ...bound, value };
  }

  if (next.idleTimeoutSeconds.value > next.absoluteTimeoutSeconds.value) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }

  store = next;
  return structuredClone(store);
}

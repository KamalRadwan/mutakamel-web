import { ApiError } from '../api/api-errors';
import { fakeDelay } from '../fake/fake-utils';
import type { LoginSession, TenantMe } from './auth-session.model';
import { FAKE_ME } from './current-user.fake';

// FAKE-ONLY: Phase 3 mock session store; persists simulated logout across reloads until sign-in.
const FAKE_SIGNED_OUT_KEY = 'fake-auth-signed-out';
const HOUR_MS = 3_600_000;
const FAKE_BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const FAKE_COMPANY_ID = '018f0000-0000-7000-8000-000000000010';

export const FAKE_TENANT_ME: TenantMe = {
  ...FAKE_ME,
  accessibleBranches: [FAKE_BRANCH_ID],
  accessibleCompanies: [FAKE_COMPANY_ID],
  accessibleBranchCompanies: [{ branchId: FAKE_BRANCH_ID, companyId: FAKE_COMPANY_ID }],
  permissions: [
    'notifications.notification.read',
    'crm.customer_profiles.status.manage',
    'crm.customer_profiles.read',
    'crm.leads.read',
    'crm.leads.write',
    'crm.opportunities.read',
    'trade.items.read',
    'tenant.users.read',
    'tenant.roles.read',
  ],
  seats: [
    { moduleKey: 'crm', accessState: 'ACTIVE' },
    { moduleKey: 'trade', accessState: 'ACTIVE' },
  ],
  permissionScopes: {},
  teamMemberships: [],
  accessScope: {
    mode: 'FULL',
    branchesTruncated: false,
    companiesTruncated: false,
    teamMembershipsTruncated: false,
    teamMembershipsTotal: 0,
  },
  featureEntitlements: { 'crm.outbound_email': true },
};

export type FakeSessionNext = 'TOKEN_EXPIRED' | 'ENDED' | 'INACTIVE' | 'SERVER_ERROR' | null;

let nextFailure: FakeSessionNext = null;
let refreshNextFailure: 'ENDED' | null = null;
let nextLogoutError: unknown = null;
const calls = { me: 0, refresh: 0, logout: 0 };

function readSignedOutFlag(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FAKE_SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSignedOutFlag(signedOut: boolean): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (signedOut) {
      sessionStorage.setItem(FAKE_SIGNED_OUT_KEY, '1');
    } else {
      sessionStorage.removeItem(FAKE_SIGNED_OUT_KEY);
    }
  } catch {
    // Ignore storage access failures.
  }
}

/** Marks the fake session signed in (clears the FAKE-ONLY signed-out flag). */
export function fakeMarkSignedIn(): void {
  writeSignedOutFlag(false);
}

export function setFakeSessionNext(code: FakeSessionNext): void {
  nextFailure = code;
  if (code === null) {
    refreshNextFailure = null;
  }
}

export function setFakeLogoutError(error: unknown): void {
  nextLogoutError = error;
}

export function fakeSessionCallCounts(): { me: number; refresh: number; logout: number } {
  return { ...calls };
}

export function resetFakeSession(): void {
  nextFailure = null;
  refreshNextFailure = null;
  nextLogoutError = null;
  calls.me = 0;
  calls.refresh = 0;
  calls.logout = 0;
  fakeMarkSignedIn();
}

export async function fakeGetMe(): Promise<TenantMe> {
  calls.me += 1;
  await fakeDelay(200);

  const injected = nextFailure;
  nextFailure = null;
  if (injected === 'TOKEN_EXPIRED') {
    throw new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED');
  }
  if (injected === 'ENDED') {
    refreshNextFailure = 'ENDED';
    throw new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED');
  }
  if (injected === 'INACTIVE') {
    throw new ApiError(403, 'SESSION_IDENTITY_INACTIVE');
  }
  if (injected === 'SERVER_ERROR') {
    throw new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR');
  }

  if (readSignedOutFlag()) {
    throw new ApiError(401, 'COMMON.AUTH.MISSING_BEARER_TOKEN');
  }

  return structuredClone(FAKE_TENANT_ME);
}

export async function fakeRefreshSession(): Promise<LoginSession> {
  calls.refresh += 1;
  await fakeDelay(200);

  const refreshInjected = refreshNextFailure;
  refreshNextFailure = null;
  if (refreshInjected === 'ENDED') {
    throw new ApiError(401, 'AUTH_SESSION_IDLE_EXPIRED');
  }

  const injected = nextFailure;
  nextFailure = null;
  if (injected === 'ENDED') {
    throw new ApiError(401, 'AUTH_SESSION_IDLE_EXPIRED');
  }
  if (injected === 'INACTIVE') {
    throw new ApiError(403, 'SESSION_IDENTITY_INACTIVE');
  }
  if (injected === 'SERVER_ERROR') {
    throw new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR');
  }

  if (readSignedOutFlag()) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN');
  }

  const now = Date.now();
  return {
    tokenType: 'Bearer',
    expiresIn: 600,
    sessionExpiresIn: 43200,
    session: {
      id: '019f0000-0000-7000-8000-000000000001',
      clientId: 'mutakamel-tenant-web',
      clientType: 'WEB',
      createdAt: new Date(now).toISOString(),
      lastRefreshAt: new Date(now).toISOString(),
      lastUserActivityAt: null,
      idleExpiresAt: new Date(now + 12 * HOUR_MS).toISOString(),
      absoluteExpiresAt: new Date(now + 24 * HOUR_MS).toISOString(),
      refreshUseCount: '1',
      accessIssueCount: '2',
      credentialVersion: 1,
      authorizationVersion: 1,
      profileVersion: 1,
    },
  };
}

export async function fakeLogout(): Promise<void> {
  calls.logout += 1;
  await fakeDelay(200);

  if (nextLogoutError !== null) {
    const err = nextLogoutError;
    nextLogoutError = null;
    throw err;
  }

  writeSignedOutFlag(true);
}

import { InjectionToken, Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp } from '../../../core/api/core-http';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import {
  fakeFreeUp,
  fakeFreeUpPreview,
  fakeGetMySeatStates,
  fakeGetSeatUsage,
  fakeListSeatHolders,
  fakeReleaseSeats,
  fakeSwapSeat,
  fakeSwitchToDerived,
} from './seats.fake';
import {
  CorePage,
  FreeUpPreview,
  MySeatState,
  SeatChange,
  SeatHolder,
  SeatPreview,
  SeatUsage,
} from './seats.model';

/** GET /api/tenant/core/v1/seats/usage */
export function getSeatUsage(): Promise<SeatUsage> {
  return fakeGetSeatUsage();
}

/** GET /api/tenant/core/v1/seats/usage/:moduleKey/holders?page&limit(<=100)&search(<=120) */
export function listSeatHolders(
  moduleKey: string,
  q: { page: number; limit: number; search?: string },
): Promise<CorePage<SeatHolder>> {
  return fakeListSeatHolders(moduleKey, q);
}

/** POST /api/tenant/core/v1/seats/preview (max 100 changes, no idempotency key) */
export function previewSeats(changes: SeatChange[]): Promise<SeatPreview> {
  if (!resolveSeatPreview) throw new Error('SeatPreviewApi is not bound');
  return resolveSeatPreview().previewSeats(changes);
}

@Service()
export class SeatPreviewApi {
  private readonly http = inject(CoreHttp);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  previewSeats(changes: SeatChange[]): Promise<SeatPreview> {
    return this.queries.fetchQuery({ queryKey: ['seats', 'preview', changes], queryFn: async () => {
      const result = await this.http.write<SeatPreview>('POST', '/api/tenant/core/v1/seats/preview', { changes });
      return result.data;
    } });
  }
}

let resolveSeatPreview: (() => Pick<SeatPreviewApi, 'previewSeats'>) | undefined;

export function bindSeatPreviewApi(resolve: () => Pick<SeatPreviewApi, 'previewSeats'>): void {
  resolveSeatPreview = resolve;
}

export const SEAT_PREVIEW = new InjectionToken<typeof previewSeats>('SEAT_PREVIEW', {
  providedIn: 'root', factory: () => {
    const api = inject(SeatPreviewApi);
    return (changes) => api.previewSeats(changes);
  },
});

// TODO(seats-backend): releaseSeats response has no schema in OpenAPI yet; shape matches Core service code.
/** POST /api/tenant/core/v1/users/:id/release-seats?confirmAddonCascade= (header x-idempotency-key UUIDv7) */
export function releaseSeats(
  userId: string,
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatPreview> {
  return fakeReleaseSeats(userId, opts, key);
}

/** POST /api/tenant/core/v1/seats/free-up/preview (owner only, no idempotency key) */
export function freeUpPreview(body: {
  moduleKey: string;
  targetSeats: number;
  keepUserIds: string[];
}): Promise<FreeUpPreview> {
  return fakeFreeUpPreview(body);
}

/** POST /api/tenant/core/v1/seats/free-up (owner only, header x-idempotency-key UUIDv7) */
export function freeUp(
  body: {
    moduleKey: string;
    targetSeats: number;
    keepUserIds: string[];
    expectedUsageRevision: number;
    confirmAddonCascade?: boolean;
  },
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return fakeFreeUp(body, key);
}

/** POST /api/tenant/core/v1/seats/:moduleKey/swap (owner only, header x-idempotency-key UUIDv7) */
export function swapSeat(
  moduleKey: string,
  body: { keepUserId: string; releaseUserId: string },
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return fakeSwapSeat(moduleKey, body, key);
}

/** POST /api/tenant/core/v1/seats/switch-to-derived?confirmAddonCascade= (owner only, header x-idempotency-key UUIDv7) */
export function switchToDerived(
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return fakeSwitchToDerived(opts, key);
}

// TODO(seats-backend): read profile.seats from real GET /api/tenant/core/v1/auth/me once HTTP is wired.
/** GET /api/tenant/core/v1/auth/me → seats (derived in the fake from active actor + seat usage). */
export function getMySeatStates(): Promise<MySeatState[]> {
  return fakeGetMySeatStates();
}

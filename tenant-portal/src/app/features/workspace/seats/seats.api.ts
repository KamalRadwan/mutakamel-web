import { InjectionToken, Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp } from '../../../core/api/core-http';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { ApiError } from '../../../core/api/api-errors';
import { mySeatStatesFromMe, seatHolderFromCore, webphoneSeatHolder, webphoneSeatHoldersPage } from './seats.model';
import type { CoreSeatHolder, SeatHolderUser, WebphoneSeatHolder, WebphoneSeatHoldersPage } from './seats.model';
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
  return seatApi().getSeatUsage();
}

/** GET /api/tenant/core/v1/seats/usage/:moduleKey/holders?page&limit(<=100)&search(<=120) */
export function listSeatHolders(
  moduleKey: string,
  q: { page: number; limit: number; search?: string },
): Promise<CorePage<SeatHolder>> {
  return seatApi().listSeatHolders(moduleKey, q);
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

  getSeatUsage(): Promise<SeatUsage> {
    return this.http.read('/api/tenant/core/v1/seats/usage');
  }

  async listSeatHolders(moduleKey: string, query: { page: number; limit: number; search?: string }): Promise<CorePage<SeatHolder>> {
    const path = `/api/tenant/core/v1/seats/usage/${encodeURIComponent(moduleKey)}/holders`;
    if (moduleKey !== 'webphone') {
      const page = await this.http.readPage<CoreSeatHolder>(path, query);
      return { ...page, data: page.data.map(seatHolderFromCore) };
    }
    // Webphone returns a nested page and omits user email/status. Read those
    // from Core rather than inventing a user status from the seat access state.
    const page = await this.http.read<WebphoneSeatHoldersPage>(path, query);
    if (!page || !Array.isArray(page.data)) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
    const users = new Map<string, Promise<SeatHolderUser>>();
    const holders = await Promise.all(page.data.map(async (row: WebphoneSeatHolder) => {
      let user = users.get(row.userId);
      if (!user) {
        user = this.http.read<SeatHolderUser>(`/api/tenant/core/v1/users/${encodeURIComponent(row.userId)}`);
        users.set(row.userId, user);
      }
      return webphoneSeatHolder(row, await user);
    }));
    return webphoneSeatHoldersPage(page, holders);
  }

  async releaseSeats(userId: string, opts: { confirmAddonCascade?: boolean }, key: string): Promise<SeatPreview> {
    const result = await this.http.write<SeatPreview>('POST', `/api/tenant/core/v1/users/${encodeURIComponent(userId)}/release-seats`,
      undefined, { key, query: opts, noBody: true });
    return result.data;
  }

  async freeUpPreview(body: Parameters<typeof freeUpPreview>[0]): Promise<FreeUpPreview> {
    return (await this.http.write<FreeUpPreview>('POST', '/api/tenant/core/v1/seats/free-up/preview', body)).data;
  }

  async freeUp(body: Parameters<typeof freeUp>[0], key: string): Promise<SeatUsage> {
    return (await this.http.write<SeatUsage>('POST', '/api/tenant/core/v1/seats/free-up', body, { key })).data;
  }

  async swapSeat(moduleKey: string, body: Parameters<typeof swapSeat>[1], key: string): Promise<SeatUsage> {
    return (await this.http.write<SeatUsage>('POST', `/api/tenant/core/v1/seats/${encodeURIComponent(moduleKey)}/swap`, body, { key })).data;
  }

  async switchToDerived(opts: { confirmAddonCascade?: boolean }, key: string): Promise<SeatUsage> {
    return (await this.http.write<SeatUsage>('POST', '/api/tenant/core/v1/seats/switch-to-derived', undefined,
      { key, query: opts, noBody: true })).data;
  }

  async getMySeatStates(): Promise<MySeatState[]> {
    return mySeatStatesFromMe(await this.http.read<{ seats: MySeatState[] }>('/api/tenant/core/v1/auth/me'));
  }

  previewSeats(changes: SeatChange[]): Promise<SeatPreview> {
    return this.queries.fetchQuery({ queryKey: ['seats', 'preview', changes], queryFn: async () => {
      const result = await this.http.write<SeatPreview>('POST', '/api/tenant/core/v1/seats/preview', { changes });
      return result.data;
    } });
  }
}

let resolveSeatPreview: (() => SeatPreviewApi) | undefined;

export function bindSeatPreviewApi(resolve: () => SeatPreviewApi): void {
  resolveSeatPreview = resolve;
}

function seatApi(): SeatPreviewApi {
  if (!resolveSeatPreview) throw new Error('SeatPreviewApi is not bound');
  return resolveSeatPreview();
}

export const SEAT_PREVIEW = new InjectionToken<typeof previewSeats>('SEAT_PREVIEW', {
  providedIn: 'root', factory: () => {
    const api = inject(SeatPreviewApi);
    return (changes) => api.previewSeats(changes);
  },
});

// Response follows SeatUserOperationsService.release -> SeatReconciler.apply (SeatPlan).
/** POST /api/tenant/core/v1/users/:id/release-seats?confirmAddonCascade= (header x-idempotency-key UUIDv7) */
export function releaseSeats(
  userId: string,
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatPreview> {
  return seatApi().releaseSeats(userId, opts, key);
}

/** POST /api/tenant/core/v1/seats/free-up/preview (owner only, no idempotency key) */
export function freeUpPreview(body: {
  moduleKey: string;
  targetSeats: number;
  keepUserIds: string[];
}): Promise<FreeUpPreview> {
  return seatApi().freeUpPreview(body);
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
  return seatApi().freeUp(body, key);
}

/** POST /api/tenant/core/v1/seats/:moduleKey/swap (owner only, header x-idempotency-key UUIDv7) */
export function swapSeat(
  moduleKey: string,
  body: { keepUserId: string; releaseUserId: string },
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return seatApi().swapSeat(moduleKey, body, key);
}

/** POST /api/tenant/core/v1/seats/switch-to-derived?confirmAddonCascade= (owner only, header x-idempotency-key UUIDv7) */
export function switchToDerived(
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return seatApi().switchToDerived(opts, key);
}

/** GET /api/tenant/core/v1/auth/me → seats for the authenticated user. */
export function getMySeatStates(): Promise<MySeatState[]> {
  return seatApi().getMySeatStates();
}

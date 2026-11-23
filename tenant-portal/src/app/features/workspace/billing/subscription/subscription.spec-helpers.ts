import {
  Injectable,
  DOCUMENT,
  signal,
  type Provider,
  type EnvironmentProviders,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { BillingApi } from '../billing.api';
import type {
  AppliedReceipt,
  BillingSummary,
  CommercialOperation,
  CommercialPreview,
  SubscriptionView,
  SubscriptionOffer,
} from '../billing.model';

export const BASE = '/api/tenant/core/v1';
export const SUBSCRIPTION = {
  subscription: {
    id: 'sub',
    tenantId: 'tenant',
    allowedUsers: 10,
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    currencyCode: 'USD',
    startedAt: '2026-01-01',
    currentPeriodStart: '2026-11-01',
    currentPeriodEnd: '2026-12-01',
    pendingPeriodStart: null,
    pendingPeriodEnd: null,
    trialDays: 0,
    trialStartedAt: null,
    trialEndsAt: null,
    activationScheduledAt: null,
    activatedAt: '2026-01-01',
    cancelAt: null,
    totalPrice: '123.4567',
    createdAt: '2026-01-01',
    updatedAt: '2026-11-01',
    currentCollectionInvoiceId: null,
  },
  subscriptionRevision: '31',
  baseItems: [
    {
      id: 'item',
      applicationId: 'app',
      applicationKey: 'crm',
      applicationName: 'CRM',
      tierId: 'tier',
      tierKey: 'standard',
      tierName: 'Standard',
      tierRank: 1,
      seats: 3,
      acceptedPricing: {
        billingCycle: 'MONTHLY',
        currencyCode: 'USD',
        recurringAmountUsd: '37.0368',
        priceRevision: '1',
        breakdown: [],
      },
    },
  ],
  addonSelections: [],
  baseAllowance: { allowedUsers: 10, effectiveAllowedUsers: 10, enabledApplications: ['crm'] },
  totals: {
    baseRecurringUsd: '123.4567',
    addonRecurringUsd: '0.0000',
    combinedRecurringUsd: '123.4567',
  },
  projection: {
    observation: 'NOT_OBSERVED',
    state: null,
    safeReasonCode: 'TENANT_PROJECTION_NOT_OBSERVED',
  },
} as SubscriptionView;

export const SUMMARY: BillingSummary = {
  subscription: {
    id: 'sub',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    startedAt: '2026-01-01',
    trialEndsAt: null,
    currentPeriodStart: '2026-11-01',
    currentPeriodEnd: '2026-12-01',
    activationScheduledAt: null,
    totalPriceUsd: '123.4567',
    accessMode: 'FULL',
  },
  wallet: {
    currencyCode: 'USD',
    balanceUsd: '200.0000',
    reservedBalanceUsd: '0.0000',
    availableBalanceUsd: '200.0000',
    status: 'ACTIVE',
  },
  outstandingInvoice: null,
};
export const OFFERS: SubscriptionOffer[] = [
  {
    sourceKind: 'APPLICATION',
    application: {
      id: 'app',
      key: 'crm',
      name: 'CRM',
      publicationVersionId: 'pub',
      definitionRevision: '1',
    },
    tier: { id: 'tier', key: 'standard', name: 'Standard', rank: 1 },
    status: 'PREPARATION_REQUIRED',
    safeReasonCode: 'PREPARATION_REQUIRED',
    ladders: [
      { billingCycle: 'MONTHLY', state: 'CONFIGURED', brackets: [], safeReasonCode: null },
      { billingCycle: 'ANNUAL', state: 'CONFIGURED', brackets: [], safeReasonCode: null },
    ],
  },
];
export function operation(
  state: CommercialOperation['state'] = 'PREPARING',
  revision = '1',
): CommercialOperation {
  return {
    operationId: 'op',
    operationRevision: revision,
    intentKind: 'COMMERCIAL_CHANGE',
    state,
    phase: state,
    createdAt: '2026-11-23',
    updatedAt: '2026-11-23',
    terminalAt: null,
    safeReasonCode: null,
    retryAfterSeconds: null,
    relatedPreviewId: null,
    committedReceiptRef: null,
    projectionState: 'NOT_REQUIRED',
  };
}
export function preview(): CommercialPreview {
  return {
    previewId: 'preview',
    subscriptionId: 'sub',
    subscriptionRevision: '31',
    operationId: 'op',
    actorBindingDigest: 'actor',
    targetSetDigest: 'target',
    pricedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    billingCycle: 'MONTHLY',
    currencyCode: 'USD',
    changes: [],
    preparation: { preparationId: 'op' },
    financial: {
      previousRecurringUsd: '123.4567',
      nextRecurringUsd: '167.8912',
      fullPeriodDeltaUsd: '44.4345',
      direction: 'DEBIT',
      proratedAmountUsd: '7.6543',
      canApply: true,
      walletStatus: 'ACTIVE',
      walletAvailableUsd: '200.0000',
      walletShortfallUsd: '0.0000',
    },
  };
}
export function receipt(): AppliedReceipt {
  return {
    previewId: 'preview',
    operationId: 'op',
    appliedAt: new Date().toISOString(),
    changes: [],
    removedSelectionIds: [],
    subscriptionRevision: '32',
    totals: {
      baseRecurringUsd: '167.8912',
      addonRecurringUsd: '0.0000',
      combinedRecurringUsd: '167.8912',
    },
    settlement: {
      walletLedgerEntryId: 'ledger',
      walletId: 'wallet',
      currencyCode: 'USD',
      direction: 'DEBIT',
      amountUsd: '7.6543',
      balanceAfterUsd: '192.3457',
    },
    projection: { state: 'PENDING', preparationId: 'op' },
  };
}

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}
export function setupHttp(
  httpProviders: (Provider | EnvironmentProviders)[],
): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [
      ...httpProviders,
      provideRouter([]),
      provideTransloco({
        config: {
          availableLangs: ['en', 'ar'],
          defaultLang: 'en',
          reRenderOnLangChange: true,
          prodMode: true,
          missingHandler: { logMissingKey: false },
        },
        loader: EmptyLoader,
      }),
      {
        provide: AuthSession,
        useValue: {
          me: signal({ isTenantOwner: true }),
          ensureLoaded: vi.fn().mockResolvedValue('signed-in'),
        },
      },
    ],
  });
  const doc = TestBed.inject(DOCUMENT);
  vi.spyOn(doc, 'cookie', 'get').mockReturnValue(
    `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf-value`,
  );
  // The page and poller resolve the real transport through this provider.
  TestBed.inject(BillingApi);
  return TestBed.inject(HttpTestingController);
}
export function respond(req: TestRequest, data: unknown, status = 200): void {
  req.flush({ success: true, data }, { status, statusText: 'OK' });
}
export function fail(
  req: TestRequest,
  status: number,
  code = 'COMMON.GENERIC.INTERNAL_ERROR',
  details?: Record<string, string[]>,
): void {
  if (status === 0) req.error(new ProgressEvent('error'));
  else
    req.flush(
      { errorCode: code, details, correlationId: 'correlation' },
      { status, statusText: 'Error' },
    );
}
export async function tick(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

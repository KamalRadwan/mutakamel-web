import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthMe } from '../../../../core/auth/auth-me';
import { LanguageState } from '../../../../core/i18n/language';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { getVersion } from '../policy.api';
import type { GovernedActionEntry, GovernedVersionDetail } from '../policy.model';
import { GovernedReview, type ReviewTimelineItem } from './governed-review';

@Injectable()
class ReviewLoader implements TranslocoLoader {
  getTranslation() { return of({}); }
}

const ME: AuthMe = {
  id: 'authenticated-user', email: 'staff@example.test', firstName: 'Current', lastName: 'Staff',
  hasAvatar: false, isTenantOwner: false, mfaEnabled: false, mfaUpdatedAt: null, status: 'ACTIVE',
  workspace: { timezone: 'Africa/Cairo', defaultLanguage: 'en' },
};

function action(overrides: Partial<GovernedActionEntry> = {}): GovernedActionEntry {
  return {
    action: 'SUBMIT', actorUserId: ME.id, actorDisplayName: null,
    reasonCode: null, reasonNameEn: null, reasonNameAr: null, reasonNote: null,
    occurredAt: '2026-11-24T00:00:00Z', ...overrides,
  };
}

function detail(actions: GovernedActionEntry[] = []): GovernedVersionDetail {
  return {
    id: 'version-1', versionNumber: 1, version: 1, status: 'APPROVED', contentHash: 'hash',
    registryVersion: '2026.11.1', effectiveFrom: '2026-11-24T00:00:00Z', effectiveTo: null,
    supersededAt: null, supersededByVersionId: null, createdBy: ME.id, submittedBy: ME.id,
    approvedBy: ME.id, approvedAt: '2026-11-24T00:01:00Z', restoredFromVersionId: null,
    content: { rules: [], defaultOutcome: 'ALLOW' }, testCases: [],
    definition: { id: 'policy-1', code: 'ORDER_POLICY', kind: 'PRICING_GUARD', scopeTarget: 'TENANT' },
    evidence: { validation: null, test: null }, actions,
  };
}

describe('GovernedReview actor identity', () => {
  const me = signal<AuthMe | null>(ME);
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    me.set(ME);
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en' }, loader: ReviewLoader }),
        { provide: LanguageState, useValue: { current: signal<'en' | 'ar'>('en') } },
        { provide: TenantScopeState, useValue: { me } },
      ],
    }).overrideComponent(GovernedReview, { set: { template: '' } });
  });

  afterEach(() => dispose());

  async function events(value: GovernedVersionDetail) {
    stub.register('GET', '/policy-versions/version-1', value);
    const fixture = TestBed.createComponent(GovernedReview);
    fixture.componentRef.setInput('detail', await getVersion('policy', 'version-1'));
    const rows = () => (fixture.componentInstance as unknown as { events(): ReviewTimelineItem[] }).events();
    return { fixture, rows };
  }

  it('uses API names for every actor, including IDs formerly used for demo identities', async () => {
    const id = '0193a000-0000-7000-8000-000000000001';
    const { rows } = await events(detail([
      action({ actorUserId: id, actorDisplayName: 'Actual Tenant Staff' }),
      action({ actorDisplayName: 'Server Staff Name' }),
    ]));
    expect(rows().filter((row) => row.action === 'SUBMIT').map((row) => row.actorDisplay))
      .toEqual(['Actual Tenant Staff', 'Server Staff Name']);
    expect(stub.recordedReads()[0].path).toBe('/policy-versions/version-1');
  });

  it('resolves milestones from the authenticated user and reacts to session changes', async () => {
    const { rows } = await events(detail());
    expect(rows()[0].actorDisplay).toBe('Current Staff');
    me.set({ ...ME, firstName: 'Updated' });
    expect(rows()[0].actorDisplay).toBe('Updated Staff');
    me.set(null);
    expect(rows()[0].actorDisplay).toBe(ME.id);
  });

  it('reuses API names for milestones and leaves unavailable identities unassigned', async () => {
    const value = detail([action({ actorUserId: 'approver', actorDisplayName: 'Real Approver' })]);
    value.approvedBy = 'approver';
    const { fixture, rows } = await events(value);
    expect(rows().find((row) => row.action === 'APPROVE')?.actorDisplay).toBe('Real Approver');
    fixture.componentRef.setInput('detail', { ...value, actions: [action({ actorUserId: null })], approvedAt: null });
    expect(rows()[0].actorDisplay).toBe('—');
  });
});

import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../public/i18n/en.json';
import enActivities from '../../../../../../public/i18n/activities/en.json';
import enCallLog from '../../../../../../public/i18n/call-log/en.json';
import enCrmModules from '../../../../../../public/i18n/crm-modules/en.json';
import enDateRange from '../../../../../../public/i18n/date-range/en.json';
import enGeo from '../../../../../../public/i18n/geo/en.json';
import enLeadDup from '../../../../../../public/i18n/lead-dup/en.json';
import enLeadForm from '../../../../../../public/i18n/lead-form/en.json';
import enLeadFormSide from '../../../../../../public/i18n/lead-form-side/en.json';
import enLeadModal from '../../../../../../public/i18n/lead-modal/en.json';
import enLeadPage from '../../../../../../public/i18n/lead-page/en.json';
import enLeads from '../../../../../../public/i18n/leads/en.json';
import enPartyCalls from '../../../../../../public/i18n/party-calls/en.json';
import enRecordActivitiesTab from '../../../../../../public/i18n/record-activities-tab/en.json';
import enRecordAttachments from '../../../../../../public/i18n/record-attachments/en.json';
import enRecordDup from '../../../../../../public/i18n/record-dup/en.json';
import enRecordFields from '../../../../../../public/i18n/record-fields/en.json';
import enRecordForm from '../../../../../../public/i18n/record-form/en.json';
import enRecordHistory from '../../../../../../public/i18n/record-history/en.json';
import enRecordPage from '../../../../../../public/i18n/record-page/en.json';
import enRecordRelated from '../../../../../../public/i18n/record-related/en.json';
import enUiPagination from '../../../../../../public/i18n/ui-pagination/en.json';
import enUiPhone from '../../../../../../public/i18n/ui-phone/en.json';
import enUiTagPicker from '../../../../../../public/i18n/ui-tag-picker/en.json';
import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { listActivities } from '../../../../shared/widgets/activities/activities.api';
import { fakeCreate, resetActivitiesFake, setFakeActivitiesDelay } from '../../../../shared/widgets/activities/activities.fake';
import type { LeadDraft } from '../lead-form/lead-draft';
import { LeadForm } from '../lead-form/lead-form';
import { fakeGetLead, fakePatchLead } from '../leads.fake';
import type { LeadDetail } from '../leads.model';
import { LeadPage } from './lead-page';

/** lead-001 (Nile Logistics): seeded open corporate lead on branch b1 (Cairo HQ, company c1) with seeded audit history. */
const LEAD_ID = 'lead-001';
const MISSING_ID = 'lead-999';

const TRANSLATIONS: Record<string, Translation> = {
  en: enGlobal,
  'activities/en': enActivities,
  'call-log/en': enCallLog,
  'crm-modules/en': enCrmModules,
  'date-range/en': enDateRange,
  'geo/en': enGeo,
  'leads/en': enLeads,
  'lead-page/en': enLeadPage,
  'lead-modal/en': enLeadModal,
  'lead-form/en': enLeadForm,
  'lead-form-side/en': enLeadFormSide,
  'lead-dup/en': enLeadDup,
  'party-calls/en': enPartyCalls,
  'record-activities-tab/en': enRecordActivitiesTab,
  'record-attachments/en': enRecordAttachments,
  'record-dup/en': enRecordDup,
  'record-fields/en': enRecordFields,
  'record-form/en': enRecordForm,
  'record-history/en': enRecordHistory,
  'record-page/en': enRecordPage,
  'record-related/en': enRecordRelated,
  'ui-pagination/en': enUiPagination,
  'ui-phone/en': enUiPhone,
  'ui-tag-picker/en': enUiTagPicker,
};

/** Answers on a microtask, never synchronously (a synchronous loader triggers NG0600). */
@Injectable()
class AsyncTestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(TRANSLATIONS[path] ?? {}));
  }
}

@Component({ template: '' })
class StubPage {}

/** Read-only access to the page's protected state (no source change). */
interface PageInternals {
  draft(): LeadDraft;
  detail(): LeadDetail | null;
  updatedAt: { (): string | null; set(value: string | null): void };
  activityCount(): number;
  dirty(): boolean;
  saving(): boolean;
  loading(): boolean;
  showSkeleton(): boolean;
  conflictOpen(): boolean;
  activeTab(): string;
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

/** Advances fake timers until the promise settles (fake APIs wait a few hundred ms). */
async function settle<T>(promise: Promise<T>, maxMs = 20_000): Promise<T> {
  let done = false;
  const guarded = promise.then(
    (value) => {
      done = true;
      return { ok: true as const, value };
    },
    (error: unknown) => {
      done = true;
      return { ok: false as const, error };
    },
  );
  for (let elapsed = 0; !done && elapsed < maxMs; elapsed += 100) {
    await vi.advanceTimersByTimeAsync(100);
  }
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

// Page mounts drive many fake calls through fake timers; real time per test can exceed the 5 s default
// on a loaded machine. Math.random is pinned so fake API delays are fixed and responses never race.
describe('LeadPage', { timeout: 60_000 }, () => {
  let harness: RouterTestingHarness;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
    setFakeActivitiesDelay(0);
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      // Browsers fire `close` as a queued task, after the caller's synchronous code.
      setTimeout(() => this.dispatchEvent(new Event('close')));
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'crm/leads/:id', component: LeadPage },
          { path: 'crm/leads', component: StubPage },
          { path: 'crm/off/leads', component: StubPage },
          { path: 'not-found', component: StubPage },
        ]),
        provideTransloco({
          config: {
            availableLangs: ['ar', 'en'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            missingHandler: { logMissingKey: false },
          },
          loader: AsyncTestLoader,
        }),
      ],
    });
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    // Drain fake API timers: module-level fakes cache promises (for example the audit fake's lead roots), and a
    // promise whose timer is dropped by useRealTimers() would never settle for the next test.
    await vi.advanceTimersByTimeAsync(5_000);
    resetActivitiesFake();
    setFakeActivitiesDelay(300);
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.removeItem('lang');
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
  });

  function host(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  /** Runs change detection and timers until the condition holds. */
  async function waitFor(condition: () => boolean, maxMs = 20_000, describeState?: () => unknown): Promise<void> {
    for (let elapsed = 0; elapsed < maxMs; elapsed += 100) {
      harness.detectChanges();
      if (condition()) return;
      await vi.advanceTimersByTimeAsync(100);
    }
    harness.detectChanges();
    const state = describeState ? JSON.stringify(describeState()) : '';
    expect(condition(), `condition not met in time ${state}`).toBe(true);
  }

  async function openReady(id: string): Promise<PageInternals> {
    harness = await settle(RouterTestingHarness.create());
    const component = await settle(harness.navigateByUrl(`/crm/leads/${id}`, LeadPage));
    const page = component as unknown as PageInternals;
    await waitFor(() => page.detail()?.id === id && !page.loading() && !page.showSkeleton());
    // Let tab counts, lookups and capabilities settle.
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(100);
      harness.detectChanges();
    }
    return page;
  }

  function form(): LeadForm {
    return harness.fixture.debugElement.query(By.directive(LeadForm)).componentInstance as LeadForm;
  }

  function editDraft(patch: Partial<LeadDraft>): void {
    const f = form();
    f.draft.set({ ...f.draft(), ...patch });
    harness.detectChanges();
  }

  function headerSaveButton(): HTMLButtonElement | null {
    const header = host().querySelector('app-record-page-header');
    if (!header) return null;
    return (
      Array.from(header.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === enRecordPage.save,
      ) ?? null
    );
  }

  /** Text of the company or branch field: a read-only input when locked, the dropdown trigger otherwise. */
  function scopeFieldText(field: 'company' | 'branch'): string {
    const scope = host().querySelector('app-scope-fields');
    expect(scope, 'scope fields').not.toBeNull();
    const control = scope!.querySelector<HTMLElement>(`[id$="-${field}"]`);
    expect(control, `${field} control`).not.toBeNull();
    return (control instanceof HTMLInputElement ? control.value : (control!.textContent ?? '')).trim();
  }

  function tabButton(tab: string): HTMLButtonElement {
    const button = host().querySelector<HTMLButtonElement>(`[role="tab"][id$="-tab-${tab}"]`);
    expect(button, `tab ${tab}`).not.toBeNull();
    return button!;
  }

  function panel(tab: string): HTMLElement | null {
    return host().querySelector<HTMLElement>(`[role="tabpanel"][id$="-panel-${tab}"]`);
  }

  function conflictDialog(): HTMLDialogElement | undefined {
    return Array.from(host().querySelectorAll<HTMLDialogElement>('dialog')).find((item) =>
      item.textContent?.includes(enRecordPage.conflict.title),
    );
  }

  function dialogButton(dialog: HTMLDialogElement, label: string): HTMLButtonElement {
    const button = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.trim() === label,
    );
    expect(button, `dialog button ${label}`).toBeDefined();
    return button!;
  }

  async function clickSave(page: PageInternals): Promise<void> {
    const button = headerSaveButton();
    expect(button, 'header save button').not.toBeNull();
    button!.click();
    harness.detectChanges();
    await waitFor(() => !page.saving());
  }

  describe('load by id', () => {
    it('loads lead-001 and renders its name in the header', async () => {
      const page = await openReady(LEAD_ID);
      const row = page.detail()!;

      expect(row.displayName).toBe('Nile Logistics');
      expect(host().querySelector('app-record-page-header')!.textContent).toContain('Nile Logistics');
      expect(page.dirty()).toBe(false);
    });

    it('navigates to /not-found for an unknown id (404 LEAD_NOT_FOUND)', async () => {
      harness = await settle(RouterTestingHarness.create());
      await settle(harness.navigateByUrl(`/crm/leads/${MISSING_ID}`));
      const router = TestBed.inject(Router);
      await waitFor(() => router.url === '/not-found');
      expect(host().querySelector('app-lead-form')).toBeNull();
    });
  });

  describe('draft from the record', () => {
    it('fills branch from the record and shows its company and branch', async () => {
      const page = await openReady(LEAD_ID);
      const draft = page.draft();

      expect(draft.branchId).toBe('b1');
      expect(draft.leadProfileType).toBe('CORPORATE');
      expect(draft.companyName).toBe('Nile Logistics');
      expect(scopeFieldText('company')).toBe(FAKE_COMPANIES[0].nameEn);
      expect(scopeFieldText('branch')).toBe(FAKE_COMPANIES[0].branches[0].nameEn);
      expect(page.dirty()).toBe(false);
    });
  });

  describe('save', () => {
    it('sends only the changed fields in the PATCH body', async () => {
      const page = await openReady(LEAD_ID);
      const loaded = page.detail()!;

      // Another writer changes the interest summary; the page keeps its stale value in base/draft but is given the new
      // version token, so a full-body PATCH would write the stale interest summary back over the other writer.
      const other = await settle(
        fakePatchLead(LEAD_ID, {
          interestSummary: 'Changed by another user',
          expectedUpdatedAt: loaded.updatedAt,
        }),
      );
      page.updatedAt.set(other.updatedAt);
      expect(page.draft().interestSummary).not.toBe('Changed by another user');

      editDraft({ description: 'Edited in the page spec' });
      expect(page.dirty()).toBe(true);
      await clickSave(page);

      const stored = await settle(fakeGetLead(LEAD_ID));
      expect(stored.description).toBe('Edited in the page spec');
      expect(stored.interestSummary).toBe('Changed by another user');
      expect(stored.displayName).toBe(loaded.displayName);
      expect(stored.status).toBe(loaded.status);
      expect(stored.stageId).toBe(loaded.stageId);
      expect(stored.ownerUserId).toBe(loaded.ownerUserId);
      expect(page.dirty()).toBe(false);
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });

    it('opens the conflict dialog on 409 and, on keep, re-saves the edit on top of the fresh record', async () => {
      const page = await openReady(LEAD_ID);
      const loaded = page.detail()!;
      await settle(
        fakePatchLead(LEAD_ID, { interestSummary: 'Concurrent interest', expectedUpdatedAt: loaded.updatedAt }),
      );

      editDraft({ description: 'Kept description' });
      headerSaveButton()!.click();
      harness.detectChanges();
      await waitFor(() => page.conflictOpen() && conflictDialog()?.hasAttribute('open') === true);

      dialogButton(conflictDialog()!, enRecordPage.conflict.keepEditing).click();
      await waitFor(() => !page.conflictOpen() && !page.saving() && !page.dirty());

      const stored = await settle(fakeGetLead(LEAD_ID));
      expect(stored.description).toBe('Kept description');
      expect(stored.interestSummary).toBe('Concurrent interest');
      expect(page.detail()!.description).toBe('Kept description');
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });

    it('reloads the fresh record and drops the edit when the user picks reload on 409', async () => {
      const page = await openReady(LEAD_ID);
      const loaded = page.detail()!;
      await settle(
        fakePatchLead(LEAD_ID, { interestSummary: 'Reloaded interest', expectedUpdatedAt: loaded.updatedAt }),
      );

      editDraft({ description: 'Discarded description' });
      headerSaveButton()!.click();
      harness.detectChanges();
      await waitFor(() => page.conflictOpen() && conflictDialog()?.hasAttribute('open') === true);

      dialogButton(conflictDialog()!, enRecordPage.conflict.reload).click();
      await waitFor(() => page.detail()?.interestSummary === 'Reloaded interest' && !page.dirty());

      expect(page.draft().description).toBe((loaded.description ?? '').trim());
      const stored = await settle(fakeGetLead(LEAD_ID));
      expect(stored.description).toBe(loaded.description);
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });
  });

  describe('tabs', () => {
    it('switches tabs and renders each panel', async () => {
      const page = await openReady(LEAD_ID);
      const router = TestBed.inject(Router);

      for (const tab of ['activities', 'attachments', 'history'] as const) {
        tabButton(tab).click();
        await waitFor(() => page.activeTab() === tab && panel(tab) !== null);
        expect(panel(tab)!.className).not.toContain('hidden');
        expect(panel('overview')!.className).toContain('hidden');
        expect(tabButton(tab).getAttribute('aria-selected')).toBe('true');
        await waitFor(() => router.url.includes(`tab=${tab}`));
      }
      expect(panel('activities')!.querySelector('app-record-activities-tab')).not.toBeNull();
      expect(panel('attachments')!.querySelector('app-record-attachments')).not.toBeNull();
      expect(panel('history')!.querySelector('app-record-history')).not.toBeNull();

      tabButton('overview').click();
      await waitFor(() => page.activeTab() === 'overview');
      expect(panel('overview')!.className).not.toContain('hidden');
      await waitFor(() => !router.url.includes('tab='));
    });
  });

  describe('activities count', () => {
    it('reads the open count from CorePage meta.total, not from the page length', async () => {
      const seededQuery = {
        targetApp: 'CRM',
        targetType: 'LEAD',
        targetId: LEAD_ID,
        statuses: ['PLANNED', 'IN_PROGRESS'],
        page: 1,
        limit: 1,
      } as const;
      // lead-001 already has 3 seeded open activities.
      const seeded = (await settle(listActivities({ ...seededQuery, statuses: [...seededQuery.statuses] }))).meta.total;
      expect(seeded).toBe(3);
      const dueAt = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
      for (const subject of ['Call one', 'Call two', 'Call three']) {
        await settle(
          fakeCreate({
            target: { app: 'CRM', type: 'LEAD', id: LEAD_ID },
            type: 'CALL',
            subject,
            dueAt,
          }),
        );
      }
      const query = await settle(
        listActivities({
          targetApp: 'CRM',
          targetType: 'LEAD',
          targetId: LEAD_ID,
          statuses: ['PLANNED', 'IN_PROGRESS'],
          page: 1,
          limit: 1,
        }),
      );
      expect(query.meta.total).toBe(6);
      expect(query.data.length).toBe(1);

      const page = await openReady(LEAD_ID);
      await waitFor(() => page.activityCount() === 6);
      expect(tabButton('activities').textContent).toContain('6');
    });
  });

  describe('history tab', () => {
    it('shows the seeded audit events of lead-001', async () => {
      const page = await openReady(LEAD_ID);
      tabButton('history').click();
      const items = () => panel('history')?.querySelectorAll('[role="listitem"]') ?? [];
      await waitFor(
        () => page.activeTab() === 'history' && items().length >= 3,
        20_000,
        () => ({ tab: page.activeTab(), n: items().length, text: panel('history')?.textContent?.slice(0, 300) }),
      );

      const text = panel('history')!.textContent ?? '';
      expect(text).toContain('created the lead');
      expect(text).toContain('moved the lead to another stage');
      expect(text).toContain('updated the lead');
    });
  });
});

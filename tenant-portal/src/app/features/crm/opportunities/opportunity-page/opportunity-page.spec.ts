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
import enOppForm from '../../../../../../public/i18n/opportunity-form/en.json';
import enOppMoves from '../../../../../../public/i18n/opportunity-moves/en.json';
import enOppPage from '../../../../../../public/i18n/opportunity-page/en.json';
import enOpportunities from '../../../../../../public/i18n/opportunities/en.json';
import enPartyCalls from '../../../../../../public/i18n/party-calls/en.json';
import enRecordActivitiesTab from '../../../../../../public/i18n/record-activities-tab/en.json';
import enRecordAttachments from '../../../../../../public/i18n/record-attachments/en.json';
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
import { fakeGetOpportunity, fakePatchOpportunity } from '../opportunities.fake';
import { type OpportunityRow, opportunityRef } from '../opportunities.model';
import type { OpportunityDraft } from '../opportunity-form/opportunity-draft';
import { OpportunityForm } from '../opportunity-form/opportunity-form';
import { OpportunityPage } from './opportunity-page';

/** OP-30008: seeded on branch b1 (Cairo HQ, company c1), amount 6,200 KWD, with seeded audit history. */
const OP_30008_ID = '0192b8ea-7c4f-7a7d-9c9f-51c7f2b30008';
const MISSING_ID = '0192b8ea-7c4f-7a7d-9c9f-51c7f2b3ffff';

const TRANSLATIONS: Record<string, Translation> = {
  en: enGlobal,
  'activities/en': enActivities,
  'call-log/en': enCallLog,
  'crm-modules/en': enCrmModules,
  'date-range/en': enDateRange,
  'geo/en': enGeo,
  'opportunities/en': enOpportunities,
  'opportunity-page/en': enOppPage,
  'opportunity-form/en': enOppForm,
  'opportunity-moves/en': enOppMoves,
  'party-calls/en': enPartyCalls,
  'record-activities-tab/en': enRecordActivitiesTab,
  'record-attachments/en': enRecordAttachments,
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
  draft(): OpportunityDraft;
  detail(): OpportunityRow | null;
  updatedAt: { (): string | null; set(value: string | null): void };
  activityCount(): number;
  dirty(): boolean;
  saving(): boolean;
  loading(): boolean;
  notFound(): boolean;
  showSkeleton(): boolean;
  activeTab(): string;
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

/** Advances fake timers until the promise settles (fake APIs wait 250-500 ms). */
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
describe('OpportunityPage', { timeout: 60_000 }, () => {
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
          { path: 'crm/opportunities/:id', component: OpportunityPage },
          { path: 'crm/opportunities', component: StubPage },
          { path: 'crm/off/opportunities', component: StubPage },
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

  async function open(id: string): Promise<{ page: PageInternals; component: OpportunityPage }> {
    harness = await settle(RouterTestingHarness.create());
    const component = await settle(harness.navigateByUrl(`/crm/opportunities/${id}`, OpportunityPage));
    const page = component as unknown as PageInternals;
    await waitFor(() => (!page.loading() && !page.showSkeleton()) || page.notFound());
    return { page, component };
  }

  async function openReady(id: string) {
    const opened = await open(id);
    await waitFor(() => opened.page.detail()?.id === id);
    // Let tab counts, lookups and capabilities settle.
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(100);
      harness.detectChanges();
    }
    return opened;
  }

  function form(): OpportunityForm {
    return harness.fixture.debugElement.query(By.directive(OpportunityForm)).componentInstance as OpportunityForm;
  }

  function editDraft(patch: Partial<OpportunityDraft>): void {
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

  function conflictDialog(): HTMLDialogElement {
    const dialog = Array.from(host().querySelectorAll<HTMLDialogElement>('dialog')).find((item) =>
      item.textContent?.includes(enOppPage.conflict.title),
    );
    expect(dialog, 'conflict dialog').toBeDefined();
    return dialog!;
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
    it('loads OP-30008 and renders its title and reference in the header', async () => {
      const { page } = await openReady(OP_30008_ID);
      const row = page.detail()!;

      expect(opportunityRef(row.id)).toBe('OP-30008');
      expect(page.notFound()).toBe(false);
      const header = host().querySelector('app-record-page-header')!;
      expect(header.textContent).toContain(row.title);
      expect(header.textContent).toContain('OP-30008');
      expect(page.dirty()).toBe(false);
    });

    it('shows the not-found state for an unknown id (404 OPPORTUNITY_NOT_FOUND)', async () => {
      const { page } = await open(MISSING_ID);
      await waitFor(() => page.notFound());

      expect(page.detail()).toBeNull();
      expect(host().textContent).toContain(enOppPage.notFound.text);
      expect(harness.routeDebugElement).toBeTruthy();
      expect(TestBed.inject(Router).url).toBe(`/crm/opportunities/${MISSING_ID}`);
    });
  });

  describe('draft from the record', () => {
    it('fills currency KWD, company and branch from OP-30008', async () => {
      const { page } = await openReady(OP_30008_ID);
      const draft = page.draft();

      expect(draft.currencyCode).toBe('KWD');
      expect(draft.amount).toBe('6200.00000000');
      expect(draft.branchId).toBe('b1');
      expect(draft.companyId).toBe('c1');

      expect(scopeFieldText('company')).toBe(FAKE_COMPANIES[0].nameEn);
      expect(scopeFieldText('branch')).toBe(FAKE_COMPANIES[0].branches[0].nameEn);
      expect(host().querySelector('app-opportunity-form')!.textContent).toContain('KWD');
      expect(page.dirty()).toBe(false);
    });
  });

  describe('save', () => {
    it('sends only the changed fields in the PATCH body', async () => {
      const { page } = await openReady(OP_30008_ID);
      const loaded = page.detail()!;

      // Another writer changes the description; the page keeps its stale description in base/draft but is given the
      // new version token, so a full-body PATCH would write the stale description back over the other writer.
      const other = await settle(
        fakePatchOpportunity(OP_30008_ID, {
          description: 'Changed by another user',
          expectedUpdatedAt: loaded.updatedAt,
        }),
      );
      page.updatedAt.set(other.updatedAt);
      expect(page.draft().description || null).toBeNull();

      editDraft({ title: 'Renamed in the page spec' });
      expect(page.dirty()).toBe(true);
      await clickSave(page);

      const stored = await settle(fakeGetOpportunity(OP_30008_ID));
      expect(stored.title).toBe('Renamed in the page spec');
      expect(stored.description).toBe('Changed by another user');
      expect(stored.amount).toBe(loaded.amount);
      expect(stored.currencyCode).toBe('KWD');
      expect(stored.ownerUserId).toBe(loaded.ownerUserId);
      expect(stored.stageId).toBe(loaded.stageId);
      expect(page.dirty()).toBe(false);
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });

    it('opens the conflict dialog on 409 and keeps the edit, rebased on the fresh record', async () => {
      const { page } = await openReady(OP_30008_ID);
      const loaded = page.detail()!;
      await settle(
        fakePatchOpportunity(OP_30008_ID, { description: 'Concurrent edit', expectedUpdatedAt: loaded.updatedAt }),
      );

      editDraft({ title: 'My title' });
      headerSaveButton()!.click();
      harness.detectChanges();
      await waitFor(() => conflictDialog().hasAttribute('open'));

      dialogButton(conflictDialog(), enOppPage.conflict.keepEditing).click();
      await waitFor(() => page.detail()?.description === 'Concurrent edit');

      expect(page.draft().title).toBe('My title');
      expect(page.draft().description).toBe('Concurrent edit');
      expect(page.dirty()).toBe(true);
      const afterConflict = await settle(fakeGetOpportunity(OP_30008_ID));
      expect(afterConflict.title).toBe(loaded.title);

      await clickSave(page);
      const stored = await settle(fakeGetOpportunity(OP_30008_ID));
      expect(stored.title).toBe('My title');
      expect(stored.description).toBe('Concurrent edit');
      expect(page.dirty()).toBe(false);
    });

    it('reloads the fresh record and drops the edit when the user picks reload on 409', async () => {
      const { page } = await openReady(OP_30008_ID);
      const loaded = page.detail()!;
      await settle(
        fakePatchOpportunity(OP_30008_ID, { description: 'Reload me', expectedUpdatedAt: loaded.updatedAt }),
      );

      editDraft({ title: 'Discarded title' });
      headerSaveButton()!.click();
      harness.detectChanges();
      await waitFor(() => conflictDialog().hasAttribute('open'));

      dialogButton(conflictDialog(), enOppPage.conflict.reload).click();
      await waitFor(() => page.detail()?.description === 'Reload me' && !page.dirty());

      expect(page.draft().title).toBe(loaded.title);
      const stored = await settle(fakeGetOpportunity(OP_30008_ID));
      expect(stored.title).toBe(loaded.title);
      expect(page.updatedAt()).toBe(stored.updatedAt);
    });
  });

  describe('tabs', () => {
    it('switches tabs and renders each panel', async () => {
      const { page } = await openReady(OP_30008_ID);
      const router = TestBed.inject(Router);

      for (const tab of ['activities', 'attachments', 'history', 'stages'] as const) {
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
      expect(panel('stages')!.querySelector('app-opportunity-stages-tab')).not.toBeNull();

      tabButton('overview').click();
      await waitFor(() => page.activeTab() === 'overview');
      expect(panel('overview')!.className).not.toContain('hidden');
      await waitFor(() => !router.url.includes('tab='));
    });
  });

  describe('activities count', () => {
    it('reads the open count from CorePage meta.total, not from the page length or the row', async () => {
      const dueAt = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
      for (const subject of ['Call one', 'Call two', 'Call three']) {
        await settle(
          fakeCreate({ target: { app: 'CRM', type: 'OPPORTUNITY', id: OP_30008_ID }, type: 'CALL', subject, dueAt }),
        );
      }
      const query = await settle(
        listActivities({
          targetApp: 'CRM',
          targetType: 'OPPORTUNITY',
          targetId: OP_30008_ID,
          statuses: ['PLANNED', 'IN_PROGRESS'],
          page: 1,
          limit: 1,
        }),
      );
      expect(query.meta.total).toBe(3);
      expect(query.data.length).toBe(1);

      const { page } = await openReady(OP_30008_ID);
      expect(page.detail()!.openActivityCount).not.toBe(3);
      await waitFor(() => page.activityCount() === 3);
      expect(tabButton('activities').textContent).toContain('3');
    });
  });

  describe('history tab', () => {
    it('shows the seeded audit events of OP-30008', async () => {
      const { page } = await openReady(OP_30008_ID);
      tabButton('history').click();
      const items = () => panel('history')?.querySelectorAll('[role="listitem"]') ?? [];
      await waitFor(
        () => page.activeTab() === 'history' && items().length >= 3,
        20_000,
        () => ({ tab: page.activeTab(), n: items().length, text: panel('history')?.textContent?.slice(0, 300) }),
      );

      const text = panel('history')!.textContent ?? '';
      expect(text).toContain('created the opportunity');
      expect(text).toContain('moved the opportunity to another stage');
      expect(text).toContain('updated the opportunity');
    });
  });
});

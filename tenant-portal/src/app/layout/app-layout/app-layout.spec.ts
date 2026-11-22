import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TRANSLOCO_LOADER, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession, type RenewalState } from '../../core/auth/auth-session';
import type { SessionStatus } from '../../core/auth/auth-session.model';
import { CurrentUser } from '../../core/auth/current-user';
import { Notify } from '../../core/notify/notify';
import { PhoneState } from '../../core/phone/phone';
import { ViewScale } from '../../core/view/view-scale';
import { CrmModules } from '../../features/crm/shared/crm-modules/crm-modules';
import { OverCapacityNotice } from '../../features/workspace/seats/over-capacity/over-capacity-notice.service';
import { StaffReadAccess } from '../../features/workspace/staff/staff-read-access';
import { BulkJobsTracker } from '../../shared/bulk-jobs';
import { AppLayout } from './app-layout';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
});

function setup(statusValue: SessionStatus = 'signed-in', renewalValue: RenewalState = 'ok') {
  const status = signal<SessionStatus>(statusValue);
  const renewal = signal<RenewalState>(renewalValue);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
      { provide: AuthSession, useValue: { status, renewal, me: signal(null) } },
      { provide: CurrentUser, useValue: {} },
      { provide: PhoneState, useValue: {} },
      { provide: ViewScale, useValue: {} },
      { provide: BulkJobsTracker, useValue: {} },
      { provide: StaffReadAccess, useValue: { availablePages: () => [] } },
      { provide: CrmModules, useValue: {
        ensureLoaded: vi.fn().mockResolvedValue(undefined),
        leadsEnabled: () => true,
        opportunitiesEnabled: () => true,
      } },
      { provide: OverCapacityNotice, useValue: { start: vi.fn() } },
    ],
  });
  // Exercise the real layout effects without creating unrelated shell components.
  TestBed.overrideComponent(AppLayout, { set: { template: '', imports: [] } });
  const transloco = TestBed.inject(TranslocoService);
  transloco.setTranslation({ session: { connectionLost: { title: "Can't reach the server", text: 'Retrying automatically' } } }, 'en');
  transloco.setTranslation({ session: { connectionLost: { title: 'تعذّر الوصول إلى الخادم', text: 'تجري إعادة المحاولة تلقائيًا' } } }, 'ar');
  transloco.setActiveLang('en');
  const notify = TestBed.inject(Notify);
  const lost = vi.spyOn(notify, 'connectionLost');
  const restored = vi.spyOn(notify, 'connectionRestored');
  const fixture = TestBed.createComponent(AppLayout);
  const flush = () => {
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };
  flush();
  return { status, renewal, notify, lost, restored, transloco, flush };
}

describe('AppLayout session connection toast', () => {
  it('shows translated connection text when signed-in renewal starts retrying', () => {
    const { renewal, notify, lost, flush } = setup();
    expect(notify.toasts()).toEqual([]);
    renewal.set('retrying');
    flush();
    expect(lost).toHaveBeenCalledWith("Can't reach the server", 'Retrying automatically');
    expect(notify.toasts()).toHaveLength(1);
    expect(notify.toasts()[0].pinned).toBe(true);
  });

  it('restores the connection toast when renewal returns to ok', () => {
    const { renewal, notify, restored, flush } = setup('signed-in', 'retrying');
    expect(notify.toasts()).toHaveLength(1);
    restored.mockClear();
    renewal.set('ok');
    flush();
    expect(restored).toHaveBeenCalledOnce();
    expect(notify.toasts()).toEqual([]);
  });

  it.each(['failed', 'signed-out'] as const)('does not show a toast while %s, even if retrying', (status) => {
    const { notify, lost, restored } = setup(status, 'retrying');
    expect(lost).not.toHaveBeenCalled();
    expect(restored).toHaveBeenCalledOnce();
    expect(notify.toasts()).toEqual([]);
  });

  it.each(['failed', 'signed-out'] as const)('removes the pinned toast on transition to %s', (nextStatus) => {
    const { status, notify, flush } = setup('signed-in', 'retrying');
    expect(notify.toasts()).toHaveLength(1);
    status.set(nextStatus);
    flush();
    expect(notify.toasts()).toEqual([]);
  });

  it('updates the same toast id when the language changes', () => {
    const { notify, transloco, flush } = setup('signed-in', 'retrying');
    const id = notify.toasts()[0].id;
    transloco.setActiveLang('ar');
    flush();
    expect(notify.toasts()).toEqual([
      { id, type: 'error', title: 'تعذّر الوصول إلى الخادم', text: 'تجري إعادة المحاولة تلقائيًا', count: 1, pinned: true },
    ]);
  });
});

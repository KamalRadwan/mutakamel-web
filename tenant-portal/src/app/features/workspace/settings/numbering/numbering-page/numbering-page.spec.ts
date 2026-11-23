import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import settings from '../../../../../../../public/i18n/settings/en.json';
import wsNumbering from '../../../../../../../public/i18n/ws-numbering/en.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { NumberingModal } from '../numbering-modal/numbering-modal';
import { NumberingApi } from '../numbering.api';
import { NumberingPage } from './numbering-page';
import { By } from '@angular/platform-browser';

const empty = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };

describe('Numbering page', () => {
  let fixture: ComponentFixture<NumberingPage>;
  let dialogMethods: PropertyDescriptorMap;
  const me = signal({ id: 'actor', isTenantOwner: false, permissions: ['numbering.read', 'numbering.manage'],
    accessibleCompanies: ['0193a100-0000-7000-8000-000000000001'],
    permissionScopes: { 'numbering.manage': { tenantWide: true, companyIds: [], branchIds: [] } },
  } as unknown as TenantMe);
  const api = { scopeRevision: () => JSON.stringify(me()), listNumbering: vi.fn(), createNumbering: vi.fn() };
  const lookups = { allCompanies: vi.fn() };
  const notify = { error: vi.fn(), success: vi.fn(), connectionLost: vi.fn(), connectionRestored: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    dialogMethods = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.open = true; },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); },
    });
    api.listNumbering.mockResolvedValue(empty);
    lookups.allCompanies.mockResolvedValue([]);
    TestBed.configureTestingModule({
      imports: [NumberingPage, TranslocoTestingModule.forRoot({ langs: { en: { settings, wsNumbering } },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' }, preloadLangs: true })],
      providers: [{ provide: AuthSession, useValue: { me } }, { provide: NumberingApi, useValue: api },
        { provide: WorkspaceLookups, useValue: lookups }, { provide: Notify, useValue: notify },
        { provide: LanguageState, useValue: { current: signal('en') } }],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    for (const name of ['showModal', 'close']) {
      const descriptor = dialogMethods[name];
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  });

  async function render() {
    fixture = TestBed.createComponent(NumberingPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('empty list shows the empty state', async () => {
    expect((await render()).textContent).toContain(wsNumbering.empty.title);
  });

  it('403 shows forbidden', async () => {
    api.listNumbering.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    const host = await render();
    expect(host.querySelector('ui-full-state h1')?.textContent).toContain(settings.errors.permission);
    expect(host.querySelector('[role="table"]')).toBeNull();
  });

  it('5xx and offline show load-failure', async () => {
    api.listNumbering.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR'))
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR')).mockResolvedValue(empty);
    const host = await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(settings.common.loadFailed);
    expect(host.querySelector('[role="table"]')).toBeNull();
    host.querySelector<HTMLButtonElement>('ui-full-state button')!.click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(host.textContent).toContain(settings.common.loadFailed);
    expect(notify.connectionLost).toHaveBeenCalledOnce();
    host.querySelector<HTMLButtonElement>('ui-full-state button')!.click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(host.textContent).toContain(wsNumbering.empty.title);
    expect(notify.connectionRestored).toHaveBeenCalled();
  });

  it('scoped reader sees the workspace-sequences note', async () => {
    expect((await render()).textContent).toContain(wsNumbering.scopedNote);
  });

  it('lookup 403 falls back to /me companies', async () => {
    lookups.allCompanies.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    const host = await render();
    const modal = fixture.debugElement.query(By.directive(NumberingModal)).componentInstance as NumberingModal;
    expect(modal.companies()).toEqual([{ id: me().accessibleCompanies[0], label: 'Company 0193a100', active: true }]);
    expect(host.textContent).toContain(wsNumbering.companyLoadFailed);
  });

  it('access-policy 403 on write', async () => {
    api.createNumbering.mockRejectedValue(new ApiError(403, 'ACCESS_POLICY_BLOCKED'));
    const host = await render();
    const modal = fixture.debugElement.query(By.directive(NumberingModal)).componentInstance as NumberingModal;
    modal.openCreate(); fixture.detectChanges();
    const code = host.querySelector<HTMLInputElement>('input[id$="-code"]')!;
    code.value = 'INV'; code.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable(); fixture.detectChanges();
    expect(notify.error).toHaveBeenCalledWith(wsNumbering.errors.ACCESS_POLICY_BLOCKED);
    expect(host.querySelector<HTMLDialogElement>('ui-modal dialog')?.open).toBe(true);
  });

  it('modal save and missing-record events reload the list', async () => {
    await render();
    const modal = fixture.debugElement.query(By.directive(NumberingModal)).componentInstance as NumberingModal;
    const sequence = { id: 'seq', code: 'INV', companyId: null, prefix: null, padding: 5,
      nextValue: '1', createdAt: '2026-11-01', updatedAt: '2026-11-01' };
    modal.saved.emit({ sequence, isNew: true });
    await fixture.whenStable(); fixture.detectChanges();
    expect(api.listNumbering).toHaveBeenCalledTimes(2);
    modal.notFound.emit('seq');
    await fixture.whenStable(); fixture.detectChanges();
    expect(api.listNumbering).toHaveBeenCalledTimes(3);
  });

  it('table displays big counters without numeric conversion and pagination', async () => {
    api.listNumbering.mockResolvedValue({ ...empty, data: [{ id: 'seq', code: 'INV', companyId: null,
      prefix: 'INV-', padding: 5, nextValue: '9007199254740993', createdAt: '2026-11-01', updatedAt: '2026-11-01' }],
      meta: { ...empty.meta, total: 1, totalPages: 1 } });
    const host = await render();
    expect(host.querySelector('[role="table"]')?.textContent).toContain('9007199254740993');
    expect(host.querySelector('ui-pagination')).not.toBeNull();
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import settings from '../../../../../../../public/i18n/settings/en.json';
import wsNumbering from '../../../../../../../public/i18n/ws-numbering/en.json';
import ar from '../../../../../../../public/i18n/ws-numbering/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { NumberingApi } from '../numbering.api';
import type { NumberingPeek, NumberingSequence } from '../numbering.model';
import { NumberingModal } from './numbering-modal';

const sequence: NumberingSequence = { id: 'seq', code: 'INV', companyId: null,
  prefix: 'INV-', padding: 5, nextValue: '10', createdAt: '2026-11-01', updatedAt: '2026-11-01' };
const peek: NumberingPeek = { code: 'INV', companyId: null, formatted: 'INV-00010', nextValue: '10' };

describe('Numbering modal', () => {
  let fixture: ComponentFixture<NumberingModal>;
  let modal: NumberingModal;
  let host: HTMLElement;
  let dialogMethods: PropertyDescriptorMap;
  const api = { createNumbering: vi.fn(), updateNumbering: vi.fn(), peekNumbering: vi.fn() };
  const notify = { error: vi.fn(), success: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    dialogMethods = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.open = true; },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); },
    });
    api.createNumbering.mockResolvedValue(sequence);
    api.updateNumbering.mockResolvedValue({ ...sequence, nextValue: '11' });
    api.peekNumbering.mockResolvedValue(peek);
    TestBed.configureTestingModule({
      imports: [NumberingModal, TranslocoTestingModule.forRoot({ langs: { en: { settings, wsNumbering }, ar: { wsNumbering: ar } },
        translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' }, preloadLangs: true })],
      providers: [{ provide: NumberingApi, useValue: api }, { provide: Notify, useValue: notify },
        { provide: LanguageState, useValue: { current: signal('en') } }],
    });
    fixture = TestBed.createComponent(NumberingModal);
    fixture.componentRef.setInput('access', { tenantWideManage: true, manageCompanyIds: [] });
    fixture.componentRef.setInput('companies', [{ id: 'company', label: 'Company', active: true }]);
    fixture.detectChanges();
    await fixture.whenStable();
    modal = fixture.componentInstance;
    host = fixture.nativeElement;
  });

  afterEach(() => {
    fixture?.destroy();
    for (const name of ['showModal', 'close']) {
      const descriptor = dialogMethods[name];
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  });

  async function settle() { await fixture.whenStable(); fixture.detectChanges(); }
  function input(field: string, value: string) {
    const control = host.querySelector<HTMLInputElement>(`input[id$="-${field}"]`)!;
    control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
  function create() { modal.openCreate(); fixture.detectChanges(); input('code', 'INV'); }
  async function edit() { modal.openEdit(sequence); fixture.detectChanges(); await settle(); input('counter', '11'); }
  async function save() {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }
  function open() { return host.querySelector<HTMLDialogElement>('ui-modal dialog')!.open; }
  function fieldText(field: string) { return host.querySelector(`input[id$="-${field}"]`)?.closest('ui-field')?.textContent; }

  it('create succeeds', async () => {
    const saved = vi.fn(); modal.saved.subscribe(saved);
    create(); await save();
    expect(api.createNumbering).toHaveBeenCalledWith({ code: 'INV', padding: 5, startValue: 1 }, expect.any(String));
    expect(saved).toHaveBeenCalledWith({ sequence, isNew: true });
    expect(notify.success).toHaveBeenCalledWith(wsNumbering.toast.created);
    expect(open()).toBe(false);
  });

  it('prefix is trimmed like Core', async () => {
    create(); input('prefix', ' INV-'); await save();
    expect(api.createNumbering.mock.calls[0][0].prefix).toBe('INV-');
  });

  it('validation errors map to fields', async () => {
    api.createNumbering.mockRejectedValue(new ApiError(400, 'CORE_VALIDATION_FAILED', {
      code: ['Code rejected'], prefix: ['Prefix rejected'], padding: ['Padding rejected'], startValue: ['Counter rejected'],
    }));
    create(); await save();
    for (const [field, message] of [['code', 'Code rejected'], ['prefix', 'Prefix rejected'], ['padding', 'Padding rejected'], ['counter', 'Counter rejected']]) {
      expect(fieldText(field)).toContain(message);
    }
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('code taken is a field message', async () => {
    api.createNumbering.mockRejectedValue(new ApiError(409, 'SEQUENCE_CODE_TAKEN'));
    create(); await save();
    expect(fieldText('code')).toContain(wsNumbering.errors.SEQUENCE_CODE_TAKEN);
    expect(open()).toBe(true);
  });

  it('COMPANY_INVALID on create', async () => {
    api.createNumbering.mockRejectedValue(new ApiError(422, 'COMPANY_INVALID'));
    create(); await save();
    expect(host.querySelector('ui-dropdown')?.closest('ui-field')?.textContent).toContain(wsNumbering.errors.COMPANY_INVALID);
  });

  it('COMPANY_INVALID on update stays under the immutable company field', async () => {
    api.updateNumbering.mockRejectedValue(new ApiError(422, 'COMPANY_INVALID'));
    await edit(); await save();
    expect(fieldText('companyId')).toContain(wsNumbering.errors.COMPANY_INVALID);
  });

  it('403 on create shows a toast', async () => {
    create();
    for (const code of ['TENANT_WIDE_PERMISSION_REQUIRED', 'COMPANY_PERMISSION_DENIED'] as const) {
      api.createNumbering.mockRejectedValueOnce(new ApiError(403, code));
      await save();
      expect(notify.error).toHaveBeenLastCalledWith(wsNumbering.errors[code]);
      expect(open()).toBe(true);
    }
  });

  it('401 on create keeps the form', async () => {
    api.createNumbering.mockRejectedValueOnce(new ApiError(401, 'AUTH_REQUIRED'));
    create(); input('prefix', 'INV-'); await save();
    expect(notify.error).toHaveBeenCalledWith(wsNumbering.notSaved);
    expect(open()).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[id$="-prefix"]')!.value).toBe('INV-');
    await save();
    expect(api.createNumbering.mock.calls[1]).toEqual(api.createNumbering.mock.calls[0]);
  });

  it('idempotency codes use the core mapper', async () => {
    create();
    for (const [code, text] of [['GW.IDEM.IN_FLIGHT', settings.errors.idempotency],
      ['GW.IDEM.MISMATCH', settings.errors.idempotencyMismatch]]) {
      api.createNumbering.mockRejectedValueOnce(new ApiError(409, code));
      await save();
      expect(notify.error).toHaveBeenLastCalledWith(text);
    }
  });

  it('update succeeds', async () => {
    await edit(); await save();
    expect(api.updateNumbering).toHaveBeenCalledWith('seq', { nextValue: 11 }, expect.any(String));
    expect(notify.success).toHaveBeenCalledWith(wsNumbering.toast.updated);
    expect(open()).toBe(false);
  });

  it('lower next value is a field message', async () => {
    api.updateNumbering.mockRejectedValue(new ApiError(422, 'SEQUENCE_VALUE_INVALID'));
    await edit(); await save();
    expect(fieldText('counter')).toContain(wsNumbering.errors.SEQUENCE_VALUE_INVALID);
    expect(open()).toBe(true);
  });

  it('404 on update reloads', async () => {
    const notFound = vi.fn(); modal.notFound.subscribe(notFound);
    api.updateNumbering.mockRejectedValue(new ApiError(404, 'SEQUENCE_NOT_FOUND'));
    await edit(); await save();
    expect(notify.error).toHaveBeenCalledWith(wsNumbering.errors.SEQUENCE_NOT_FOUND);
    expect(notFound).toHaveBeenCalledWith('seq');
    expect(open()).toBe(false);
  });

  it('next value is capped', async () => {
    await edit(); input('counter', '9007199254740992'); await save();
    expect(api.updateNumbering).not.toHaveBeenCalled();
    expect(fieldText('counter')).toContain(wsNumbering.validation.counterFormat);
    input('counter', '9007199254740991'); await save();
    expect(api.updateNumbering.mock.calls[0][1].nextValue).toBe(9007199254740991);
  });

  it('peek 403 shows the workspace-wide text', async () => {
    api.peekNumbering.mockRejectedValue(new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'));
    await edit();
    expect(host.textContent).toContain(wsNumbering.peekNeedsTenantWide);
  });

  it('peek 404 shows not found', async () => {
    api.peekNumbering.mockRejectedValue(new ApiError(404, 'SEQUENCE_NOT_FOUND'));
    await edit(); expect(host.textContent).toContain(wsNumbering.preview.notFound);
  });

  it('older peek answers are ignored', async () => {
    let resolveOld!: (value: NumberingPeek) => void;
    api.peekNumbering.mockReturnValueOnce(new Promise<NumberingPeek>((resolve) => { resolveOld = resolve; }));
    modal.openEdit(sequence); fixture.detectChanges();
    modal.openEdit({ ...sequence, id: 'new', code: 'NEW' }); fixture.detectChanges();
    await settle();
    resolveOld({ ...peek, formatted: 'STALE-ANSWER' }); await settle();
    expect(host.textContent).not.toContain('STALE-ANSWER');
    expect(host.textContent).toContain(peek.formatted);
  });

  it('peek 429 is handled', async () => {
    api.peekNumbering.mockRejectedValue(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED'));
    await edit(); expect(host.textContent).toContain(settings.errors.rateLimited);
  });

  it('peek inactive company uses its specific text', async () => {
    api.peekNumbering.mockRejectedValue(new ApiError(422, 'COMPANY_INVALID'));
    await edit(); expect(host.textContent).toContain(wsNumbering.peekCompanyInactive);
  });

  it('field hints stay linked and include future-number guidance', () => {
    create();
    for (const field of ['code', 'prefix', 'padding', 'counter']) {
      const control = host.querySelector<HTMLInputElement>(`input[id$="-${field}"]`)!;
      expect(control.getAttribute('aria-describedby')).toContain(`${control.id}-hint`);
    }
    expect(fieldText('prefix')).toContain(wsNumbering.futureOnly);
    expect(fieldText('padding')).toContain(wsNumbering.futureOnly);
    expect(ar.futureOnly).toBeTruthy();
  });
});

import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { ApiError } from '../../../shared/trade-api';
import { bindTradeHttpForTest } from '../../../shared/trade-http';
import { TradeHttpStub } from '../../../shared/testing/trade-http-testing';
import { TERM_LIMITS, type TradeTerm } from '../../../shared/terms/terms.model';
import { TermModal } from './term-modal';

const TSET_EN: Translation = {
  types: { PAYMENT: 'Payment terms', GENERAL: 'Terms and conditions' },
  sides: { SALES: 'Sales', PURCHASE: 'Purchase', BOTH: 'Both' },
  incoterms: {},
  errors: {
    generic: 'Something went wrong. Try again.',
    TRADE_TERMS_CODE_TAKEN: 'This code is already used for this term type.',
  },
};

const TTERMS_EN: Translation = {
  modal: {
    newTitle: 'New term',
    save: 'Save',
    undo: 'Undo',
    unsaved: 'Unsaved changes',
    cancel: 'Cancel',
    close: 'Close',
    incotermNone: 'None',
    fields: {
      code: 'Code',
      side: 'Applies to',
      dueDays: 'Due days',
      nameAr: 'Arabic name',
      nameEn: 'English name',
      sortOrder: 'Order',
      textAr: 'Arabic text',
      textEn: 'English text',
      defaultFor: { SALES: 'Default for Sales', PURCHASE: 'Default for Purchase', BOTH: 'Default for Both' },
      active: 'Active',
    },
    placeholders: { code: 'NET30', dueDays: '30' },
    hints: {
      code: 'Code hint',
      side: 'Side hint',
      dueDays: 'Due days hint',
      nameAr: 'Arabic name hint',
      nameEn: 'English name hint',
      sortOrder: 'Order hint',
      textAr: 'Printed on Arabic documents (up to 400 characters).',
      textEn: 'Printed on English documents (up to 400 characters).',
      default: 'Default hint',
      active: 'Active hint',
    },
  },
  validation: {
    required: 'This field is required.',
    codePattern: 'Invalid code.',
    maxLength: 'At most {{max}} characters.',
    dueDaysRange: 'Enter a whole number from {{min}} to {{max}}.',
    sortOrderRange: 'Enter a whole number from {{min}} to {{max}}.',
  },
  status: { active: 'Active', inactive: 'Inactive' },
  conflict: { title: 'Term changed', text: 'Conflict', reload: 'Reload', keepMine: 'Keep my changes' },
  unsavedDialog: { title: 'Unsaved changes', text: 'Save?', save: 'Save', discard: 'Discard', cancel: 'Keep editing' },
  deleteConfirm: { title: 'Delete?', text: 'Confirm', confirm: 'Delete', cancel: 'Cancel' },
  toasts: {
    created: 'Term created',
    updated: 'Term updated',
    madeDefault: 'Default term updated',
    deleted: 'Term deleted',
  },
};

const SCOPED: Record<string, Translation> = {
  en: { tset: TSET_EN, tterms: TTERMS_EN },
  'trade-settings/en': TSET_EN,
  'trade-settings-terms/en': TTERMS_EN,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(SCOPED[path] ?? {});
  }
}

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
  el.dispatchEvent(new Event('blur'));
}

function sampleTerm(over: Partial<TradeTerm> = {}): TradeTerm {
  return {
    id: '019a0000-0000-7000-8000-000000000001',
    termType: 'GENERAL',
    side: 'SALES',
    code: 'GEN1',
    displayName: 'General term',
    localizedNames: { en: 'General term', ar: 'شرط عام' },
    localizedTexts: { en: 'General text', ar: 'نص عام' },
    dueDays: null,
    incotermCode: null,
    isDefault: false,
    isActive: true,
    sortOrder: 10,
    version: 1,
    updatedAt: '2026-11-23T00:00:00.000Z',
    ...over,
  };
}

describe('TermModal', () => {
  const fixtures: ComponentFixture<TermModal>[] = [];
  let stub: TradeHttpStub;
  let restoreHttp: () => void;

  beforeEach(() => {
    localStorage.removeItem('lang');
    localStorage.removeItem('scope');
    sessionStorage.removeItem('scope');
    document.documentElement.lang = 'en';
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    stub = new TradeHttpStub();
    restoreHttp = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()!.destroy();
    }
    restoreHttp();
    localStorage.removeItem('lang');
    localStorage.removeItem('scope');
    sessionStorage.removeItem('scope');
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
  });

  function configure(companyId = 'c1'): void {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
        {
          provide: ScopeState,
          useValue: {
            company: signal({ id: companyId, nameEn: 'Co', nameAr: 'شركة', branches: [{ id: 'b1', nameEn: 'B1', nameAr: 'ف1' }] }),
            branch: signal({ id: 'b1', nameEn: 'B1', nameAr: 'ف1' }),
          },
        },
      ],
    });
  }

  async function openCreate(type: 'PAYMENT' | 'GENERAL'): Promise<ComponentFixture<TermModal>> {
    configure();
    const fixture = TestBed.createComponent(TermModal);
    fixtures.push(fixture);
    fixture.detectChanges();
    fixture.componentInstance.openCreate(type, 10, 'SALES');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    return fixture;
  }

  async function openEdit(term: TradeTerm): Promise<ComponentFixture<TermModal>> {
    configure();
    const fixture = TestBed.createComponent(TermModal);
    fixtures.push(fixture);
    fixture.detectChanges();
    fixture.componentInstance.openEdit(term);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    return fixture;
  }

  type FormAccess = { form: { update(fn: (v: Record<string, unknown>) => Record<string, unknown>): void } };
  type SaveAccess = FormAccess & { save(): Promise<boolean> };

  it('accepts 400 characters and refuses 401 characters for Arabic and English term texts', async () => {
    expect(TERM_LIMITS.textMax).toBe(400);
    const fixture = await openCreate('PAYMENT');

    const el = fixture.nativeElement as HTMLElement;
    const codeInput = el.querySelector<HTMLInputElement>('input[id$="-code"]')!;
    const nameArInput = el.querySelector<HTMLInputElement>('input[id$="-name-ar"]')!;
    const nameEnInput = el.querySelector<HTMLInputElement>('input[id$="-name-en"]')!;
    const textArArea = el.querySelector<HTMLTextAreaElement>('textarea[id$="-text-ar"]')!;
    const textEnArea = el.querySelector<HTMLTextAreaElement>('textarea[id$="-text-en"]')!;

    setInputValue(codeInput, 'NET35');
    setInputValue(nameArInput, 'شرط 35');
    setInputValue(nameEnInput, 'Net 35');
    setInputValue(textArArea, 'ب'.repeat(400));
    setInputValue(textEnArea, 'a'.repeat(400));
    fixture.detectChanges();

    const saveBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('[modal-footer] button')).find(
      (btn) => btn.textContent?.trim() === 'Save',
    )!;
    expect(saveBtn.disabled).toBe(false);

    setInputValue(textEnArea, 'a'.repeat(401));
    fixture.detectChanges();
    expect(saveBtn.disabled).toBe(true);
    expect(textEnArea.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector<HTMLElement>(`#${textEnArea.id}-error`)?.textContent).toContain('At most 400 characters.');

    setInputValue(textEnArea, 'a'.repeat(400));
    setInputValue(textArArea, 'ب'.repeat(401));
    fixture.detectChanges();
    expect(saveBtn.disabled).toBe(true);
    expect(textArArea.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector<HTMLElement>(`#${textArArea.id}-error`)?.textContent).toContain('At most 400 characters.');
  });

  it('requires both texts even when the term is inactive', async () => {
    const fixture = await openCreate('GENERAL');
    (fixture.componentInstance as unknown as FormAccess).form.update((v) => ({
      ...v,
      code: 'INACT1',
      nameAr: 'شرط',
      nameEn: 'Term',
      textAr: 'نص',
      textEn: '',
      isActive: false,
    }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const saveBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('[modal-footer] button')).find(
      (btn) => btn.textContent?.trim() === 'Save',
    )!;
    expect(saveBtn.disabled).toBe(true);
  });

  it('omits dueDays and incotermCode from the create body for a type that does not use them', async () => {
    const created = sampleTerm({ code: 'OMITNULL' });
    stub.register('POST', '/terms', created);

    const fixture = await openCreate('GENERAL');
    (fixture.componentInstance as unknown as FormAccess).form.update((v) => ({
      ...v,
      code: 'OMITNULL',
      nameAr: 'شرط',
      nameEn: 'Term',
      textAr: 'نص',
      textEn: 'Text',
    }));
    fixture.detectChanges();

    expect(await (fixture.componentInstance as unknown as SaveAccess).save()).toBe(true);
    const writes = stub.recordedWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe('POST');
    expect(writes[0].path).toBe('/terms');
    expect(writes[0].scope).toEqual({ companyId: 'c1' });
    expect(writes[0].key).toBeTruthy();
    expect(writes[0].body).not.toHaveProperty('dueDays');
    expect(writes[0].body).not.toHaveProperty('incotermCode');
  });

  it('reuses one Idempotency-Key when the same update is retried and opens conflict modal on 409', async () => {
    const term = sampleTerm({ version: 1 });
    stub.register('PATCH', `/terms/${term.id}`, new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));

    const fixture = await openEdit(term);
    const modal = fixture.componentInstance as unknown as SaveAccess;
    modal.form.update((v) => ({ ...v, nameEn: 'Retry name' }));
    fixture.detectChanges();

    expect(await modal.save()).toBe(false);
    expect(await modal.save()).toBe(false);

    modal.form.update((v) => ({ ...v, nameEn: 'Retry name 2' }));
    fixture.detectChanges();
    expect(await modal.save()).toBe(false);

    const writes = stub.recordedWrites();
    expect(writes).toHaveLength(3);
    expect(writes[0].ifMatch).toBe('"1"');
    expect(writes[0].key).toBe(writes[1].key);
    expect(writes[2].key).not.toBe(writes[0].key);
    const conflictDialog = (fixture.nativeElement as HTMLElement).querySelectorAll('dialog')[1];
    expect(conflictDialog?.hasAttribute('open')).toBe(true);
  });

  it('emits the id of the term the delete call returns', async () => {
    const term = sampleTerm({ version: 2 });
    stub.register('DELETE', `/terms/${term.id}`, { ...term, version: 3 });

    const fixture = await openEdit(term);
    const deleted: string[] = [];
    fixture.componentInstance.deleted.subscribe((id) => deleted.push(id));
    const access = fixture.componentInstance as unknown as {
      deleteDialog(): { open(): Promise<boolean> };
      requestDelete(): Promise<void>;
    };
    vi.spyOn(access.deleteDialog(), 'open').mockResolvedValue(true);

    await access.requestDelete();
    expect(deleted).toEqual([term.id]);
    const writes = stub.recordedWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe('DELETE');
    expect(writes[0].path).toBe(`/terms/${term.id}`);
    expect(writes[0].ifMatch).toBe('"2"');
    expect(writes[0].scope).toEqual({ companyId: 'c1' });
  });

  it('emits forbidden without showing an error toast when save returns 403', async () => {
    const term = sampleTerm({ version: 1 });
    stub.register('PATCH', `/terms/${term.id}`, new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

    const fixture = await openEdit(term);
    const notifyError = vi.spyOn(TestBed.inject(Notify), 'error');
    const forbiddenSpy = vi.fn();
    fixture.componentInstance.forbidden.subscribe(forbiddenSpy);

    const modal = fixture.componentInstance as unknown as SaveAccess;
    modal.form.update((v) => ({ ...v, nameEn: 'Denied update' }));
    fixture.detectChanges();

    expect(await modal.save()).toBe(false);
    expect(forbiddenSpy).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
  });
});

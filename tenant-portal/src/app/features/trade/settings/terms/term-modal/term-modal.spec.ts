import { Injectable } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopeState } from '../../../../../core/scope/scope';
import { listAllTerms } from '../../../shared/terms/terms.api';
import { TERM_LIMITS, type TradeTerm } from '../../../shared/terms/terms.model';
import { TermModal } from './term-modal';

const TSET_EN: Translation = {
  types: { PAYMENT: 'Payment terms' },
  sides: { SALES: 'Sales', PURCHASE: 'Purchase', BOTH: 'Both' },
  incoterms: {},
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

describe('TermModal text limit validation (§6)', () => {
  const fixtures: ComponentFixture<TermModal>[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()!.destroy();
    }
    vi.useRealTimers();
    localStorage.removeItem('lang');
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
  });

  it('accepts 400 characters and refuses 401 characters for Arabic and English term texts', async () => {
    expect(TERM_LIMITS.textMax).toBe(400);

    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
      ],
    });

    const fixture = TestBed.createComponent(TermModal);
    fixtures.push(fixture);
    fixture.detectChanges();

    fixture.componentInstance.openCreate('PAYMENT', 10, 'SALES');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

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

    // 401 characters in English text must fail validation and disable Save.
    setInputValue(textEnArea, 'a'.repeat(401));
    fixture.detectChanges();

    expect(saveBtn.disabled).toBe(true);
    expect(textEnArea.getAttribute('aria-invalid')).toBe('true');
    const enError = el.querySelector<HTMLElement>(`#${textEnArea.id}-error`);
    expect(enError?.textContent).toContain('At most 400 characters.');

    // Restore English to 400 and test 401 characters in Arabic text.
    setInputValue(textEnArea, 'a'.repeat(400));
    setInputValue(textArArea, 'ب'.repeat(401));
    fixture.detectChanges();

    expect(saveBtn.disabled).toBe(true);
    expect(textArArea.getAttribute('aria-invalid')).toBe('true');
    const arError = el.querySelector<HTMLElement>(`#${textArArea.id}-error`);
    expect(arError?.textContent).toContain('At most 400 characters.');
  });

  async function openCreate(type: 'PAYMENT' | 'GENERAL'): Promise<ComponentFixture<TermModal>> {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(TermModal);
    fixtures.push(fixture);
    fixture.detectChanges();
    fixture.componentInstance.openCreate(type, 10, 'SALES');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    return fixture;
  }

  type FormAccess = { form: { update(fn: (v: Record<string, unknown>) => Record<string, unknown>): void } };

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

  // The fake rejects even a null dueDays / incotermCode on a GENERAL term (TYPE_FIELD_INVALID), like the backend,
  // so a successful save proves the body omits both keys.
  it('omits dueDays and incotermCode from the create body for a type that does not use them', async () => {
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
    const saving = (fixture.componentInstance as unknown as { save(): Promise<boolean> }).save();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await saving).toBe(true);
  });

  async function openEditOf(pick: (term: TradeTerm) => boolean, stale = false) {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(TermModal);
    fixtures.push(fixture);
    fixture.detectChanges();
    const listing = listAllTerms({}, TestBed.inject(ScopeState));
    await vi.advanceTimersByTimeAsync(1000);
    const term = (await listing).find(pick)!;
    expect(term).toBeTruthy();
    fixture.componentInstance.openEdit(stale ? { ...term, version: term.version + 50 } : term);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    return { fixture, term };
  }

  /** Counts Idempotency-Key generations (newIdempotencyKey fills one 16-byte array per key). */
  function countKeyGenerations(): { readonly count: number; restore(): void } {
    const original = crypto.getRandomValues.bind(crypto);
    let count = 0;
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T) => {
      if (array instanceof Uint8Array && array.length === 16) count++;
      return original(array as never) as T;
    });
    return {
      get count() {
        return count;
      },
      restore: () => spy.mockRestore(),
    };
  }

  type SaveAccess = FormAccess & { save(): Promise<boolean> };

  it('reuses one Idempotency-Key when the same update is retried and starts a new one when the body changes', async () => {
    const { fixture } = await openEditOf((term) => !term.isDefault && term.isActive, true);
    const modal = fixture.componentInstance as unknown as SaveAccess;
    modal.form.update((v) => ({ ...v, nameEn: 'Retry name' }));
    fixture.detectChanges();

    const keys = countKeyGenerations();
    try {
      // The stale version fails with STALE_VERSION each time; the unchanged request keeps its key.
      for (let attempt = 0; attempt < 2; attempt++) {
        const saving = modal.save();
        await vi.advanceTimersByTimeAsync(1000);
        expect(await saving).toBe(false);
      }
      expect(keys.count).toBe(1);

      modal.form.update((v) => ({ ...v, nameEn: 'Retry name 2' }));
      fixture.detectChanges();
      const saving = modal.save();
      await vi.advanceTimersByTimeAsync(1000);
      expect(await saving).toBe(false);
      expect(keys.count).toBe(2);
    } finally {
      keys.restore();
    }
  });

  it('emits the id of the term the delete call returns', async () => {
    const { fixture, term } = await openEditOf((item) => !item.isDefault);
    const deleted: string[] = [];
    fixture.componentInstance.deleted.subscribe((id) => deleted.push(id));
    const access = fixture.componentInstance as unknown as {
      deleteDialog(): { open(): Promise<boolean> };
      requestDelete(): Promise<void>;
    };
    vi.spyOn(access.deleteDialog(), 'open').mockResolvedValue(true);

    const deleting = access.requestDelete();
    await vi.advanceTimersByTimeAsync(1000);
    await deleting;
    expect(deleted).toEqual([term.id]);
  });
});

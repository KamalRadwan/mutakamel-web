import { Component, Injectable, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRADE_FAKE_DB } from '../../trade-foundation.fake';
import type { ReasonCode, ReasonKind } from '../../trade-foundation.model';
import { TradeReasonPicker, type ReasonPickerValue } from './reason-picker';

const TS_EN: Translation = {
  reason: {
    label: 'Reason',
    hint: 'Choose a reason.',
    note: 'Note',
    noteHint: 'Add details, up to 500 characters.',
    noteRequired: 'A note is required for this reason.',
    none: 'No reasons are set up for this action.',
  },
  common: { required: 'This field is required.', loadFailed: 'Could not load the data.', retry: 'Try again' },
  picker: { loading: 'Loading' },
};

const SCOPED: Record<string, Translation> = {
  en: { tradeShared: TS_EN },
  'trade-shared/en': TS_EN,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(SCOPED[path] ?? {});
  }
}

@Component({
  imports: [TradeReasonPicker],
  template: `
    <app-trade-reason-picker
      idPrefix="rp"
      [kind]="kind()"
      [showErrors]="showErrors()"
      [showNote]="showNote()"
      [(value)]="value"
    />
  `,
})
class Host {
  readonly picker = viewChild.required(TradeReasonPicker);
  readonly kind = signal<ReasonKind>('DOCUMENT_CANCEL');
  readonly showErrors = signal(false);
  readonly showNote = signal(true);
  readonly value = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
}

/** Protected members the template uses; read through a narrow view for assertions. */
interface PickerInternals {
  reasons(): ReasonCode[];
  noteRequired(): boolean;
  dropdownOptions(): { value: string | null; label: string; disabled?: boolean }[];
  reasonErrorKey(): string | null;
  noteErrorKey(): string | null;
  onReasonChange(id: string | null): void;
}

function internals(fixture: ComponentFixture<Host>): PickerInternals {
  return fixture.componentInstance.picker() as unknown as PickerInternals;
}

const OTHER_CANCEL = 'rsn-document_cancel-other';
const DUP_CANCEL = 'rsn-document_cancel-duplicate';
const OTHER_REVERSAL = 'rsn-inventory_reversal-other';

describe('TradeReasonPicker', () => {
  const fixtures: ComponentFixture<Host>[] = [];

  async function mount(kind: ReasonKind = 'DOCUMENT_CANCEL'): Promise<ComponentFixture<Host>> {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    fixtures.push(fixture);
    fixture.componentInstance.kind.set(kind);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    return fixture;
  }

  async function select(fixture: ComponentFixture<Host>, id: string | null): Promise<void> {
    internals(fixture).onReasonChange(id);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  function setNote(fixture: ComponentFixture<Host>, note: string): void {
    const textarea = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>('#rp-note');
    expect(textarea).not.toBeNull();
    textarea!.value = note;
    textarea!.dispatchEvent(new Event('input'));
    textarea!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
  });

  afterEach(() => {
    while (fixtures.length > 0) fixtures.pop()!.destroy();
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('lists only the reasons of the requested kind, in sortOrder', async () => {
    const fixture = await mount('DOCUMENT_CANCEL');
    const rows = internals(fixture).reasons();
    expect(rows.every((r) => r.kind === 'DOCUMENT_CANCEL')).toBe(true);
    expect(rows.map((r) => r.code)).toEqual(['CUSTOMER_REQUEST', 'DATA_ERROR', 'DUPLICATE', 'PRICE_NOT_ACCEPTED', 'OTHER']);
    expect(internals(fixture).dropdownOptions().map((o) => o.label)).toEqual([
      'Customer request',
      'Data entry error',
      'Duplicate document',
      'Price not accepted',
      'Other',
    ]);
  });

  it('hides inactive reasons', async () => {
    const target = TRADE_FAKE_DB.reasons.find((r) => r.id === DUP_CANCEL)!;
    target.isActive = false;
    try {
      const fixture = await mount('DOCUMENT_CANCEL');
      const ids = internals(fixture).reasons().map((r) => r.id);
      expect(ids).not.toContain(DUP_CANCEL);
      expect(ids.length).toBe(4);
      expect(internals(fixture).dropdownOptions().some((o) => o.value === DUP_CANCEL)).toBe(false);
    } finally {
      target.isActive = true;
    }
  });

  it('emits the value as { reasonCodeId, note }', async () => {
    const fixture = await mount();
    await select(fixture, DUP_CANCEL);
    setNote(fixture, 'Second copy');
    expect(fixture.componentInstance.value()).toEqual({ reasonCodeId: DUP_CANCEL, note: 'Second copy' });
  });

  it('is invalid with no reason and shows the required error once errors are shown', async () => {
    const fixture = await mount();
    const picker = fixture.componentInstance.picker();
    expect(picker.valid()).toBe(false);
    expect(internals(fixture).reasonErrorKey()).toBeNull();
    fixture.componentInstance.showErrors.set(true);
    fixture.detectChanges();
    expect(internals(fixture).reasonErrorKey()).toBe('tradeShared.common.required');
  });

  it('does not require a note for a reason without requiresNote', async () => {
    const fixture = await mount();
    await select(fixture, DUP_CANCEL);
    fixture.componentInstance.showErrors.set(true);
    fixture.detectChanges();
    expect(internals(fixture).noteRequired()).toBe(false);
    expect(internals(fixture).noteErrorKey()).toBeNull();
    expect(fixture.componentInstance.picker().valid()).toBe(true);
  });

  it('requires a note for OTHER on a non-inventory kind (mirrors TRADE.REASON.NOTE_REQUIRED)', async () => {
    const fixture = await mount();
    await select(fixture, OTHER_CANCEL);
    const picker = fixture.componentInstance.picker();
    expect(internals(fixture).noteRequired()).toBe(true);
    expect(picker.valid()).toBe(false);

    setNote(fixture, '   ');
    expect(picker.valid()).toBe(false);
    expect(internals(fixture).noteErrorKey()).toBe('tradeShared.reason.noteRequired');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#rp-note')?.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#rp-note-error')?.textContent).toContain('A note is required for this reason.');

    setNote(fixture, 'Customer changed plans');
    expect(picker.valid()).toBe(true);
    expect(internals(fixture).noteErrorKey()).toBeNull();
  });

  it('does not require a note for OTHER on an INVENTORY_* kind', async () => {
    const fixture = await mount('INVENTORY_REVERSAL');
    await select(fixture, OTHER_REVERSAL);
    expect(internals(fixture).noteRequired()).toBe(false);
    expect(fixture.componentInstance.picker().valid()).toBe(true);
  });

  it('rejects a note longer than 500 characters', async () => {
    const fixture = await mount();
    await select(fixture, DUP_CANCEL);
    setNote(fixture, 'x'.repeat(500));
    expect(fixture.componentInstance.picker().valid()).toBe(true);
    setNote(fixture, 'x'.repeat(501));
    expect(fixture.componentInstance.picker().valid()).toBe(false);
  });

  it('skips note checks when the note is hidden', async () => {
    const fixture = await mount();
    fixture.componentInstance.showNote.set(false);
    fixture.detectChanges();
    await select(fixture, OTHER_CANCEL);
    expect((fixture.nativeElement as HTMLElement).querySelector('#rp-note')).toBeNull();
    expect(fixture.componentInstance.picker().valid()).toBe(true);
  });

  it('treats an id from another kind as no selection (client side of TRADE.REASON.KIND_INVALID)', async () => {
    const fixture = await mount('DOCUMENT_CANCEL');
    fixture.componentInstance.value.set({ reasonCodeId: OTHER_REVERSAL, note: '' });
    fixture.detectChanges();
    expect(fixture.componentInstance.picker().valid()).toBe(false);
  });

  it('treats an unknown id as no selection (client side of TRADE.REASON.NOT_FOUND)', async () => {
    const fixture = await mount();
    fixture.componentInstance.value.set({ reasonCodeId: 'rsn-missing', note: 'x' });
    fixture.detectChanges();
    expect(fixture.componentInstance.picker().valid()).toBe(false);
  });

  it('clears the reason id but keeps the note when the kind changes, then loads the new kind', async () => {
    const fixture = await mount('DOCUMENT_CANCEL');
    await select(fixture, DUP_CANCEL);
    setNote(fixture, 'keep me');

    fixture.componentInstance.kind.set('INVENTORY_REVERSAL');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toEqual({ reasonCodeId: null, note: 'keep me' });
    const rows = internals(fixture).reasons();
    expect(rows.length).toBe(5);
    expect(rows.every((r) => r.kind === 'INVENTORY_REVERSAL')).toBe(true);
  });

  it('shows a disabled "none" option for a kind with no reasons and no required error', async () => {
    const fixture = await mount('UNSEEDED_KIND');
    fixture.componentInstance.showErrors.set(true);
    fixture.detectChanges();
    expect(internals(fixture).dropdownOptions()).toEqual([
      { value: null, label: 'No reasons are set up for this action.', disabled: true },
    ]);
    expect(internals(fixture).reasonErrorKey()).toBeNull();
    expect(fixture.componentInstance.picker().valid()).toBe(false);
  });
});

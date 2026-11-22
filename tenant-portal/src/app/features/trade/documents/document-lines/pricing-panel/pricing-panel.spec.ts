import { Component, Injectable, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TradeReasonPicker, type ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import type { DiscountPolicy } from '../../shared/documents.api';
import type { PricingIntent } from '../../shared/document.model';
import { PricingPanel } from './pricing-panel';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const POLICY: DiscountPolicy = {
  hasApplyPermission: true,
  canApply: true,
  canManage: false,
  configured: true,
  limit: { maxPercent: '20', allowFreeItems: false, reasonRequired: true },
};

@Component({
  imports: [PricingPanel],
  template: `<app-pricing-panel [(intent)]="intent" [policy]="policy()" />`,
})
class Host {
  readonly panel = viewChild.required(PricingPanel);
  readonly intent = signal<PricingIntent>({ mode: 'DISCOUNT', scope: 'LINE' });
  readonly policy = signal<DiscountPolicy | null>(POLICY);
}

/** Protected members used by the template; read through a narrow view. */
interface PanelInternals {
  showReasonField(): boolean;
  reasonRequiresNote(): boolean;
  reasonPickerValue(): ReasonPickerValue;
  onReasonPick(value: ReasonPickerValue): void;
  onModeChange(raw: string | null): void;
  onScopeChange(raw: string | null): void;
  onTypeChange(raw: string | null): void;
}

const LOYALTY = 'rsn-document_discount-loyal_customer';
const OTHER = 'rsn-document_discount-other';

describe('PricingPanel discount reason (picker host)', () => {
  const fixtures: ComponentFixture<Host>[] = [];

  async function mount(): Promise<ComponentFixture<Host>> {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: EmptyLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    fixtures.push(fixture);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    return fixture;
  }

  const panel = (f: ComponentFixture<Host>) => f.componentInstance.panel() as unknown as PanelInternals;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
  });

  afterEach(() => {
    while (fixtures.length > 0) fixtures.pop()!.destroy();
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('hosts the reason picker for kind DOCUMENT_DISCOUNT when the policy requires a reason', async () => {
    const fixture = await mount();
    expect(panel(fixture).showReasonField()).toBe(true);
    const picker = fixture.debugElement.query((de) => de.componentInstance instanceof TradeReasonPicker);
    expect(picker).not.toBeNull();
    expect((picker.componentInstance as TradeReasonPicker).kind()).toBe('DOCUMENT_DISCOUNT');
    expect(fixture.componentInstance.panel().reasonRequired()).toBe(true);
  });

  it('stores the picked reason as reasonCode (not the id, not free text)', async () => {
    const fixture = await mount();
    panel(fixture).onReasonPick({ reasonCodeId: LOYALTY, note: '' });
    fixture.detectChanges();
    const intent = fixture.componentInstance.intent();
    expect(intent.reasonCode).toBe('LOYAL_CUSTOMER');
    expect('reason' in intent).toBe(false);
    expect(panel(fixture).reasonPickerValue().reasonCodeId).toBe(LOYALTY);
    expect(fixture.componentInstance.panel().reasonRequired()).toBe(false);
  });

  it('requires a note for OTHER and sends it as reasonNote', async () => {
    const fixture = await mount();
    panel(fixture).onReasonPick({ reasonCodeId: OTHER, note: '' });
    fixture.detectChanges();
    expect(panel(fixture).reasonRequiresNote()).toBe(true);
    expect(fixture.componentInstance.panel().reasonRequired()).toBe(true);

    panel(fixture).onReasonPick({ reasonCodeId: OTHER, note: 'Matched a competitor' });
    fixture.detectChanges();
    expect(fixture.componentInstance.intent()).toMatchObject({ reasonCode: 'OTHER', reasonNote: 'Matched a competitor' });
    expect(fixture.componentInstance.panel().reasonRequired()).toBe(false);
  });

  it('keeps reasonCode and reasonNote across mode, scope and type changes', async () => {
    const fixture = await mount();
    panel(fixture).onReasonPick({ reasonCodeId: OTHER, note: 'Kept note' });
    const kept = { reasonCode: 'OTHER', reasonNote: 'Kept note' };

    panel(fixture).onScopeChange('DOCUMENT');
    expect(fixture.componentInstance.intent()).toMatchObject({ scope: 'DOCUMENT', ...kept });
    panel(fixture).onTypeChange('AMOUNT');
    expect(fixture.componentInstance.intent()).toMatchObject({ type: 'AMOUNT', ...kept });
    panel(fixture).onScopeChange('LINE');
    expect(fixture.componentInstance.intent()).toMatchObject({ scope: 'LINE', ...kept });
    panel(fixture).onModeChange('DISCOUNT');
    expect(fixture.componentInstance.intent()).toMatchObject({ mode: 'DISCOUNT', ...kept });
  });
});

import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { TradeReasonPicker, type ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import { listReasons } from '../../../shared/trade-foundation.api';
import type { ReasonCode } from '../../../shared/trade-foundation.model';
import { cmp, formatPercentCap, isDecimal } from '../../shared/decimal';
import type { DiscountPolicy } from '../../shared/documents.api';
import type { DiscountScope, DiscountType, PricingIntent, PricingMode } from '../../shared/document.model';
import { isArithmeticDecimal } from '../line-math';
import { translationEvents } from '../../../../../core/i18n/translation-events';

@Component({
  selector: 'app-pricing-panel',
  imports: [Field, Segmented, TranslocoPipe, TradeReasonPicker],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-lines', alias: 'tdlines' },
    ),
  ],
  templateUrl: './pricing-panel.html',
  host: { class: 'block min-w-0' },
})
export class PricingPanel {
  private static nextId = 0;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly uid = `pricing-panel-${++PricingPanel.nextId}`;

  readonly intent = model<PricingIntent>({ mode: 'NONE' });
  readonly policy = input<DiscountPolicy | null | undefined>(null);
  readonly disabled = input(false);

  protected readonly valueTouched = signal(false);
  protected readonly reasonTouched = signal(false);

  readonly reasonRequired = computed<boolean>(() => {
    const current = this.intent();
    if (current.mode !== 'DISCOUNT') return false;
    if (!this.policy()?.limit.reasonRequired) return false;
    if (!current.reasonCode?.trim()) return true;
    return this.reasonRequiresNote() && !current.reasonNote?.trim();
  });

  protected readonly canApplyDiscount = computed(() => Boolean(this.policy()?.canApply));
  protected readonly maxPercent = computed(() => this.policy()?.limit.maxPercent ?? null);
  protected readonly maxPercentText = computed(() => {
    const max = this.maxPercent();
    return max === null ? null : formatPercentCap(max);
  });
  protected readonly effectiveScope = computed<DiscountScope>(() => this.intent().scope ?? 'LINE');
  protected readonly effectiveType = computed<DiscountType>(() => this.intent().type ?? 'PERCENT');
  protected readonly showReasonField = computed(
    () => this.intent().mode === 'DISCOUNT' && Boolean(this.policy()?.limit.reasonRequired),
  );

  private readonly discountReasons = signal<ReasonCode[]>([]);
  private reasonsRequested = false;

  /** The stored reason is the reason code; the picker works with the reason id. */
  protected readonly reasonPickerValue = computed<ReasonPickerValue>(() => {
    const code = this.intent().reasonCode;
    const match = code ? this.discountReasons().find((reason) => reason.code === code) : undefined;
    return { reasonCodeId: match?.id ?? null, note: this.intent().reasonNote ?? '' };
  });

  protected readonly reasonRequiresNote = computed(() => {
    const code = this.intent().reasonCode;
    return Boolean(code) && this.discountReasons().some((reason) => reason.code === code && reason.requiresNote);
  });

  private readonly loadDiscountReasons = effect(() => {
    if (!this.showReasonField()) return;
    untracked(() => {
      if (this.reasonsRequested) return;
      this.reasonsRequested = true;
      listReasons('DOCUMENT_DISCOUNT').then(
        (rows) => this.discountReasons.set(rows),
        () => (this.reasonsRequested = false),
      );
    });
  });

  protected readonly modeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const locked = this.disabled();
    return [
      { value: 'NONE', label: this.transloco.translate('tdlines.pricing.none'), disabled: locked },
      { value: 'PROMOTIONS', label: this.transloco.translate('tdlines.pricing.promotions'), disabled: locked },
      {
        value: 'DISCOUNT',
        label: this.transloco.translate('tdlines.pricing.discount'),
        disabled: locked || !this.canApplyDiscount(),
      },
    ];
  });

  protected readonly scopeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const locked = this.disabled();
    return [
      { value: 'LINE', label: this.transloco.translate('tdlines.pricing.scopeLine'), disabled: locked },
      { value: 'DOCUMENT', label: this.transloco.translate('tdlines.pricing.scopeDocument'), disabled: locked },
    ];
  });

  protected readonly typeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const locked = this.disabled();
    return [
      { value: 'PERCENT', label: this.transloco.translate('tdlines.pricing.typePercent'), disabled: locked },
      { value: 'AMOUNT', label: this.transloco.translate('tdlines.pricing.typeAmount'), disabled: locked },
    ];
  });

  protected readonly valueError = computed<string | null>(() => {
    this.i18n();
    const current = this.intent();
    if (current.mode !== 'DISCOUNT' || this.effectiveScope() !== 'DOCUMENT') return null;

    const raw = (current.value ?? '').trim();
    if (!raw) {
      return this.valueTouched() ? this.transloco.translate('tdlines.errors.documentDiscountRequired') : null;
    }
    if (!isDecimal(raw, { maxDecimals: 8 })) {
      return this.transloco.translate('tdlines.errors.discountInvalid');
    }

    if (this.effectiveType() === 'PERCENT') {
      const policyMax = this.maxPercent();
      const cap = policyMax !== null && isArithmeticDecimal(policyMax) ? policyMax : '100';
      if (cmp(raw, cap) > 0) {
        return this.transloco.translate('tdlines.errors.documentDiscountExceeds', { max: formatPercentCap(cap) });
      }
    }
    return null;
  });

  protected onModeChange(raw: string | null): void {
    if (this.disabled() || !raw) return;
    const mode = raw as PricingMode;
    if (mode === 'NONE') {
      this.valueTouched.set(false);
      this.reasonTouched.set(false);
      this.intent.set({ mode: 'NONE' });
      return;
    }
    if (mode === 'PROMOTIONS') {
      this.valueTouched.set(false);
      this.reasonTouched.set(false);
      this.intent.set({ mode: 'PROMOTIONS' });
      return;
    }
    if (!this.canApplyDiscount()) return;
    const current = this.intent();
    this.intent.set({
      mode: 'DISCOUNT',
      scope: current.scope ?? 'LINE',
      ...(current.scope === 'DOCUMENT'
        ? { type: current.type ?? 'PERCENT', value: current.value ?? '' }
        : {}),
      ...keepReason(current),
    });
  }

  protected onScopeChange(raw: string | null): void {
    if (this.disabled() || !raw) return;
    const current = this.intent();
    if (current.mode !== 'DISCOUNT') return;
    const scope = raw as DiscountScope;
    if (scope === 'LINE') {
      this.valueTouched.set(false);
      this.intent.set({
        mode: 'DISCOUNT',
        scope: 'LINE',
        ...keepReason(current),
      });
      return;
    }
    this.intent.set({
      mode: 'DISCOUNT',
      scope: 'DOCUMENT',
      type: current.type ?? 'PERCENT',
      value: current.value ?? '',
      ...keepReason(current),
    });
  }

  protected onTypeChange(raw: string | null): void {
    if (this.disabled() || !raw) return;
    const current = this.intent();
    if (current.mode !== 'DISCOUNT') return;
    this.intent.set({
      mode: 'DISCOUNT',
      scope: 'DOCUMENT',
      type: raw as DiscountType,
      value: current.value ?? '',
      ...keepReason(current),
    });
  }

  protected onValueInput(event: Event): void {
    if (this.disabled()) return;
    const current = this.intent();
    if (current.mode !== 'DISCOUNT') return;
    const value = (event.target as HTMLInputElement).value;
    this.valueTouched.set(true);
    this.intent.set({
      ...current,
      scope: 'DOCUMENT',
      type: this.effectiveType(),
      value,
    });
  }

  protected onReasonPick(value: ReasonPickerValue): void {
    if (this.disabled()) return;
    const current = this.intent();
    if (current.mode !== 'DISCOUNT') return;
    const picked = this.discountReasons().find((reason) => reason.id === value.reasonCodeId);
    this.reasonTouched.set(true);
    const { reasonNote: _dropped, ...rest } = current;
    this.intent.set({
      ...rest,
      reasonCode: picked?.code ?? '',
      ...(picked && value.note ? { reasonNote: value.note } : {}),
    });
  }
}

/** Mode, scope and type changes keep the picked discount reason and its note. */
function keepReason(current: PricingIntent): Pick<PricingIntent, 'reasonCode' | 'reasonNote'> {
  return {
    reasonCode: current.reasonCode ?? '',
    ...(current.reasonNote !== undefined ? { reasonNote: current.reasonNote } : {}),
  };
}

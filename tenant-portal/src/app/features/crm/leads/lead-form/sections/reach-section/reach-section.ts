import { Component, computed, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { PhoneActionSource } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { PhoneList } from '../../../../../../shared/widgets/phone-list/phone-list';
import { DraftErrors, LEAD_LIMITS, LeadDraft } from '../../lead-draft';

@Component({
  selector: 'app-lf-reach',
  imports: [TranslocoPipe, Field, PhoneList],
  providers: [provideTranslocoScope({ scope: 'lead-form', alias: 'leadForm' })],
  templateUrl: './reach-section.html',
  host: { class: 'block' },
})
export class ReachSection {
  private static nextId = 0;
  protected readonly uid = `lf-reach-${++ReachSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly draft = model.required<LeadDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly countries = input<GeoCountry[]>([]);
  readonly layout = input<RecordLayout>('modal');
  readonly crm = input(false);
  readonly source = input<PhoneActionSource | null>(null);

  protected readonly limits = LEAD_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;
  protected readonly phones = computed(() => {
    const list = this.draft().phones;
    return list.length > 0 ? list : [''];
  });

  protected readonly phoneErrors = computed<Record<number, string>>(() => {
    const errs = this.errors();
    const out: Record<number, string> = {};
    const count = this.phones().length;
    for (let i = 0; i < count; i++) {
      const msg = this.phoneError(i);
      if (msg) out[i] = msg;
    }
    for (const key of Object.keys(errs)) {
      if (!key.startsWith('phones.')) continue;
      const idx = Number(key.slice('phones.'.length));
      if (Number.isInteger(idx) && idx >= 0 && !out[idx]) {
        const msg = this.phoneError(idx);
        if (msg) out[idx] = msg;
      }
    }
    return out;
  });

  protected phoneError(index: number): string | null {
    const errs = this.errors();
    const raw = errs[`phones.${index}`] ?? (index === 0 ? errs['phones'] : undefined);
    return this.translateError(raw, LEAD_LIMITS.phoneMax);
  }

  protected emailError(): string | null {
    const errs = this.errors();
    return this.translateError(errs['email'] ?? errs['reach'], LEAD_LIMITS.email);
  }

  protected onPhonesChange(phones: string[]): void {
    if (this.readonly()) return;
    this.draft.update((current) => ({ ...current, phones: [...phones] }));
  }

  protected setEmail(event: Event): void {
    if (this.readonly()) return;
    const email = (event.target as HTMLInputElement).value;
    this.draft.update((current) => ({ ...current, email }));
  }

  private translateError(raw: string | undefined, max?: number): string | null {
    this.i18n();
    if (!raw) return null;
    const [codePart, suffixMax] = raw.split(':');
    const key = codePart.startsWith('leadForm.') ? codePart : `leadForm.errors.${codePart}`;
    const resolvedMax = suffixMax !== undefined ? Number(suffixMax) : max;
    return this.transloco.translate(key, resolvedMax !== undefined ? { max: resolvedMax } : undefined);
  }
}

export { ReachSection as LfReach };

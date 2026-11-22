import { Component, ElementRef, computed, inject, input, model, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { PhoneActionSource } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { PhoneList } from '../../../../../../shared/widgets/phone-list/phone-list';
import { CUSTOMER_LIMITS } from '../../../customers.model';
import { CustomerDraft, DraftErrors } from '../../customer-draft';

@Component({
  selector: 'app-customer-company',
  imports: [TranslocoPipe, Field, PhoneList],
  providers: [provideTranslocoScope({ scope: 'customer-form', alias: 'customerForm' })],
  templateUrl: './customer-company.html',
  host: { class: 'block min-w-0' },
})
export class CustomerCompany {
  private static nextId = 0;
  protected readonly uid = `cf-company-${++CustomerCompany.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly companyNameInput = viewChild<ElementRef<HTMLInputElement>>('companyNameInput');

  readonly draft = model.required<CustomerDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly countries = input<GeoCountry[]>([]);
  readonly layout = input<RecordLayout>('modal');
  readonly crm = input(false);
  readonly source = input<PhoneActionSource | null>(null);

  protected readonly limits = CUSTOMER_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected readonly phones = computed(() => {
    const list = this.draft().companyPhones;
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
      if (!key.startsWith('companyPhones.')) continue;
      const idx = Number(key.slice('companyPhones.'.length));
      if (Number.isInteger(idx) && idx >= 0 && !out[idx]) {
        const msg = this.phoneError(idx);
        if (msg) out[idx] = msg;
      }
    }
    return out;
  });

  focusName(): void {
    const inputEl = this.companyNameInput()?.nativeElement;
    if (!inputEl) return;
    inputEl.scrollIntoView({ block: 'nearest' });
    inputEl.focus();
  }

  protected companyNameError(): string | null {
    this.i18n();
    return this.translateError(this.errors()['companyName'], CUSTOMER_LIMITS.companyName);
  }

  protected phoneError(index: number): string | null {
    const errs = this.errors();
    const raw = errs[`companyPhones.${index}`] ?? (index === 0 ? errs['companyPhones'] : undefined);
    return this.translateError(raw, CUSTOMER_LIMITS.phoneMax);
  }

  protected emailError(): string | null {
    this.i18n();
    const errs = this.errors();
    return this.translateError(errs['companyEmail'] ?? errs['reach'], CUSTOMER_LIMITS.email);
  }

  protected websiteError(): string | null {
    this.i18n();
    return this.translateError(this.errors()['companyWebsite'], CUSTOMER_LIMITS.website);
  }

  protected onPhonesChange(companyPhones: string[]): void {
    if (this.readonly()) return;
    this.draft.update((current) => ({ ...current, companyPhones: [...companyPhones] }));
  }

  protected setField(field: 'companyName' | 'companyEmail' | 'companyWebsite', event: Event): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((current) => ({ ...current, [field]: value }));
  }

  private translateError(raw: string | undefined, max?: number): string | null {
    this.i18n();
    if (!raw) return null;
    const [codePart, suffixMax] = raw.split(':');
    const resolvedMax = suffixMax !== undefined ? Number(suffixMax) : max;
    const params = resolvedMax !== undefined ? { max: resolvedMax } : undefined;
    if (codePart.includes('.')) {
      const direct = this.transloco.translate(codePart, params);
      return direct !== codePart ? direct : codePart;
    }
    const formKey = `customerForm.errors.${codePart}`;
    const formMsg = this.transloco.translate(formKey, params);
    if (formMsg !== formKey) return formMsg;
    const serverKey = `customerForm.server.${codePart}`;
    const serverMsg = this.transloco.translate(serverKey, params);
    if (serverMsg !== serverKey) return serverMsg;
    return codePart;
  }
}

import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, model, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { Button } from '../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { PhoneActionSource } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { PhoneList } from '../../../../../../shared/widgets/phone-list/phone-list';
import { DraftErrors, LEAD_LIMITS, LeadDraft } from '../../lead-draft';

@Component({
  selector: 'app-lf-company',
  imports: [TranslocoPipe, Button, Field, PhoneList],
  providers: [provideTranslocoScope({ scope: 'lead-form', alias: 'leadForm' })],
  templateUrl: './company-section.html',
  host: { class: 'block' },
})
export class CompanySection {
  private static nextId = 0;
  protected readonly uid = `lf-company-${++CompanySection.nextId}`;

  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly companyNameInput = viewChild<ElementRef<HTMLInputElement>>('companyNameInput');

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

  protected readonly canChangeCompany = computed(
    () => !this.readonly() && this.mode() === 'create' && this.draft().existingCompanyPartyId !== null,
  );
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
    const errs = this.errors();
    return this.translateError(errs['existingCompanyPartyId'] ?? errs['companyName'], LEAD_LIMITS.company);
  }

  protected phoneError(index: number): string | null {
    const errs = this.errors();
    const raw = errs[`companyPhones.${index}`] ?? (index === 0 ? errs['companyPhones'] : undefined);
    return this.translateError(raw, LEAD_LIMITS.phoneMax);
  }

  protected emailError(): string | null {
    const errs = this.errors();
    return this.translateError(errs['companyEmail'] ?? errs['reach'], LEAD_LIMITS.email);
  }

  protected websiteError(): string | null {
    return this.translateError(this.errors()['companyWebsite'], LEAD_LIMITS.website);
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

  protected clearExistingCompany(): void {
    if (!this.canChangeCompany()) return;
    this.draft.update((current) => ({
      ...current,
      existingCompanyPartyId: null,
      existingCompanyName: null,
      companyName: '',
      companyPhones: current.companyPhones.length > 0 ? current.companyPhones : [''],
      contacts: current.contacts.map((contact) => ({ ...contact, contactPartyId: null })),
    }));
    afterNextRender(() => this.focusName(), { injector: this.injector });
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
    const formKey = `leadForm.errors.${codePart}`;
    const formMsg = this.transloco.translate(formKey, params);
    if (formMsg !== formKey) return formMsg;
    const serverKey = `leadForm.server.${codePart}`;
    const serverMsg = this.transloco.translate(serverKey, params);
    if (serverMsg !== serverKey) return serverMsg;
    return codePart;
  }
}

export { CompanySection as LfCompany };

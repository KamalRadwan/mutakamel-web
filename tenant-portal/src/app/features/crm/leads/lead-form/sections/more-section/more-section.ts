import { Component, computed, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { AddressFields } from '../../../../../../shared/ui/address-fields/address-fields';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID } from '../../../../../../shared/ui/record-layout/record-layout';
import { AddressDraft, DraftErrors, LEAD_LIMITS, LeadDraft } from '../../lead-draft';

const CAN_ADD_PLACES = true; // later from permission core.geo.places.create

const ADDRESS_FIELD_LIMITS: Partial<Record<keyof AddressDraft, number>> = {
  street1: LEAD_LIMITS.street1,
  street2: LEAD_LIMITS.street2,
  buildingNo: LEAD_LIMITS.building,
  floor: LEAD_LIMITS.floor,
  landmark: LEAD_LIMITS.landmark,
  postalCode: LEAD_LIMITS.postal,
};

const ADDRESS_KEYS: readonly (keyof AddressDraft)[] = [
  'countryId',
  'stateId',
  'cityId',
  'districtId',
  'street1',
  'street2',
  'buildingNo',
  'floor',
  'landmark',
  'postalCode',
];

export interface MoreErrorSpec {
  key: string;
  params?: { max: number };
}

function codePointLength(value: string): number {
  return [...value].length;
}

@Component({
  selector: 'app-lf-more',
  imports: [TranslocoPipe, Field, AddressFields],
  providers: [
    provideTranslocoScope(
      { scope: 'lead-form-side', alias: 'leadSide' },
      { scope: 'lead-form', alias: 'leadForm' },
    ),
  ],
  templateUrl: './more-section.html',
  styleUrl: './more-section.css',
  host: { class: 'block min-w-0' },
})
export class MoreSection {
  private static nextId = 0;
  protected readonly uid = `lf-more-${++MoreSection.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly canAddPlaces = CAN_ADD_PLACES;
  protected readonly limits = LEAD_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  readonly layout = input<'modal' | 'page'>('modal');
  readonly draft = model.required<LeadDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly part = input<'address' | 'legal' | 'qualification' | 'all'>('all');
  readonly columns = input<1 | 2 | null>(null);

  protected readonly effectiveColumns = computed<1 | 2>(() => this.columns() ?? (this.part() === 'all' ? 1 : 2));
  protected readonly showAddress = computed(() => this.part() === 'address' || this.part() === 'all');
  protected readonly hasExistingCompany = computed(() => Boolean(this.draft().existingCompanyPartyId));
  protected readonly hideExistingCompanyAddress = computed(
    () => this.mode() === 'create' && this.hasExistingCompany(),
  );
  protected readonly showLegal = computed(
    () =>
      (this.part() === 'legal' || this.part() === 'all') &&
      this.draft().leadProfileType === 'CORPORATE' &&
      !this.hasExistingCompany(),
  );
  protected readonly showQualification = computed(() => this.part() === 'qualification' || this.part() === 'all');

  protected readonly legalNameCount = computed(() => codePointLength(this.draft().legalName));
  protected readonly taxNumberCount = computed(() => codePointLength(this.draft().taxNumber));
  protected readonly crNumberCount = computed(() => codePointLength(this.draft().commercialRegistrationNumber));
  protected readonly descriptionCount = computed(() => codePointLength(this.draft().description));
  protected readonly interestCount = computed(() => codePointLength(this.draft().interestSummary));
  protected readonly needCount = computed(() => codePointLength(this.draft().expectedNeed));

  protected readonly addressErrors = computed<Partial<Record<keyof AddressDraft, string>>>(() => {
    this.i18n();
    const allErrors = this.errors();
    const translated: Partial<Record<keyof AddressDraft, string>> = {};
    for (const key of ADDRESS_KEYS) {
      const raw = allErrors[`address.${key}`] ?? allErrors[key];
      if (!raw) continue;
      const fullKey = raw.startsWith('leadForm.') ? raw : `leadForm.errors.${raw}`;
      const max = ADDRESS_FIELD_LIMITS[key];
      const params = max !== undefined && fullKey === 'leadForm.errors.tooLong' ? { max } : undefined;
      translated[key] = this.transloco.translate(fullKey, params);
    }
    return translated;
  });

  protected errorFor(path: string, max?: number): MoreErrorSpec | null {
    const raw = this.errors()[path];
    if (!raw) return null;
    const key = raw.startsWith('leadForm.') ? raw : `leadForm.errors.${raw}`;
    const params = max !== undefined && key === 'leadForm.errors.tooLong' ? { max } : undefined;
    return { key, params };
  }

  protected onAddressChange(address: AddressDraft): void {
    this.draft.update((current) => ({ ...current, address }));
  }

  protected onTextFieldInput(
    field: 'legalName' | 'taxNumber' | 'commercialRegistrationNumber' | 'description' | 'interestSummary' | 'expectedNeed',
    event: Event,
  ): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.draft.update((current) => ({ ...current, [field]: value }));
  }
}

export { MoreSection as LfMore };

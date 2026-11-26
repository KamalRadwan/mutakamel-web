import { Component, computed, inject, input, model, output } from '@angular/core';
import { FullState } from '../../../../../../shared/ui/full-state/full-state';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { AddressFields, AddressValue } from '../../../../../../shared/ui/address-fields/address-fields';
import { Button } from '../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID } from '../../../../../../shared/ui/record-layout/record-layout';
import { CUSTOMER_LIMITS } from '../../../customers.model';
import { CustomerDraft, DraftErrors, emptyAddress, hasGeoAddress } from '../../customer-draft';

const CAN_ADD_PLACES = false;

const ADDRESS_KEYS: readonly (keyof AddressValue)[] = [
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
  selector: 'app-customer-more',
  imports: [TranslocoPipe, Button, Field, AddressFields, FullState],
  providers: [provideTranslocoScope({ scope: 'customer-form', alias: 'customerForm' })],
  templateUrl: './customer-more.html',
  styles: [
    `
      :host ::ng-deep app-address-fields > div:first-child > :nth-child(n + 5) {
        display: none;
      }

      :host ::ng-deep app-address-fields.page-address-grid > div:first-child {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
      }

      @media (width >= 1024px) {
        :host ::ng-deep app-address-fields.page-address-grid > div:first-child {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (width >= 1280px) {
        :host ::ng-deep app-address-fields.page-address-grid > div:first-child {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }
    `,
  ],
  host: { class: 'block min-w-0' },
})
export class CustomerMore {
  private static nextId = 0;
  protected readonly uid = `cf-more-${++CustomerMore.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly canAddPlaces = CAN_ADD_PLACES;
  protected readonly limits = CUSTOMER_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  readonly layout = input<'modal' | 'page'>('modal');
  readonly draft = model.required<CustomerDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly legacyAddress = input<string | null>(null);
  readonly geoFailed = input(false);
  readonly retryGeo = output<void>();

  protected readonly showLegal = computed(() => this.draft().profileType === 'CORPORATE');
  protected readonly hasAddressSelection = computed(() =>
    ADDRESS_KEYS.some((key) => !!this.draft().address[key]?.trim()),
  );
  protected readonly resolvedLegacyAddress = computed(() =>
    (this.legacyAddress() ?? this.draft().legacyAddress ?? '').trim(),
  );
  protected readonly showLegacyAddress = computed(
    () => !hasGeoAddress(this.draft().address) && this.resolvedLegacyAddress().length > 0,
  );

  protected readonly legalNameCount = computed(() => codePointLength(this.draft().legalName));
  protected readonly taxNumberCount = computed(() => codePointLength(this.draft().taxNumber));
  protected readonly crNumberCount = computed(() => codePointLength(this.draft().commercialRegistrationNumber));
  protected readonly descriptionCount = computed(() => codePointLength(this.draft().description));

  protected readonly addressErrors = computed<Partial<Record<keyof AddressValue, string>>>(() => {
    this.i18n();
    const allErrors = this.errors();
    const translated: Partial<Record<keyof AddressValue, string>> = {};
    for (const key of ADDRESS_KEYS) {
      const raw = allErrors[`address.${key}`] ?? allErrors[key];
      if (!raw) continue;
      const fullKey = raw.startsWith('customerForm.') ? raw : `customerForm.errors.${raw}`;
      translated[key] = this.transloco.translate(fullKey);
    }
    return translated;
  });

  protected errorFor(path: string, max?: number): MoreErrorSpec | null {
    const raw = this.errors()[path];
    if (!raw) return null;
    const key = raw.startsWith('customerForm.') ? raw : `customerForm.errors.${raw}`;
    const params = max !== undefined && key === 'customerForm.errors.tooLong' ? { max } : undefined;
    return { key, params };
  }

  protected onAddressChange(address: AddressValue): void {
    if (this.readonly()) return;
    this.draft.update((current) => ({ ...current, address }));
  }

  protected clearAddress(): void {
    if (this.readonly()) return;
    this.draft.update((current) => ({ ...current, address: emptyAddress() }));
  }

  protected onTextFieldInput(
    field: 'legalName' | 'taxNumber' | 'commercialRegistrationNumber' | 'description',
    event: Event,
  ): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.draft.update((current) => ({ ...current, [field]: value }));
  }
}

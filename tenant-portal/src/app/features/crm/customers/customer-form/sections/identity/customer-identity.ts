import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { GeoCountry } from '../../../../../../core/geo/geo.model';
import { LanguageState } from '../../../../../../core/i18n/language';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { Segmented, SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import { SuggestInput } from '../../../../../../shared/ui/suggest-input/suggest-input';
import { TITLE_SUGGESTIONS, suggestionsForLanguage } from '../../../../../../shared/ui/suggest-input/suggestions';
import { PhoneActionSource } from '../../../../../../shared/widgets/phone-actions/phone-actions';
import { PhoneList } from '../../../../../../shared/widgets/phone-list/phone-list';
import { CUSTOMER_LIMITS, ProfileType } from '../../../customers.model';
import { CustomerDraft, DraftErrors, emptyDraft } from '../../customer-draft';

@Component({
  selector: 'app-customer-identity',
  imports: [TranslocoPipe, ConfirmDialog, Field, Segmented, SuggestInput, PhoneList],
  providers: [provideTranslocoScope({ scope: 'customer-form', alias: 'customerForm' })],
  templateUrl: './customer-identity.html',
  host: { class: 'block min-w-0' },
})
export class CustomerIdentity {
  private static nextId = 0;
  protected readonly uid = `cf-identity-${++CustomerIdentity.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly typeSegmented = viewChild<Segmented>('typeSegmented');
  private readonly switchTypeWrap = viewChild<ElementRef<HTMLElement>>('switchTypeWrap');
  private readonly switchTypeDialog = viewChild.required<ConfirmDialog>('switchTypeDialog');
  private readonly firstNameInput = viewChild<ElementRef<HTMLInputElement>>('firstNameInput');
  private readonly lastNameInput = viewChild<ElementRef<HTMLInputElement>>('lastNameInput');

  readonly draft = model.required<CustomerDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit' | 'view'>('create');
  /** 'type' = only the customer type; 'details' = only the individual identity & reach; 'all' = both. */
  readonly part = input<'type' | 'details' | 'all'>('all');
  readonly layout = input<RecordLayout>('modal');
  readonly countries = input<GeoCountry[]>([]);
  readonly crm = input(false);
  readonly source = input<PhoneActionSource | null>(null);

  protected readonly limits = CUSTOMER_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;
  readonly switchingType = signal(false);

  protected readonly typeLocked = computed(() => this.mode() !== 'create' || this.readonly());
  protected readonly allTitles = computed(() => suggestionsForLanguage(TITLE_SUGGESTIONS, this.language()));

  protected readonly typeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const locked = this.typeLocked();
    return [
      {
        value: 'INDIVIDUAL',
        label: this.transloco.translate('customerForm.type.individual'),
        disabled: locked,
      },
      {
        value: 'CORPORATE',
        label: this.transloco.translate('customerForm.type.corporate'),
        disabled: locked,
      },
    ];
  });

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

  constructor() {
    const destroyRef = inject(DestroyRef);
    const onSwitchTypeKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.switchingType()) return;
      this.dismissSwitchTypeDialog(event);
    };
    const onSwitchTypeCancel = (event: Event) => {
      if (!this.switchingType()) return;
      this.dismissSwitchTypeDialog(event);
    };
    document.addEventListener('keydown', onSwitchTypeKeydown, { capture: true });
    document.addEventListener('cancel', onSwitchTypeCancel, { capture: true });
    destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onSwitchTypeKeydown, { capture: true });
      document.removeEventListener('cancel', onSwitchTypeCancel, { capture: true });
    });
  }

  focusName(): void {
    const errs = this.errors();
    const inputEl =
      this.draft().profileType === 'CORPORATE'
        ? this.host.nativeElement.closest('app-customer-form')?.querySelector<HTMLInputElement>(
            'input[autocomplete="organization"]',
          )
        : errs['lastName'] && !errs['firstName']
          ? this.lastNameInput()?.nativeElement
          : this.firstNameInput()?.nativeElement;
    if (!inputEl) return;
    inputEl.scrollIntoView({ block: 'nearest' });
    inputEl.focus();
  }

  protected errorText(path: string, max?: number): string | null {
    this.i18n();
    return this.translateError(this.errors()[path], max);
  }

  protected emailError(): string | null {
    this.i18n();
    const errs = this.errors();
    return this.translateError(errs['email'] ?? errs['reach'], CUSTOMER_LIMITS.email);
  }

  protected phoneError(index: number): string | null {
    const errs = this.errors();
    const raw = errs[`phones.${index}`] ?? (index === 0 ? errs['phones'] : undefined);
    return this.translateError(raw, CUSTOMER_LIMITS.phoneMax);
  }

  protected async onTypeChange(value: string | null): Promise<void> {
    if (this.typeLocked() || this.switchingType()) return;
    if (value !== 'INDIVIDUAL' && value !== 'CORPORATE') return;
    const nextType: ProfileType = value;
    const current = this.draft();
    if (nextType === current.profileType) return;

    if (this.hasTypeSpecificData(current)) {
      this.typeSegmented()?.value.set(current.profileType);
      this.switchingType.set(true);
      try {
        const confirmed = await this.switchTypeDialog().open();
        if (!confirmed) return;
      } finally {
        this.switchingType.set(false);
      }
    }

    this.draft.set(
      emptyDraft({
        profileType: nextType,
        companyId: current.companyId,
        branchId: current.branchId,
        ownerUserId: current.ownerUserId,
        status: current.status,
        acquisitionSourceId: current.acquisitionSourceId,
        tagIds: current.tagIds,
        rating: current.rating,
        cardColor: current.cardColor,
        address: current.address,
        description: current.description,
        customFields: current.customFields,
      }),
    );

    afterNextRender(() => this.focusName(), { injector: this.injector });
  }

  protected onSwitchTypeEscape(event: Event): void {
    this.dismissSwitchTypeDialog(event);
  }

  protected setHonorificTitle(honorificTitle: string): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, honorificTitle }));
  }

  protected setField(field: 'firstName' | 'lastName' | 'email', event: Event): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected onPhonesChange(phones: string[]): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, phones: [...phones] }));
  }

  private dismissSwitchTypeDialog(event: Event): void {
    const dialog = this.switchTypeWrap()?.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (!dialog?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dialog.close();
  }

  private translateError(raw: string | undefined, max?: number): string | null {
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

  private hasTypeSpecificData(d: CustomerDraft): boolean {
    if (d.profileType === 'INDIVIDUAL') {
      return !!(
        d.honorificTitle.trim() ||
        d.firstName.trim() ||
        d.lastName.trim() ||
        d.email.trim() ||
        d.phones.some((p) => p.trim().length > 0)
      );
    }
    return !!(
      d.companyName.trim() ||
      d.legalName.trim() ||
      d.taxNumber.trim() ||
      d.commercialRegistrationNumber.trim() ||
      d.companyEmail.trim() ||
      d.companyWebsite.trim() ||
      d.companyPhones.some((p) => p.trim().length > 0) ||
      d.contacts.some(
        (c) =>
          c.contactPartyId ||
          c.honorificTitle.trim() ||
          c.firstName.trim() ||
          c.lastName.trim() ||
          c.jobTitle.trim() ||
          c.email.trim() ||
          c.phones.some((p) => p.trim().length > 0),
      )
    );
  }
}

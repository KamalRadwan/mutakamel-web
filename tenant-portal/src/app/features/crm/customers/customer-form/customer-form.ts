import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerAddressBook,
  tablerBuilding,
  tablerDots,
  tablerForms,
  tablerTags,
  tablerUser,
} from '@ng-icons/tabler-icons';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { RecordLayout } from '../../../../shared/ui/record-layout/record-layout';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { PhoneActionSource } from '../../../../shared/widgets/phone-actions/phone-actions';
import { RecordContacts } from '../../shared/record/contacts/record-contacts';
import { CustomFieldDef } from '../../shared/record/custom-fields/custom-field.model';
import { RecordCustomFields } from '../../shared/record/custom-fields/record-custom-fields';
import { DuplicateStrip } from '../../shared/record/duplicate-strip/duplicate-strip';
import {
  DuplicateCheckPayload,
  DuplicateMatch,
  DuplicateProbe,
} from '../../shared/record/duplicate-strip/duplicate.model';
import { ContactChange, ContactDraft, ContactErrors, ContactLimits } from '../../shared/record/record-contact';
import { checkDuplicates } from '../customers.api';
import { CUSTOMER_LIMITS, CardColor, CustomerStatus } from '../customers.model';
import { CustomerDraft, DraftErrors } from './customer-draft';
import { CustomerLookups } from './customer-lookups';
import { CustomerClassification } from './sections/classification/customer-classification';
import { CustomerCompany } from './sections/company/customer-company';
import { CustomerIdentity } from './sections/identity/customer-identity';
import { CustomerMore } from './sections/more/customer-more';
import { smoothScrollBehavior } from '../../../../shared/ui/scroll/scroll-into-view';

const MORE_ERROR_KEYS = new Set(['address', 'legalName', 'taxNumber', 'commercialRegistrationNumber', 'description']);

export const CUSTOMER_PAGE_SECTION_ERRORS: Record<string, readonly string[]> = {
  'cf-classification': ['branchId', 'ownerUserId', 'status', 'acquisitionSourceId', 'tagIds'],
  'cf-contact': ['honorificTitle', 'firstName', 'lastName', 'phones', 'email', 'reach'],
  'cf-company': ['companyName', 'companyPhones', 'companyEmail', 'companyWebsite', 'reach'],
  'cf-contacts': ['contacts'],
  'cf-custom': ['customFields'],
  'cf-more': ['address', 'legalName', 'taxNumber', 'commercialRegistrationNumber', 'description'],
};

const PAGE_SECTION_ORDER = [
  'cf-classification',
  'cf-contact',
  'cf-company',
  'cf-contacts',
  'cf-custom',
  'cf-more',
] as const;

const CUSTOMER_CONTACT_LIMITS: ContactLimits = {
  honorificTitle: CUSTOMER_LIMITS.honorificTitle,
  firstName: CUSTOMER_LIMITS.contactFirstName,
  lastName: CUSTOMER_LIMITS.contactLastName,
  jobTitle: CUSTOMER_LIMITS.jobTitle,
  email: CUSTOMER_LIMITS.email,
  phones: CUSTOMER_LIMITS.phonesMax,
  phoneLength: CUSTOMER_LIMITS.phoneMax,
  contacts: CUSTOMER_LIMITS.contactsMax,
};

function maxForContactField(fieldPath: string): number | undefined {
  if (fieldPath === 'honorificTitle') return CUSTOMER_LIMITS.honorificTitle;
  if (fieldPath === 'jobTitle') return CUSTOMER_LIMITS.jobTitle;
  if (fieldPath === 'firstName') return CUSTOMER_LIMITS.contactFirstName;
  if (fieldPath === 'lastName') return CUSTOMER_LIMITS.contactLastName;
  if (fieldPath === 'email' || fieldPath === 'reach') return CUSTOMER_LIMITS.email;
  if (fieldPath === 'phones' || fieldPath.startsWith('phones.')) return CUSTOMER_LIMITS.phoneMax;
  return undefined;
}

@Component({
  selector: 'app-customer-form',
  imports: [
    SectionBar,
    TranslocoPipe,
    DuplicateStrip,
    RecordContacts,
    RecordCustomFields,
    CustomerClassification,
    CustomerIdentity,
    CustomerCompany,
    CustomerMore,
  ],
  viewProviders: [
    CustomerLookups,
    provideTranslocoScope(
      { scope: 'customer-form', alias: 'customerForm' },
      { scope: 'customers', alias: 'customers' },
    ),
    provideIcons({
      tablerTags,
      tablerUser,
      tablerBuilding,
      tablerAddressBook,
      tablerForms,
      tablerDots,
    }),
  ],
  templateUrl: './customer-form.html',
  host: {
    '[class]': "layout() === 'modal' ? 'flex h-full min-h-0 flex-1 overflow-hidden' : 'block'",
    '(keydown)': 'onHostKeydown($event)',
  },
})
export class CustomerForm {
  private static nextId = 0;
  protected readonly uid = `customer-form-${++CustomerForm.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tenant = inject(TenantScopeState);
  readonly lookups = inject(CustomerLookups);

  private readonly identitySection = viewChild(CustomerIdentity);
  private readonly companySection = viewChild(CustomerCompany);
  private readonly recordContacts = viewChild(RecordContacts);

  readonly draft = model.required<CustomerDraft>();
  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit' | 'view'>('create');
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly updating = input(false);
  readonly customerId = input<string | null>(null);
  readonly saveContact = input<((change: ContactChange) => Promise<ContactErrors | null>) | null>(null);
  readonly excludePartyId = input<string | null>(null);
  readonly status = input<CustomerStatus | null>(null);
  readonly showMore = input(false);
  readonly revision = input(0);
  readonly legacyAddress = input<string | null>(null);
  readonly fallbackOwnerName = input<string | null>(null);

  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly statusChange = output<CustomerStatus>();
  readonly openDuplicate = output<DuplicateMatch>();
  readonly contactEditingChange = output<boolean>();
  readonly submitRequest = output<void>();

  protected readonly limits = CUSTOMER_LIMITS;
  protected readonly contactLimits = CUSTOMER_CONTACT_LIMITS;
  /** The strip takes the match list; the endpoint answers with a { matches } envelope. */
  protected readonly checkDuplicates = (probe: DuplicateCheckPayload): Promise<DuplicateMatch[]> =>
    checkDuplicates(probe).then((response) => response.matches);
  /** True while a live duplicate match would block saving; the strip shows the warning before save. */
  readonly duplicateBlocking = signal(false);
  protected readonly countries = this.lookups.countries;

  protected readonly effectiveReadonly = computed(
    () =>
      this.readonly() ||
      (this.mode() !== 'create' && this.lookups.capabilities() !== null && !this.lookups.canUpdate()),
  );
  protected readonly contactsMode = computed<'create' | 'edit' | 'view'>(() =>
    this.effectiveReadonly() ? 'view' : this.mode() === 'create' ? 'create' : 'edit',
  );
  protected readonly contactResetKey = computed(() => `${this.customerId() ?? ''}|${this.revision()}|${this.mode()}`);

  protected readonly moreOpen = linkedSignal({
    source: () => ({
      showMore: this.showMore(),
      mode: this.mode(),
      id: this.customerId(),
      revision: this.revision(),
    }),
    computation: (state) => state.showMore || state.mode !== 'create',
  });

  readonly switchingType = computed(
    () => (this.identitySection()?.switchingType() ?? false) || (this.recordContacts()?.dialogBusy() ?? false),
  );
  readonly contactUnsaved = computed(() => this.recordContacts()?.hasUnsavedChanges() ?? false);
  readonly isEditingContact = computed(() => this.recordContacts()?.isEditingContact() ?? false);

  private readonly branchId = computed(() => this.draft().branchId);

  protected readonly customFieldsList = computed<readonly CustomFieldDef[]>(() => this.lookups.customFields() ?? []);
  protected readonly hasOtherCustomFields = computed(() =>
    this.customFieldsList().some((field) => !(field.requiredOnCreate || field.requiredOnUpdate)),
  );

  protected readonly duplicateProbe = computed<DuplicateProbe>(() => {
    const d = this.draft();
    const isCorporate = d.profileType === 'CORPORATE';
    return {
      branchId: d.branchId,
      ownerUserId: d.ownerUserId,
      name: isCorporate
        ? d.companyName
        : [d.firstName, d.lastName]
            .map((part) => part.trim())
            .filter(Boolean)
            .join(' '),
      phones: isCorporate ? [...d.companyPhones, ...d.contacts.flatMap((c) => c.phones)] : d.phones,
      email: isCorporate ? d.companyEmail : d.email,
      taxNumber: isCorporate ? d.taxNumber : '',
      commercialRegistrationNumber: isCorporate ? d.commercialRegistrationNumber : '',
      excludePartyId: this.mode() === 'create' ? null : this.excludePartyId(),
      corporate: false,
    };
  });

  protected readonly phoneSource = computed<PhoneActionSource | null>(() => {
    const id = this.customerId();
    if (this.mode() === 'create' || !id) return null;
    const d = this.draft();
    const label =
      d.profileType === 'CORPORATE'
        ? d.companyName.trim()
        : [d.honorificTitle.trim(), d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ');
    return { type: 'CUSTOMER_PROFILE', id, label };
  });

  protected readonly contactErrors = computed<ContactErrors>(() => {
    this.i18n();
    const rawErrors = this.errors();
    const contacts = this.draft().contacts;
    const out: ContactErrors = {};

    if (rawErrors['contacts']) {
      const msg = this.translateError(rawErrors['contacts'], CUSTOMER_LIMITS.contactsMax);
      if (msg) out['contacts'] = msg;
    }

    for (const [key, raw] of Object.entries(rawErrors)) {
      if (!raw || !key.startsWith('contacts.')) continue;
      const rest = key.slice('contacts.'.length);
      const dot = rest.indexOf('.');
      if (dot < 0) continue;
      const idx = Number(rest.slice(0, dot));
      const contact = Number.isInteger(idx) ? contacts[idx] : undefined;
      if (!contact) continue;
      const fieldPath = rest.slice(dot + 1);
      const msg = this.translateError(raw, maxForContactField(fieldPath));
      if (!msg) continue;

      if (fieldPath === 'phones') {
        out[`${contact.key}.phones.0`] = msg;
      } else if (fieldPath === 'reach') {
        out[`${contact.key}.email`] = out[`${contact.key}.email`] ?? msg;
      } else {
        out[`${contact.key}.${fieldPath}`] = msg;
      }
    }

    return out;
  });

  constructor() {
    effect(() => {
      const branchId = this.branchId();
      const mode = this.mode();
      untracked(() => {
        this.lookups.setBranch(branchId);
        this.lookups.setMode(mode);
      });
    });

    effect(() => {
      if (this.mode() !== 'create') return;
      const current = this.draft();
      this.tenant.selection();
      const selected = sessionBranch();
      if (!selected || current.branchId === selected.branchId) return;
      untracked(() => {
        this.draft.update((d) => ({
          ...d,
          companyId: selected.companyId,
          branchId: selected.branchId,
        }));
      });
    });
  }

  focusName(): void {
    if (this.draft().profileType === 'CORPORATE') {
      this.companySection()?.focusName();
    } else {
      this.identitySection()?.focusName();
    }
  }

  focusFirstError(): void {
    if (this.layout() === 'modal' && !this.moreOpen() && this.hasMoreErrors()) {
      this.moreOpen.set(true);
      afterNextRender(() => this.focusInvalidElement(), { injector: this.injector });
      return;
    }

    const focused = this.focusInvalidElement();
    if (!focused && this.layout() === 'modal' && !this.moreOpen()) {
      this.moreOpen.set(true);
      afterNextRender(() => this.focusInvalidElement(), { injector: this.injector });
    }
  }

  scrollToFirstError(): void {
    if (this.layout() === 'modal') return;
    const errKeys = Object.keys(this.errors());
    if (errKeys.length === 0) return;

    const requiredCfKeys = new Set(
      this.customFieldsList()
        .filter((f) => f.requiredOnCreate || f.requiredOnUpdate)
        .map((f) => `customFields.${f.fieldKey}`),
    );

    for (const sectionId of PAGE_SECTION_ORDER) {
      if (!this.pageSectionHasError(sectionId, errKeys, requiredCfKeys)) continue;
      const sectionEl = this.host.nativeElement.querySelector<HTMLElement>(`#${sectionId}`);
      if (!sectionEl) continue;
      sectionEl.scrollIntoView({ block: 'start', behavior: smoothScrollBehavior() });
      this.focusFirstInvalidIn(sectionEl, true);
      return;
    }
  }

  saveEditingContact(): Promise<boolean> {
    return this.recordContacts()?.saveCurrentEdit() ?? Promise.resolve(true);
  }

  discardContactEdit(): void {
    this.recordContacts()?.discardEdit();
  }

  draftWithEditingContact(): CustomerDraft {
    const current = this.draft();
    const contacts = this.recordContacts()?.draftContacts();
    return contacts ? { ...current, contacts } : current;
  }

  protected onContactsChange(contacts: ContactDraft[]): void {
    if (this.effectiveReadonly()) return;
    this.draft.update((current) => ({ ...current, contacts }));
  }

  protected onCustomFieldsChange(customFields: Record<string, unknown>): void {
    if (this.effectiveReadonly()) return;
    this.draft.update((current) => ({ ...current, customFields }));
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    if (this.effectiveReadonly()) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (this.isEditingContact()) {
        event.stopPropagation();
        void this.saveEditingContact();
        return;
      }
      this.submitRequest.emit();
    }
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

  private hasMoreErrors(): boolean {
    const errKeys = Object.keys(this.errors());
    if (errKeys.length === 0) return false;
    return errKeys.some((key) => MORE_ERROR_KEYS.has(key) || key.startsWith('address.'));
  }

  private pageSectionHasError(
    sectionId: string,
    errKeys: readonly string[],
    requiredCfKeys: ReadonlySet<string>,
  ): boolean {
    if (sectionId === 'cf-custom') {
      return errKeys.some(
        (key) => (key === 'customFields' || key.startsWith('customFields.')) && !requiredCfKeys.has(key),
      );
    }
    if (sectionId === 'cf-classification' && errKeys.some((key) => requiredCfKeys.has(key))) {
      return true;
    }
    const prefixes = CUSTOMER_PAGE_SECTION_ERRORS[sectionId];
    if (!prefixes) return false;
    return errKeys.some((key) => prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)));
  }

  private focusInvalidElement(): boolean {
    return this.focusFirstInvalidIn(this.host.nativeElement, false);
  }

  private focusFirstInvalidIn(container: HTMLElement, preventScroll: boolean): boolean {
    const target = container.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) return false;
    const focusTarget = (el: HTMLElement) => {
      if (!preventScroll) {
        el.scrollIntoView({ block: 'nearest' });
      }
      el.focus({ preventScroll });
    };
    if (target.matches('input, textarea, select, button, [tabindex]')) {
      focusTarget(target);
      return true;
    }
    const inner = target.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]');
    if (inner) {
      focusTarget(inner);
      return true;
    }
    const ownedIds = (target.getAttribute('aria-owns') ?? '').split(/\s+/).filter(Boolean);
    for (const id of ownedIds) {
      const owned = this.host.nativeElement.querySelector<HTMLElement>(`#${id}`);
      if (owned) {
        focusTarget(owned);
        return true;
      }
    }
    if (!preventScroll) {
      target.scrollIntoView({ block: 'nearest' });
    }
    return true;
  }
}

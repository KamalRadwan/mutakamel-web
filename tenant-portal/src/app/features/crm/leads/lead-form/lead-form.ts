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
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerAdjustments,
  tablerBuilding,
  tablerCategory,
  tablerChevronDown,
  tablerNote,
  tablerPhone,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { listCountries } from '../../../../core/geo/geo.api';
import { GeoCountry } from '../../../../core/geo/geo.model';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { PhoneActionSource } from '../../../../shared/widgets/phone-actions/phone-actions';
import { checkLeadDuplicates } from '../leads.api';
import { CardColor, LeadStage } from '../leads.model';
import { DuplicateStrip } from '../../shared/record/duplicate-strip/duplicate-strip';
import {
  DuplicateCheckPayload,
  DuplicateCompanySelection,
  DuplicateMatch,
  DuplicateProbe,
} from '../../shared/record/duplicate-strip/duplicate.model';
import { ContactDraft, DraftErrors, LeadDraft, emptyDraft } from './lead-draft';
import { LeadLookups } from './lead-lookups';
import { BasicsSection } from './sections/basics-section/basics-section';
import { ClassificationSection } from './sections/classification-section/classification-section';
import { CompanySection } from './sections/company-section/company-section';
import { ContactsSection } from './sections/contacts-section/contacts-section';
import { CustomFieldsSection } from './sections/custom-fields-section/custom-fields-section';
import { MoreSection } from './sections/more-section/more-section';
import { ReachSection } from './sections/reach-section/reach-section';
import { ValueSection } from './sections/value-section/value-section';
import { smoothScrollBehavior } from '../../../../shared/ui/scroll/scroll-into-view';

const MORE_ERROR_KEYS = new Set([
  'address',
  'legalName',
  'taxNumber',
  'commercialRegistrationNumber',
  'description',
  'interestSummary',
  'expectedNeed',
]);

export const LEAD_PAGE_SECTION_ERRORS: Record<string, readonly string[]> = {
  'lf-classification': [
    'branchId',
    'stageId',
    'ownerUserId',
    'acquisitionSourceId',
    'tagIds',
    'expectedValue',
    'currencyCode',
  ],
  'lf-reach': ['firstName', 'lastName', 'honorificTitle', 'reach', 'email', 'phones'],
  'lf-company': [
    'companyName',
    'existingCompanyPartyId',
    'companyPhone',
    'companyPhones',
    'companyEmail',
    'companyWebsite',
  ],
  'lf-contacts': ['contacts'],
  'lf-custom': ['customFields'],
  'lf-more': [
    'address',
    'legalName',
    'taxNumber',
    'commercialRegistrationNumber',
    'description',
    'interestSummary',
    'expectedNeed',
  ],
};

const PAGE_SECTION_ORDER = [
  'lf-classification',
  'lf-reach',
  'lf-company',
  'lf-contacts',
  'lf-custom',
  'lf-more',
] as const;

@Component({
  selector: 'app-lead-form',
  imports: [
    SectionBar,
    TranslocoPipe,
    DuplicateStrip,
    BasicsSection,
    ReachSection,
    CompanySection,
    ContactsSection,
    CustomFieldsSection,
    ClassificationSection,
    ValueSection,
    MoreSection,
  ],
  viewProviders: [provideTranslocoScope({ scope: 'lead-form', alias: 'leadForm' })],
  providers: [
    LeadLookups,
    provideIcons({
      tablerChevronDown,
      tablerBuilding,
      tablerPhone,
      tablerUsers,
      tablerCategory,
      tablerNote,
      tablerAdjustments,
    }),
  ],
  templateUrl: './lead-form.html',
  host: {
    '[class]': "layout() === 'modal' ? 'flex h-full min-h-0 flex-1 overflow-hidden' : 'block'",
    '(keydown)': 'onHostKeydown($event)',
  },
})
export class LeadForm {
  private static nextId = 0;
  protected readonly uid = `lead-form-${++LeadForm.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly lookups = inject(LeadLookups);
  private readonly basicsSection = viewChild(BasicsSection);
  private readonly companySection = viewChild(CompanySection);
  private readonly contactsSection = viewChild(ContactsSection);

  readonly layout = input<'modal' | 'page'>('modal');
  readonly mode = input<'create' | 'edit'>('create');
  readonly readonly = input(false);
  readonly customFieldsDenied = input(false);
  readonly customFieldsFailed = input(false);
  readonly customFieldsMessage = input('');
  readonly canUpdateRecord = input(false);
  readonly errors = input<DraftErrors>({});
  readonly showMore = input(false);
  readonly excludePartyId = input<string | null>(null);
  readonly stages = input<LeadStage[] | null>(null);
  readonly stageId = input<string | null>(null);
  readonly updating = input(false);
  readonly leadId = input<string | null>(null);
  readonly revision = input(0);
  readonly saveContacts = input<((contacts: ContactDraft[], editIndex?: number) => Promise<DraftErrors | null>) | null>(
    null,
  );

  readonly draft = model.required<LeadDraft>();
  readonly openLead = output<string>();
  readonly submitRequest = output<void>();
  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly moveStage = output<string>();

  readonly switchingType = computed(
    () => (this.basicsSection()?.switchingType() ?? false) || (this.contactsSection()?.dialogBusy() ?? false),
  );
  readonly contactUnsaved = computed(() => this.contactsSection()?.hasUnsavedChanges() ?? false);
  readonly isEditingContact = computed(() => this.contactsSection()?.isEditingContact() ?? false);

  protected readonly countries = signal<GeoCountry[]>([]);
  /** The shared strip takes the match list; the endpoint answers { matches }. */
  protected readonly checkDuplicates = (payload: DuplicateCheckPayload) =>
    checkLeadDuplicates(payload).then((response) => response.matches);
  protected readonly moreOpen = linkedSignal(() => this.showMore());
  private readonly branchId = computed(() => this.draft().branchId);
  private readonly draftStageId = computed(() => this.draft().stageId);

  protected readonly resolvedStages = computed<LeadStage[]>(() => {
    const provided = this.stages();
    if (provided && provided.length > 0) return provided;
    return this.mode() === 'create'
      ? this.lookups.stages()
      : this.lookups.allStages().filter((stage) => stage.isActive);
  });
  protected readonly resolvedStageId = computed(() => this.stageId() ?? this.draft().stageId);

  protected readonly hasAnyCustomFields = computed(() => (this.lookups.customFields()?.length ?? 0) > 0);
  protected readonly hasRequiredCustomFields = computed(() => {
    if (this.customFieldsDenied() || this.customFieldsFailed()) return false;
    const fields = this.lookups.customFields();
    if (!fields?.length) return false;
    return fields.some((field) => field.requiredOnCreate || field.requiredOnUpdate);
  });
  protected readonly hasOtherCustomFields = computed(() => {
    const fields = this.lookups.customFields();
    if (!fields?.length) return false;
    return fields.some((field) => !(field.requiredOnCreate || field.requiredOnUpdate));
  });

  protected readonly duplicateProbe = computed<DuplicateProbe>(() => {
    const d = this.draft();
    const corporate = d.leadProfileType === 'CORPORATE';
    return {
      branchId: d.branchId,
      ownerUserId: d.ownerUserId,
      name: corporate
        ? d.companyName
        : [d.firstName, d.lastName]
            .map((part) => part.trim())
            .filter(Boolean)
            .join(' '),
      phones: corporate ? [...d.companyPhones, ...d.contacts.flatMap((c) => c.phones)] : d.phones,
      email: corporate ? d.companyEmail : d.email,
      taxNumber: corporate ? d.taxNumber : '',
      commercialRegistrationNumber: corporate ? d.commercialRegistrationNumber : '',
      excludePartyId: this.excludePartyId(),
      corporate,
    };
  });

  protected readonly phoneSource = computed<PhoneActionSource | null>(() => {
    const id = this.leadId();
    if (this.mode() === 'create' || !id) return null;
    const d = this.draft();
    const label =
      d.leadProfileType === 'CORPORATE'
        ? (d.existingCompanyPartyId ? (d.existingCompanyName ?? '').trim() : '') || d.companyName.trim()
        : [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ');
    return { type: 'LEAD', id, label };
  });

  constructor() {
    void listCountries()
      .then((list) => this.countries.set(list))
      .catch(() => {});

    effect(() => {
      const branchId = this.branchId();
      const mode = this.mode();
      untracked(() => {
        this.lookups.setBranch(branchId);
        this.lookups.setMode(mode);
      });
    });

    effect(() => {
      if (this.readonly()) return;
      const stages = this.lookups.stages();
      const mode = this.mode();
      const currentBranchId = this.branchId();
      const currentStageId = this.draftStageId();

      const nextBranchId = mode === 'create' ? sessionBranch()?.branchId ?? null : currentBranchId;
      const defaultStageId =
        mode === 'create' && !currentStageId && stages.length > 0 ? pickDefaultStageId(stages) : currentStageId;

      if (nextBranchId !== currentBranchId || defaultStageId !== currentStageId) {
        untracked(() => {
          this.draft.update((d) => ({
            ...d,
            branchId: nextBranchId,
            stageId: mode === 'create' ? (d.stageId ?? defaultStageId) : d.stageId,
          }));
        });
      }
    });
  }

  focusName(): void {
    if (this.draft().leadProfileType === 'CORPORATE') {
      this.companySection()?.focusName();
    } else {
      this.basicsSection()?.focusName();
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
      (this.lookups.customFields() ?? [])
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

  protected toggleMore(): void {
    this.moreOpen.update((open) => !open);
  }

  protected onOpenDuplicateRecord(match: DuplicateMatch): void {
    const id = match.recordId ?? match.leads?.[0]?.id;
    if (id) {
      this.openLead.emit(id);
    }
  }

  protected onUseCompany(selection: DuplicateCompanySelection): void {
    if (this.readonly() || this.mode() !== 'create') return;
    const emptyAddress = emptyDraft().address;
    this.draft.update((current) => ({
      ...current,
      existingCompanyPartyId: selection.partyId,
      existingCompanyName: selection.displayName,
      companyName: '',
      legalName: '',
      taxNumber: '',
      commercialRegistrationNumber: '',
      companyPhones: [],
      companyEmail: '',
      companyWebsite: '',
      address: emptyAddress,
    }));
  }

  saveEditingContact(): Promise<boolean> {
    return this.contactsSection()?.saveContact() ?? Promise.resolve(true);
  }

  discardContactEdit(): void {
    this.contactsSection()?.discardEdit();
  }

  draftWithEditingContact(): LeadDraft {
    const current = this.draft();
    const contacts = this.contactsSection()?.draftContacts();
    return contacts ? { ...current, contacts } : current;
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    if (this.readonly()) return;
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
    if (sectionId === 'lf-custom') {
      return errKeys.some(
        (key) => (key === 'customFields' || key.startsWith('customFields.')) && !requiredCfKeys.has(key),
      );
    }
    if (sectionId === 'lf-classification' && errKeys.some((key) => requiredCfKeys.has(key))) {
      return true;
    }
    const prefixes = LEAD_PAGE_SECTION_ERRORS[sectionId];
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

function pickDefaultStageId(stages: LeadStage[]): string {
  const sorted = stages.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const flagged = sorted.find((s) => (s as LeadStage & { isDefault?: boolean }).isDefault);
  return (flagged ?? sorted.find((s) => s.flag === 'NEW') ?? sorted[0]).id;
}

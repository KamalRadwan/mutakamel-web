import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerCategory,
  tablerDots,
  tablerFlag,
  tablerForms,
  tablerTarget,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { listCountries } from '../../../../core/geo/geo.api';
import { GeoCountry } from '../../../../core/geo/geo.model';
import { Field } from '../../../../shared/ui/field/field';
import { RecordLayout } from '../../../../shared/ui/record-layout/record-layout';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { RecordCustomFields } from '../../shared/record/custom-fields/record-custom-fields';
import { isClosed, type CardColor, type OpportunityRow } from '../opportunities.model';
import {
  DraftErrors,
  OpportunityDraft,
  OpportunityFormSection,
  SECTION_OF_FIELD,
  firstOpenStageId,
} from './opportunity-draft';
import { OpportunityLookups } from './opportunity-lookups';
import {
  ClassificationSection,
  OpportunityUpdatingState,
} from './sections/classification-section/classification-section';
import { ClosingSection } from './sections/closing-section/closing-section';
import { CustomerSection } from './sections/customer-section/customer-section';
import { DealSection } from './sections/deal-section/deal-section';
import { MoreSection } from './sections/more-section/more-section';
import { smoothScrollBehavior } from '../../../../shared/ui/scroll/scroll-into-view';

export type OpportunitySeedPatch = Partial<
  Pick<OpportunityDraft, 'branchId' | 'pipelineId' | 'stageId' | 'currencyCode'>
>;

export type { OpportunityUpdatingState } from './sections/classification-section/classification-section';

export const OPPORTUNITY_PAGE_SECTION_ERRORS: Record<string, readonly string[]> = {
  'opp-classification': [
    'companyId',
    'branchId',
    'ownerUserId',
    'pipelineId',
    'stageId',
    'amount',
    'currencyCode',
    'probabilityPercent',
    'expectedCloseDate',
    'tagIds',
  ],
  'opp-deal': ['title', 'description'],
  'opp-customer': ['customerProfileId', 'contactPartyId'],
  'opp-custom': ['customFields'],
  'opp-more': ['leadId'],
};

const MODAL_SECTION_ORDER: readonly OpportunityFormSection[] = [
  'deal',
  'customer',
  'custom',
  'more',
  'classification',
];

const PAGE_SECTION_ORDER: readonly OpportunityFormSection[] = [
  'classification',
  'deal',
  'customer',
  'custom',
  'more',
];

@Component({
  selector: 'app-opportunity-form',
  imports: [
    TranslocoPipe,
    Field,
    SectionBar,
    RecordCustomFields,
    ClassificationSection,
    DealSection,
    CustomerSection,
    ClosingSection,
    MoreSection,
  ],
  providers: [
    {
      provide: OpportunityLookups,
      useFactory: () => inject(OpportunityLookups, { optional: true, skipSelf: true }) ?? new OpportunityLookups(),
    },
    provideTranslocoScope(
      { scope: 'opportunity-form', alias: 'oppForm' },
      { scope: 'opportunities', alias: 'opportunities' },
    ),
    provideIcons({
      tablerCategory,
      tablerTarget,
      tablerUsers,
      tablerForms,
      tablerFlag,
      tablerDots,
    }),
  ],
  templateUrl: './opportunity-form.html',
  host: {
    '[class]': "layout() === 'modal' ? 'flex h-full min-h-0 flex-1 overflow-hidden' : 'block'",
    '(keydown)': 'onHostKeydown($event)',
  },
})
export class OpportunityForm {
  private static nextId = 0;
  protected readonly uid = `opp-form-${++OpportunityForm.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly scope = inject(OpportunityLookups).scope;
  readonly lookups = inject(OpportunityLookups);
  private readonly dealSection = viewChild(DealSection);

  readonly draft = model.required<OpportunityDraft>();
  readonly layout = input<RecordLayout>('modal');
  readonly mode = input<'create' | 'edit' | 'view'>('create');
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly row = input<OpportunityRow | null>(null);
  readonly updating = input<OpportunityUpdatingState>({});

  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly moveStage = output<string>();
  readonly submitRequest = output<void>();
  /**
   * Create mode only: the fields the form filled on its own (branch, pipeline, stage,
   * currency) once lookups arrived. Hosts must merge this patch into their base
   * snapshot (`base = { ...base, ...patch }`) so seeding never makes the form dirty.
   */
  readonly seeded = output<OpportunitySeedPatch>();

  /**
   * Non-null (an i18n key) while saving must be blocked, e.g. custom-field definitions
   * failed to load so required checks cannot run. Hosts disable save and show the message.
   */
  readonly saveBlockedReason = computed(() => this.lookups.saveBlockedReason());

  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly moreOpen = signal(false);
  private seededDefaultCurrency = false;

  protected readonly hasOtherCustomFields = computed(() =>
    this.lookups.customFields().some((field) => !(field.requiredOnCreate || field.requiredOnUpdate)),
  );

  protected readonly showClosing = computed(() => {
    const r = this.row();
    return this.mode() !== 'create' && r !== null && isClosed(r);
  });

  constructor() {
    void listCountries()
      .then((list) => this.countries.set(list))
      .catch(() => {});

    effect(() => {
      const d = this.draft();
      const m = this.mode();
      if (m !== 'create') {
        this.seededDefaultCurrency = false;
      }
      untracked(() => {
        this.lookups.setBranch(d.branchId);
        this.lookups.setMode(m);
        this.lookups.setCustomerProfile(d.customerProfileId);
      });
    });

    effect(() => {
      const m = this.mode();
      if (m !== 'create') return;

      const d = this.draft();
      const defaultPipeline = this.lookups.defaultPipeline();
      const defaultCurrency = this.lookups.defaultCurrency();

      const nextBranchId = this.lookups.selectedBranch()?.branchId ?? null;

      const nextPipelineId = !d.pipelineId && defaultPipeline ? defaultPipeline.id : d.pipelineId;
      const activePipeline = nextPipelineId ? this.lookups.pipeline(nextPipelineId) ?? defaultPipeline : defaultPipeline;
      const nextStageId = !d.stageId && activePipeline ? firstOpenStageId(activePipeline) : d.stageId;

      const shouldSeedCurrency =
        !this.seededDefaultCurrency && d.currencyCode === null && !d.amount.trim() && defaultCurrency !== null;
      const nextCurrencyCode = shouldSeedCurrency ? defaultCurrency : d.currencyCode;

      if (
        nextBranchId !== d.branchId ||
        nextPipelineId !== d.pipelineId ||
        nextStageId !== d.stageId ||
        nextCurrencyCode !== d.currencyCode
      ) {
        if (shouldSeedCurrency) {
          this.seededDefaultCurrency = true;
        }
        untracked(() => {
          const current = this.draft();
          const patch: OpportunitySeedPatch = {};
          if (current.branchId === null && nextBranchId !== null) patch.branchId = nextBranchId;
          if (current.pipelineId === null && nextPipelineId !== null) patch.pipelineId = nextPipelineId;
          if (current.stageId === null && nextStageId !== null) patch.stageId = nextStageId;
          if (current.currencyCode === null && nextCurrencyCode !== null) patch.currencyCode = nextCurrencyCode;
          if (Object.keys(patch).length === 0) return;
          this.draft.set({ ...current, ...patch });
          this.seeded.emit(patch);
        });
      }
    });
  }

  focusTitle(): void {
    this.dealSection()?.focusTitle();
  }

  focusFirstError(explicitErrors?: DraftErrors): void {
    const errs = explicitErrors ?? this.errors();
    const errKeys = Object.entries(errs)
      .filter(([, message]) => Boolean(message))
      .map(([key]) => key);
    if (errKeys.length === 0) return;

    const targetSection = this.firstErrorSection(errKeys);

    if (this.layout() === 'modal' && targetSection === 'more' && !this.moreOpen()) {
      this.moreOpen.set(true);
      afterNextRender(() => this.scrollAndFocusSection(targetSection), { injector: this.injector });
      return;
    }

    if (!this.scrollAndFocusSection(targetSection)) {
      afterNextRender(() => this.scrollAndFocusSection(targetSection), { injector: this.injector });
    }
  }

  scrollToFirstError(explicitErrors?: DraftErrors): void {
    this.focusFirstError(explicitErrors);
  }

  protected onOtherCustomFieldsChange(customFields: Record<string, unknown>): void {
    this.draft.update((current) => ({
      ...current,
      customFields,
    }));
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    if (this.readonly()) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.submitRequest.emit();
    }
  }

  private firstErrorSection(errKeys: readonly string[]): OpportunityFormSection | null {
    const requiredCfKeys = new Set(
      this.lookups
        .customFields()
        .filter((f) => f.requiredOnCreate || f.requiredOnUpdate)
        .map((f) => `customFields.${f.fieldKey}`),
    );

    const order = this.layout() === 'page' ? PAGE_SECTION_ORDER : MODAL_SECTION_ORDER;
    for (const section of order) {
      if (this.sectionHasError(section, errKeys, requiredCfKeys)) {
        return section;
      }
    }
    return null;
  }

  private sectionHasError(
    section: OpportunityFormSection,
    errKeys: readonly string[],
    requiredCfKeys: ReadonlySet<string>,
  ): boolean {
    for (const key of errKeys) {
      if (key === 'customFields' || key.startsWith('customFields.')) {
        const isRequired = requiredCfKeys.has(key);
        if (section === 'classification' && isRequired) return true;
        if (section === 'custom' && !isRequired) return true;
        continue;
      }
      const mapped = SECTION_OF_FIELD[key];
      if (mapped === section) return true;
    }
    return false;
  }

  private scrollAndFocusSection(section: OpportunityFormSection | null): boolean {
    const sectionEl = section
      ? this.host.nativeElement.querySelector<HTMLElement>(`[data-section="${section}"]`)
      : null;

    if (sectionEl) {
      sectionEl.scrollIntoView({
        block: this.layout() === 'page' ? 'start' : 'nearest',
        behavior: smoothScrollBehavior(),
      });
      if (this.focusFirstInvalidIn(sectionEl)) {
        return true;
      }
    }

    return this.focusFirstInvalidIn(this.host.nativeElement);
  }

  private focusFirstInvalidIn(container: HTMLElement): boolean {
    const target = container.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) return false;

    const focusTarget = (el: HTMLElement) => {
      el.scrollIntoView({ block: 'nearest' });
      el.focus();
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
    target.scrollIntoView({ block: 'nearest' });
    return true;
  }
}

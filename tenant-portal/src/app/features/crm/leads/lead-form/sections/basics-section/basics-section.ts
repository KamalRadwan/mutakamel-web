import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding, tablerUser } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID, RecordLayout } from '../../../../../../shared/ui/record-layout/record-layout';
import { SuggestInput } from '../../../../../../shared/ui/suggest-input/suggest-input';
import { TITLE_SUGGESTIONS, suggestionsForLanguage } from '../../../../../../shared/ui/suggest-input/suggestions';
import { LeadProfileType } from '../../../leads.model';
import { DraftErrors, LEAD_LIMITS, LeadDraft, emptyDraft } from '../../lead-draft';

interface TypeOption {
  value: LeadProfileType;
  label: string;
  icon: 'tablerUser' | 'tablerBuilding';
  activeClass: string;
  disabled: boolean;
}

@Component({
  selector: 'app-lf-basics',
  imports: [NgIcon, TranslocoPipe, ConfirmDialog, Field, SuggestInput],
  providers: [
    provideTranslocoScope(
      { scope: 'lead-form', alias: 'leadForm' },
      { scope: 'lead-modal', alias: 'leadModal' },
    ),
    provideIcons({ tablerUser, tablerBuilding }),
  ],
  templateUrl: './basics-section.html',
  host: { class: 'block min-w-0' },
})
export class BasicsSection {
  private static nextId = 0;
  protected readonly uid = `lf-basics-${++BasicsSection.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly typeGroup = viewChild<ElementRef<HTMLElement>>('typeGroup');
  private readonly typeButtons = viewChildren<ElementRef<HTMLButtonElement>>('typeBtn');
  private readonly switchTypeWrap = viewChild<ElementRef<HTMLElement>>('switchTypeWrap');
  private readonly switchTypeDialog = viewChild.required<ConfirmDialog>('switchTypeDialog');
  private readonly firstNameInput = viewChild<ElementRef<HTMLInputElement>>('firstNameInput');
  private readonly lastNameInput = viewChild<ElementRef<HTMLInputElement>>('lastNameInput');

  readonly draft = model.required<LeadDraft>();
  readonly errors = input<DraftErrors>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  /** 'type' = only the lead type; 'names' = only the individual name row; 'all' = both. */
  readonly part = input<'type' | 'names' | 'all'>('all');
  readonly layout = input<RecordLayout>('modal');

  protected readonly limits = LEAD_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;
  readonly switchingType = signal(false);

  protected readonly allTitles = computed(() => suggestionsForLanguage(TITLE_SUGGESTIONS, this.language()));

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

    effect(() => {
      this.i18n();
      const groupEl = this.typeGroup()?.nativeElement;
      if (!groupEl) return;
      const fieldEl = groupEl.closest('ui-field');
      const labelEl = fieldEl?.querySelector('label');
      if (labelEl) {
        labelEl.id = `${this.uid}-type-label`;
      }
      const tipEl = fieldEl?.querySelector('[role="tooltip"]');
      if (tipEl?.id) {
        groupEl.setAttribute('aria-describedby', tipEl.id);
      }
    });
  }

  protected readonly typeOptions = computed<TypeOption[]>(() => {
    this.i18n();
    const locked = this.mode() === 'edit' || this.readonly();
    return [
      {
        value: 'INDIVIDUAL',
        label: this.transloco.translate('leadForm.basics.individual'),
        icon: 'tablerUser',
        activeClass: 'bg-icon-blue text-on-icon',
        disabled: locked,
      },
      {
        value: 'CORPORATE',
        label: this.transloco.translate('leadForm.basics.corporate'),
        icon: 'tablerBuilding',
        activeClass: 'bg-icon-navy text-on-icon',
        disabled: locked,
      },
    ];
  });

  protected readonly activeTypeTabIndex = computed(() => {
    const items = this.typeOptions();
    const current = this.draft().leadProfileType;
    const selectedIndex = items.findIndex((item) => !item.disabled && item.value === current);
    if (selectedIndex !== -1) return selectedIndex;
    return items.findIndex((item) => !item.disabled);
  });

  focusName(): void {
    const errs = this.errors();
    const inputEl =
      this.draft().leadProfileType === 'CORPORATE'
        ? this.host.nativeElement.closest('app-lead-form')?.querySelector<HTMLInputElement>(
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
    const raw = this.errors()[path];
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

  protected async onTypeChange(value: LeadProfileType): Promise<void> {
    if (this.mode() === 'edit' || this.readonly() || this.switchingType()) return;
    const current = this.draft();
    if (value === current.leadProfileType) return;

    if (this.hasTypeSpecificData(current)) {
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
        leadProfileType: value,
        branchId: current.branchId,
        stageId: current.stageId,
        ownerUserId: current.ownerUserId,
        acquisitionSourceId: current.acquisitionSourceId,
        tagIds: current.tagIds,
        rating: current.rating,
        cardColor: current.cardColor,
        address: current.address,
        description: current.description,
        interestSummary: current.interestSummary,
        expectedNeed: current.expectedNeed,
        expectedValue: current.expectedValue,
        currencyCode: current.currencyCode,
        customFields: current.customFields,
      }),
    );

    afterNextRender(() => this.focusName(), { injector: this.injector });
  }

  protected onTypeKeydown(event: KeyboardEvent, index: number): void {
    const items = this.typeOptions();
    const enabledIndices = items.reduce<number[]>((acc, item, i) => {
      if (!item.disabled) acc.push(i);
      return acc;
    }, []);
    if (enabledIndices.length === 0) return;

    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    const currentPos = enabledIndices.indexOf(index);
    const startPos = currentPos !== -1 ? currentPos : 0;
    let targetPos = -1;

    if (event.key === nextKey || event.key === 'ArrowDown') {
      targetPos = (startPos + 1) % enabledIndices.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      targetPos = (startPos - 1 + enabledIndices.length) % enabledIndices.length;
    } else if (event.key === 'Home') {
      targetPos = 0;
    } else if (event.key === 'End') {
      targetPos = enabledIndices.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const targetIndex = enabledIndices[targetPos];
    const targetOption = items[targetIndex];
    this.typeButtons()[targetIndex]?.nativeElement.focus();
    void this.onTypeChange(targetOption.value);
  }

  protected onSwitchTypeEscape(event: Event): void {
    this.dismissSwitchTypeDialog(event);
  }

  private dismissSwitchTypeDialog(event: Event): void {
    const dialog = this.switchTypeWrap()?.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (!dialog?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dialog.close();
  }

  protected setHonorificTitle(honorificTitle: string): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, honorificTitle }));
  }

  protected setField(field: 'firstName' | 'lastName', event: Event): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }

  private hasTypeSpecificData(d: LeadDraft): boolean {
    if (d.leadProfileType === 'INDIVIDUAL') {
      return !!(
        d.honorificTitle.trim() ||
        d.firstName.trim() ||
        d.lastName.trim() ||
        d.email.trim() ||
        d.phones.some((p) => p.trim().length > 0)
      );
    }
    return !!(
      d.existingCompanyPartyId ||
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

export { BasicsSection as LfBasics };

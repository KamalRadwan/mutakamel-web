import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerArrowRight,
  tablerCheck,
  tablerCloudOff,
  tablerFileDescription,
  tablerFileInvoice,
  tablerFileText,
  tablerLock,
  tablerMail,
  tablerPlus,
  tablerReceipt,
  tablerShoppingCart,
  tablerTemplate,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { TEMPLATE_FAMILY_META, templateLayoutMeta } from '../../shared/template-family';
import {
  CreateTemplateDto,
  CreateTemplateResponse,
  TemplateApiError,
  TemplateCreationScope,
  TemplateDataSourceItem,
  TemplateDataSourceKey,
  TemplateDefinitionScope,
  TemplateDirection,
  TemplateDocumentType,
  TemplateLayoutMode,
  TemplateLocale,
  TemplateOutputChannel,
  TemplatePageOrientation,
  TemplatePagePreset,
  TemplateResolvedDirection,
  TemplateStarterOption,
  TemplateStartersQuery,
  createTemplate,
  getCreationScopes,
  getStarterThumbnail,
  listDataSources,
  listStarters,
  newTemplateIdempotencyKey,
} from '../../templates.api';
import { TemplatePageDiagram } from '../page-diagram/page-diagram';

type WizardStepId = 'details' | 'document' | 'page' | 'starter' | 'review';

interface WizardStepMeta {
  id: WizardStepId;
  labelKey: string;
  num: number;
}

const WIZARD_STEPS: readonly WizardStepMeta[] = [
  { id: 'details', labelKey: 'tplCreate.wizard.steps.details', num: 1 },
  { id: 'document', labelKey: 'tplCreate.wizard.steps.document', num: 2 },
  { id: 'page', labelKey: 'tplCreate.wizard.steps.page', num: 3 },
  { id: 'starter', labelKey: 'tplCreate.wizard.steps.starter', num: 4 },
  { id: 'review', labelKey: 'tplCreate.wizard.steps.review', num: 5 },
];

const DOCUMENT_TYPES: readonly TemplateDocumentType[] = [
  'QUOTATION',
  'PURCHASE_QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'INVOICE',
  'CONTRACT',
  'LETTER',
  'CRM_OUTBOUND_EMAIL',
];

const PRINT_LAYOUT_MODES: readonly TemplateLayoutMode[] = [
  'HYBRID_DOCUMENT',
  'FLOW_DOCUMENT',
  'FIXED_CANVAS',
];

const EMAIL_LAYOUT_TILES: readonly TemplateLayoutMode[] = [
  'EMAIL_FLOW',
  'HYBRID_DOCUMENT',
  'FLOW_DOCUMENT',
  'FIXED_CANVAS',
];

const DEFAULT_PRINT_ADAPTERS: Readonly<Record<Exclude<TemplateDocumentType, 'CRM_OUTBOUND_EMAIL'>, TemplateDataSourceKey>> = {
  QUOTATION: 'TRADE_QUOTATION_PRINT_V1',
  PURCHASE_QUOTATION: 'TRADE_PURCHASE_QUOTATION_PRINT_V1',
  SALES_ORDER: 'TRADE_SALES_ORDER_PRINT_V1',
  PURCHASE_ORDER: 'TRADE_PURCHASE_ORDER_PRINT_V1',
  INVOICE: 'TRADE_INVOICE_PRINT_V1',
  CONTRACT: 'TRADE_CONTRACT_PRINT_V1',
  LETTER: 'CORE_BUSINESS_LETTER_PRINT_V1',
};

const PRESET_DIMENSIONS_MM: Readonly<Record<Exclude<TemplatePagePreset, 'CUSTOM'>, { width: number; height: number }>> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  LETTER: { width: 215.9, height: 279.4 },
};

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,99}$/;

const ALL_LOCALES: readonly TemplateLocale[] = ['en-US', 'ar-EG'];
const ALL_DIRECTIONS: readonly TemplateDirection[] = ['AUTO', 'LTR', 'RTL'];
const ALL_PRESETS: readonly TemplatePagePreset[] = ['A4', 'A5', 'LETTER', 'CUSTOM'];
const ALL_ORIENTATIONS: readonly TemplatePageOrientation[] = ['PORTRAIT', 'LANDSCAPE'];

function scopeKeyOf(scope: TemplateDefinitionScope): string {
  return scope.type === 'COMPANY' ? `COMPANY:${scope.companyId}` : 'TENANT';
}

function parseScopeKey(key: string): TemplateDefinitionScope {
  if (key.startsWith('COMPANY:')) {
    return { type: 'COMPANY', companyId: key.slice('COMPANY:'.length) };
  }
  return { type: 'TENANT' };
}

function extractApiErrorCode(error: unknown): string | null {
  if (error instanceof TemplateApiError) return error.code;
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return null;
}

@Component({
  selector: 'app-template-create-wizard, app-create-wizard',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    Modal,
    UnsavedDialog,
    TemplatePageDiagram,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'templates-create', alias: 'tplCreate' },
      { scope: 'templates', alias: 'templates' },
    ),
    provideIcons({
      tablerArrowLeft,
      tablerArrowRight,
      tablerCheck,
      tablerCloudOff,
      tablerFileDescription,
      tablerFileInvoice,
      tablerFileText,
      tablerLock,
      tablerMail,
      tablerPlus,
      tablerReceipt,
      tablerShoppingCart,
      tablerTemplate,
      tablerX,
    }),
  ],
  templateUrl: './create-wizard.html',
})
export class TemplateCreateWizard {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly modal = viewChild.required<Modal>('wizardModal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  readonly watchQueryParam = input(true);
  readonly navigateOnCreate = input(true);
  /** Supports optional declarative `[open]="..."` binding alongside imperative `.open()` and `?create=1`. */
  readonly openInput = input<boolean | null>(null, { alias: 'open' });

  readonly created = output<CreateTemplateResponse>();
  readonly closed = output<void>();

  private openedFromQueryParam = false;

  protected readonly steps = WIZARD_STEPS;
  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly familyMetaMap = TEMPLATE_FAMILY_META;
  protected readonly layoutMetaFn = templateLayoutMeta;

  protected readonly isOpen = signal(false);
  protected readonly step = signal<WizardStepId>('details');
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly guardBusy = signal(false);

  protected readonly creationScopes = signal<TemplateCreationScope[]>([]);
  protected readonly dataSources = signal<TemplateDataSourceItem[]>([]);
  protected readonly dataSourcesLoaded = signal(false);

  // Step 1 fields
  protected readonly name = signal('');
  protected readonly code = signal('');
  protected readonly scopeKey = signal('');
  protected readonly description = signal('');
  protected readonly step1Attempted = signal(false);
  protected readonly codeConflictError = signal<string | null>(null);

  // Step 2 fields
  protected readonly documentType = signal<TemplateDocumentType>('QUOTATION');
  protected readonly layoutMode = signal<TemplateLayoutMode>('HYBRID_DOCUMENT');
  protected readonly dataSourceKey = signal<TemplateDataSourceKey>('TRADE_QUOTATION_PRINT_V1');
  protected readonly locale = signal<TemplateLocale>(this.language() === 'ar' ? 'ar-EG' : 'en-US');
  protected readonly direction = signal<TemplateDirection>('AUTO');

  // Step 3 fields (print only)
  protected readonly pagePreset = signal<TemplatePagePreset>('A4');
  protected readonly pageOrientation = signal<TemplatePageOrientation>('PORTRAIT');
  protected readonly customWidthMm = signal<number>(210);
  protected readonly customHeightMm = signal<number>(297);
  protected readonly marginTopMm = signal<number>(12);
  protected readonly marginEndMm = signal<number>(12);
  protected readonly marginBottomMm = signal<number>(12);
  protected readonly marginStartMm = signal<number>(12);
  protected readonly step3Attempted = signal(false);

  // Step 4 fields (starter)
  protected readonly startersLoading = signal(false);
  protected readonly startersFailed = signal(false);
  protected readonly startersCorrelationId = signal<string | null>(null);
  protected readonly starters = signal<TemplateStarterOption[]>([]);
  protected readonly selectedStarterKey = signal<string | null>(null);
  protected readonly starterThumbUrls = signal<Record<string, string>>({});

  private baseSnapshot = '';
  private allowClose = false;
  private initSeq = 0;
  private sourcesSeq = 0;
  private startersSeq = 0;
  private loadedStartersTupleKey = '';
  private starterBlobUrls: string[] = [];
  private pendingCreateKey: string | null = null;
  private pendingCreateSig = '';

  protected readonly isRtlUi = computed(() => this.language() === 'ar');
  protected readonly forwardArrowIcon = computed(() => (this.isRtlUi() ? 'tablerArrowLeft' : 'tablerArrowRight'));
  protected readonly backArrowIcon = computed(() => (this.isRtlUi() ? 'tablerArrowRight' : 'tablerArrowLeft'));

  protected readonly outputChannel = computed<TemplateOutputChannel>(() =>
    this.documentType() === 'CRM_OUTBOUND_EMAIL' ? 'EMAIL' : 'PRINT',
  );
  protected readonly isEmail = computed(() => this.outputChannel() === 'EMAIL');

  protected readonly currentStepIndex = computed(() => this.steps.findIndex((s) => s.id === this.step()));
  protected readonly currentStepNumber = computed(() => this.currentStepIndex() + 1);

  protected readonly resolvedDirection = computed<TemplateResolvedDirection>(() => {
    const dir = this.direction();
    if (dir === 'AUTO') return this.locale() === 'ar-EG' ? 'RTL' : 'LTR';
    return dir;
  });

  protected readonly selectedScope = computed<TemplateDefinitionScope>(() => parseScopeKey(this.scopeKey()));

  protected readonly scopeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.creationScopes().map((item) =>
      item.type === 'TENANT'
        ? { value: 'TENANT', label: this.transloco.translate('tplCreate.details.tenantScope') }
        : { value: `COMPANY:${item.companyId}`, label: item.label },
    );
  });

  protected readonly currentScopeLabel = computed(() => {
    this.i18n();
    const key = this.scopeKey();
    return this.scopeOptions().find((opt) => opt.value === key)?.label ?? this.transloco.translate('tplCreate.details.tenantScope');
  });

  protected readonly matchingAdapters = computed(() => {
    const doc = this.documentType();
    return this.dataSources().filter((item) => item.documentType === doc);
  });

  protected readonly activeAdapter = computed(() => {
    const key = this.dataSourceKey();
    return this.matchingAdapters().find((item) => item.adapterKey === key) ?? this.matchingAdapters()[0] ?? null;
  });

  protected readonly emailSourceOptions = computed<DropdownOption<TemplateDataSourceKey>[]>(() => {
    this.i18n();
    return this.matchingAdapters().map((item) => ({
      value: item.adapterKey,
      label: this.transloco.translate(`tplCreate.document.dataSources.${item.adapterKey}`),
    }));
  });

  protected readonly dataSourceLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(`tplCreate.document.dataSources.${this.dataSourceKey()}`);
  });

  protected readonly layoutTileModes = computed<readonly TemplateLayoutMode[]>(() =>
    this.isEmail() ? EMAIL_LAYOUT_TILES : PRINT_LAYOUT_MODES,
  );

  protected readonly languageOptions = computed<DropdownOption<TemplateLocale>[]>(() => {
    this.i18n();
    const supported = this.activeAdapter()?.supportedLocales;
    const list = supported && supported.length > 0 ? supported : ALL_LOCALES;
    return list.map((loc) => ({
      value: loc,
      label: this.transloco.translate(`templates.locales.${loc}`),
    }));
  });

  protected readonly directionOptions = computed<DropdownOption<TemplateDirection>[]>(() => {
    this.i18n();
    return ALL_DIRECTIONS.map((dir) => ({
      value: dir,
      label: this.transloco.translate(`templates.directions.${dir}`),
    }));
  });

  protected readonly presetOptions = computed<DropdownOption<TemplatePagePreset>[]>(() => {
    this.i18n();
    return ALL_PRESETS.map((preset) => ({
      value: preset,
      label: this.transloco.translate(`tplCreate.page.presets.${preset}`),
    }));
  });

  protected readonly orientationOptions = computed<DropdownOption<TemplatePageOrientation>[]>(() => {
    this.i18n();
    return ALL_ORIENTATIONS.map((orientation) => ({
      value: orientation,
      label: this.transloco.translate(`tplCreate.page.orientations.${orientation}`),
    }));
  });

  protected readonly diagramWidthMm = computed(() => {
    const preset = this.pagePreset();
    if (preset === 'CUSTOM') return this.customWidthMm();
    const base = PRESET_DIMENSIONS_MM[preset];
    return this.pageOrientation() === 'LANDSCAPE' ? base.height : base.width;
  });

  protected readonly diagramHeightMm = computed(() => {
    const preset = this.pagePreset();
    if (preset === 'CUSTOM') return this.customHeightMm();
    const base = PRESET_DIMENSIONS_MM[preset];
    return this.pageOrientation() === 'LANDSCAPE' ? base.width : base.height;
  });

  protected readonly nameError = computed<string | null>(() => {
    this.i18n();
    if (!this.step1Attempted()) return null;
    const trimmed = this.name().trim();
    if (!trimmed) return this.transloco.translate('tplCreate.details.errors.nameRequired');
    if (trimmed.length > 200) return this.transloco.translate('tplCreate.details.errors.nameTooLong');
    return null;
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    if (this.codeConflictError()) return this.codeConflictError();
    if (!this.step1Attempted()) return null;
    const normalized = this.code().trim().toUpperCase();
    if (!normalized) return this.transloco.translate('tplCreate.details.errors.codeRequired');
    if (normalized.length > 100) return this.transloco.translate('tplCreate.details.errors.codeTooLong');
    if (!CODE_PATTERN.test(normalized)) return this.transloco.translate('tplCreate.details.errors.codePattern');
    return null;
  });

  protected readonly scopeError = computed<string | null>(() => {
    this.i18n();
    if (!this.step1Attempted()) return null;
    if (!this.scopeKey() || this.creationScopes().length === 0) {
      return this.transloco.translate('tplCreate.details.errors.scopeRequired');
    }
    return null;
  });

  protected readonly descriptionError = computed<string | null>(() => {
    this.i18n();
    if (!this.step1Attempted()) return null;
    if (this.description().trim().length > 1000) {
      return this.transloco.translate('tplCreate.details.errors.descriptionTooLong');
    }
    return null;
  });

  protected readonly step1Valid = computed(() => {
    const trimmedName = this.name().trim();
    const normalizedCode = this.code().trim().toUpperCase();
    return (
      trimmedName.length >= 1 &&
      trimmedName.length <= 200 &&
      normalizedCode.length >= 1 &&
      normalizedCode.length <= 100 &&
      CODE_PATTERN.test(normalizedCode) &&
      this.description().trim().length <= 1000 &&
      Boolean(this.scopeKey()) &&
      this.creationScopes().length > 0 &&
      !this.codeConflictError()
    );
  });

  protected readonly widthError = computed<string | null>(() => {
    this.i18n();
    if (!this.step3Attempted() || this.isEmail() || this.pagePreset() !== 'CUSTOM') return null;
    const w = this.customWidthMm();
    if (!Number.isFinite(w) || w < 50 || w > 500) {
      return this.transloco.translate('tplCreate.page.errors.widthRange');
    }
    return null;
  });

  protected readonly heightError = computed<string | null>(() => {
    this.i18n();
    if (!this.step3Attempted() || this.isEmail() || this.pagePreset() !== 'CUSTOM') return null;
    const h = this.customHeightMm();
    if (!Number.isFinite(h) || h < 50 || h > 1000) {
      return this.transloco.translate('tplCreate.page.errors.heightRange');
    }
    return null;
  });

  protected readonly marginTopError = computed<string | null>(() => this.marginFieldError(this.marginTopMm(), true));
  protected readonly marginEndError = computed<string | null>(() => this.marginFieldError(this.marginEndMm(), false));
  protected readonly marginBottomError = computed<string | null>(() => this.marginFieldError(this.marginBottomMm(), true));
  protected readonly marginStartError = computed<string | null>(() => this.marginFieldError(this.marginStartMm(), false));

  protected readonly step3Valid = computed(() => {
    if (this.isEmail()) return true;
    const w = this.diagramWidthMm();
    const h = this.diagramHeightMm();
    if (this.pagePreset() === 'CUSTOM') {
      if (!Number.isFinite(w) || w < 50 || w > 500) return false;
      if (!Number.isFinite(h) || h < 50 || h > 1000) return false;
    }
    const margins = [this.marginTopMm(), this.marginEndMm(), this.marginBottomMm(), this.marginStartMm()];
    if (margins.some((m) => !Number.isFinite(m) || m < 0 || m > 100)) return false;
    return w - this.marginStartMm() - this.marginEndMm() > 0 && h - this.marginTopMm() - this.marginBottomMm() > 0;
  });

  protected readonly selectedStarter = computed<TemplateStarterOption | null>(() => {
    const key = this.selectedStarterKey();
    if (!key) return null;
    return this.starters().find((item) => item.starterKey === key) ?? null;
  });

  protected readonly dirty = computed(() => {
    if (this.loading() || this.loadFailed() || !this.isOpen()) return false;
    return this.computeFormSnapshot() !== this.baseSnapshot;
  });

  constructor() {
    effect(() => {
      if (!this.watchQueryParam()) return;
      const createFlag = this.queryParams()?.get('create');
      if (createFlag === '1' && !untracked(() => this.isOpen())) {
        this.openedFromQueryParam = true;
        untracked(() => this.open());
      } else if (
        createFlag !== '1' &&
        this.openedFromQueryParam &&
        untracked(() => this.isOpen()) &&
        !untracked(() => this.saving())
      ) {
        this.openedFromQueryParam = false;
        untracked(() => this.closeImmediately(false));
      }
    });

    effect(() => {
      const attr = this.openInput();
      if (attr === null) return;
      if (attr && !untracked(() => this.isOpen())) {
        untracked(() => this.open());
      } else if (!attr && untracked(() => this.isOpen()) && !untracked(() => this.saving())) {
        untracked(() => this.closeImmediately(false));
      }
    });

    this.destroyRef.onDestroy(() => {
      this.revokeStarterThumbnails();
    });
  }

  open(initialScope?: TemplateDefinitionScope): void {
    this.allowClose = false;
    this.guardBusy.set(false);
    this.saving.set(false);
    this.resetFields(initialScope);

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }

    void this.loadInitialData(initialScope);
  }

  protected retryInitialLoad(): void {
    void this.loadInitialData();
  }

  protected onCodeInput(raw: string): void {
    this.codeConflictError.set(null);
    this.code.set(raw.toUpperCase());
    this.invalidateCreateIdempotency();
  }

  protected onNameInput(raw: string): void {
    this.name.set(raw);
    this.invalidateCreateIdempotency();
  }

  protected onDescriptionInput(raw: string): void {
    this.description.set(raw);
    this.invalidateCreateIdempotency();
  }

  protected onScopeChange(nextScopeKey: string): void {
    if (nextScopeKey === this.scopeKey()) return;
    this.scopeKey.set(nextScopeKey);
    this.clearStarterIfTupleChanged();
    this.invalidateCreateIdempotency();
    void this.loadDataSourcesForScope(parseScopeKey(nextScopeKey));
  }

  protected selectDocumentType(docType: TemplateDocumentType): void {
    if (this.isDocumentTypeDisabled(docType) || docType === this.documentType()) return;
    this.documentType.set(docType);

    if (docType === 'CRM_OUTBOUND_EMAIL') {
      const emailAdapters = this.dataSources().filter((ds) => ds.documentType === 'CRM_OUTBOUND_EMAIL');
      const nextAdapter = emailAdapters[0]?.adapterKey ?? 'CRM_LEAD_OUTBOUND_EMAIL_V1';
      this.dataSourceKey.set(nextAdapter);
      this.layoutMode.set('EMAIL_FLOW');
    } else {
      const adapter =
        this.dataSources().find((ds) => ds.documentType === docType) ?? null;
      const nextKey = adapter?.adapterKey ?? DEFAULT_PRINT_ADAPTERS[docType];
      this.dataSourceKey.set(nextKey);
      const allowed = adapter?.allowedLayoutModes ?? PRINT_LAYOUT_MODES;
      if (!allowed.includes(this.layoutMode())) {
        this.layoutMode.set(allowed[0] ?? 'HYBRID_DOCUMENT');
      }
    }

    this.ensureLocaleSupported();
    this.clearStarterIfTupleChanged();
    this.invalidateCreateIdempotency();
  }

  protected isDocumentTypeDisabled(docType: TemplateDocumentType): boolean {
    if (!this.dataSourcesLoaded()) return false;
    return !this.dataSources().some((ds) => ds.documentType === docType);
  }

  protected isLayoutDisabled(mode: TemplateLayoutMode): boolean {
    if (this.isEmail()) {
      return mode !== 'EMAIL_FLOW';
    }
    if (mode === 'EMAIL_FLOW') return true;
    const adapter = this.activeAdapter();
    if (!adapter) return false;
    return !adapter.allowedLayoutModes.includes(mode);
  }

  protected layoutDisabledReason(mode: TemplateLayoutMode): string | null {
    if (!this.isLayoutDisabled(mode)) return null;
    if (this.isEmail() && mode !== 'EMAIL_FLOW') {
      return this.transloco.translate('tplCreate.document.disabledPrintOnly');
    }
    if (!this.isEmail() && mode === 'EMAIL_FLOW') {
      return this.transloco.translate('tplCreate.document.disabledEmailOnly');
    }
    return this.transloco.translate('tplCreate.document.disabledBySource');
  }

  protected selectLayoutMode(mode: TemplateLayoutMode): void {
    if (this.isLayoutDisabled(mode) || mode === this.layoutMode()) return;
    this.layoutMode.set(mode);
    this.clearStarterIfTupleChanged();
    this.invalidateCreateIdempotency();
  }

  protected onDataSourceChange(key: TemplateDataSourceKey): void {
    if (key === this.dataSourceKey()) return;
    this.dataSourceKey.set(key);
    this.ensureLocaleSupported();
    this.clearStarterIfTupleChanged();
    this.invalidateCreateIdempotency();
  }

  protected onLocaleChange(nextLocale: TemplateLocale): void {
    if (nextLocale === this.locale()) return;
    this.locale.set(nextLocale);
    this.clearStarterIfTupleChanged();
    this.invalidateCreateIdempotency();
  }

  protected onDirectionChange(nextDir: TemplateDirection): void {
    if (nextDir === this.direction()) return;
    this.direction.set(nextDir);
    this.clearStarterIfTupleChanged();
    this.invalidateCreateIdempotency();
  }

  protected onPresetChange(nextPreset: TemplatePagePreset): void {
    this.pagePreset.set(nextPreset);
    if (nextPreset !== 'CUSTOM') {
      const dims = PRESET_DIMENSIONS_MM[nextPreset];
      if (this.pageOrientation() === 'LANDSCAPE') {
        this.customWidthMm.set(dims.height);
        this.customHeightMm.set(dims.width);
      } else {
        this.customWidthMm.set(dims.width);
        this.customHeightMm.set(dims.height);
      }
    }
    this.invalidateCreateIdempotency();
  }

  protected onOrientationChange(nextOrientation: TemplatePageOrientation): void {
    if (nextOrientation === this.pageOrientation()) return;
    this.pageOrientation.set(nextOrientation);
    this.invalidateCreateIdempotency();
  }

  protected formatNumberInput(value: number): string {
    return Number.isFinite(value) ? String(value) : '';
  }

  protected onNumericInput(target: 'width' | 'height' | 'top' | 'end' | 'bottom' | 'start', raw: string): void {
    const parsed = raw.trim() === '' ? Number.NaN : Number(raw);
    switch (target) {
      case 'width':
        this.customWidthMm.set(parsed);
        break;
      case 'height':
        this.customHeightMm.set(parsed);
        break;
      case 'top':
        this.marginTopMm.set(parsed);
        break;
      case 'end':
        this.marginEndMm.set(parsed);
        break;
      case 'bottom':
        this.marginBottomMm.set(parsed);
        break;
      case 'start':
        this.marginStartMm.set(parsed);
        break;
    }
    this.invalidateCreateIdempotency();
  }

  protected selectStarter(starterKey: string | null): void {
    this.selectedStarterKey.set(starterKey);
    this.invalidateCreateIdempotency();
  }

  protected reloadStarters(): void {
    void this.loadStartersForCurrentTuple(true);
  }

  protected isStepSkipped(stepId: WizardStepId): boolean {
    return stepId === 'page' && this.isEmail();
  }

  protected isStepInvalid(stepId: WizardStepId): boolean {
    if (stepId === 'details') return this.step1Attempted() && !this.step1Valid();
    if (stepId === 'page') return !this.isEmail() && this.step3Attempted() && !this.step3Valid();
    return false;
  }

  protected isStepDone(stepIndex: number, stepId: WizardStepId): boolean {
    if (this.isStepSkipped(stepId) || this.isStepInvalid(stepId)) return false;
    return stepIndex < this.currentStepIndex();
  }

  protected isDocumentTypeTabStop(docType: TemplateDocumentType): boolean {
    const current = this.documentType();
    if (!this.isDocumentTypeDisabled(current)) return current === docType;
    const firstEnabled = this.documentTypes.find((item) => !this.isDocumentTypeDisabled(item));
    return firstEnabled === docType;
  }

  protected isLayoutTabStop(mode: TemplateLayoutMode): boolean {
    const modes = this.layoutTileModes();
    const current = this.layoutMode();
    if (modes.includes(current) && !this.isLayoutDisabled(current)) return current === mode;
    const firstEnabled = modes.find((item) => !this.isLayoutDisabled(item));
    return firstEnabled === mode;
  }

  protected isStarterTabStop(starterKey: string | null): boolean {
    const current = this.selectedStarterKey();
    if (current === null) return starterKey === null;
    const exists = this.starters().some((item) => item.starterKey === current);
    return exists ? current === starterKey : starterKey === null;
  }

  protected onDocumentTypeKeydown(event: KeyboardEvent, index: number): void {
    this.handleRadioGridKeydown(
      event,
      this.documentTypes,
      index,
      3,
      (item) => this.isDocumentTypeDisabled(item),
      (item) => this.selectDocumentType(item),
    );
  }

  protected onLayoutKeydown(event: KeyboardEvent, index: number): void {
    this.handleRadioGridKeydown(
      event,
      this.layoutTileModes(),
      index,
      this.isEmail() ? 2 : 3,
      (item) => this.isLayoutDisabled(item),
      (item) => this.selectLayoutMode(item),
    );
  }

  protected onStarterKeydown(event: KeyboardEvent, index: number): void {
    const keys: readonly (string | null)[] = [null, ...this.starters().map((s) => s.starterKey)];
    this.handleRadioGridKeydown(
      event,
      keys,
      index,
      2,
      () => false,
      (item) => this.selectStarter(item),
    );
  }

  protected canClickStep(stepIndex: number, stepId: WizardStepId): boolean {
    if (this.loading() || this.loadFailed() || this.saving()) return false;
    if (stepId === 'page' && this.isEmail()) return false;
    return this.isStepDone(stepIndex, stepId);
  }

  protected goToStep(target: WizardStepId): void {
    if (this.loading() || this.loadFailed() || this.saving()) return;
    if (target === 'details') {
      this.step.set('details');
      return;
    }
    if (!this.step1Valid()) {
      this.step1Attempted.set(true);
      this.step.set('details');
      return;
    }
    if (target === 'document') {
      this.step.set('document');
      return;
    }
    if (target === 'page') {
      if (this.isEmail()) {
        void this.enterStarterStep();
      } else {
        this.step.set('page');
      }
      return;
    }
    if (!this.isEmail() && !this.step3Valid()) {
      this.step3Attempted.set(true);
      this.step.set('page');
      return;
    }
    if (target === 'starter') {
      void this.enterStarterStep();
      return;
    }
    this.step.set('review');
  }

  protected goNext(): void {
    if (this.loading() || this.loadFailed() || this.saving()) return;
    switch (this.step()) {
      case 'details':
        if (!this.step1Valid()) {
          this.step1Attempted.set(true);
          return;
        }
        this.step.set('document');
        return;
      case 'document':
        if (this.isEmail()) {
          void this.enterStarterStep();
        } else {
          this.step.set('page');
        }
        return;
      case 'page':
        if (!this.step3Valid()) {
          this.step3Attempted.set(true);
          return;
        }
        void this.enterStarterStep();
        return;
      case 'starter':
        this.step.set('review');
        return;
      case 'review':
        void this.submitCreate();
    }
  }

  protected goPrevious(): void {
    if (this.loading() || this.loadFailed() || this.saving()) return;
    switch (this.step()) {
      case 'document':
        this.step.set('details');
        return;
      case 'page':
        this.step.set('document');
        return;
      case 'starter':
        this.step.set(this.isEmail() ? 'document' : 'page');
        return;
      case 'review':
        void this.enterStarterStep();
    }
  }

  protected async submitCreate(): Promise<void> {
    if (this.saving() || this.loading() || this.loadFailed()) return;
    if (!this.step1Valid()) {
      this.step1Attempted.set(true);
      this.step.set('details');
      return;
    }
    if (!this.isEmail() && !this.step3Valid()) {
      this.step3Attempted.set(true);
      this.step.set('page');
      return;
    }

    const dto = this.buildCreateDto();
    const signature = JSON.stringify(dto);
    if (!this.pendingCreateKey || this.pendingCreateSig !== signature) {
      this.pendingCreateKey = newTemplateIdempotencyKey();
      this.pendingCreateSig = signature;
    }

    this.saving.set(true);
    try {
      const response = await createTemplate(dto, this.pendingCreateKey);
      this.pendingCreateKey = null;
      this.pendingCreateSig = '';
      this.notify.success(
        this.transloco.translate('tplCreate.wizard.createdTitle'),
        this.transloco.translate('tplCreate.wizard.createdText', { name: response.definition.name }),
      );
      this.created.emit(response);
      this.closeImmediately(false);
      if (this.navigateOnCreate()) {
        await this.router.navigate(['/workspace/operations/template-platform', response.definition.templateId, 'design']);
      }
    } catch (error) {
      const code = extractApiErrorCode(error);
      if (code === 'CORE.TEMPLATE.CODE.CONFLICT') {
        this.pendingCreateKey = null;
        this.pendingCreateSig = '';
        this.codeConflictError.set(this.translateErrorMessage(error));
        this.step1Attempted.set(true);
        this.step.set('details');
        queueMicrotask(() => this.codeInput()?.nativeElement.focus());
      } else {
        this.notify.error(this.translateErrorMessage(error));
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.guardBusy()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    // A self-close (closeImmediately) passes its own URL choice; a user close always clears ?create=1.
    this.finalizeClose(this.allowClose ? this.closeClearsUrl : true);
  }

  private async confirmModalClose(): Promise<void> {
    const choice = await this.openGuarded(() => this.unsavedDialog().open());
    if (choice === 'discard') {
      this.closeImmediately(true);
      return;
    }
    if (choice === 'save') {
      if (!this.step1Valid()) {
        this.step1Attempted.set(true);
        this.step.set('details');
      } else if (!this.isEmail() && !this.step3Valid()) {
        this.step3Attempted.set(true);
        this.step.set('page');
      } else {
        this.step.set('review');
      }
    }
  }

  private async openGuarded<T>(fn: () => Promise<T>): Promise<T> {
    this.guardBusy.set(true);
    try {
      return await fn();
    } finally {
      this.guardBusy.set(false);
    }
  }

  /** True when the pending self-close should also clear the ?create=1 query param. */
  private closeClearsUrl = true;

  private closeImmediately(clearUrlQuery: boolean): void {
    this.allowClose = true;
    this.closeClearsUrl = clearUrlQuery;
    // modal().close() emits (closed) synchronously → onModalClosed → finalizeClose, so finalize here
    // only if the modal did not emit (e.g. it was already closed). Otherwise `closed` fired twice.
    this.modal().close();
    if (this.isOpen()) this.finalizeClose(clearUrlQuery);
    this.closeClearsUrl = true;
  }

  private finalizeClose(clearUrlQuery: boolean): void {
    this.allowClose = false;
    this.openedFromQueryParam = false;
    this.initSeq++;
    this.sourcesSeq++;
    this.startersSeq++;
    this.isOpen.set(false);
    this.guardBusy.set(false);
    this.saving.set(false);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.loadCorrelationId.set(null);
    this.startersCorrelationId.set(null);
    this.revokeStarterThumbnails();
    this.closed.emit();

    if (clearUrlQuery && this.watchQueryParam() && this.queryParams()?.get('create') === '1') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { create: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private resetFields(initialScope?: TemplateDefinitionScope): void {
    this.step.set('details');
    this.name.set('');
    this.code.set('');
    this.scopeKey.set(initialScope ? scopeKeyOf(initialScope) : 'TENANT');
    this.description.set('');
    this.step1Attempted.set(false);
    this.codeConflictError.set(null);

    this.documentType.set('QUOTATION');
    this.layoutMode.set('HYBRID_DOCUMENT');
    this.dataSourceKey.set('TRADE_QUOTATION_PRINT_V1');
    this.locale.set(this.language() === 'ar' ? 'ar-EG' : 'en-US');
    this.direction.set('AUTO');

    this.pagePreset.set('A4');
    this.pageOrientation.set('PORTRAIT');
    this.customWidthMm.set(210);
    this.customHeightMm.set(297);
    this.marginTopMm.set(12);
    this.marginEndMm.set(12);
    this.marginBottomMm.set(12);
    this.marginStartMm.set(12);
    this.step3Attempted.set(false);

    this.startersLoading.set(false);
    this.startersFailed.set(false);
    this.starters.set([]);
    this.selectedStarterKey.set(null);
    this.loadedStartersTupleKey = '';
    this.revokeStarterThumbnails();
    this.invalidateCreateIdempotency();
    this.baseSnapshot = this.computeFormSnapshot();
  }

  private async loadInitialData(preferredScope?: TemplateDefinitionScope): Promise<void> {
    const seq = ++this.initSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.loadCorrelationId.set(null);
    this.dataSourcesLoaded.set(false);

    try {
      const scopesRes = await getCreationScopes();
      if (seq !== this.initSeq) return;

      const scopes = scopesRes.scopes;
      this.creationScopes.set(scopes);

      let chosenScope: TemplateDefinitionScope = { type: 'TENANT' };
      if (preferredScope && scopes.some((s) => scopeKeyOf(s) === scopeKeyOf(preferredScope))) {
        chosenScope = preferredScope;
      } else if (scopes.length > 0) {
        const first = scopes[0];
        chosenScope = first.type === 'COMPANY' ? { type: 'COMPANY', companyId: first.companyId } : { type: 'TENANT' };
      }

      this.scopeKey.set(scopes.length > 0 ? scopeKeyOf(chosenScope) : '');
      this.baseSnapshot = this.computeFormSnapshot();

      if (scopes.length > 0) {
        await this.loadDataSourcesForScope(chosenScope, seq);
      } else {
        this.dataSources.set([]);
        this.dataSourcesLoaded.set(true);
      }

      if (seq !== this.initSeq) return;
      this.loading.set(false);
      this.baseSnapshot = this.computeFormSnapshot();
    } catch (error: unknown) {
      if (seq !== this.initSeq) return;
      this.loading.set(false);
      this.loadCorrelationId.set(error instanceof TemplateApiError ? error.correlationId : null);
      this.loadFailed.set(true);
    }
  }

  private async loadDataSourcesForScope(scope: TemplateDefinitionScope, expectedInitSeq?: number): Promise<void> {
    const seq = ++this.sourcesSeq;
    try {
      const res = await listDataSources({
        scopeType: scope.type,
        ...(scope.type === 'COMPANY' ? { companyId: scope.companyId } : {}),
      });
      if (seq !== this.sourcesSeq) return;
      if (expectedInitSeq !== undefined && expectedInitSeq !== this.initSeq) return;

      this.dataSources.set(res.items);
      this.dataSourcesLoaded.set(true);

      const currentDoc = this.documentType();
      const firstDoc = res.items[0]?.documentType;
      if (!res.items.some((ds) => ds.documentType === currentDoc) && firstDoc) {
        this.selectDocumentType(firstDoc);
      } else {
        const adapter = this.activeAdapter();
        if (adapter) {
          this.dataSourceKey.set(adapter.adapterKey);
          if (!adapter.allowedLayoutModes.includes(this.layoutMode())) {
            this.layoutMode.set(adapter.allowedLayoutModes[0] ?? 'HYBRID_DOCUMENT');
          }
          this.ensureLocaleSupported();
        }
      }
    } catch (error) {
      if (seq !== this.sourcesSeq) return;
      if (expectedInitSeq !== undefined) {
        if (expectedInitSeq !== this.initSeq) return;
        throw error;
      }
      this.notify.error(this.translateErrorMessage(error));
    }
  }

  private async enterStarterStep(): Promise<void> {
    this.step.set('starter');
    await this.loadStartersForCurrentTuple(false);
  }

  private async loadStartersForCurrentTuple(force: boolean): Promise<void> {
    const query = this.buildStartersQuery();
    const tupleKey = JSON.stringify(query);
    if (!force && this.loadedStartersTupleKey === tupleKey && !this.startersFailed()) {
      return;
    }

    const seq = ++this.startersSeq;
    this.startersLoading.set(true);
    this.startersFailed.set(false);
    this.startersCorrelationId.set(null);

    try {
      const res = await listStarters(query);
      if (seq !== this.startersSeq) return;

      this.starters.set(res.items);
      this.loadedStartersTupleKey = tupleKey;
      this.startersLoading.set(false);

      if (this.selectedStarterKey() && !res.items.some((s) => s.starterKey === this.selectedStarterKey())) {
        this.selectedStarterKey.set(null);
      }

      void this.loadStarterThumbnails(res.items, query, seq);
    } catch (error: unknown) {
      if (seq !== this.startersSeq) return;
      this.startersLoading.set(false);
      this.startersCorrelationId.set(error instanceof TemplateApiError ? error.correlationId : null);
      this.startersFailed.set(true);
    }
  }

  private async loadStarterThumbnails(
    items: readonly TemplateStarterOption[],
    query: TemplateStartersQuery,
    seq: number,
  ): Promise<void> {
    this.revokeStarterThumbnails();
    const entries = await Promise.all(
      items
        .filter((item) => item.thumbnail.state === 'READY')
        .map(async (item) => {
          try {
            const blob = await getStarterThumbnail(item.starterKey, query);
            return [item.starterKey, URL.createObjectURL(blob)] as const;
          } catch {
            return null;
          }
        }),
    );

    if (seq !== this.startersSeq) {
      for (const entry of entries) {
        if (entry) URL.revokeObjectURL(entry[1]);
      }
      return;
    }

    const nextMap: Record<string, string> = {};
    for (const entry of entries) {
      if (!entry) continue;
      nextMap[entry[0]] = entry[1];
      this.starterBlobUrls.push(entry[1]);
    }
    this.starterThumbUrls.set(nextMap);
  }

  private revokeStarterThumbnails(): void {
    for (const url of this.starterBlobUrls) {
      URL.revokeObjectURL(url);
    }
    this.starterBlobUrls = [];
    this.starterThumbUrls.set({});
  }

  private buildStartersQuery(): TemplateStartersQuery {
    const scope = this.selectedScope();
    const adapter = this.activeAdapter();
    return {
      documentType: this.documentType(),
      outputChannel: this.outputChannel(),
      layoutMode: this.layoutMode(),
      dataSourceKey: this.dataSourceKey(),
      dataSourceSchemaVersion: adapter?.schemaVersion ?? (this.isEmail() || this.documentType() === 'LETTER' ? 1 : 2),
      locale: this.locale(),
      direction: this.direction(),
      definitionScopeType: scope.type,
      ...(scope.type === 'COMPANY' ? { definitionCompanyId: scope.companyId } : {}),
    };
  }

  private buildCreateDto(): CreateTemplateDto {
    const trimmedDesc = this.description().trim();
    const starterKey = this.selectedStarterKey();
    const preset = this.pagePreset();
    return {
      code: this.code().trim().toUpperCase(),
      name: this.name().trim(),
      ...(trimmedDesc ? { description: trimmedDesc } : {}),
      documentType: this.documentType(),
      outputChannel: this.outputChannel(),
      layoutMode: this.layoutMode(),
      dataSourceKey: this.dataSourceKey(),
      locale: this.locale(),
      direction: this.direction(),
      scope: this.selectedScope(),
      ...(this.outputChannel() === 'PRINT'
        ? {
            page: {
              preset,
              orientation: this.pageOrientation(),
              ...(preset === 'CUSTOM'
                ? { widthMm: this.customWidthMm(), heightMm: this.customHeightMm() }
                : {}),
              marginMm: {
                top: this.marginTopMm(),
                end: this.marginEndMm(),
                bottom: this.marginBottomMm(),
                start: this.marginStartMm(),
              },
            },
          }
        : {}),
      ...(starterKey ? { starterKey } : {}),
    };
  }

  private ensureLocaleSupported(): void {
    const supported = this.activeAdapter()?.supportedLocales;
    if (supported && supported.length > 0 && !supported.includes(this.locale())) {
      this.locale.set(supported[0]);
    }
  }

  private clearStarterIfTupleChanged(): void {
    this.loadedStartersTupleKey = '';
    if (this.selectedStarterKey() !== null) {
      this.selectedStarterKey.set(null);
      this.notify.info(
        this.transloco.translate('tplCreate.wizard.starterClearedTitle'),
        this.transloco.translate('tplCreate.wizard.starterClearedText'),
      );
    }
  }

  private invalidateCreateIdempotency(): void {
    this.pendingCreateKey = null;
    this.pendingCreateSig = '';
  }

  private marginFieldError(value: number, isVertical: boolean): string | null {
    this.i18n();
    if (!this.step3Attempted() || this.isEmail()) return null;
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return this.transloco.translate('tplCreate.page.errors.marginRange');
    }
    const positive = isVertical
      ? this.diagramHeightMm() - this.marginTopMm() - this.marginBottomMm() > 0
      : this.diagramWidthMm() - this.marginStartMm() - this.marginEndMm() > 0;
    return positive ? null : this.transloco.translate('tplCreate.page.errors.printableAreaInvalid');
  }

  private computeFormSnapshot(): string {
    return JSON.stringify({
      name: this.name(),
      code: this.code(),
      scopeKey: this.scopeKey(),
      description: this.description(),
      documentType: this.documentType(),
      layoutMode: this.layoutMode(),
      dataSourceKey: this.dataSourceKey(),
      locale: this.locale(),
      direction: this.direction(),
      pagePreset: this.pagePreset(),
      pageOrientation: this.pageOrientation(),
      customWidthMm: this.customWidthMm(),
      customHeightMm: this.customHeightMm(),
      marginTopMm: this.marginTopMm(),
      marginEndMm: this.marginEndMm(),
      marginBottomMm: this.marginBottomMm(),
      marginStartMm: this.marginStartMm(),
      selectedStarterKey: this.selectedStarterKey(),
    });
  }

  private handleRadioGridKeydown<T>(
    event: KeyboardEvent,
    items: readonly T[],
    currentIndex: number,
    cols: number,
    isDisabled: (item: T) => boolean,
    select: (item: T) => void,
  ): void {
    const total = items.length;
    if (total === 0) return;

    const rtl = this.isRtlUi();
    let step: number | null = null;
    let edge: 'first' | 'last' | null = null;

    switch (event.key) {
      case 'ArrowRight':
        step = rtl ? -1 : 1;
        break;
      case 'ArrowLeft':
        step = rtl ? 1 : -1;
        break;
      case 'ArrowDown':
        step = cols;
        break;
      case 'ArrowUp':
        step = -cols;
        break;
      case 'Home':
        edge = 'first';
        break;
      case 'End':
        edge = 'last';
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    let targetIdx = -1;
    if (edge === 'first') {
      targetIdx = items.findIndex((item) => !isDisabled(item));
    } else if (edge === 'last') {
      for (let i = total - 1; i >= 0; i--) {
        if (!isDisabled(items[i])) {
          targetIdx = i;
          break;
        }
      }
    } else if (step !== null) {
      let probe = (currentIndex + step + total * 4) % total;
      for (let count = 0; count < total; count++) {
        if (!isDisabled(items[probe])) {
          targetIdx = probe;
          break;
        }
        probe = (probe + (step > 0 ? 1 : -1) + total) % total;
      }
    }

    if (targetIdx < 0) return;
    select(items[targetIdx]);

    const group = (event.currentTarget as HTMLElement | null)?.closest('[role="radiogroup"]');
    const buttons = group?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    buttons?.[targetIdx]?.focus();
  }

  private translateErrorMessage(error: unknown): string {
    const code = extractApiErrorCode(error);
    if (code) {
      const localKey = `tplCreate.errors.${code}`;
      const localMsg = this.transloco.translate(localKey);
      if (localMsg && localMsg !== localKey) return localMsg;

      const sharedKey = `templates.errors.${code}`;
      const sharedMsg = this.transloco.translate(sharedKey);
      if (sharedMsg && sharedMsg !== sharedKey) return sharedMsg;
    }
    if (error instanceof TemplateApiError && error.status === 0) {
      return this.transloco.translate('templates.errors.network');
    }
    return this.transloco.translate('templates.errors.generic');
  }
}

export { TemplateCreateWizard as CreateWizard };

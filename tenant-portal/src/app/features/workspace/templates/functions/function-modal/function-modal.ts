import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArchive,
  tablerArrowBackUp,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCircleCheck,
  tablerCircleX,
  tablerClock,
  tablerDeviceFloppy,
  tablerHistory,
  tablerLock,
  tablerMathFunction,
  tablerPlus,
  tablerRoute,
  tablerShieldCheck,
  tablerStack2,
  tablerTrash,
  tablerUpload,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { countFormulaAstNodes } from '../../designer/tables/table-ops';
import { FormulaBuilder } from '../../designer/tables/formula-builder/formula-builder';
import type { TemplateFormulaDimension, TemplateFormulaExpression } from '../../templates.model';
import { FunctionImpactModal } from '../function-impact-modal/function-impact-modal';
import { FunctionReasonModal } from '../function-reason-modal/function-reason-modal';
import {
  FUNCTION_CODE_RE,
  FUNCTION_DECIMAL_RE,
  FUNCTION_MAX_PARAMETERS,
  FUNCTION_MAX_TESTS,
  FUNCTION_NUMERIC_POLICY,
  FUNCTION_PARAM_NAME_RE,
  FUNCTION_VALIDATION_TTL_MS,
  FunctionCompanyOption,
  FunctionDetailDto,
  FunctionPageInfo,
  FunctionParameter,
  FunctionResultSpec,
  FunctionScalarType,
  FunctionScope,
  FunctionScopeType,
  FunctionSummaryDto,
  FunctionTestCase,
  FunctionUsageItemDto,
  FunctionValidationIssue,
  FunctionValidationState,
  FunctionValidationSummary,
  FunctionValue,
  FunctionVersionDetailDto,
  FunctionVersionSummaryDto,
  FunctionWorkingBody,
  TemplateApiError,
  ValidateFunctionResponseDto,
  archiveFunction,
  createFunction,
  defaultFunctionValue,
  formatFunctionDateTime,
  formatFunctionExpression,
  formatFunctionTime,
  getFunction,
  getFunctionVersion,
  listFunctionUsage,
  listFunctionVersions,
  newTemplateIdempotencyKey,
  patchFunction,
  publishFunction,
  restoreFunction,
  translateFunctionError,
  translateFunctionIssueCode,
  validateFunction,
} from '../functions.api';

type FunctionModalTab = 'definition' | 'tests' | 'versions' | 'usage';

interface FunctionFormDraft {
  code: string;
  scopeType: FunctionScopeType;
  companyId: string;
  working: FunctionWorkingBody;
}

function generateClientUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultExpressionFor(paramName: string): TemplateFormulaExpression {
  return { kind: 'PARAMETER', name: paramName };
}

function buildEmptyCreateDraft(defaultCompanyId: string, defaultTestName: string): FunctionFormDraft {
  const paramName = 'amount';
  return {
    code: '',
    scopeType: 'TENANT',
    companyId: defaultCompanyId,
    working: {
      numericPolicy: FUNCTION_NUMERIC_POLICY,
      name: '',
      description: '',
      parameters: [{ name: paramName, type: 'DECIMAL', nullable: false, dimension: 'SCALAR' }],
      result: { type: 'DECIMAL', nullable: false, dimension: 'SCALAR' },
      expression: defaultExpressionFor(paramName),
      tests: [
        {
          id: generateClientUuid(),
          name: defaultTestName,
          arguments: [{ name: paramName, value: defaultFunctionValue('DECIMAL', 'SCALAR') }],
          expected: defaultFunctionValue('DECIMAL', 'SCALAR'),
        },
      ],
    },
  };
}

function draftFromDetail(detail: FunctionDetailDto, fallbackCompanyId: string): FunctionFormDraft {
  const working = detail.working
    ? structuredClone(detail.working)
    : {
        numericPolicy: FUNCTION_NUMERIC_POLICY,
        name: detail.name,
        description: detail.description ?? '',
        parameters: [{ name: 'value', type: 'DECIMAL' as const, nullable: false, dimension: 'SCALAR' as const }],
        result: { type: 'DECIMAL' as const, nullable: false, dimension: 'SCALAR' as const },
        expression: defaultExpressionFor('value'),
        tests: [],
      };
  working.description = working.description ?? '';

  return {
    code: detail.code,
    scopeType: detail.scope.scopeType,
    companyId: detail.scope.scopeType === 'COMPANY' ? detail.scope.companyId : fallbackCompanyId,
    working,
  };
}

function canonicalDraftSignature(d: FunctionFormDraft): string {
  return JSON.stringify({
    code: d.code.trim().toUpperCase(),
    scopeType: d.scopeType,
    companyId: d.scopeType === 'COMPANY' ? d.companyId : '',
    working: {
      numericPolicy: d.working.numericPolicy,
      name: d.working.name.trim(),
      description: (d.working.description ?? '').trim(),
      parameters: d.working.parameters,
      result: d.working.result,
      expression: d.working.expression,
      tests: d.working.tests,
    },
  });
}

function toWorkingPayload(working: FunctionWorkingBody): FunctionWorkingBody {
  const trimmedDesc = (working.description ?? '').trim();
  return {
    numericPolicy: FUNCTION_NUMERIC_POLICY,
    name: working.name.trim(),
    ...(trimmedDesc ? { description: trimmedDesc } : {}),
    parameters: structuredClone(working.parameters),
    result: structuredClone(working.result),
    expression: structuredClone(working.expression),
    tests: working.tests.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      arguments: structuredClone(t.arguments),
      expected: structuredClone(t.expected),
    })),
  };
}

function uniqueParamName(existing: readonly FunctionParameter[]): string {
  const used = new Set(existing.map((p) => p.name));
  for (let i = 1; i <= 64; i++) {
    const candidate = `param${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `param_${Date.now()}`;
}

@Component({
  selector: 'app-function-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Checkbox,
    DateField,
    Dropdown,
    Field,
    Modal,
    Segmented,
    UnsavedDialog,
    FormulaBuilder,
    FunctionReasonModal,
    FunctionImpactModal,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerArchive,
      tablerArrowBackUp,
      tablerChevronLeft,
      tablerChevronRight,
      tablerCircleCheck,
      tablerCircleX,
      tablerClock,
      tablerDeviceFloppy,
      tablerHistory,
      tablerLock,
      tablerMathFunction,
      tablerPlus,
      tablerRoute,
      tablerShieldCheck,
      tablerStack2,
      tablerTrash,
      tablerUpload,
    }),
  ],
  templateUrl: './function-modal.html',
})
export class FunctionModal {
  private static nextId = 0;
  protected readonly uid = `fn-modal-${++FunctionModal.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('fnModal');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly versionDetailModal = viewChild.required<Modal>('versionDetailModal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly formulaBuilder = viewChild<FormulaBuilder>('formula');
  private readonly reasonModal = viewChild.required<FunctionReasonModal>('reasonModal');
  private readonly impactModal = viewChild.required<FunctionImpactModal>('impactModal');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  readonly companyOptions = input.required<readonly FunctionCompanyOption[]>();
  readonly canManage = input(true);
  readonly canPublish = input(true);
  readonly canUpdateTemplates = input(true);

  readonly saved = output<{ detail: FunctionDetailDto; isNew: boolean }>();
  readonly versionResolved = output<{ versionId: string; versionNumber: number }>();

  protected readonly maxParameters = FUNCTION_MAX_PARAMETERS;
  protected readonly maxTests = FUNCTION_MAX_TESTS;

  protected readonly isOpen = signal(false);
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly activeTab = signal<FunctionModalTab>('definition');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly validating = signal(false);
  protected readonly publishing = signal(false);
  protected readonly archiving = signal(false);
  protected readonly childModalOpen = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly versionModalOpen = signal(false);
  protected readonly attemptedSave = signal(false);
  protected readonly codeServerError = signal<string | null>(null);
  protected readonly nowTick = signal(Date.now());

  protected readonly detail = signal<FunctionDetailDto | null>(null);
  protected readonly baseDraft = signal<FunctionFormDraft>(buildEmptyCreateDraft('', 'Test 1'));
  protected readonly draft = signal<FunctionFormDraft>(buildEmptyCreateDraft('', 'Test 1'));
  protected readonly lastValidationRun = signal<ValidateFunctionResponseDto | null>(null);

  // Versions tab state
  protected readonly versions = signal<FunctionVersionSummaryDto[]>([]);
  protected readonly versionDetailsById = signal<Record<string, FunctionVersionDetailDto>>({});
  protected readonly versionsPageInfo = signal<FunctionPageInfo>({ limit: 25, hasNextPage: false, nextCursor: null });
  protected readonly versionsCursorStack = signal<string[]>([]);
  protected readonly versionsLoading = signal(false);
  protected readonly viewingVersion = signal<FunctionVersionDetailDto | null>(null);

  // Usage tab state
  protected readonly usageItems = signal<FunctionUsageItemDto[]>([]);
  protected readonly usagePageInfo = signal<FunctionPageInfo>({ limit: 25, hasNextPage: false, nextCursor: null });
  protected readonly usageCursorStack = signal<string[]>([]);
  protected readonly usageVersionFilter = signal('');
  protected readonly usageLoading = signal(false);
  protected readonly openingImpact = signal(false);

  private allowClose = false;
  private loadSeq = 0;
  private versionsSeq = 0;
  private usageSeq = 0;
  private expiryTimer: ReturnType<typeof setInterval> | null = null;
  private lastSaveFingerprint: string | null = null;
  private lastSaveIdempotencyKey: string | null = null;

  protected readonly isArchived = computed(() => this.detail()?.status === 'ARCHIVED');
  protected readonly workingAvailable = computed(
    () => this.mode() === 'create' || this.detail()?.working !== undefined,
  );
  protected readonly isReadOnly = computed(
    () =>
      !this.canManage() ||
      this.isArchived() ||
      this.loading() ||
      (this.mode() === 'edit' && !this.workingAvailable()),
  );
  protected readonly busy = computed(
    () => this.saving() || this.validating() || this.publishing() || this.archiving(),
  );

  protected readonly dirty = computed(() => {
    if (this.mode() !== 'edit' || this.isReadOnly()) return false;
    return canonicalDraftSignature(this.baseDraft()) !== canonicalDraftSignature(this.draft());
  });

  protected readonly tabs = computed<
    { id: FunctionModalTab; labelKey: string; icon: string; counter?: number }[]
  >(() => {
    const base: { id: FunctionModalTab; labelKey: string; icon: string; counter?: number }[] = [
      { id: 'definition', labelKey: 'tplFunctions.modal.tabs.definition', icon: 'tablerMathFunction' },
      {
        id: 'tests',
        labelKey: 'tplFunctions.modal.tabs.tests',
        icon: 'tablerCircleCheck',
        counter: this.draft().working.tests.length,
      },
    ];
    if (this.mode() === 'edit') {
      base.push(
        { id: 'versions', labelKey: 'tplFunctions.modal.tabs.versions', icon: 'tablerHistory' },
        { id: 'usage', labelKey: 'tplFunctions.modal.tabs.usage', icon: 'tablerRoute' },
      );
    }
    return base;
  });

  protected readonly scopeTypeOptions = computed<DropdownOption<FunctionScopeType>[]>(() => {
    this.i18n();
    return [
      { value: 'TENANT', label: this.transloco.translate('tplFunctions.scopes.tenant') },
      { value: 'COMPANY', label: this.transloco.translate('tplFunctions.scopes.company') },
    ];
  });

  protected readonly companyDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.companyOptions().map((c) => ({ value: c.id, label: c.label })),
  );

  protected readonly scalarTypeOptions = computed<DropdownOption<FunctionScalarType>[]>(() => {
    this.i18n();
    return [
      { value: 'DECIMAL', label: this.transloco.translate('tplFunctions.types.DECIMAL') },
      { value: 'STRING', label: this.transloco.translate('tplFunctions.types.STRING') },
      { value: 'BOOLEAN', label: this.transloco.translate('tplFunctions.types.BOOLEAN') },
      { value: 'DATE', label: this.transloco.translate('tplFunctions.types.DATE') },
    ];
  });

  protected readonly dimensionOptions = computed<DropdownOption<TemplateFormulaDimension>[]>(() => {
    this.i18n();
    return [
      { value: 'SCALAR', label: this.transloco.translate('tplFunctions.dimensions.SCALAR') },
      { value: 'MONEY', label: this.transloco.translate('tplFunctions.dimensions.MONEY') },
      { value: 'QUANTITY', label: this.transloco.translate('tplFunctions.dimensions.QUANTITY') },
      { value: 'UNIT_PRICE', label: this.transloco.translate('tplFunctions.dimensions.UNIT_PRICE') },
    ];
  });

  protected readonly boolOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'true', label: this.transloco.translate('tplFunctions.values.yes') },
      { value: 'false', label: this.transloco.translate('tplFunctions.values.no') },
    ];
  });

  protected readonly lockedScopeLabel = computed(() => {
    this.i18n();
    const d = this.detail();
    if (!d) return '';
    if (d.scope.scopeType === 'TENANT') {
      return this.transloco.translate('tplFunctions.scopes.tenant');
    }
    const found = this.companyOptions().find((c) => c.id === (d.scope as { companyId: string }).companyId);
    return found?.label ?? (d.scope as { companyId: string }).companyId;
  });

  protected readonly expressionSummary = computed(() => {
    this.i18n();
    return formatFunctionExpression(this.draft().working.expression, (k) => this.transloco.translate(k));
  });

  protected readonly expressionStepCount = computed(() =>
    countFormulaAstNodes(this.draft().working.expression),
  );

  protected readonly validationSummary = computed<FunctionValidationSummary | null>(
    () => this.detail()?.validation ?? null,
  );

  protected readonly validationExpired = computed(() => {
    const val = this.validationSummary();
    if (!val) return false;
    const ms = Date.parse(val.validatedAt);
    if (Number.isNaN(ms)) return false;
    return this.nowTick() - ms > FUNCTION_VALIDATION_TTL_MS;
  });

  protected readonly validUntilTime = computed(() => {
    const val = this.validationSummary();
    if (!val) return '';
    const ms = Date.parse(val.validatedAt);
    if (Number.isNaN(ms)) return '';
    return formatFunctionTime(new Date(ms + FUNCTION_VALIDATION_TTL_MS).toISOString(), this.language());
  });

  protected readonly validationIssues = computed<readonly FunctionValidationIssue[]>(() => {
    const run = this.lastValidationRun();
    if (!run || !this.validationSummary() || run.validationId !== this.validationSummary()!.id) return [];
    return run.issues;
  });

  protected readonly validateDisabled = computed(
    () =>
      this.mode() !== 'edit' ||
      this.isReadOnly() ||
      this.dirty() ||
      this.busy(),
  );

  protected readonly validateTooltip = computed(() => {
    this.i18n();
    if (this.dirty()) return this.transloco.translate('tplFunctions.actions.saveFirst');
    if (this.isArchived()) return this.transloco.translate('tplFunctions.errors.FUNCTION_ARCHIVED');
    return '';
  });

  protected readonly publishDisabled = computed(() => {
    if (this.mode() !== 'edit' || !this.canPublish() || this.isReadOnly() || this.dirty() || this.busy()) {
      return true;
    }
    const val = this.validationSummary();
    if (!val || val.state !== 'PASSED' || this.validationExpired()) return true;
    if (this.draft().working.tests.length < 1) return true;
    return false;
  });

  protected readonly publishTooltip = computed(() => {
    this.i18n();
    if (this.dirty()) return this.transloco.translate('tplFunctions.actions.saveFirst');
    if (this.draft().working.tests.length < 1) {
      return this.transloco.translate('tplFunctions.modal.publishNeedsTests');
    }
    const val = this.validationSummary();
    if (!val) return this.transloco.translate('tplFunctions.modal.publishNeedsValidation');
    if (val.state === 'FAILED') return this.transloco.translate('tplFunctions.modal.publishValidationFailed');
    if (this.validationExpired()) return this.transloco.translate('tplFunctions.modal.publishValidationExpired');
    return '';
  });

  protected readonly usageVersionDropdownOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.versions();
    return [
      { value: '', label: this.transloco.translate('tplFunctions.usage.allVersions') },
      ...list.map((v) => ({
        value: v.id,
        label: this.transloco.translate('tplFunctions.usage.versionOption', { number: v.versionNumber }),
      })),
    ];
  });

  protected readonly impactTargetVersion = computed<FunctionVersionSummaryDto | null>(() => {
    const list = this.versions();
    if (list.length === 0) return null;
    const filterId = this.usageVersionFilter();
    if (filterId) {
      const matched = list.find((v) => v.id === filterId);
      if (matched) return matched;
    }
    const pubId = this.detail()?.publishedVersionId;
    if (pubId) {
      const pub = list.find((v) => v.id === pubId);
      if (pub) return pub;
    }
    return list[0] ?? null;
  });

  protected readonly versionsHasPrev = computed(() => this.versionsCursorStack().length > 0);
  protected readonly versionsHasNext = computed(
    () => this.versionsPageInfo().hasNextPage && !!this.versionsPageInfo().nextCursor,
  );
  protected readonly usageHasPrev = computed(() => this.usageCursorStack().length > 0);
  protected readonly usageHasNext = computed(
    () => this.usagePageInfo().hasNextPage && !!this.usagePageInfo().nextCursor,
  );

  // Field validation errors
  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.codeServerError();
    if (server) return server;
    if (!this.attemptedSave() || this.mode() !== 'create') return null;
    const raw = this.draft().code.trim().toUpperCase();
    if (!raw) return this.transloco.translate('tplFunctions.validation.codeRequired');
    if (!FUNCTION_CODE_RE.test(raw)) return this.transloco.translate('tplFunctions.validation.codePattern');
    return null;
  });

  protected readonly companyError = computed(() => {
    this.i18n();
    if (!this.attemptedSave() || this.mode() !== 'create') return null;
    if (this.draft().scopeType === 'COMPANY' && !this.draft().companyId.trim()) {
      return this.transloco.translate('tplFunctions.validation.companyRequired');
    }
    return null;
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    if (!this.attemptedSave()) return null;
    const trimmed = this.draft().working.name.trim();
    if (!trimmed) return this.transloco.translate('tplFunctions.validation.nameRequired');
    if (trimmed.length > 200) return this.transloco.translate('tplFunctions.validation.nameTooLong');
    return null;
  });

  protected readonly descriptionError = computed(() => {
    this.i18n();
    if (!this.attemptedSave()) return null;
    if ((this.draft().working.description ?? '').length > 1000) {
      return this.transloco.translate('tplFunctions.validation.descriptionTooLong');
    }
    return null;
  });

  protected readonly expressionError = computed(() => {
    this.i18n();
    if (!this.attemptedSave()) return null;
    if (this.expressionStepCount() > 100) {
      return this.transloco.translate('tplFunctions.validation.expressionTooLarge');
    }
    return null;
  });

  protected readonly builderParameters = computed(() =>
    this.draft()
      .working.parameters.filter((p) => p.name.trim().length > 0)
      .map((p) => ({ name: p.name.trim(), type: p.type, dimension: p.dimension })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopExpiryTimer());
  }

  openCreate(): void {
    this.loadSeq++;
    this.versionsSeq++;
    this.usageSeq++;
    this.allowClose = false;
    this.conflictOpen.set(false);
    this.versionModalOpen.set(false);
    this.childModalOpen.set(false);
    this.loading.set(false);
    this.saving.set(false);
    this.validating.set(false);
    this.publishing.set(false);
    this.archiving.set(false);
    this.attemptedSave.set(false);
    this.codeServerError.set(null);
    this.lastValidationRun.set(null);
    this.versions.set([]);
    this.versionDetailsById.set({});
    this.usageItems.set([]);
    this.usageVersionFilter.set('');
    this.lastSaveFingerprint = null;
    this.lastSaveIdempotencyKey = null;

    const defaultCompanyId = this.companyOptions()[0]?.id ?? '';
    const defaultTestName = this.transloco.translate('tplFunctions.tests.defaultName', { n: 1 });
    const initial = buildEmptyCreateDraft(defaultCompanyId, defaultTestName);
    this.mode.set('create');
    this.activeTab.set('definition');
    this.detail.set(null);
    this.baseDraft.set(structuredClone(initial));
    this.draft.set(structuredClone(initial));

    this.nowTick.set(Date.now());
    this.startExpiryTimer();

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }
  }

  openEdit(summary: FunctionSummaryDto): void {
    this.allowClose = false;
    this.conflictOpen.set(false);
    this.versionModalOpen.set(false);
    this.childModalOpen.set(false);
    this.saving.set(false);
    this.validating.set(false);
    this.publishing.set(false);
    this.archiving.set(false);
    this.attemptedSave.set(false);
    this.codeServerError.set(null);
    this.lastValidationRun.set(null);
    this.versions.set([]);
    this.versionDetailsById.set({});
    this.versionsCursorStack.set([]);
    this.usageItems.set([]);
    this.usageCursorStack.set([]);
    this.usageVersionFilter.set('');
    this.lastSaveFingerprint = null;
    this.lastSaveIdempotencyKey = null;

    this.mode.set('edit');
    this.activeTab.set('definition');
    this.detail.set(summary);
    const fallbackCompany = this.companyOptions()[0]?.id ?? '';
    const skeletonDraft = draftFromDetail(summary, fallbackCompany);
    this.baseDraft.set(structuredClone(skeletonDraft));
    this.draft.set(structuredClone(skeletonDraft));

    this.nowTick.set(Date.now());
    this.startExpiryTimer();

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }

    void this.loadEditRecord(summary.id);
  }

  protected selectTab(tab: FunctionModalTab): void {
    this.activeTab.set(tab);
    const id = this.detail()?.id;
    if (!id) return;
    if (tab === 'versions' && this.versions().length === 0 && !this.versionsLoading()) {
      void this.loadVersions(id, null);
    } else if (tab === 'usage') {
      if (this.versions().length === 0 && !this.versionsLoading()) {
        void this.loadVersions(id, null);
      }
      if (this.usageItems().length === 0 && !this.usageLoading()) {
        void this.loadUsage(id, this.usageVersionFilter(), null);
      }
    }
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const list = this.tabs();
    if (list.length === 0) return;
    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
    let nextIdx = -1;
    if (event.key === (isRtl ? 'ArrowLeft' : 'ArrowRight')) {
      nextIdx = (index + 1) % list.length;
    } else if (event.key === (isRtl ? 'ArrowRight' : 'ArrowLeft')) {
      nextIdx = (index - 1 + list.length) % list.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = list.length - 1;
    }
    if (nextIdx === -1) return;
    event.preventDefault();
    this.selectTab(list[nextIdx].id);
    this.tabButtons()[nextIdx]?.nativeElement.focus();
  }

  protected onCodeInput(event: Event): void {
    if (this.isReadOnly() || this.mode() !== 'create') return;
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.codeServerError.set(null);
    this.draft.update((d) => ({ ...d, code: value }));
  }

  protected onScopeTypeChange(scopeType: FunctionScopeType): void {
    if (this.isReadOnly() || this.mode() !== 'create') return;
    this.draft.update((d) => ({
      ...d,
      scopeType,
      companyId: scopeType === 'COMPANY' ? d.companyId || (this.companyOptions()[0]?.id ?? '') : d.companyId,
    }));
  }

  protected onCompanyChange(companyId: string): void {
    if (this.isReadOnly() || this.mode() !== 'create') return;
    this.draft.update((d) => ({ ...d, companyId }));
  }

  protected onNameInput(event: Event): void {
    if (this.isReadOnly()) return;
    const name = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, working: { ...d.working, name } }));
  }

  protected onDescriptionInput(event: Event): void {
    if (this.isReadOnly()) return;
    const description = (event.target as HTMLTextAreaElement).value;
    this.draft.update((d) => ({ ...d, working: { ...d.working, description } }));
  }

  // Parameters management
  protected addParameter(): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      if (d.working.parameters.length >= FUNCTION_MAX_PARAMETERS) return d;
      const name = uniqueParamName(d.working.parameters);
      const nextParam: FunctionParameter = {
        name,
        type: 'DECIMAL',
        nullable: false,
        dimension: 'SCALAR',
      };
      const nextTests = d.working.tests.map((test) => ({
        ...test,
        arguments: [...test.arguments, { name, value: defaultFunctionValue('DECIMAL', 'SCALAR') }],
      }));
      return {
        ...d,
        working: {
          ...d.working,
          parameters: [...d.working.parameters, nextParam],
          tests: nextTests,
        },
      };
    });
  }

  protected removeParameter(index: number): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      if (d.working.parameters.length <= 1) return d;
      const removed = d.working.parameters[index];
      const nextParams = d.working.parameters.filter((_, idx) => idx !== index);
      const nextTests = d.working.tests.map((test) => ({
        ...test,
        arguments: test.arguments.filter((arg) => arg.name !== removed.name),
      }));
      return {
        ...d,
        working: {
          ...d.working,
          parameters: nextParams,
          tests: nextTests,
        },
      };
    });
  }

  protected onParamNameInput(index: number, event: Event): void {
    if (this.isReadOnly()) return;
    const nextName = (event.target as HTMLInputElement).value;
    this.draft.update((d) => {
      const prevName = d.working.parameters[index]?.name ?? '';
      const nextParams = d.working.parameters.map((p, idx) => (idx === index ? { ...p, name: nextName } : p));
      const nextTests = d.working.tests.map((test) => ({
        ...test,
        arguments: test.arguments.map((arg, aIdx) =>
          arg.name === prevName || (aIdx === index && !nextParams.some((p, pIdx) => pIdx !== index && p.name === arg.name))
            ? { ...arg, name: nextName }
            : arg,
        ),
      }));
      return {
        ...d,
        working: {
          ...d.working,
          parameters: nextParams,
          tests: nextTests,
        },
      };
    });
  }

  protected onParamTypeChange(index: number, nextType: FunctionScalarType): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      const target = d.working.parameters[index];
      if (!target || target.type === nextType) return d;
      const nextDimension: TemplateFormulaDimension = nextType === 'DECIMAL' ? target.dimension : 'SCALAR';
      const nextParams = d.working.parameters.map((p, idx) =>
        idx === index ? { ...p, type: nextType, dimension: nextDimension } : p,
      );
      const nextTests: FunctionTestCase[] = d.working.tests.map((test) => ({
        ...test,
        arguments: test.arguments.map((arg) =>
          arg.name === target.name
            ? {
                ...arg,
                value:
                  arg.value.kind === 'NULL' && target.nullable
                    ? { kind: 'NULL' as const }
                    : defaultFunctionValue(nextType, nextDimension),
              }
            : arg,
        ),
      }));
      return {
        ...d,
        working: { ...d.working, parameters: nextParams, tests: nextTests },
      };
    });
  }

  protected onParamDimensionChange(index: number, dimension: TemplateFormulaDimension): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      const target = d.working.parameters[index];
      if (!target || target.type !== 'DECIMAL') return d;
      const nextParams = d.working.parameters.map((p, idx) => (idx === index ? { ...p, dimension } : p));
      const nextTests: FunctionTestCase[] = d.working.tests.map((test) => ({
        ...test,
        arguments: test.arguments.map((arg) =>
          arg.name === target.name && arg.value.kind === 'DECIMAL'
            ? {
                ...arg,
                value: {
                  kind: 'DECIMAL' as const,
                  value: arg.value.value,
                  dimension,
                  ...(dimension === 'MONEY' ? { currencyCode: arg.value.currencyCode ?? 'EGP' } : {}),
                  ...(dimension === 'QUANTITY' || dimension === 'UNIT_PRICE'
                    ? { unitCode: arg.value.unitCode ?? 'pcs' }
                    : {}),
                },
              }
            : arg,
        ),
      }));
      return {
        ...d,
        working: { ...d.working, parameters: nextParams, tests: nextTests },
      };
    });
  }

  protected onParamNullableChange(index: number, nullable: boolean): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      const target = d.working.parameters[index];
      if (!target) return d;
      const nextParams = d.working.parameters.map((p, idx) => (idx === index ? { ...p, nullable } : p));
      const nextTests = nullable
        ? d.working.tests
        : d.working.tests.map((test) => ({
            ...test,
            arguments: test.arguments.map((arg) =>
              arg.name === target.name && arg.value.kind === 'NULL'
                ? { ...arg, value: defaultFunctionValue(target.type, target.dimension) }
                : arg,
            ),
          }));
      return {
        ...d,
        working: { ...d.working, parameters: nextParams, tests: nextTests },
      };
    });
  }

  protected paramNameError(index: number): string | null {
    this.i18n();
    if (!this.attemptedSave()) return null;
    const params = this.draft().working.parameters;
    const param = params[index];
    if (!param) return null;
    const trimmed = param.name.trim();
    if (!trimmed) return this.transloco.translate('tplFunctions.validation.paramNameRequired');
    if (!FUNCTION_PARAM_NAME_RE.test(trimmed)) {
      return this.transloco.translate('tplFunctions.validation.paramNamePattern');
    }
    if (params.some((other, idx) => idx !== index && other.name.trim() === trimmed)) {
      return this.transloco.translate('tplFunctions.validation.paramNameUnique');
    }
    return null;
  }

  // Result management
  protected onResultTypeChange(nextType: FunctionScalarType): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      const cur = d.working.result;
      if (cur.type === nextType) return d;
      const nextDim: TemplateFormulaDimension = nextType === 'DECIMAL' ? cur.dimension : 'SCALAR';
      const nextResult: FunctionResultSpec = { ...cur, type: nextType, dimension: nextDim };
      const nextTests: FunctionTestCase[] = d.working.tests.map((test) => ({
        ...test,
        expected:
          test.expected.kind === 'NULL' && cur.nullable
            ? { kind: 'NULL' as const }
            : defaultFunctionValue(nextType, nextDim),
      }));
      return { ...d, working: { ...d.working, result: nextResult, tests: nextTests } };
    });
  }

  protected onResultDimensionChange(dimension: TemplateFormulaDimension): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      if (d.working.result.type !== 'DECIMAL') return d;
      const nextResult: FunctionResultSpec = { ...d.working.result, dimension };
      const nextTests: FunctionTestCase[] = d.working.tests.map((test) => ({
        ...test,
        expected:
          test.expected.kind === 'DECIMAL'
            ? {
                kind: 'DECIMAL' as const,
                value: test.expected.value,
                dimension,
                ...(dimension === 'MONEY' ? { currencyCode: test.expected.currencyCode ?? 'EGP' } : {}),
                ...(dimension === 'QUANTITY' || dimension === 'UNIT_PRICE'
                  ? { unitCode: test.expected.unitCode ?? 'pcs' }
                  : {}),
              }
            : test.expected,
      }));
      return { ...d, working: { ...d.working, result: nextResult, tests: nextTests } };
    });
  }

  protected onResultNullableChange(nullable: boolean): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      const nextResult: FunctionResultSpec = { ...d.working.result, nullable };
      const nextTests = nullable
        ? d.working.tests
        : d.working.tests.map((test) => ({
            ...test,
            expected:
              test.expected.kind === 'NULL'
                ? defaultFunctionValue(nextResult.type, nextResult.dimension)
                : test.expected,
          }));
      return { ...d, working: { ...d.working, result: nextResult, tests: nextTests } };
    });
  }

  // Formula builder
  protected async openFormulaBuilder(): Promise<void> {
    if (this.isReadOnly()) return;
    const builder = this.formulaBuilder();
    if (!builder) return;
    this.childModalOpen.set(true);
    try {
      const res = await builder.open({
        context: 'FUNCTION',
        expression: structuredClone(this.draft().working.expression),
        parameters: this.builderParameters(),
      });
      if (res) {
        this.draft.update((d) => ({
          ...d,
          working: { ...d.working, expression: res.expression },
        }));
      }
    } finally {
      this.childModalOpen.set(false);
    }
  }

  // Tests management
  protected addTest(): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      if (d.working.tests.length >= FUNCTION_MAX_TESTS) return d;
      const idx = d.working.tests.length + 1;
      const test: FunctionTestCase = {
        id: generateClientUuid(),
        name: this.transloco.translate('tplFunctions.tests.defaultName', { n: idx }),
        arguments: d.working.parameters.map((p) => ({
          name: p.name,
          value: defaultFunctionValue(p.type, p.dimension),
        })),
        expected: defaultFunctionValue(d.working.result.type, d.working.result.dimension),
      };
      return {
        ...d,
        working: { ...d.working, tests: [...d.working.tests, test] },
      };
    });
  }

  protected removeTest(testId: string): void {
    if (this.isReadOnly()) return;
    this.draft.update((d) => {
      if (d.working.tests.length <= 1) return d;
      return {
        ...d,
        working: { ...d.working, tests: d.working.tests.filter((t) => t.id !== testId) },
      };
    });
  }

  protected onTestNameInput(testId: string, event: Event): void {
    if (this.isReadOnly()) return;
    const name = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({
      ...d,
      working: {
        ...d.working,
        tests: d.working.tests.map((t) => (t.id === testId ? { ...t, name } : t)),
      },
    }));
  }

  protected testArgumentValue(test: FunctionTestCase, param: FunctionParameter): FunctionValue {
    const found = test.arguments.find((a) => a.name === param.name);
    return found ? found.value : defaultFunctionValue(param.type, param.dimension);
  }

  protected onTestArgNullChange(testId: string, param: FunctionParameter, isNull: boolean): void {
    if (this.isReadOnly() || !param.nullable) return;
    const nextVal: FunctionValue = isNull
      ? { kind: 'NULL' }
      : defaultFunctionValue(param.type, param.dimension);
    this.setTestArgumentValue(testId, param.name, nextVal);
  }

  protected onTestArgDecimalInput(testId: string, param: FunctionParameter, event: Event): void {
    if (this.isReadOnly()) return;
    const raw = (event.target as HTMLInputElement).value;
    const current = this.testArgumentValue(
      this.draft().working.tests.find((t) => t.id === testId)!,
      param,
    );
    const prevCurr = current.kind === 'DECIMAL' ? current.currencyCode : 'EGP';
    const prevUnit = current.kind === 'DECIMAL' ? current.unitCode : 'pcs';
    this.setTestArgumentValue(testId, param.name, {
      kind: 'DECIMAL',
      value: raw,
      dimension: param.dimension,
      ...(param.dimension === 'MONEY' ? { currencyCode: prevCurr ?? 'EGP' } : {}),
      ...(param.dimension === 'QUANTITY' || param.dimension === 'UNIT_PRICE'
        ? { unitCode: prevUnit ?? 'pcs' }
        : {}),
    });
  }

  protected onTestArgTextInput(testId: string, paramName: string, event: Event): void {
    if (this.isReadOnly()) return;
    this.setTestArgumentValue(testId, paramName, {
      kind: 'STRING',
      value: (event.target as HTMLInputElement).value,
    });
  }

  protected onTestArgBoolChange(testId: string, paramName: string, val: string | null): void {
    if (this.isReadOnly()) return;
    this.setTestArgumentValue(testId, paramName, {
      kind: 'BOOLEAN',
      value: val === 'true',
    });
  }

  protected onTestArgDateChange(testId: string, paramName: string, val: string | null): void {
    if (this.isReadOnly()) return;
    this.setTestArgumentValue(testId, paramName, {
      kind: 'DATE',
      value: val ?? '',
    });
  }

  protected onTestExpectedNullChange(testId: string, isNull: boolean): void {
    if (this.isReadOnly()) return;
    const res = this.draft().working.result;
    if (!res.nullable) return;
    const nextVal: FunctionValue = isNull
      ? { kind: 'NULL' }
      : defaultFunctionValue(res.type, res.dimension);
    this.setTestExpectedValue(testId, nextVal);
  }

  protected onTestExpectedDecimalInput(testId: string, event: Event): void {
    if (this.isReadOnly()) return;
    const res = this.draft().working.result;
    const raw = (event.target as HTMLInputElement).value;
    this.setTestExpectedValue(testId, {
      kind: 'DECIMAL',
      value: raw,
      dimension: res.dimension,
      ...(res.dimension === 'MONEY' ? { currencyCode: 'EGP' } : {}),
      ...(res.dimension === 'QUANTITY' || res.dimension === 'UNIT_PRICE' ? { unitCode: 'pcs' } : {}),
    });
  }

  protected onTestExpectedTextInput(testId: string, event: Event): void {
    if (this.isReadOnly()) return;
    this.setTestExpectedValue(testId, {
      kind: 'STRING',
      value: (event.target as HTMLInputElement).value,
    });
  }

  protected onTestExpectedBoolChange(testId: string, val: string | null): void {
    if (this.isReadOnly()) return;
    this.setTestExpectedValue(testId, {
      kind: 'BOOLEAN',
      value: val === 'true',
    });
  }

  protected onTestExpectedDateChange(testId: string, val: string | null): void {
    if (this.isReadOnly()) return;
    this.setTestExpectedValue(testId, {
      kind: 'DATE',
      value: val ?? '',
    });
  }

  protected testNameError(test: FunctionTestCase): string | null {
    this.i18n();
    if (!this.attemptedSave()) return null;
    const trimmed = test.name.trim();
    if (!trimmed) return this.transloco.translate('tplFunctions.validation.testNameRequired');
    if (trimmed.length > 100) return this.transloco.translate('tplFunctions.validation.testNameTooLong');
    return null;
  }

  protected valueFieldError(val: FunctionValue, scalarType: FunctionScalarType): string | null {
    this.i18n();
    if (!this.attemptedSave() || val.kind === 'NULL') return null;
    if (scalarType === 'DECIMAL' && val.kind === 'DECIMAL') {
      return FUNCTION_DECIMAL_RE.test(val.value.trim())
        ? null
        : this.transloco.translate('tplFunctions.validation.decimalInvalid');
    }
    if (scalarType === 'DATE' && val.kind === 'DATE') {
      return /^\d{4}-\d{2}-\d{2}$/.test(val.value.trim())
        ? null
        : this.transloco.translate('tplFunctions.validation.dateRequired');
    }
    if (scalarType === 'STRING' && val.kind === 'STRING' && val.value.length > 1000) {
      return this.transloco.translate('tplFunctions.validation.stringTooLong');
    }
    return null;
  }

  protected testResultFor(testId: string): { state: FunctionValidationState; issueCodes: string[] } | null {
    const run = this.lastValidationRun();
    if (!run || !this.validationSummary() || run.validationId !== this.validationSummary()!.id) return null;
    return run.testResults.find((r) => r.testId === testId) ?? null;
  }

  protected issueText(code: string): string {
    this.i18n();
    return translateFunctionIssueCode(code, (k) => this.transloco.translate(k));
  }

  // Lifecycle actions
  protected undoChanges(): void {
    if (!this.dirty() || this.busy()) return;
    this.attemptedSave.set(false);
    this.codeServerError.set(null);
    this.draft.set(structuredClone(this.baseDraft()));
  }

  protected async save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    if (this.isReadOnly() || this.busy()) return false;

    this.attemptedSave.set(true);
    this.codeServerError.set(null);

    const firstInvalidTab = this.findFirstInvalidTab();
    if (firstInvalidTab) {
      if (this.activeTab() !== firstInvalidTab && (this.activeTab() !== 'definition' && this.activeTab() !== 'tests')) {
        this.activeTab.set(firstInvalidTab);
      } else if (
        (this.activeTab() === 'definition' && !this.hasDefinitionErrors()) ||
        (this.activeTab() === 'tests' && !this.hasTestsErrors())
      ) {
        this.activeTab.set(firstInvalidTab);
      }
      return false;
    }

    const d = this.draft();
    const working = toWorkingPayload(d.working);

    if (this.mode() === 'create') {
      const scope: FunctionScope =
        d.scopeType === 'COMPANY' ? { scopeType: 'COMPANY', companyId: d.companyId } : { scopeType: 'TENANT' };
      const body = { code: d.code.trim().toUpperCase(), scope, working };
      const fp = JSON.stringify(body);
      if (fp !== this.lastSaveFingerprint || !this.lastSaveIdempotencyKey) {
        this.lastSaveFingerprint = fp;
        this.lastSaveIdempotencyKey = newTemplateIdempotencyKey();
      }
      this.saving.set(true);
      try {
        const created = await createFunction(body, this.lastSaveIdempotencyKey);
        this.lastSaveFingerprint = null;
        this.lastSaveIdempotencyKey = null;
        this.applyLoadedDetail(created);
        this.mode.set('edit');
        this.attemptedSave.set(false);
        this.notify.success(this.transloco.translate('tplFunctions.toasts.created'));
        this.saved.emit({ detail: created, isNew: true });
        return true;
      } catch (error) {
        this.handleMutationError(error);
        return false;
      } finally {
        this.saving.set(false);
      }
    }

    const currentDetail = this.detail();
    if (!currentDetail) return false;
    const fp = JSON.stringify({ id: currentDetail.id, rev: currentDetail.revision, working });
    if (fp !== this.lastSaveFingerprint || !this.lastSaveIdempotencyKey) {
      this.lastSaveFingerprint = fp;
      this.lastSaveIdempotencyKey = newTemplateIdempotencyKey();
    }
    this.saving.set(true);
    try {
      const updated = await patchFunction(
        currentDetail.id,
        { working },
        currentDetail.etag,
        this.lastSaveIdempotencyKey,
      );
      this.lastSaveFingerprint = null;
      this.lastSaveIdempotencyKey = null;
      this.lastValidationRun.set(null);
      this.applyLoadedDetail(updated);
      this.attemptedSave.set(false);
      this.notify.success(this.transloco.translate('tplFunctions.toasts.saved'));
      this.saved.emit({ detail: updated, isNew: false });
      return true;
    } catch (error) {
      this.handleMutationError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async runValidate(): Promise<void> {
    const currentDetail = this.detail();
    if (!currentDetail || this.validateDisabled()) return;

    this.validating.set(true);
    try {
      const run = await validateFunction(
        currentDetail.id,
        { revision: currentDetail.revision },
        currentDetail.etag,
        newTemplateIdempotencyKey(),
      );
      this.lastValidationRun.set(run);
      this.nowTick.set(Date.now());
      this.detail.update((d) =>
        d
          ? {
              ...d,
              validation: {
                id: run.validationId,
                state: run.state,
                contentChecksum: run.contentChecksum,
                dependencyChecksum: run.dependencyChecksum,
                validatedAt: run.validatedAt,
              },
            }
          : d,
      );
      if (run.state === 'PASSED') {
        this.notify.success(this.transloco.translate('tplFunctions.toasts.validatedPassed'));
      } else {
        this.notify.warning(this.transloco.translate('tplFunctions.toasts.validatedFailed'));
        if (run.testResults.some((t) => t.state === 'FAILED')) {
          this.activeTab.set('tests');
        }
      }
    } catch (error) {
      this.handleMutationError(error);
    } finally {
      this.validating.set(false);
    }
  }

  protected async runPublish(): Promise<void> {
    const currentDetail = this.detail();
    const val = this.validationSummary();
    if (!currentDetail || !val || this.publishDisabled()) return;

    this.childModalOpen.set(true);
    let changeNote: string | null = null;
    try {
      changeNote = await this.reasonModal().open({
        mode: 'publish',
        functionName: currentDetail.name,
      });
    } finally {
      this.childModalOpen.set(false);
    }
    if (!changeNote) return;

    this.publishing.set(true);
    try {
      const version = await publishFunction(
        currentDetail.id,
        {
          revision: currentDetail.revision,
          validationId: val.id,
          contentChecksum: val.contentChecksum,
          dependencyChecksum: val.dependencyChecksum,
          changeNote,
        },
        currentDetail.etag,
        newTemplateIdempotencyKey(),
      );
      const refreshed = await getFunction(currentDetail.id);
      this.applyLoadedDetail(refreshed);
      this.versionDetailsById.update((map) => ({ ...map, [version.id]: version }));
      this.versionResolved.emit({ versionId: version.id, versionNumber: version.versionNumber });
      this.notify.success(
        this.transloco.translate('tplFunctions.toasts.published', { version: version.versionNumber }),
      );
      this.saved.emit({ detail: refreshed, isNew: false });
      void this.loadVersions(currentDetail.id, null);
    } catch (error) {
      this.handleMutationError(error);
    } finally {
      this.publishing.set(false);
    }
  }

  protected async runArchiveOrRestore(action: 'archive' | 'restore'): Promise<void> {
    const currentDetail = this.detail();
    if (!currentDetail || !this.canManage() || this.busy()) return;

    this.childModalOpen.set(true);
    let reason: string | null = null;
    try {
      reason = await this.reasonModal().open({
        mode: action,
        functionName: currentDetail.name,
      });
    } finally {
      this.childModalOpen.set(false);
    }
    if (!reason) return;

    this.archiving.set(true);
    try {
      const updated =
        action === 'archive'
          ? await archiveFunction(currentDetail.id, { reason }, currentDetail.etag, newTemplateIdempotencyKey())
          : await restoreFunction(currentDetail.id, { reason }, currentDetail.etag, newTemplateIdempotencyKey());
      this.applyLoadedDetail(updated);
      this.notify.success(
        this.transloco.translate(
          action === 'archive' ? 'tplFunctions.toasts.archived' : 'tplFunctions.toasts.restored',
        ),
      );
      this.saved.emit({ detail: updated, isNew: false });
    } catch (error) {
      this.handleMutationError(error);
    } finally {
      this.archiving.set(false);
    }
  }

  // Versions & Usage pagination and modals
  protected async openVersionDetail(summary: FunctionVersionSummaryDto): Promise<void> {
    const id = this.detail()?.id;
    if (!id) return;
    let full = this.versionDetailsById()[summary.id];
    if (!full) {
      try {
        full = await getFunctionVersion(id, summary.id);
        this.versionDetailsById.update((m) => ({ ...m, [summary.id]: full }));
      } catch (error) {
        this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
        return;
      }
    }
    this.viewingVersion.set(full);
    this.versionModalOpen.set(true);
    this.childModalOpen.set(true);
    this.versionDetailModal().open();
  }

  protected closeVersionDetail(): void {
    this.versionDetailModal().close();
  }

  protected onVersionDetailClosed(): void {
    this.versionModalOpen.set(false);
    this.childModalOpen.set(false);
    this.viewingVersion.set(null);
  }

  protected prevVersionsPage(): void {
    const id = this.detail()?.id;
    if (!id || !this.versionsHasPrev() || this.versionsLoading()) return;
    const nextStack = this.versionsCursorStack().slice(0, -1);
    this.versionsCursorStack.set(nextStack);
    void this.loadVersions(id, nextStack.length > 0 ? nextStack[nextStack.length - 1] : null);
  }

  protected nextVersionsPage(): void {
    const id = this.detail()?.id;
    const next = this.versionsPageInfo().nextCursor;
    if (!id || !next || this.versionsLoading()) return;
    this.versionsCursorStack.update((s) => [...s, next]);
    void this.loadVersions(id, next);
  }

  protected onUsageVersionFilterChange(versionId: string): void {
    const id = this.detail()?.id;
    this.usageVersionFilter.set(versionId);
    this.usageCursorStack.set([]);
    if (id) {
      void this.loadUsage(id, versionId, null);
    }
  }

  protected prevUsagePage(): void {
    const id = this.detail()?.id;
    if (!id || !this.usageHasPrev() || this.usageLoading()) return;
    const nextStack = this.usageCursorStack().slice(0, -1);
    this.usageCursorStack.set(nextStack);
    void this.loadUsage(id, this.usageVersionFilter(), nextStack.length > 0 ? nextStack[nextStack.length - 1] : null);
  }

  protected nextUsagePage(): void {
    const id = this.detail()?.id;
    const next = this.usagePageInfo().nextCursor;
    if (!id || !next || this.usageLoading()) return;
    this.usageCursorStack.update((s) => [...s, next]);
    void this.loadUsage(id, this.usageVersionFilter(), next);
  }

  protected async openImpactCheck(): Promise<void> {
    const currentDetail = this.detail();
    const targetVer = this.impactTargetVersion();
    if (!currentDetail || !targetVer || this.openingImpact()) return;

    this.openingImpact.set(true);
    try {
      const unfiltered = await listFunctionUsage(currentDetail.id, { limit: 100 });
      this.childModalOpen.set(true);
      this.impactModal().open({
        functionId: currentDetail.id,
        functionName: currentDetail.name,
        versionId: targetVer.id,
        versionNumber: targetVer.versionNumber,
        usageItems: unfiltered.items,
      });
    } catch (error) {
      this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      this.openingImpact.set(false);
    }
  }

  protected onImpactModalApplied(): void {
    this.childModalOpen.set(false);
    const id = this.detail()?.id;
    if (id) {
      const stack = this.usageCursorStack();
      void this.loadUsage(id, this.usageVersionFilter(), stack.length > 0 ? stack[stack.length - 1] : null);
    }
  }

  protected formatDateTime(iso: string): string {
    return formatFunctionDateTime(iso, this.language());
  }

  protected formatExpression(expr: TemplateFormulaExpression | null | undefined): string {
    this.i18n();
    return formatFunctionExpression(expr, (k) => this.transloco.translate(k));
  }

  protected versionNumberLabel(versionId: string): string {
    const match = this.versions().find((v) => v.id === versionId);
    if (match) {
      return this.transloco.translate('tplFunctions.usage.versionNumber', { number: match.versionNumber });
    }
    return versionId.slice(-8);
  }

  // Closing & conflict handling
  protected async requestClose(): Promise<void> {
    if (this.busy() || this.childModalOpen() || this.conflictOpen()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && (this.busy() || this.childModalOpen() || this.conflictOpen())) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmLeaveAndClose();
      return;
    }
    this.resetOnClose();
  }

  protected async reloadFromConflict(): Promise<void> {
    const id = this.detail()?.id;
    this.conflictOpen.set(false);
    this.childModalOpen.set(false);
    this.conflictModal().close();
    if (id) {
      await this.loadEditRecord(id);
    }
  }

  protected keepChangesAfterConflict(): void {
    this.conflictOpen.set(false);
    this.childModalOpen.set(false);
    this.conflictModal().close();
  }

  protected onConflictClosed(): void {
    this.conflictOpen.set(false);
    this.childModalOpen.set(false);
  }

  private async loadEditRecord(functionId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    try {
      const [detailRes, versionsRes] = await Promise.all([
        getFunction(functionId),
        listFunctionVersions(functionId, { limit: 25 }),
      ]);
      if (seq !== this.loadSeq) return;

      this.applyLoadedDetail(detailRes);
      this.versions.set(versionsRes.items);
      this.versionsPageInfo.set(versionsRes.pageInfo);
      this.emitPublishedVersionNumber(detailRes.publishedVersionId, versionsRes.items);
      void this.hydrateVersionDetails(functionId, versionsRes.items);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadVersions(functionId: string, cursor: string | null): Promise<void> {
    const seq = ++this.versionsSeq;
    this.versionsLoading.set(true);
    try {
      const page = await listFunctionVersions(functionId, { cursor, limit: 25 });
      if (seq !== this.versionsSeq) return;
      this.versions.set(page.items);
      this.versionsPageInfo.set(page.pageInfo);
      this.emitPublishedVersionNumber(this.detail()?.publishedVersionId, page.items);
      await this.hydrateVersionDetails(functionId, page.items);
    } catch (error) {
      if (seq !== this.versionsSeq) return;
      this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      if (seq === this.versionsSeq) {
        this.versionsLoading.set(false);
      }
    }
  }

  private async hydrateVersionDetails(
    functionId: string,
    items: readonly FunctionVersionSummaryDto[],
  ): Promise<void> {
    const known = this.versionDetailsById();
    const missing = items.filter((v) => !known[v.id]);
    if (missing.length === 0) return;
    const settled = await Promise.allSettled(missing.map((v) => getFunctionVersion(functionId, v.id)));
    const additions: Record<string, FunctionVersionDetailDto> = {};
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        additions[item.value.id] = item.value;
      }
    }
    if (Object.keys(additions).length > 0) {
      this.versionDetailsById.update((curr) => ({ ...curr, ...additions }));
    }
  }

  private async loadUsage(functionId: string, versionId: string, cursor: string | null): Promise<void> {
    const seq = ++this.usageSeq;
    this.usageLoading.set(true);
    try {
      const page = await listFunctionUsage(functionId, {
        versionId: versionId || undefined,
        cursor,
        limit: 25,
      });
      if (seq !== this.usageSeq) return;
      this.usageItems.set(page.items);
      this.usagePageInfo.set(page.pageInfo);
    } catch (error) {
      if (seq !== this.usageSeq) return;
      this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      if (seq === this.usageSeq) {
        this.usageLoading.set(false);
      }
    }
  }

  private emitPublishedVersionNumber(
    publishedVersionId: string | null | undefined,
    versions: readonly FunctionVersionSummaryDto[],
  ): void {
    if (!publishedVersionId) return;
    const found = versions.find((v) => v.id === publishedVersionId);
    if (found) {
      this.versionResolved.emit({ versionId: found.id, versionNumber: found.versionNumber });
    }
  }

  private applyLoadedDetail(loaded: FunctionDetailDto): void {
    this.detail.set(loaded);
    const fallbackCompany = this.companyOptions()[0]?.id ?? '';
    const nextDraft = draftFromDetail(loaded, fallbackCompany);
    this.baseDraft.set(structuredClone(nextDraft));
    this.draft.set(structuredClone(nextDraft));
  }

  private handleMutationError(error: unknown): void {
    if (error instanceof TemplateApiError) {
      if (error.status === 412 || error.code === 'STALE' || error.code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.conflictOpen.set(true);
        this.childModalOpen.set(true);
        this.conflictModal().open();
        return;
      }
      if (error.code === 'FUNCTION_CODE_CONFLICT' && this.mode() === 'create') {
        this.codeServerError.set(this.transloco.translate('tplFunctions.errors.FUNCTION_CODE_CONFLICT'));
        this.activeTab.set('definition');
        return;
      }
    }
    this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
  }

  private setTestArgumentValue(testId: string, paramName: string, value: FunctionValue): void {
    this.draft.update((d) => ({
      ...d,
      working: {
        ...d.working,
        tests: d.working.tests.map((test) => {
          if (test.id !== testId) return test;
          const exists = test.arguments.some((a) => a.name === paramName);
          const nextArgs = exists
            ? test.arguments.map((a) => (a.name === paramName ? { ...a, value } : a))
            : [...test.arguments, { name: paramName, value }];
          return { ...test, arguments: nextArgs };
        }),
      },
    }));
  }

  private setTestExpectedValue(testId: string, expected: FunctionValue): void {
    this.draft.update((d) => ({
      ...d,
      working: {
        ...d.working,
        tests: d.working.tests.map((test) => (test.id === testId ? { ...test, expected } : test)),
      },
    }));
  }

  private hasDefinitionErrors(): boolean {
    if (this.codeError() || this.companyError() || this.nameError() || this.descriptionError() || this.expressionError()) {
      return true;
    }
    const params = this.draft().working.parameters;
    return params.some((_, idx) => this.paramNameError(idx) !== null);
  }

  private hasTestsErrors(): boolean {
    const tests = this.draft().working.tests;
    const params = this.draft().working.parameters;
    const resType = this.draft().working.result.type;
    for (const test of tests) {
      if (this.testNameError(test)) return true;
      for (const param of params) {
        if (this.valueFieldError(this.testArgumentValue(test, param), param.type)) return true;
      }
      if (this.valueFieldError(test.expected, resType)) return true;
    }
    return false;
  }

  private findFirstInvalidTab(): 'definition' | 'tests' | null {
    if (this.hasDefinitionErrors()) return 'definition';
    if (this.hasTestsErrors()) return 'tests';
    return null;
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  private async confirmLeaveAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    this.childModalOpen.set(true);
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') {
        this.draft.set(structuredClone(this.baseDraft()));
        return true;
      }
      return await this.save();
    } finally {
      this.childModalOpen.set(false);
    }
  }

  private startExpiryTimer(): void {
    this.stopExpiryTimer();
    this.expiryTimer = setInterval(() => this.nowTick.set(Date.now()), 30_000);
  }

  private stopExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private resetOnClose(): void {
    this.allowClose = false;
    this.loadSeq++;
    this.versionsSeq++;
    this.usageSeq++;
    this.stopExpiryTimer();
    this.isOpen.set(false);
    this.loading.set(false);
    this.saving.set(false);
    this.validating.set(false);
    this.publishing.set(false);
    this.archiving.set(false);
    this.childModalOpen.set(false);
    this.conflictOpen.set(false);
    this.versionModalOpen.set(false);
    this.attemptedSave.set(false);
    this.codeServerError.set(null);
    this.lastSaveFingerprint = null;
    this.lastSaveIdempotencyKey = null;
  }
}

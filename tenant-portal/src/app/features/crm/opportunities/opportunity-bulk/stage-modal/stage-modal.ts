import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowsExchange,
  tablerCheck,
  tablerChevronDown,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { reasonDefinitionIn, reasonNameIn } from '../../../settings/reasons/reasons.model';
import type { OpportunityReason } from '../../opportunities.model';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { listPipelines, listReasons } from '../../opportunities.api';
import {
  OPPORTUNITY_LIMITS,
  type OpportunityStageFlag,
  type PipelineStageView,
  type SelectedOpportunity,
  stageLabel,
} from '../../opportunities.model';
import { stageTone } from '../../opportunity-stage-tone';
import { PipelineScope } from '../../pipeline-scope';
import {
  buildMoveStageBulkJob,
  moveStageParamsFor,
  submitOpportunityBulkJob,
  translateOpportunityBulkError,
} from '../bulk-runner';
import {
  OpportunitySelection,
  type OpportunitySelectionRow,
  toSelectedOpportunity,
} from '../opportunity-selection';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const MAX_NOTE_LENGTH = OPPORTUNITY_LIMITS.reason;

function dotClassForFlag(flag: OpportunityStageFlag): string {
  switch (stageTone(flag)) {
    case 'success':
      return 'bg-success';
    case 'danger':
      return 'bg-danger';
    case 'neutral':
      return 'bg-status-none';
    default:
      return 'bg-brand';
  }
}

@Component({
  selector: 'app-opp-bulk-stage-modal',
  imports: [NgIcon, TranslocoPipe, PluralKeyPipe, BulkRunModal, Dropdown, Field],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-bulk', alias: 'oppBulk' }),
    provideIcons({ tablerArrowsExchange, tablerChevronDown, tablerCheck, tablerAlertTriangle }),
  ],
  templateUrl: './stage-modal.html',
  host: {
    '(document:click)': 'closeStageMenuIfOutside($event)',
    '(window:resize)': 'closeStageMenu()',
  },
})
export class OppBulkStageModal {
  private static nextId = 0;
  protected readonly uid = `opp-bulk-stage-${++OppBulkStageModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly pipelineScope = inject(PipelineScope, { optional: true });
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly selection = inject(OpportunitySelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);
  private readonly stageTrigger = viewChild<ElementRef<HTMLButtonElement>>('stageTrigger');
  private readonly stageList = viewChild<ElementRef<HTMLElement>>('stageList');

  readonly branchId = input('');
  readonly pipelineId = input('');
  readonly stages = input<readonly PipelineStageView[]>([]);
  readonly submitted = output<string>();

  protected readonly maxNoteLength = MAX_NOTE_LENGTH;
  protected readonly rows = signal<SelectedOpportunity[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly fallbackPipelineId = signal('');
  protected readonly fallbackStages = signal<PipelineStageView[]>([]);
  protected readonly lossReasons = signal<OpportunityReason[]>([]);
  protected readonly winReasons = signal<OpportunityReason[]>([]);
  protected readonly reasonsLoading = signal(false);
  protected readonly lossReasonsHidden = signal(false);
  protected readonly winReasonsHidden = signal(false);
  protected readonly serverRequiredWinReason = signal(false);
  protected readonly selectedStageId = signal('');
  protected readonly selectedReasonId = signal('');
  protected readonly note = signal('');
  protected readonly lostTouched = signal(false);
  protected readonly serverReasonError = signal<string | null>(null);
  protected readonly serverNoteError = signal<string | null>(null);
  protected readonly stageMenuOpen = signal(false);
  protected readonly stageMenuPlaced = signal(false);
  protected readonly stageMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private openSeq = 0;
  private menuSeq = 0;

  private readonly effectiveBranchId = computed(() => this.branchId().trim() || this.scopeState.branch().id);

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  protected readonly selectableStages = computed<PipelineStageView[]>(() => {
    const explicit = this.stages();
    const fromScope = this.pipelineScope?.current();
    const requestedPipeline = this.pipelineId().trim();
    const scopeMatches =
      fromScope && (!requestedPipeline || fromScope.id === requestedPipeline) ? fromScope.stages : [];
    const source = explicit.length > 0 ? explicit : scopeMatches.length > 0 ? scopeMatches : this.fallbackStages();

    return source
      .filter((stage) => stage.isActive)
      .slice()
      .sort((a, b) => a.rank - b.rank);
  });

  protected readonly selectedStage = computed<PipelineStageView | null>(() => {
    const id = this.selectedStageId();
    const list = this.selectableStages();
    return list.find((stage) => stage.id === id) ?? list[0] ?? null;
  });

  private readonly effectivePipelineId = computed(
    () =>
      this.pipelineId().trim() ||
      this.selectedStage()?.pipelineId ||
      this.pipelineScope?.current()?.id ||
      this.fallbackPipelineId(),
  );

  protected readonly isLost = computed(() => this.selectedStage()?.flag === 'LOST');
  protected readonly isWon = computed(() => this.selectedStage()?.flag === 'WON');
  protected readonly isTerminal = computed(() => this.isLost() || this.isWon());

  protected readonly activeReasons = computed<OpportunityReason[]>(() =>
    this.isLost() ? this.lossReasons() : this.isWon() ? this.winReasons() : [],
  );

  protected readonly reasonsHidden = computed(() =>
    this.isLost() ? this.lossReasonsHidden() : this.isWon() ? this.winReasonsHidden() : true,
  );

  protected readonly reasonFieldLabelKey = computed(() => {
    if (this.isLost()) return 'oppBulk.stage.lossReason';
    return 'oppBulk.stage.winReason';
  });

  protected readonly reasonRequired = computed(
    () =>
      (this.isLost() && !this.reasonsHidden() && !this.note().trim()) ||
      (this.isWon() && this.serverRequiredWinReason()),
  );

  protected readonly noteRequired = computed(() => this.isLost() && this.reasonsHidden());

  protected readonly reasonOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    return [
      { value: '', label: this.transloco.translate('oppBulk.stage.noReason') },
      ...this.activeReasons().map((reason) => ({
        value: reason.id,
        label: reasonNameIn(reason, lang),
      })),
    ];
  });

  protected readonly selectedReasonDefinition = computed<string | null>(() => {
    const id = this.selectedReasonId();
    if (!id) return null;
    const found = this.activeReasons().find((reason) => reason.id === id);
    return found ? reasonDefinitionIn(found, this.language())?.trim() || null : null;
  });

  protected readonly noteLength = computed(() => [...this.note()].length);

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    const serverErr = this.serverReasonError();
    if (serverErr && !this.reasonsHidden()) return serverErr;
    if (this.isLost() && !this.reasonsHidden() && this.lostTouched()) {
      if (!this.selectedReasonId().trim() && !this.note().trim()) {
        return this.transloco.translate('oppBulk.stage.reasonOrNoteRequired');
      }
    }
    return null;
  });

  protected readonly noteError = computed<string | null>(() => {
    this.i18n();
    const serverNote = this.serverNoteError();
    if (serverNote) return serverNote;
    const serverReason = this.serverReasonError();
    if (serverReason && this.reasonsHidden()) return serverReason;
    if (this.noteLength() > MAX_NOTE_LENGTH) {
      return this.transloco.translate('oppBulk.stage.noteTooLong');
    }
    if (this.isLost() && this.reasonsHidden() && this.lostTouched() && !this.note().trim()) {
      return this.transloco.translate('oppBulk.stage.reasonOrNoteRequired');
    }
    return null;
  });

  protected readonly reasonDescribedBy = computed(
    () => `${this.uid}-reason-hint${this.reasonError() ? ` ${this.uid}-reason-error` : ''}`,
  );

  protected readonly previewParams = computed(() => {
    const lang = this.language();
    const stage = this.selectedStage();
    const list = this.rows();
    const same = stage ? list.filter((row) => row.stageId === stage.id).length : 0;
    const move = Math.max(0, list.length - same);
    return {
      move,
      stage: stage ? stageLabel(stage, lang) : '—',
      same,
    };
  });

  protected readonly canSubmit = computed(() => {
    if (
      this.submitting() ||
      this.resolving() ||
      !this.selectedStage() ||
      !this.effectivePipelineId() ||
      this.rows().length === 0 ||
      this.noteLength() > MAX_NOTE_LENGTH
    ) {
      return false;
    }
    if (this.isLost()) {
      if (this.reasonsLoading()) return false;
      const reasonId = this.reasonsHidden() ? '' : this.selectedReasonId().trim();
      const trimmedNote = this.note().trim();
      return Boolean(reasonId || trimmedNote);
    }
    if (this.isWon() && this.serverRequiredWinReason() && !this.reasonsHidden()) {
      return Boolean(this.selectedReasonId().trim());
    }
    return true;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.stageMenuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.stageList()?.nativeElement.contains(target)) return;
      this.closeStageMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.stageMenuOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.closeStageMenu();
      this.stageTrigger()?.nativeElement.focus();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onEscape, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('keydown', onEscape, { capture: true });
    });
  }

  open(rows?: readonly OpportunitySelectionRow[]): void {
    void this.initOpen(rows);
  }

  protected stageText(stage: PipelineStageView): string {
    return stageLabel(stage, this.language());
  }

  protected dotClass(flag: OpportunityStageFlag): string {
    return dotClassForFlag(flag);
  }

  protected toggleStageMenu(): void {
    if (this.selectableStages().length === 0) return;
    if (this.stageMenuOpen()) {
      this.closeStageMenu();
      return;
    }
    const trigger = this.stageTrigger()?.nativeElement;
    if (!trigger) return;
    const seq = ++this.menuSeq;
    this.stageMenuPlaced.set(false);
    this.stageMenuPlace.set(this.initialMenuPlace(trigger));
    this.stageMenuOpen.set(true);
    queueMicrotask(() => this.placeStageMenu(seq, trigger));
    afterNextRender(() => this.placeStageMenu(seq, trigger), { injector: this.injector });
  }

  protected selectStage(stageId: string): void {
    if (this.selectedStageId() !== stageId) {
      this.selectedStageId.set(stageId);
      this.selectedReasonId.set('');
      this.lostTouched.set(false);
      this.serverRequiredWinReason.set(false);
      this.serverReasonError.set(null);
      this.serverNoteError.set(null);
    }
    this.closeStageMenu();
    this.stageTrigger()?.nativeElement.focus();
  }

  protected onReasonChange(reasonId: string): void {
    this.selectedReasonId.set(reasonId);
    this.lostTouched.set(true);
    this.serverReasonError.set(null);
  }

  protected onNoteInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.note.set(value);
    this.lostTouched.set(true);
    this.serverNoteError.set(null);
    if (value.trim()) {
      this.serverReasonError.set(null);
    }
  }

  protected onStageListKeydown(event: KeyboardEvent): void {
    const listEl = this.stageList()?.nativeElement;
    if (!listEl) return;
    const buttons = Array.from(listEl.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex = -1;
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex < 0 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[nextIndex].focus();
  }

  protected closeStageMenuIfOutside(event: Event): void {
    if (!this.stageMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (
      this.stageTrigger()?.nativeElement.contains(target) ||
      this.stageList()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closeStageMenu();
  }

  protected closeStageMenu(): void {
    this.menuSeq++;
    this.stageMenuOpen.set(false);
    this.stageMenuPlaced.set(false);
  }

  protected close(): void {
    this.closeStageMenu();
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.closeStageMenu();
    this.resolving.set(false);
    this.submitting.set(false);
    this.serverReasonError.set(null);
    this.serverNoteError.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.isLost()) {
      this.lostTouched.set(true);
    }
    if (!this.canSubmit()) return;
    const stage = this.selectedStage();
    const pipelineId = this.effectivePipelineId();
    if (!stage || !pipelineId) return;

    const reasonId = this.reasonsHidden() ? '' : this.selectedReasonId();
    const params = moveStageParamsFor(stage, pipelineId, reasonId, this.note());

    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };
    const body = buildMoveStageBulkJob(this.effectiveBranchId(), selection, params);

    this.submitting.set(true);
    this.serverReasonError.set(null);
    this.serverNoteError.set(null);
    try {
      const res = await submitOpportunityBulkJob(this.tracker, body);
      this.close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: readonly OpportunitySelectionRow[]): Promise<void> {
    const seq = ++this.openSeq;
    const mapped = rows ? rows.map(toSelectedOpportunity) : [];
    this.closeStageMenu();
    this.submitting.set(false);
    this.lostTouched.set(false);
    this.serverRequiredWinReason.set(false);
    this.serverReasonError.set(null);
    this.serverNoteError.set(null);
    this.selectedReasonId.set('');
    this.note.set('');
    this.rows.set(mapped);
    this.selectedStageId.set(this.selectableStages()[0]?.id ?? '');
    this.modal().open();

    await Promise.all([this.ensureStages(seq), this.loadReasons(seq), this.resolveRows(seq, mapped)]);
  }

  private async ensureStages(seq: number): Promise<void> {
    if (this.selectableStages().length > 0) {
      if (!this.selectedStageId()) {
        this.selectedStageId.set(this.selectableStages()[0]?.id ?? '');
      }
      return;
    }

    try {
      if (this.pipelineScope) {
        await this.pipelineScope.ensureLoaded();
        if (seq !== this.openSeq) return;
      }
      if (this.selectableStages().length > 0) {
        if (!this.selectedStageId()) {
          this.selectedStageId.set(this.selectableStages()[0]?.id ?? '');
        }
        return;
      }

      const pipelines = await listPipelines();
      if (seq !== this.openSeq) return;
      const requested = this.pipelineId().trim();
      const target =
        (requested ? pipelines.find((p) => p.id === requested) : undefined) ??
        pipelines.find((p) => p.isDefault) ??
        pipelines[0] ??
        null;
      this.fallbackPipelineId.set(target?.id ?? '');
      this.fallbackStages.set(target?.stages ?? []);
      if (!this.selectedStageId()) {
        this.selectedStageId.set(this.selectableStages()[0]?.id ?? '');
      }
    } catch {
      // Keep empty stages if fallback load fails.
    }
  }

  private async loadReasons(seq: number): Promise<void> {
    this.reasonsLoading.set(true);
    try {
      const [lossRes, winRes] = await Promise.allSettled([listReasons({ kind: 'LOSS' }), listReasons({ kind: 'WIN' })]);
      if (seq !== this.openSeq) return;

      if (lossRes.status === 'fulfilled') {
        const activeLoss = lossRes.value.items;
        this.lossReasons.set(activeLoss);
        this.lossReasonsHidden.set(activeLoss.length === 0);
      } else {
        this.lossReasons.set([]);
        this.lossReasonsHidden.set(true);
      }

      if (winRes.status === 'fulfilled') {
        const activeWin = winRes.value.items;
        this.winReasons.set(activeWin);
        this.winReasonsHidden.set(activeWin.length === 0);
      } else {
        this.winReasons.set([]);
        this.winReasonsHidden.set(true);
      }
    } finally {
      if (seq === this.openSeq) {
        this.reasonsLoading.set(false);
      }
    }
  }

  private async resolveRows(seq: number, explicitRows: SelectedOpportunity[]): Promise<void> {
    if (explicitRows.length > 0) {
      this.rows.set(explicitRows);
      this.resolving.set(false);
      return;
    }
    if (!this.selection || this.selection.count() === 0) {
      this.rows.set([]);
      this.resolving.set(false);
      return;
    }
    this.resolving.set(true);
    try {
      const resolved = await this.selection.resolve();
      if (seq !== this.openSeq) return;
      this.rows.set(resolved);
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.showResolveError(error);
      this.close();
    } finally {
      if (seq === this.openSeq) {
        this.resolving.set(false);
      }
    }
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'BULK_JOB_ACTIVE') return;
    if (code === 'OPPORTUNITY_LOST_REASON_REQUIRED' || code === 'CRM_REASON_REQUIRED') {
      if (this.isWon()) {
        this.serverRequiredWinReason.set(true);
      }
      this.serverReasonError.set(this.translateCode(code));
      return;
    }
    this.notify.error(this.translateCode(code));
  }

  private translateCode(code: string | null): string {
    return translateOpportunityBulkError(this.transloco, code);
  }

  private showResolveError(error: unknown): void {
    const code = error instanceof ApiError ? error.code : errorCodeOf(error);
    this.notify.error(this.translateCode(code));
  }

  private initialMenuPlace(trigger: HTMLElement): MenuPlace {
    const rect = rectInPage(trigger);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeStageMenu(seq: number, trigger: HTMLElement): void {
    const listEl = this.stageList()?.nativeElement;
    if (seq !== this.menuSeq || !this.stageMenuOpen() || this.stageMenuPlaced() || !listEl) return;

    const rect = rectInPage(trigger);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.stageMenuPlace.set({ top, start, width: rect.width, maxHeight });
    this.stageMenuPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');

    const selected = listEl.querySelector<HTMLButtonElement>('[aria-selected="true"] button');
    const first = listEl.querySelector<HTMLButtonElement>('button:not([disabled])');
    (selected ?? first)?.focus();
  }
}

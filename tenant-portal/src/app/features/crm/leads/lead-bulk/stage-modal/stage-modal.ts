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
import { tablerArrowsExchange, tablerCheck, tablerChevronDown } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { LeadBulkSubmitKey, leadBulkErrorParams, selectionBranchMismatch } from '../lead-bulk-submit';
import { listLeadStages } from '../../leads.api';
import { LeadStage, nameIn } from '../../leads.model';
import { listDisqualificationReasons } from '../lead-bulk.api';
import { SelectedRow } from '../lead-bulk.model';
import { LeadSelection } from '../lead-selection';

interface DisqualificationReason {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'app-bulk-stage-modal',
  imports: [NgIcon, TranslocoPipe, BulkRunModal, Dropdown, Field],
  providers: [
    provideTranslocoScope('leads', { scope: 'record-related', alias: 'recordRelated' }, { scope: 'lead-bulk-actions', alias: 'leadBulk' }),
    provideIcons({ tablerArrowsExchange, tablerChevronDown, tablerCheck }),
  ],
  templateUrl: './stage-modal.html',
  host: {
    '(document:click)': 'closeStageMenuIfOutside($event)',
    '(window:resize)': 'closeStageMenu()',
  },
})
export class BulkStageModal {
  private static nextId = 0;
  protected readonly uid = `bulk-stage-${++BulkStageModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly selection = inject(LeadSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);
  private readonly stageTrigger = viewChild<ElementRef<HTMLButtonElement>>('stageTrigger');
  private readonly stageList = viewChild<ElementRef<HTMLElement>>('stageList');

  readonly branchId = input('');
  readonly stages = input<LeadStage[]>([]);
  readonly submitted = output<string>();

  protected readonly rows = signal<SelectedRow[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly fallbackStages = signal<LeadStage[]>([]);
  protected readonly reasons = signal<DisqualificationReason[]>([]);
  protected readonly reasonsLoading = signal(false);
  protected readonly selectedStageId = signal('');
  protected readonly selectedReasonId = signal('');
  protected readonly serverReasonError = signal<string | null>(null);
  private readonly submitKey = new LeadBulkSubmitKey();
  protected readonly stageMenuOpen = signal(false);
  protected readonly stageMenuPlaced = signal(false);
  protected readonly stageMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private openSeq = 0;
  private menuSeq = 0;

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  protected readonly selectableStages = computed<LeadStage[]>(() => {
    const source = this.stages().length > 0 ? this.stages() : this.fallbackStages();
    return source
      .filter((stage) => stage.isActive && stage.flag !== 'CONVERTED')
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  protected readonly selectedStage = computed<LeadStage | null>(() => {
    const id = this.selectedStageId();
    const list = this.selectableStages();
    return list.find((stage) => stage.id === id) ?? list[0] ?? null;
  });

  protected readonly isDisqualified = computed(() => this.selectedStage()?.flag === 'DISQUALIFIED');

  protected readonly reasonOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.reasons().map((reason) => ({
      value: reason.id,
      label: nameIn(reason, lang),
    }));
  });

  protected readonly skippedRows = computed<SelectedRow[]>(() =>
    this.rows().filter((row) => row.status === 'CONVERTED'),
  );

  protected readonly actionableRows = computed<SelectedRow[]>(() =>
    this.rows().filter((row) => row.status !== 'CONVERTED'),
  );

  protected readonly previewParams = computed(() => {
    const lang = this.language();
    const stage = this.selectedStage();
    const actionable = this.actionableRows();
    const same = stage ? actionable.filter((row) => row.stageId === stage.id).length : 0;
    const move = Math.max(0, actionable.length - same);
    return {
      move,
      stage: stage ? nameIn(stage, lang) : '—',
      same,
      conv: this.skippedRows().length,
    };
  });

  protected readonly canSubmit = computed(() => {
    if (this.submitting() || this.resolving() || !this.selectedStage() || this.actionableRows().length === 0) {
      return false;
    }
    if (this.isDisqualified()) {
      return !this.reasonsLoading() && !!this.selectedReasonId();
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

  open(rows?: SelectedRow[]): void {
    void this.initOpen(rows);
  }

  protected stageLabel(stage: LeadStage): string {
    return nameIn(stage, this.language());
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
    this.selectedStageId.set(stageId);
    this.serverReasonError.set(null);
    this.closeStageMenu();
    this.stageTrigger()?.nativeElement.focus();
  }

  protected onReasonChange(reasonId: string): void {
    this.selectedReasonId.set(reasonId);
    this.serverReasonError.set(null);
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
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const stage = this.selectedStage();
    if (!stage) return;
    const reasonId = stage.flag === 'DISQUALIFIED' ? this.selectedReasonId() || null : null;
    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };
    const body: BulkJobSubmit = {
      module: 'crm.leads',
      action: 'MOVE_STAGE',
      scope: { branchId: this.branchId() },
      selection,
      params: { stageId: stage.id, reasonId },
    };

    this.submitting.set(true);
    this.serverReasonError.set(null);
    try {
      const res = await this.tracker.submit('crm', body, { idempotencyKey: this.submitKey.for(body) });
      this.submitKey.reset();
      this.close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.handleSubmitError(error, selectionBranchMismatch(selection, this.branchId()));
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: SelectedRow[]): Promise<void> {
    const seq = ++this.openSeq;
    this.submitKey.reset();
    this.closeStageMenu();
    this.submitting.set(false);
    this.serverReasonError.set(null);
    this.rows.set(rows ?? []);
    this.selectedStageId.set(this.selectableStages()[0]?.id ?? '');
    this.selectedReasonId.set('');
    this.modal().open();

    await Promise.all([this.ensureStages(seq), this.loadReasons(seq), this.resolveRows(seq, rows)]);
  }

  private async ensureStages(seq: number): Promise<void> {
    if (this.stages().length > 0) {
      if (!this.selectedStageId()) {
        this.selectedStageId.set(this.selectableStages()[0]?.id ?? '');
      }
      return;
    }
    try {
      const loaded = await listLeadStages();
      if (seq !== this.openSeq) return;
      this.fallbackStages.set(loaded);
      if (!this.selectedStageId()) {
        this.selectedStageId.set(this.selectableStages()[0]?.id ?? '');
      }
    } catch {
      // Keep empty list if fallback stage fetch fails.
    }
  }

  private async loadReasons(seq: number): Promise<void> {
    this.reasonsLoading.set(true);
    try {
      const list = await listDisqualificationReasons();
      if (seq !== this.openSeq) return;
      this.reasons.set(list);
      this.selectedReasonId.set(list[0]?.id ?? '');
    } catch {
      if (seq !== this.openSeq) return;
      this.reasons.set([]);
    } finally {
      if (seq === this.openSeq) {
        this.reasonsLoading.set(false);
      }
    }
  }

  private async resolveRows(seq: number, rows?: SelectedRow[]): Promise<void> {
    if (rows && rows.length > 0) {
      this.rows.set(rows);
      this.resolving.set(false);
      return;
    }
    if (!this.selection || this.selection.count() === 0) {
      this.rows.set(rows ?? []);
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

  private handleSubmitError(error: unknown, branchMismatch: boolean): void {
    const code = errorCodeOf(error);
    if (code === 'BULK_JOB_ACTIVE') return;
    if (code === 'CRM_REASON_REQUIRED') {
      this.serverReasonError.set(this.translateCode(code));
      return;
    }
    if (code === 'CRM_SCOPED_PERMISSION_DENIED' && branchMismatch) {
      this.notify.error(this.transloco.translate('leadBulk.codes.BRANCH_SCOPE_MISMATCH'));
      return;
    }
    this.notify.error(this.translateCode(code, error));
  }

  private translateCode(code: string | null, error?: unknown): string {
    if (code) {
      for (const prefix of ['leadBulk.codes.', 'bulkJobs.codes.']) {
        const key = `${prefix}${code}`;
        const translated = this.transloco.translate(key, leadBulkErrorParams(error));
        if (translated !== key) return translated;
      }
    }
    return this.transloco.translate('leadBulk.codes.generic');
  }

  private showResolveError(error: unknown): void {
    this.i18n();
    const code = error instanceof ApiError ? error.code : errorCodeOf(error);
    this.notify.error(this.translateCode(code, error));
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

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
import { tablerCheck, tablerChevronDown, tablerSearch, tablerUserShare } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { LeadBulkSubmitKey, leadBulkErrorMessage, leadBulkLoadError, leadBulkPrecheck, leadBulkValidationFields } from '../lead-bulk-submit';
import { initials } from '../../leads.model';
import { listAssignableOwners } from '../lead-bulk.api';
import { SelectedRow } from '../lead-bulk.model';
import { LeadSelection } from '../lead-selection';

interface OwnerOption {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'app-bulk-assign-modal',
  imports: [FullState, NgIcon, TranslocoPipe, BulkRunModal, Field],
  providers: [
    provideTranslocoScope('leads', { scope: 'record-related', alias: 'recordRelated' }, { scope: 'lead-bulk-actions', alias: 'leadBulk' }),
    provideIcons({ tablerUserShare, tablerChevronDown, tablerCheck, tablerSearch }),
  ],
  templateUrl: './assign-modal.html',
  host: {
    '(document:click)': 'closeOwnerMenuIfOutside($event)',
    '(window:resize)': 'closeOwnerMenu()',
  },
})
export class BulkAssignModal {
  private static nextId = 0;
  protected readonly uid = `bulk-assign-${++BulkAssignModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly selection = inject(LeadSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);
  private readonly ownerTrigger = viewChild<ElementRef<HTMLButtonElement>>('ownerTrigger');
  private readonly ownerPanel = viewChild<ElementRef<HTMLElement>>('ownerPanel');
  private readonly ownerSearchInput = viewChild<ElementRef<HTMLInputElement>>('ownerSearchInput');

  readonly branchId = input('');
  readonly submitted = output<string>();

  protected readonly rows = signal<SelectedRow[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly loadError = signal<ReturnType<typeof leadBulkLoadError> | null>(null);
  protected readonly owners = signal<OwnerOption[]>([]);
  protected readonly ownersLoading = signal(false);
  protected readonly ownersLoaded = signal(false);
  protected readonly ownersForbidden = signal(false);
  protected readonly selectedOwnerId = signal('');
  protected readonly ownerSearch = signal('');
  protected readonly ownerMenuOpen = signal(false);
  protected readonly ownerMenuPlaced = signal(false);
  protected readonly ownerMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  private readonly serverOwnerError = signal<string | null>(null);
  protected readonly submitKey = new LeadBulkSubmitKey();

  protected readonly initials = initials;

  private openSeq = 0;
  private menuSeq = 0;

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  protected readonly selectedOwner = computed<OwnerOption | null>(() => {
    const id = this.selectedOwnerId();
    return this.owners().find((owner) => owner.id === id) ?? null;
  });

  protected readonly filteredOwners = computed<OwnerOption[]>(() => {
    const term = this.ownerSearch().trim().toLowerCase();
    const list = this.owners();
    if (!term) return list;
    return list.filter((owner) => owner.displayName.toLowerCase().includes(term));
  });

  protected readonly ownerFieldError = computed<string | null>(() => {
    this.i18n();
    const serverErr = this.serverOwnerError();
    if (serverErr) return serverErr;
    if (this.ownersForbidden()) return this.transloco.translate('leadBulk.catalogueUnavailable');
    if (this.ownersLoaded() && this.owners().length === 0) {
      return this.transloco.translate('leadBulk.assign.noOwners');
    }
    return null;
  });

  // The backend always skips converted leads on ASSIGN (handler resolve(): SKIPPED / CONVERTED).
  protected readonly skippedRows = computed<SelectedRow[]>(() =>
    this.rows().filter((row) => row.stageFlag === 'CONVERTED'),
  );

  protected readonly actionableRows = computed<SelectedRow[]>(() =>
    this.rows().filter((row) => row.stageFlag !== 'CONVERTED'),
  );

  protected readonly previewParams = computed(() => {
    const actionable = this.actionableRows();
    const ownerId = this.selectedOwnerId();
    const same = ownerId ? actionable.filter((row) => row.ownerUserId === ownerId).length : 0;
    const change = Math.max(0, actionable.length - same);
    return {
      change,
      owner: this.selectedOwner()?.displayName ?? '—',
      same,
      conv: this.skippedRows().length,
    };
  });

  protected readonly canSubmit = computed(
    () =>
      !this.loadError() &&
      !this.submitKey.blocked() &&
      !this.submitting() &&
      !this.resolving() &&
      !this.ownersLoading() &&
      this.owners().some((owner) => owner.id === this.selectedOwnerId()) &&
      this.actionableRows().length > 0,
  );

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.ownerMenuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.ownerPanel()?.nativeElement.contains(target)) return;
      this.closeOwnerMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.ownerMenuOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.closeOwnerMenu();
      this.ownerTrigger()?.nativeElement.focus();
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

  protected toggleOwnerMenu(): void {
    if (this.ownersLoading() || this.owners().length === 0) return;
    if (this.ownerMenuOpen()) {
      this.closeOwnerMenu();
      return;
    }
    const trigger = this.ownerTrigger()?.nativeElement;
    if (!trigger) return;
    const seq = ++this.menuSeq;
    this.ownerSearch.set('');
    this.ownerMenuPlaced.set(false);
    this.ownerMenuPlace.set(this.initialMenuPlace(trigger));
    this.ownerMenuOpen.set(true);
    queueMicrotask(() => this.placeOwnerMenu(seq, trigger));
    afterNextRender(() => this.placeOwnerMenu(seq, trigger), { injector: this.injector });
  }

  protected selectOwner(ownerId: string): void {
    this.selectedOwnerId.set(ownerId);
    this.serverOwnerError.set(null);
    this.closeOwnerMenu();
    this.ownerTrigger()?.nativeElement.focus();
  }

  protected onOwnerSearchInput(event: Event): void {
    this.ownerSearch.set((event.target as HTMLInputElement).value);
  }

  protected onOwnerPanelKeydown(event: KeyboardEvent): void {
    const panel = this.ownerPanel()?.nativeElement;
    if (!panel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeOwnerMenu();
      this.ownerTrigger()?.nativeElement.focus();
      return;
    }
    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('ul button:not([disabled])'));
    if (buttons.length === 0) return;

    const activeEl = document.activeElement;
    const currentIndex = buttons.indexOf(activeEl as HTMLButtonElement);
    const inSearch = activeEl === this.ownerSearchInput()?.nativeElement;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = inSearch || currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
      buttons[nextIndex].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentIndex <= 0) {
        this.ownerSearchInput()?.nativeElement.focus();
      } else {
        buttons[currentIndex - 1].focus();
      }
    } else if (event.key === 'Home' && !inSearch) {
      event.preventDefault();
      buttons[0].focus();
    } else if (event.key === 'End' && !inSearch) {
      event.preventDefault();
      buttons[buttons.length - 1].focus();
    }
  }

  protected closeOwnerMenuIfOutside(event: Event): void {
    if (!this.ownerMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (
      this.ownerTrigger()?.nativeElement.contains(target) ||
      this.ownerPanel()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closeOwnerMenu();
  }

  protected closeOwnerMenu(): void {
    this.menuSeq++;
    this.ownerMenuOpen.set(false);
    this.ownerMenuPlaced.set(false);
  }

  protected close(): void {
    this.closeOwnerMenu();
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.closeOwnerMenu();
    this.resolving.set(false);
    this.submitting.set(false);
    this.serverOwnerError.set(null);
  }

  protected async retryLoad(): Promise<void> {
    const seq = ++this.openSeq;
    this.loadError.set(null);
    this.resolving.set(true);
    await Promise.all([this.loadOwners(seq), this.resolveRows(seq, this.selection?.count() ? undefined : this.rows())]);
    if (seq === this.openSeq) this.resolving.set(false);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const ownerId = this.selectedOwnerId();
    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };
    const precheck = leadBulkPrecheck(selection, this.branchId());
    if (precheck) {
      this.notify.error(this.transloco.translate(`leadBulk.codes.${precheck}`));
      return;
    }
    const body: BulkJobSubmit = {
      module: 'crm.leads',
      action: 'ASSIGN',
      scope: { branchId: this.branchId() },
      selection,
      params: { ownerUserId: ownerId },
    };

    this.submitting.set(true);
    this.serverOwnerError.set(null);
    try {
      const res = await this.tracker.submit('crm', body, { idempotencyKey: this.submitKey.for(body) });
      this.submitKey.reset();
      this.close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.submitKey.failed(error);
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: SelectedRow[]): Promise<void> {
    const seq = ++this.openSeq;
    this.loadError.set(null);
    this.submitKey.reset();
    this.ownerSearch.set('');
    this.serverOwnerError.set(null);
    this.submitting.set(false);
    this.closeOwnerMenu();
    this.ownersLoaded.set(false);
    this.selectedOwnerId.set('');
    this.rows.set(rows ?? []);
    this.modal().open();

    const loadOwnersTask = this.loadOwners(seq);
    const resolveRowsTask = this.resolveRows(seq, rows);
    await Promise.all([loadOwnersTask, resolveRowsTask]);
  }

  private async loadOwners(seq: number): Promise<void> {
    this.ownersLoading.set(true);
    this.ownersForbidden.set(false);
    try {
      const list = await listAssignableOwners(this.branchId());
      if (seq !== this.openSeq) return;
      this.owners.set(list);
      this.ownersLoaded.set(true);
      this.selectedOwnerId.set(list[0]?.id ?? '');
    } catch (error) {
      if (seq !== this.openSeq) return;
      if (error instanceof ApiError && error.status === 403) this.ownersForbidden.set(true);
      else this.loadError.set(leadBulkLoadError(this.transloco, error));
      this.owners.set([]);
      this.ownersLoaded.set(true);
    } finally {
      if (seq === this.openSeq) {
        this.ownersLoading.set(false);
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
      this.loadError.set(leadBulkLoadError(this.transloco, error));
    } finally {
      if (seq === this.openSeq) {
        this.resolving.set(false);
      }
    }
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'BULK_JOB_ACTIVE') return;
    this.closeOwnerMenu();
    if (leadBulkValidationFields(error).includes('ownerUserId')) {
      this.serverOwnerError.set(this.transloco.translate('leadBulk.invalidValue'));
      return;
    }
    this.notify.error(this.translateCode(code, error));
  }

  private translateCode(code: string | null, error?: unknown): string {
    return leadBulkErrorMessage(this.transloco, error ?? (code ? new ApiError(422, code) : null));
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

  private placeOwnerMenu(seq: number, trigger: HTMLElement): void {
    const panel = this.ownerPanel()?.nativeElement;
    if (seq !== this.menuSeq || !this.ownerMenuOpen() || this.ownerMenuPlaced() || !panel) return;

    const rect = rectInPage(trigger);
    const panelRect = rectInPage(panel);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = panelRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? panelRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + panelRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - panelRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - panelRect.width));

    this.ownerMenuPlace.set({ top, start, width: rect.width, maxHeight });
    this.ownerMenuPlaced.set(true);

    panel.style.top = `${top}px`;
    panel.style.insetInlineStart = `${start}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    panel.classList.remove('invisible');

    this.ownerSearchInput()?.nativeElement.focus();
  }
}

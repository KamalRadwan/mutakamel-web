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
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { listAssignableOwners } from '../../opportunities.api';
import { type OwnerOption, type SelectedOpportunity, initials } from '../../opportunities.model';
import {
  buildAssignBulkJob,
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

@Component({
  selector: 'app-opp-bulk-assign-modal',
  imports: [NgIcon, TranslocoPipe, PluralKeyPipe, BulkRunModal, Field],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-bulk', alias: 'oppBulk' }),
    provideIcons({ tablerUserShare, tablerChevronDown, tablerCheck, tablerSearch }),
  ],
  templateUrl: './assign-modal.html',
  host: {
    '(document:click)': 'closeOwnerMenuIfOutside($event)',
    '(window:resize)': 'closeOwnerMenu()',
  },
})
export class OppBulkAssignModal {
  private static nextId = 0;
  protected readonly uid = `opp-bulk-assign-${++OppBulkAssignModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly selection = inject(OpportunitySelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);
  private readonly ownerTrigger = viewChild<ElementRef<HTMLButtonElement>>('ownerTrigger');
  private readonly ownerPanel = viewChild<ElementRef<HTMLElement>>('ownerPanel');
  private readonly ownerSearchInput = viewChild<ElementRef<HTMLInputElement>>('ownerSearchInput');

  readonly branchId = input('');
  readonly submitted = output<string>();

  protected readonly rows = signal<SelectedOpportunity[]>([]);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly owners = signal<OwnerOption[]>([]);
  protected readonly ownersLoading = signal(false);
  protected readonly ownersLoaded = signal(false);
  protected readonly selectedOwnerId = signal('');
  protected readonly ownerSearch = signal('');
  protected readonly ownerMenuOpen = signal(false);
  protected readonly ownerMenuPlaced = signal(false);
  protected readonly ownerMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  private readonly serverOwnerError = signal<string | null>(null);

  protected readonly initials = initials;

  private openSeq = 0;
  private menuSeq = 0;

  private readonly effectiveBranchId = computed(() => this.branchId().trim() || this.scopeState.branch().id);

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
    if (this.ownersLoaded() && this.owners().length === 0) {
      return this.transloco.translate('oppBulk.assign.noOwners');
    }
    return null;
  });

  protected readonly previewParams = computed(() => {
    const list = this.rows();
    const ownerId = this.selectedOwnerId();
    const same = ownerId ? list.filter((row) => row.ownerUserId === ownerId).length : 0;
    const change = Math.max(0, list.length - same);
    return {
      change,
      owner: this.selectedOwner()?.displayName ?? '—',
      same,
    };
  });

  protected readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      !this.resolving() &&
      !this.ownersLoading() &&
      !!this.selectedOwnerId() &&
      this.rows().length > 0,
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

  open(rows?: readonly OpportunitySelectionRow[]): void {
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

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const ownerUserId = this.selectedOwnerId();
    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };
    const body = buildAssignBulkJob(this.effectiveBranchId(), selection, { ownerUserId });

    this.submitting.set(true);
    this.serverOwnerError.set(null);
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
    this.ownerSearch.set('');
    this.serverOwnerError.set(null);
    this.submitting.set(false);
    this.closeOwnerMenu();
    this.ownersLoaded.set(false);
    this.selectedOwnerId.set('');
    this.rows.set(mapped);
    this.modal().open();

    await Promise.all([this.loadOwners(seq), this.resolveRows(seq, mapped)]);
  }

  private async loadOwners(seq: number): Promise<void> {
    this.ownersLoading.set(true);
    try {
      const list = await listAssignableOwners(this.effectiveBranchId());
      if (seq !== this.openSeq) return;
      this.owners.set(list);
      this.ownersLoaded.set(true);
      this.selectedOwnerId.set(list[0]?.id ?? '');
    } catch {
      if (seq !== this.openSeq) return;
      this.owners.set([]);
      this.ownersLoaded.set(true);
    } finally {
      if (seq === this.openSeq) {
        this.ownersLoading.set(false);
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
    if (code === 'CRM_SCOPED_PERMISSION_DENIED' || code === 'OPPORTUNITY_OWNER_INELIGIBLE') {
      this.serverOwnerError.set(this.translateCode(code));
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

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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerSearch, tablerUserShare } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { sessionBranch } from '../../../shared/lookups/session-branch';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { ownerInitials } from '../../customer-card/customer-card';
import { listCustomerBulkOwners } from '../customer-bulk.api';
import { CustomerCapabilities, OwnerOption } from '../../customers.model';
import {
  CUSTOMERS_BULK_APP,
  CUSTOMERS_BULK_MODULE_ID,
  SelectedCustomerRow,
  extractBulkErrorParams,
  translateCustomerBulkError,
  customerBulkReadOnly,
  customerBulkLoadFailure,
} from '../customer-bulk.model';
import { CustomerBulkSubmitKey } from '../customer-bulk-submit-key';
import { CustomerSelection } from '../customer-selection';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const MENU_GAP = 4;
const MENU_EDGE = 8;

@Component({
  selector: 'app-customer-bulk-assign-modal',
  imports: [NgIcon, TranslocoPipe, PluralKeyPipe, BulkRunModal, Field, FullState],
  providers: [provideIcons({ tablerUserShare, tablerChevronDown, tablerCheck, tablerSearch })],
  templateUrl: './customer-bulk-assign-modal.html',
  host: {
    '(document:click)': 'closeOwnerMenuIfOutside($event)',
    '(window:resize)': 'closeOwnerMenu()',
  },
})
export class CustomerBulkAssignModal {
  private static nextId = 0;
  protected readonly uid = `customer-bulk-assign-${++CustomerBulkAssignModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly i18n = translationEvents(this.transloco);
  private readonly selection = inject(CustomerSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(BulkRunModal);
  private readonly ownerTrigger = viewChild<ElementRef<HTMLButtonElement>>('ownerTrigger');
  private readonly ownerPanel = viewChild<ElementRef<HTMLElement>>('ownerPanel');
  private readonly ownerSearchInput = viewChild<ElementRef<HTMLInputElement>>('ownerSearchInput');

  readonly branchId = input('');
  readonly capabilities = input<CustomerCapabilities | null>(null);
  readonly submitted = output<string>();

  private readonly explicitRows = signal<readonly SelectedCustomerRow[] | null>(null);
  protected readonly submitting = signal(false);
  protected readonly readOnly = signal(false);
  protected readonly loadFailure = signal<string | null>(null);
  protected readonly owners = signal<OwnerOption[]>([]);
  protected readonly ownersLoading = signal(false);
  protected readonly ownersLoaded = signal(false);
  protected readonly ownersDenied = signal(false);
  protected readonly selectedOwnerId = signal('');
  protected readonly ownerSearch = signal('');
  protected readonly ownerMenuOpen = signal(false);
  protected readonly ownerMenuPlaced = signal(false);
  protected readonly ownerMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly requestError = signal<string | null>(null);

  protected readonly ownerInitials = ownerInitials;

  private openSeq = 0;
  private readonly submitKey = new CustomerBulkSubmitKey();
  private menuSeq = 0;

  private readonly effectiveBranchId = computed(() => {
    const branchId = sessionBranch()?.branchId ?? '';
    return !this.branchId() || this.branchId() === branchId ? branchId : '';
  });

  protected readonly displayCount = computed(() => {
    const explicit = this.explicitRows();
    return explicit !== null ? explicit.length : (this.selection?.count() ?? 0);
  });

  protected readonly selectedOwner = computed<OwnerOption | null>(() => {
    const id = this.selectedOwnerId();
    return this.owners().find((owner) => owner.userId === id) ?? null;
  });

  protected readonly filteredOwners = computed<OwnerOption[]>(() => {
    const term = this.ownerSearch().trim().toLowerCase();
    const list = this.owners();
    if (!term) return list;
    return list.filter((owner) => owner.name.toLowerCase().includes(term));
  });

  protected readonly ownerFieldError = computed<string | null>(() => {
    this.i18n();
    if (this.ownersDenied()) return this.transloco.translate('customerBulk.catalogueDenied');
    if (this.ownersLoaded() && this.owners().length === 0) {
      return this.transloco.translate('customerBulk.assign.noOwners');
    }
    return null;
  });

  protected readonly canSubmit = computed(
    () =>
      !this.readOnly() &&
      this.loadFailure() === null &&
      !this.submitting() &&
      !this.ownersLoading() &&
      !!this.selectedOwnerId() &&
      this.displayCount() > 0,
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

  open(rows?: readonly SelectedCustomerRow[]): void {
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
    this.requestError.set(null);
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
    this.submitting.set(false);
    this.requestError.set(null);
    this.explicitRows.set(null);
  }

  protected retryLoad(): void {
    this.loadFailure.set(null);
    void this.loadOwners(this.openSeq);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const ownerUserId = this.selectedOwnerId();
    const explicit = this.explicitRows();
    const selection: BulkJobSelection =
      explicit !== null
        ? { kind: 'IDS', ids: explicit.map((row) => row.id) }
        : this.selection && this.selection.count() > 0
          ? this.selection.snapshot()
          : { kind: 'IDS', ids: [] };

    if (selection.kind === 'IDS' && selection.ids.length === 0) return;

    this.submitting.set(true);
    this.requestError.set(null);
    try {
      const body: BulkJobSubmit = {
        module: CUSTOMERS_BULK_MODULE_ID,
        action: 'ASSIGN',
        scope: { branchId: this.effectiveBranchId() },
        selection,
        params: { ownerUserId },
      };
      const res = await this.tracker.submit(CUSTOMERS_BULK_APP, body, { idempotencyKey: this.submitKey.for(body) });
      this.submitKey.reset();
      this.close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.submitKey.failed(error);
      this.readOnly.update((value) => value || customerBulkReadOnly(error));
      const code = errorCodeOf(error);
      if (code === 'BULK_JOB_ACTIVE') {
        this.close();
        return;
      }
      const message = translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error));
      this.requestError.set(message);
      this.notify.error(message);
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: readonly SelectedCustomerRow[]): Promise<void> {
    const seq = ++this.openSeq;
    this.submitKey.reset();
    this.loadFailure.set(null);
    this.explicitRows.set(rows ? [...rows] : null);
    this.ownerSearch.set('');
    this.requestError.set(null);
    this.submitting.set(false);
    this.closeOwnerMenu();
    this.ownersLoaded.set(false);
    this.ownersDenied.set(false);
    this.selectedOwnerId.set('');
    this.modal().open();

    await this.loadOwners(seq);
  }

  private async loadOwners(seq: number): Promise<void> {
    const branchId = this.effectiveBranchId();
    this.ownersLoading.set(true);
    try {
      const allowed = await listCustomerBulkOwners(branchId);
      if (seq !== this.openSeq) return;
      this.owners.set(allowed);
      this.ownersLoaded.set(true);
    } catch (error) {
      if (seq !== this.openSeq) return;
      const failure = customerBulkLoadFailure(error);
      if (failure !== null) {
        this.loadFailure.set(failure);
        return;
      }
      this.owners.set([]);
      this.ownersDenied.set(error instanceof ApiError && error.status === 403);
      const code = errorCodeOf(error);
      const message = translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error));
      this.requestError.set(message);
      this.notify.error(message);
      this.ownersLoaded.set(true);
    } finally {
      if (seq === this.openSeq) {
        this.ownersLoading.set(false);
      }
    }
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }

  private initialMenuPlace(trigger: HTMLElement): MenuPlace {
    const rect = rectInPage(trigger);
    const view = viewport();
    const start = this.isRtl() ? view.width - rect.right : rect.left;
    return {
      top: rect.bottom + MENU_GAP,
      start: Math.max(MENU_EDGE, start),
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeOwnerMenu(seq: number, trigger: HTMLElement): void {
    const panel = this.ownerPanel()?.nativeElement;
    if (seq !== this.menuSeq || !panel || !this.ownerMenuOpen()) return;

    const rect = rectInPage(trigger);
    const panelRect = rectInPage(panel);
    const view = viewport();
    const rtl = this.isRtl();

    const width = Math.max(rect.width, panelRect.width);
    const rawStart = rtl ? view.width - rect.right : rect.left;
    const maxStart = Math.max(MENU_EDGE, view.width - width - MENU_EDGE);
    const start = Math.max(MENU_EDGE, Math.min(rawStart, maxStart));

    const spaceBelow = view.height - rect.bottom - MENU_EDGE - MENU_GAP;
    const spaceAbove = rect.top - MENU_EDGE - MENU_GAP;
    const openAbove = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const available = openAbove ? spaceAbove : spaceBelow;
    const clampedHeight = Math.min(panelRect.height, Math.max(0, available));
    const top = openAbove
      ? Math.max(MENU_EDGE, rect.top - MENU_GAP - clampedHeight)
      : Math.max(MENU_EDGE, Math.min(rect.bottom + MENU_GAP, view.height - MENU_EDGE - clampedHeight));
    const maxHeight = clampedHeight < panelRect.height ? Math.max(0, Math.floor(available)) : null;

    this.ownerMenuPlace.set({ top, start, width: rect.width, maxHeight });
    this.ownerMenuPlaced.set(true);
    this.ownerSearchInput()?.nativeElement.focus({ preventScroll: true });
  }
}

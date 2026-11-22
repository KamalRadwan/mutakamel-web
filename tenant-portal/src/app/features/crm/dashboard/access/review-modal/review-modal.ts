import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerChevronDown,
  tablerLayoutDashboard,
  tablerPuzzle,
  tablerSearch,
  tablerUserShare,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDate } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import {
  errorCodeOf,
  newIdempotencyKey,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorDetailField } from '../../shared/api-error-details';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import {
  cancelOwnerReview,
  executeOwnerTransfer,
  getOwnerReview,
  isPersonInactive,
  listActiveOwners,
  personName,
  proposeOwner,
  resourceLabel,
} from '../access.api';
import type { AccessPerson, OwnerReview, OwnerReviewStatus } from '../access.model';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

@Component({
  selector: 'app-review-modal',
  imports: [NgIcon, TranslocoPipe, Badge, Button, ConfirmDialog, Field, Modal],
  providers: [
    provideIcons({
      tablerUserShare,
      tablerLayoutDashboard,
      tablerPuzzle,
      tablerChevronDown,
      tablerCheck,
      tablerSearch,
    }),
  ],
  templateUrl: './review-modal.html',
  host: {
    '(document:click)': 'closeOwnerMenuIfOutside($event)',
    '(window:resize)': 'closeOwnerMenu()',
  },
})
export class ReviewModal {
  private static nextId = 0;
  protected readonly uid = `access-review-${++ReviewModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly cancelConfirm = viewChild.required<ConfirmDialog>('cancelConfirm');
  private readonly conflictDialog = viewChild.required<ConfirmDialog>('conflictDialog');
  private readonly ownerTrigger = viewChild<ElementRef<HTMLButtonElement>>('ownerTrigger');
  private readonly ownerPanel = viewChild<ElementRef<HTMLElement>>('ownerPanel');
  private readonly ownerSearchInput = viewChild<ElementRef<HTMLInputElement>>('ownerSearchInput');

  readonly updated = output<OwnerReview | null>();

  protected readonly review = signal<OwnerReview | null>(null);
  protected readonly owners = signal<AccessPerson[]>([]);
  protected readonly ownersLoading = signal(false);
  protected readonly selectedOwnerId = signal('');
  protected readonly reason = signal('');

  protected readonly ownerSearch = signal('');
  protected readonly ownerMenuOpen = signal(false);
  protected readonly ownerMenuPlaced = signal(false);
  protected readonly ownerMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  protected readonly submitting = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverOwnerError = signal<string | null>(null);
  protected readonly serverReasonError = signal<string | null>(null);

  private ownersSeq = 0;
  private menuSeq = 0;
  private transferIdemFingerprint: string | null = null;
  private transferIdemKey: string | null = null;

  protected readonly isOpenReview = computed(() => this.review()?.status === 'OPEN');

  protected readonly isTransferAction = computed(() => {
    const rev = this.review();
    if (!rev || rev.status !== 'OPEN' || !rev.proposedOwnerUserId) return false;
    return this.selectedOwnerId() === rev.proposedOwnerUserId;
  });

  protected readonly resourceLabel = computed(() => {
    const rev = this.review();
    return rev ? resourceLabel(rev) : '—';
  });

  protected readonly currentOwnerLabel = computed(() => {
    const rev = this.review();
    return rev ? personName(rev.ownerUserId, this.language()) : '—';
  });

  protected readonly currentOwnerInactive = computed(() => {
    const rev = this.review();
    return rev ? isPersonInactive(rev.ownerUserId) : false;
  });

  protected readonly openedText = computed(() => {
    const rev = this.review();
    return rev ? formatDate(rev.openedAt, this.language()) : '—';
  });

  protected readonly reviewUntilText = computed(() => {
    const rev = this.review();
    return rev ? formatDate(rev.reviewUntil, this.language()) : '—';
  });

  protected readonly currentProposalSummary = computed(() => {
    this.i18n();
    const lang = this.language();
    const rev = this.review();
    if (!rev || !rev.proposedOwnerUserId) return null;
    return {
      name: personName(rev.proposedOwnerUserId, lang),
      date: rev.proposedAt ? formatDate(rev.proposedAt, lang) : '',
      reason: rev.proposalReason ?? '',
    };
  });

  protected readonly selectedOwner = computed<AccessPerson | null>(() => {
    const id = this.selectedOwnerId();
    return this.owners().find((item) => item.id === id) ?? null;
  });

  protected readonly filteredOwners = computed<AccessPerson[]>(() => {
    const term = this.ownerSearch().trim().toLowerCase();
    const list = this.owners();
    if (!term) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.nameAr.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term),
    );
  });

  protected readonly ownerError = computed<string | null>(() => {
    this.i18n();
    const srv = this.serverOwnerError();
    if (srv) return srv;
    if (this.submitted() && !this.selectedOwnerId()) {
      return this.transloco.translate('access.errors.ownerRequired');
    }
    return null;
  });

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    const srv = this.serverReasonError();
    if (srv) return srv;
    const trimmed = this.reason().trim();
    if (trimmed.length > 500) {
      return this.transloco.translate('access.errors.maxLength', { max: 500 });
    }
    if (this.submitted() && this.isTransferAction() && trimmed.length === 0) {
      return this.transloco.translate('access.errors.reasonRequired');
    }
    return null;
  });

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

  open(review: OwnerReview): void {
    this.review.set(review);
    this.selectedOwnerId.set(review.proposedOwnerUserId ?? '');
    this.reason.set(review.proposalReason ?? '');
    this.ownerSearch.set('');
    this.submitted.set(false);
    this.submitting.set(false);
    this.cancelling.set(false);
    this.transferIdemFingerprint = null;
    this.transferIdemKey = null;
    this.clearServerErrors();
    this.closeOwnerMenu();
    this.modal().open();
    if (review.status === 'OPEN') {
      void this.loadOwners();
    }
  }

  protected close(): void {
    this.closeOwnerMenu();
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.ownersSeq++;
    this.closeOwnerMenu();
    this.submitting.set(false);
    this.cancelling.set(false);
    this.submitted.set(false);
    this.clearServerErrors();
  }

  protected statusTone(status: OwnerReviewStatus): BadgeTone {
    switch (status) {
      case 'OPEN':
        return 'warning';
      case 'TRANSFERRED':
      case 'OWNER_REACTIVATED':
        return 'success';
      case 'LAPSED':
      case 'CANCELLED':
      default:
        return 'none';
    }
  }

  protected personDisplayName(person: AccessPerson): string {
    return this.language() === 'ar' ? person.nameAr : person.name;
  }

  protected initials(name: string): string {
    return personInitials(name);
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
    this.serverReasonError.set(null);
  }

  protected toggleOwnerMenu(): void {
    if (!this.isOpenReview() || this.ownersLoading() || this.owners().length === 0) return;
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
    this.submitted.set(false);
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

  protected async submitPrimary(): Promise<void> {
    const rev = this.review();
    if (!rev || rev.status !== 'OPEN' || this.submitting() || this.cancelling()) return;

    this.submitted.set(true);
    this.clearServerErrors();

    const ownerId = this.selectedOwnerId();
    const trimmedReason = this.reason().trim();
    if (!ownerId || trimmedReason.length > 500) return;

    if (this.isTransferAction()) {
      if (trimmedReason.length === 0) return;
      await this.runTransfer(rev, trimmedReason);
    } else {
      await this.runPropose(rev, ownerId, trimmedReason);
    }
  }

  protected async confirmCancelReview(): Promise<void> {
    const rev = this.review();
    if (!rev || rev.status !== 'OPEN' || this.submitting() || this.cancelling()) return;

    const confirmed = await this.cancelConfirm().open();
    if (!confirmed) return;

    this.cancelling.set(true);
    try {
      const next = await cancelOwnerReview(rev.id, rev.revision);
      this.notify.success(this.transloco.translate('access.toast.reviewCancelled'));
      this.close();
      this.updated.emit(next);
    } catch (error) {
      await this.handleActionError(error, rev);
    } finally {
      this.cancelling.set(false);
    }
  }

  private async runPropose(rev: OwnerReview, ownerId: string, reason: string): Promise<void> {
    this.submitting.set(true);
    try {
      const next = await proposeOwner(rev.id, {
        revision: rev.revision,
        proposedOwnerUserId: ownerId,
        ...(reason ? { reason } : {}),
      });
      this.review.set(next);
      this.selectedOwnerId.set(next.proposedOwnerUserId ?? ownerId);
      this.reason.set(next.proposalReason ?? reason);
      this.submitted.set(false);
      this.notify.success(this.transloco.translate('access.toast.proposed'));
      this.updated.emit(next);
    } catch (error) {
      await this.handleActionError(error, rev);
    } finally {
      this.submitting.set(false);
    }
  }

  private async runTransfer(rev: OwnerReview, reason: string): Promise<void> {
    const body = { revision: rev.revision, reason };
    const fingerprint = JSON.stringify({ id: rev.id, body });
    if (this.transferIdemFingerprint !== fingerprint || !this.transferIdemKey) {
      this.transferIdemFingerprint = fingerprint;
      this.transferIdemKey = newIdempotencyKey();
    }

    this.submitting.set(true);
    try {
      const res = await executeOwnerTransfer(rev.id, body, this.transferIdemKey);
      this.notify.success(this.transloco.translate('access.toast.transferred'));
      this.close();
      this.updated.emit(res.review);
    } catch (error) {
      await this.handleActionError(error, rev);
    } finally {
      this.submitting.set(false);
    }
  }

  private async handleActionError(error: unknown, current: OwnerReview): Promise<void> {
    const code = errorCodeOf(error);
    if (code === 'CRM_OWNER_REVIEW_NOT_OPEN') {
      this.notify.warning(this.transloco.translate(errorKey(code)));
      this.close();
      this.updated.emit(null);
      return;
    }

    if (code === 'CRM_OWNER_REVIEW_REVISION_STALE') {
      // Esc and Cancel resolve to false: keep the user's input, refresh only the revision.
      const reload = await this.conflictDialog().open();
      try {
        const fresh = await getOwnerReview(current.id);
        this.review.set(fresh);
        if (reload) {
          this.selectedOwnerId.set(fresh.proposedOwnerUserId ?? '');
          this.reason.set(fresh.proposalReason ?? '');
          this.submitted.set(false);
        }
        this.updated.emit(fresh);
        if (fresh.status !== 'OPEN') {
          this.notify.warning(this.transloco.translate(errorKey('CRM_OWNER_REVIEW_NOT_OPEN')));
          this.close();
        }
      } catch (refreshError) {
        // 404 CRM_OWNER_REVIEW_NOT_FOUND (deleted meanwhile) has its own text; anything else is generic.
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(refreshError))));
        this.close();
        this.updated.emit(null);
      }
      return;
    }

    const field = errorDetailField(error);
    const message = this.transloco.translate(errorKey(code));

    if (field === 'proposedOwnerUserId' || code === 'CRM_OWNER_REVIEW_PROPOSED_OWNER_INVALID') {
      this.serverOwnerError.set(message);
      return;
    }
    if (field === 'reason') {
      this.serverReasonError.set(message);
      return;
    }

    this.notify.error(message);
  }

  private async loadOwners(): Promise<void> {
    const seq = ++this.ownersSeq;
    this.ownersLoading.set(true);
    try {
      const list = await listActiveOwners();
      if (seq !== this.ownersSeq) return;
      this.owners.set(list);
    } catch {
      if (seq !== this.ownersSeq) return;
      this.owners.set([]);
    } finally {
      if (seq === this.ownersSeq) {
        this.ownersLoading.set(false);
      }
    }
  }

  private clearServerErrors(): void {
    this.serverOwnerError.set(null);
    this.serverReasonError.set(null);
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

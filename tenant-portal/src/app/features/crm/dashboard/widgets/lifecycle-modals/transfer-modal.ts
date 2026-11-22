import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerChevronDown,
  tablerLoader2,
  tablerSearch,
  tablerUserShare,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { getWidget, listTransferTargets, transferImpact, transferWidget } from '../widgets.api';
import type { TransferImpact, WidgetSummary } from '../widgets.model';

interface TargetOption {
  id: string;
  name: string;
}

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const MAX_REASON_LEN = 500;

@Component({
  selector: 'app-widget-transfer-modal',
  imports: [NgIcon, TranslocoPipe, Badge, Button, Checkbox, Field, Modal],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widgets', alias: 'widgets' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerUserShare, tablerChevronDown, tablerCheck, tablerSearch, tablerLoader2 }),
  ],
  templateUrl: './transfer-modal.html',
  host: {
    class: 'contents',
    '(document:click)': 'closeOwnerMenuIfOutside($event)',
    '(window:resize)': 'closeOwnerMenu()',
  },
})
export class TransferModal {
  private static nextId = 0;
  protected readonly uid = `widget-transfer-${++TransferModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly ownerTrigger = viewChild<ElementRef<HTMLButtonElement>>('ownerTrigger');
  private readonly ownerPanel = viewChild<ElementRef<HTMLElement>>('ownerPanel');
  private readonly ownerSearchInput = viewChild<ElementRef<HTMLInputElement>>('ownerSearchInput');

  protected readonly widget = signal<WidgetSummary | null>(null);
  protected readonly targets = signal<TargetOption[]>([]);
  protected readonly loadingTargets = signal(false);
  protected readonly selectedTargetId = signal('');
  protected readonly ownerSearch = signal('');
  protected readonly ownerMenuOpen = signal(false);
  protected readonly ownerMenuPlaced = signal(false);
  protected readonly ownerMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  protected readonly loadingImpact = signal(false);
  protected readonly impact = signal<TransferImpact | null>(null);
  protected readonly reason = signal('');
  protected readonly reasonTouched = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly acknowledged = signal(false);
  protected readonly submitting = signal(false);
  private readonly serverOwnerError = signal<string | null>(null);

  private openSeq = 0;
  private menuSeq = 0;
  private impactSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private resolver: ((changed: boolean) => void) | null = null;
  private settledResult = false;

  protected readonly selectedTarget = computed<TargetOption | null>(() => {
    const id = this.selectedTargetId();
    return this.targets().find((t) => t.id === id) ?? null;
  });

  protected readonly ownerError = computed<string | null>(() => {
    this.i18n();
    return this.serverOwnerError();
  });

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    const trimmed = this.reason().trim();
    if (trimmed.length > MAX_REASON_LEN) {
      return this.transloco.translate('widgets.transferModal.reasonTooLong');
    }
    if ((this.reasonTouched() || this.submitAttempted()) && trimmed.length === 0) {
      return this.transloco.translate('widgets.transferModal.reasonRequired');
    }
    return null;
  });

  protected readonly canSubmit = computed<boolean>(() => {
    const trimmedReason = this.reason().trim();
    return (
      !this.submitting() &&
      !this.loadingImpact() &&
      Boolean(this.selectedTargetId()) &&
      this.impact() !== null &&
      trimmedReason.length >= 1 &&
      trimmedReason.length <= MAX_REASON_LEN &&
      this.acknowledged()
    );
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
      this.clearSearchTimer();
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('keydown', onEscape, { capture: true });
      this.openSeq++;
      this.settle(false);
    });
  }

  open(widget: WidgetSummary): Promise<boolean> {
    this.settle(false);
    this.settledResult = false;
    this.clearSearchTimer();
    const seq = ++this.openSeq;

    this.widget.set(widget);
    this.targets.set([]);
    this.selectedTargetId.set('');
    this.ownerSearch.set('');
    this.impact.set(null);
    this.loadingImpact.set(false);
    this.reason.set('');
    this.reasonTouched.set(false);
    this.submitAttempted.set(false);
    this.acknowledged.set(false);
    this.submitting.set(false);
    this.serverOwnerError.set(null);
    this.closeOwnerMenu();

    this.modal().open();
    void this.loadTargets(seq, widget.id, '');

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected toggleOwnerMenu(): void {
    if (this.submitting()) return;
    if (this.ownerMenuOpen()) {
      this.closeOwnerMenu();
      return;
    }
    const trigger = this.ownerTrigger()?.nativeElement;
    if (!trigger) return;

    const seq = ++this.menuSeq;
    this.ownerMenuPlaced.set(false);
    this.ownerMenuPlace.set(this.initialMenuPlace(trigger));
    this.ownerMenuOpen.set(true);
    queueMicrotask(() => this.placeOwnerMenu(seq, trigger));
    afterNextRender(() => this.placeOwnerMenu(seq, trigger), { injector: this.injector });
  }

  protected onOwnerSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.ownerSearch.set(term);
    this.clearSearchTimer();
    const w = this.widget();
    if (!w) return;
    const seq = this.openSeq;
    this.searchTimer = setTimeout(() => {
      void this.loadTargets(seq, w.id, term);
    }, 180);
  }

  protected selectTarget(targetId: string): void {
    this.selectedTargetId.set(targetId);
    this.serverOwnerError.set(null);
    this.closeOwnerMenu();
    this.ownerTrigger()?.nativeElement.focus();

    const w = this.widget();
    if (w) {
      void this.loadImpact(this.openSeq, w, targetId, false);
    }
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

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected onReasonBlur(): void {
    this.reasonTouched.set(true);
  }

  protected close(): void {
    this.closeOwnerMenu();
    this.modal().close();
  }

  protected onClosed(): void {
    this.openSeq++;
    this.impactSeq++;
    this.clearSearchTimer();
    this.closeOwnerMenu();
    this.loadingTargets.set(false);
    this.loadingImpact.set(false);
    this.submitting.set(false);
    this.settle(this.settledResult);
  }

  protected async submit(): Promise<void> {
    this.submitAttempted.set(true);
    const currentWidget = this.widget();
    const currentImpact = this.impact();
    const targetUserId = this.selectedTargetId();
    if (!currentWidget || !currentImpact || !targetUserId || !this.canSubmit()) return;

    const seq = this.openSeq;
    this.submitting.set(true);
    this.serverOwnerError.set(null);

    try {
      await transferWidget(currentWidget.id, {
        targetUserId,
        expectedWidgetRevision: currentWidget.revision,
        expectedGovernanceRevision: currentWidget.governanceRevision,
        impactId: currentImpact.impactId,
        reason: this.reason().trim(),
        acknowledged: true,
      });
      if (seq !== this.openSeq) return;
      this.notify.success(this.transloco.translate('widgets.transferModal.transferredToast'));
      this.settledResult = true;
      this.modal().close();
    } catch (error) {
      if (seq !== this.openSeq) return;
      const code = errorCodeOf(error);
      if (
        code === 'CRM_OWNERSHIP_TARGET_INACTIVE' ||
        code === 'CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE'
      ) {
        this.serverOwnerError.set(this.transloco.translate(errorKey(code)));
        return;
      }
      if (
        code === 'CRM_WIDGET_TRANSFER_IMPACT_STALE' ||
        code === 'CRM_WIDGET_REVISION_CONFLICT'
      ) {
        this.notify.warning(this.transloco.translate(errorKey(code)));
        await this.refreshAndReloadImpact(seq, currentWidget.id, targetUserId);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(code)));
    } finally {
      if (seq === this.openSeq) {
        this.submitting.set(false);
      }
    }
  }

  private async loadTargets(seq: number, widgetId: string, search: string): Promise<void> {
    this.loadingTargets.set(true);
    try {
      const page = await listTransferTargets(widgetId, search);
      if (seq !== this.openSeq) return;
      this.targets.set(page.items);
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      if (seq === this.openSeq) {
        this.loadingTargets.set(false);
      }
    }
  }

  private async loadImpact(
    seq: number,
    widget: WidgetSummary,
    targetUserId: string,
    retryingConflict: boolean,
  ): Promise<void> {
    const reqSeq = ++this.impactSeq;
    this.loadingImpact.set(true);
    this.impact.set(null);
    try {
      const imp = await transferImpact(widget.id, {
        targetUserId,
        expectedWidgetRevision: widget.revision,
        expectedGovernanceRevision: widget.governanceRevision,
      });
      if (seq !== this.openSeq || reqSeq !== this.impactSeq) return;
      this.impact.set(imp);
    } catch (error) {
      if (seq !== this.openSeq || reqSeq !== this.impactSeq) return;
      const code = errorCodeOf(error);
      if (!retryingConflict && code === 'CRM_WIDGET_TRANSFER_IMPACT_STALE') {
        this.notify.warning(this.transloco.translate(errorKey(code)));
        await this.refreshAndReloadImpact(seq, widget.id, targetUserId, true);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(code)));
    } finally {
      if (seq === this.openSeq && reqSeq === this.impactSeq) {
        this.loadingImpact.set(false);
      }
    }
  }

  private async refreshAndReloadImpact(
    seq: number,
    widgetId: string,
    targetUserId: string,
    retryingConflict = false,
  ): Promise<void> {
    try {
      const fresh = await getWidget(widgetId);
      if (seq !== this.openSeq) return;
      this.widget.set(fresh);
      await this.loadImpact(seq, fresh, targetUserId, retryingConflict);
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    }
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
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

  private settle(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.settledResult = false;
    resolve?.(result);
  }
}

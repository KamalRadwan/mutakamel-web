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
  tablerKey,
  tablerLayoutDashboard,
  tablerPuzzle,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { addDays } from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import {
  errorCodeOf,
  newIdempotencyKey,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorDetailField } from '../../shared/api-error-details';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { listRequestableResources, submitAccessRequest } from '../access.api';
import type {
  AccessLevel,
  AccessRequest,
  AccessResourceType,
  RequestableResource,
} from '../access.model';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

function formatIsoDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-request-modal',
  imports: [NgIcon, TranslocoPipe, Badge, Button, DateField, Field, Modal, Segmented],
  providers: [
    provideIcons({
      tablerKey,
      tablerLayoutDashboard,
      tablerPuzzle,
      tablerChevronDown,
      tablerCheck,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './request-modal.html',
  host: {
    '(document:click)': 'closeMenuIfOutside($event)',
    '(window:resize)': 'closeMenu()',
  },
})
export class RequestModal {
  private readonly org = inject(OrgApi);
  private static nextId = 0;
  protected readonly uid = `access-request-${++RequestModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly resourceTrigger = viewChild<ElementRef<HTMLButtonElement>>('resourceTrigger');
  private readonly resourcePanel = viewChild<ElementRef<HTMLElement>>('resourcePanel');
  private readonly resourceSearchInput = viewChild<ElementRef<HTMLInputElement>>('resourceSearchInput');

  readonly created = output<AccessRequest>();

  protected readonly resourceType = signal<AccessResourceType>('DASHBOARD');
  protected readonly resources = signal<RequestableResource[]>([]);
  protected readonly resourcesLoading = signal(false);
  protected readonly resourceId = signal('');
  protected readonly requestedLevel = signal<AccessLevel>('VIEW');
  protected readonly requestedExpiresAt = signal<string | null>(null);
  protected readonly purpose = signal('');

  protected readonly resourceSearch = signal('');
  protected readonly menuOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverResourceError = signal<string | null>(null);
  protected readonly serverLevelError = signal<string | null>(null);
  protected readonly serverExpiresError = signal<string | null>(null);
  protected readonly serverPurposeError = signal<string | null>(null);

  protected readonly minExpiryDate = formatIsoDay(addDays(new Date(this.org.now()), 1));

  private loadSeq = 0;
  private menuSeq = 0;
  private idemFingerprint: string | null = null;
  private idemKey: string | null = null;

  protected readonly typeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'DASHBOARD', label: this.transloco.translate('access.resourceType.DASHBOARD') },
      { value: 'WIDGET', label: this.transloco.translate('access.resourceType.WIDGET') },
    ];
  });

  protected readonly levelOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'VIEW', label: this.transloco.translate('access.level.VIEW') },
      { value: 'EDIT', label: this.transloco.translate('access.level.EDIT') },
    ];
  });

  protected readonly selectedResource = computed<RequestableResource | null>(() => {
    const id = this.resourceId();
    return this.resources().find((item) => item.id === id) ?? null;
  });

  protected readonly filteredResources = computed<RequestableResource[]>(() => {
    const term = this.resourceSearch().trim().toLowerCase();
    const list = this.resources();
    if (!term) return list;
    return list.filter(
      (item) =>
        item.nameEn.toLowerCase().includes(term) || item.nameAr.toLowerCase().includes(term),
    );
  });

  protected readonly resourceError = computed<string | null>(() => {
    this.i18n();
    const srv = this.serverResourceError();
    if (srv) return srv;
    if (this.submitted() && !this.resourceId()) {
      return this.transloco.translate('access.errors.resourceRequired');
    }
    return null;
  });

  protected readonly levelError = computed<string | null>(() => this.serverLevelError());
  protected readonly expiresError = computed<string | null>(() => this.serverExpiresError());

  protected readonly purposeError = computed<string | null>(() => {
    this.i18n();
    const srv = this.serverPurposeError();
    if (srv) return srv;
    const trimmed = this.purpose().trim();
    if (trimmed.length > 250) {
      return this.transloco.translate('access.errors.maxLength', { max: 250 });
    }
    if (this.submitted() && trimmed.length === 0) {
      return this.transloco.translate('access.errors.purposeRequired');
    }
    return null;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.menuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.resourcePanel()?.nativeElement.contains(target)) return;
      this.closeMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.menuOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.closeMenu();
      this.resourceTrigger()?.nativeElement.focus();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onEscape, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('keydown', onEscape, { capture: true });
    });
  }

  open(): void {
    this.resourceType.set('DASHBOARD');
    this.resourceId.set('');
    this.requestedLevel.set('VIEW');
    this.requestedExpiresAt.set(null);
    this.purpose.set('');
    this.resourceSearch.set('');
    this.submitted.set(false);
    this.submitting.set(false);
    this.idemFingerprint = null;
    this.idemKey = null;
    this.clearServerErrors();
    this.closeMenu();
    this.modal().open();
    void this.loadResources('DASHBOARD');
  }

  protected close(): void {
    this.closeMenu();
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.loadSeq++;
    this.closeMenu();
    this.submitting.set(false);
    this.submitted.set(false);
    this.clearServerErrors();
  }

  protected onTypeChange(next: string | null): void {
    if (next !== 'DASHBOARD' && next !== 'WIDGET') return;
    if (next === this.resourceType()) return;
    this.resourceType.set(next);
    this.resourceId.set('');
    this.resourceSearch.set('');
    this.clearServerErrors();
    this.closeMenu();
    void this.loadResources(next);
  }

  protected onLevelChange(next: string | null): void {
    if (next !== 'VIEW' && next !== 'EDIT') return;
    this.requestedLevel.set(next);
    this.serverLevelError.set(null);
  }

  protected onExpiresChange(value: string | null): void {
    this.requestedExpiresAt.set(value);
    this.serverExpiresError.set(null);
  }

  protected clearExpires(): void {
    this.requestedExpiresAt.set(null);
    this.serverExpiresError.set(null);
  }

  protected onPurposeInput(event: Event): void {
    this.purpose.set((event.target as HTMLTextAreaElement).value);
    this.serverPurposeError.set(null);
  }

  protected resourceDisplayName(item: RequestableResource): string {
    return this.language() === 'ar' ? item.nameAr : item.nameEn;
  }

  protected toggleMenu(): void {
    if (this.resourcesLoading() || this.resources().length === 0) return;
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    const trigger = this.resourceTrigger()?.nativeElement;
    if (!trigger) return;
    const seq = ++this.menuSeq;
    this.resourceSearch.set('');
    this.menuPlaced.set(false);
    this.menuPlace.set(this.initialMenuPlace(trigger));
    this.menuOpen.set(true);
    queueMicrotask(() => this.placeMenu(seq, trigger));
    afterNextRender(() => this.placeMenu(seq, trigger), { injector: this.injector });
  }

  protected selectResource(item: RequestableResource): void {
    this.resourceId.set(item.id);
    if (item.heldLevel === 'VIEW' && this.requestedLevel() === 'VIEW') {
      this.requestedLevel.set('EDIT');
    }
    this.serverResourceError.set(null);
    this.serverLevelError.set(null);
    this.closeMenu();
    this.resourceTrigger()?.nativeElement.focus();
  }

  protected onSearchInput(event: Event): void {
    this.resourceSearch.set((event.target as HTMLInputElement).value);
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    const panel = this.resourcePanel()?.nativeElement;
    if (!panel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu();
      this.resourceTrigger()?.nativeElement.focus();
      return;
    }
    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('ul button:not([disabled])'));
    if (buttons.length === 0) return;

    const activeEl = document.activeElement;
    const currentIndex = buttons.indexOf(activeEl as HTMLButtonElement);
    const inSearch = activeEl === this.resourceSearchInput()?.nativeElement;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = inSearch || currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
      buttons[nextIndex].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentIndex <= 0) {
        this.resourceSearchInput()?.nativeElement.focus();
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

  protected closeMenuIfOutside(event: Event): void {
    if (!this.menuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (
      this.resourceTrigger()?.nativeElement.contains(target) ||
      this.resourcePanel()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closeMenu();
  }

  protected closeMenu(): void {
    this.menuSeq++;
    this.menuOpen.set(false);
    this.menuPlaced.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitted.set(true);
    this.clearServerErrors();

    const resourceId = this.resourceId();
    const purpose = this.purpose().trim();
    if (!resourceId || purpose.length === 0 || purpose.length > 250) {
      return;
    }

    const body = {
      resourceType: this.resourceType(),
      resourceId,
      requestedLevel: this.requestedLevel(),
      purpose,
      requestedExpiresAt: this.requestedExpiresAt(),
    };
    const fingerprint = JSON.stringify(body);
    if (this.idemFingerprint !== fingerprint || !this.idemKey) {
      this.idemFingerprint = fingerprint;
      this.idemKey = newIdempotencyKey();
    }

    this.submitting.set(true);
    try {
      const created = await submitAccessRequest(body, this.idemKey);
      this.notify.success(this.transloco.translate('access.toast.requested'));
      this.close();
      this.created.emit(created);
    } catch (error) {
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private async loadResources(type: AccessResourceType): Promise<void> {
    const seq = ++this.loadSeq;
    this.resourcesLoading.set(true);
    try {
      const list = await listRequestableResources(type);
      if (seq !== this.loadSeq) return;
      this.resources.set(list);
    } catch {
      if (seq !== this.loadSeq) return;
      this.resources.set([]);
    } finally {
      if (seq === this.loadSeq) {
        this.resourcesLoading.set(false);
      }
    }
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    const field = errorDetailField(error);
    const message = this.transloco.translate(errorKey(code));

    if (field === 'resourceId' || code === 'CRM_ACCESS_REQUEST_NOT_FOUND') {
      this.serverResourceError.set(message);
      return;
    }
    if (field === 'purpose') {
      this.serverPurposeError.set(message);
      return;
    }
    if (field === 'requestedExpiresAt' || code === 'CRM_SHARE_EXPIRY_INVALID') {
      this.serverExpiresError.set(message);
      return;
    }
    if (
      field === 'requestedLevel' ||
      code === 'CRM_ACCESS_REQUEST_ALREADY_GRANTED' ||
      code === 'CRM_ACCESS_REQUEST_PENDING_EXISTS' ||
      code === 'CRM_SHARE_MANAGE_NOT_ENABLED'
    ) {
      this.serverLevelError.set(message);
      return;
    }

    this.notify.error(message);
  }

  private clearServerErrors(): void {
    this.serverResourceError.set(null);
    this.serverLevelError.set(null);
    this.serverExpiresError.set(null);
    this.serverPurposeError.set(null);
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

  private placeMenu(seq: number, trigger: HTMLElement): void {
    const panel = this.resourcePanel()?.nativeElement;
    if (seq !== this.menuSeq || !this.menuOpen() || this.menuPlaced() || !panel) return;

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

    this.menuPlace.set({ top, start, width: rect.width, maxHeight });
    this.menuPlaced.set(true);

    panel.style.top = `${top}px`;
    panel.style.insetInlineStart = `${start}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    panel.classList.remove('invisible');

    this.resourceSearchInput()?.nativeElement.focus();
  }
}

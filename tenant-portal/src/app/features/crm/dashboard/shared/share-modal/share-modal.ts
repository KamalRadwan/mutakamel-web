import { Router } from '@angular/router';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
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
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerPlus,
  tablerSearch,
  tablerShare,
  tablerUser,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDate } from '../../../../../shared/ui/chart/chart-format';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { fieldErrorsOf } from '../../../../../core/api/api-errors';
import { ConflictChoice } from '../conflict-choice';
import {
  dashboardWriteError,
  isAnalyticsConflict,
  retainWriteIntent,
  writeIntent,
  type WriteIntent,
} from '../write-state';
import { DataCell, DataColumn, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import type {
  Share,
  ShareListItem,
  SharePreview,
  ShareTarget,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import { errorKey, reasonKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

export interface ShareApi {
  list(): Promise<ShareListItem[]>;
  add(
    body: {
      subjectType: 'USER' | 'TEAM';
      subjectId: string;
      accessLevel: 'VIEW' | 'EDIT';
      expiresAt?: string | null;
    },
    key: string,
  ): Promise<Share>;
  update(
    shareId: string,
    body: { revision?: number; accessLevel?: 'VIEW' | 'EDIT'; expiresAt?: string | null },
  ): Promise<Share>;
  revoke(shareId: string, reason: 'OWNER_REVOKED' | 'ADMIN_REVOKED'): Promise<void>;
  targets(search: string): Promise<ShareTarget[]>;
  preview(subjectType: 'USER' | 'TEAM', subjectId: string): Promise<SharePreview>;
}

interface TargetPlace {
  top: number;
  start: number;
  width: number;
}

const SEARCH_DEBOUNCE_MS = 150;

/** End of the chosen calendar day in the viewer's local time zone, as an instant. */
function endOfLocalDayIso(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 0).toISOString();
}
const ESTIMATED_LIST_HEIGHT = 240;

@Component({
  selector: 'app-share-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Field,
    Modal,
    Segmented,
    DateField,
    Dropdown,
    DataTable,
    DataCell,
    Badge,
    ConflictDialog,
    FullState,
  ],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'crm-dash-share', alias: 'share' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({
      tablerShare,
      tablerUser,
      tablerUsers,
      tablerSearch,
      tablerX,
      tablerPlus,
      tablerCheck,
    }),
  ],
  templateUrl: './share-modal.html',
  host: {
    class: 'contents',
    '(document:click)': 'closeTargetsIfOutside($event)',
    '(window:resize)': 'closeTargetMenu()',
  },
})
export class ShareModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  protected readonly canViewReadiness = can('crm.analytics.readiness.view');
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly shareScope = toSignal(
    selectScopeTranslation(this.transloco, 'crm-dash-share', 'share'),
  );
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly revokeModal = viewChild.required<Modal>('revokeModal');
  private readonly tenantScope = inject(TenantScopeState, { optional: true });
  protected readonly conflict = new ConflictChoice();
  protected readonly readOnly = signal(false);
  protected readonly readFailure = signal<ReturnType<typeof dashboardWriteError> | null>(null);
  protected readonly shareDrafts = signal<Record<string, 'VIEW' | 'EDIT'>>({});
  protected readonly revokeReason = signal<'OWNER_REVOKED' | 'ADMIN_REVOKED' | null>(null);
  protected readonly reasonError = signal<string | null>(null);
  private addIntent: WriteIntent | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly reasonOptions = computed<DropdownOption<'OWNER_REVOKED' | 'ADMIN_REVOKED'>[]>(
    () => {
      this.i18n();
      return [
        { value: 'OWNER_REVOKED', label: this.transloco.translate('share.ownerRevoked') },
        ...(this.canAdmin()
          ? [
              {
                value: 'ADMIN_REVOKED' as const,
                label: this.transloco.translate('share.adminRevoked'),
              },
            ]
          : []),
      ];
    },
  );
  private readonly targetArea = viewChild<ElementRef<HTMLElement>>('targetArea');
  private readonly targetInput = viewChild<ElementRef<HTMLInputElement>>('targetInput');
  private readonly targetMenu = viewChild<ElementRef<HTMLElement>>('targetMenu');
  private readonly targetOptionBtns =
    viewChildren<ElementRef<HTMLButtonElement>>('targetOptionBtn');

  readonly changed = output<void>();

  private currentApi: ShareApi | null = null;
  private openSeq = 0;
  private searchSeq = 0;
  private previewSeq = 0;
  private placeSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly resourceName = signal('');
  protected readonly canAdmin = signal(false);
  protected readonly shares = signal<ShareListItem[]>([]);
  protected readonly loadingShares = signal(false);

  protected readonly selectedTarget = signal<ShareTarget | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly previewData = signal<SharePreview | null>(null);
  protected readonly previewError = signal<string | null>(null);
  protected readonly previewHidden = signal(false);
  protected readonly searchText = signal('');
  protected readonly targetOptions = signal<ShareTarget[]>([]);
  protected readonly loadingTargets = signal(false);
  protected readonly targetMenuOpen = signal(false);
  protected readonly targetPlaced = signal(false);
  protected readonly targetPlace = signal<TargetPlace>({ top: 0, start: 0, width: 0 });
  protected readonly activeTargetIndex = signal(0);

  protected readonly accessLevel = signal<'VIEW' | 'EDIT'>('VIEW');
  protected readonly expiresAt = signal<string | null>(null);
  protected readonly targetError = signal<string | null>(null);
  protected readonly expiryError = signal<string | null>(null);
  protected readonly accessError = signal<string | null>(null);
  protected readonly rowErrors = signal<Record<string, string>>({});

  protected readonly adding = signal(false);
  protected readonly updatingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly revokingId = signal<string | null>(null);
  protected readonly revokingItem = signal<ShareListItem | null>(null);

  protected readonly modalTitle = computed(() => {
    this.i18n();
    this.shareScope();
    return this.transloco.translate('share.title', { name: this.resourceName() });
  });

  protected readonly expiryDescribedBy = computed(() =>
    this.expiryError() ? 'share-expires-hint share-expires-error' : 'share-expires-hint',
  );

  protected readonly accessSegmentedOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.shareScope();
    return [
      { value: 'VIEW', label: this.transloco.translate('share.view'), disabled: this.readOnly() },
      { value: 'EDIT', label: this.transloco.translate('share.edit'), disabled: this.readOnly() },
    ];
  });

  protected readonly accessDropdownOptions = computed<DropdownOption<'VIEW' | 'EDIT'>[]>(() => {
    this.i18n();
    this.shareScope();
    return [
      { value: 'VIEW', label: this.transloco.translate('share.view'), disabled: this.readOnly() },
      { value: 'EDIT', label: this.transloco.translate('share.edit'), disabled: this.readOnly() },
    ];
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.shareScope();
    return [
      { key: 'name', label: this.transloco.translate('share.columns.name'), width: 2.1 },
      { key: 'type', label: this.transloco.translate('share.columns.type'), width: 0.85 },
      { key: 'access', label: this.transloco.translate('share.columns.access'), width: 1.25 },
      { key: 'expires', label: this.transloco.translate('share.columns.expires'), width: 1.05 },
      {
        key: 'actions',
        label: this.transloco.translate('share.columns.actions'),
        width: 0.95,
        align: 'end',
      },
    ];
  });

  protected readonly activeOptionId = computed(() => {
    if (!this.targetMenuOpen()) return null;
    const opt = this.targetOptions()[this.activeTargetIndex()];
    return opt ? this.targetOptionId(opt) : null;
  });

  protected readonly rowKey = (row: ShareListItem): string => row.id;

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.targetMenuOpen()) return;
      const target = event.target;
      const menuEl = this.targetMenu()?.nativeElement;
      if (menuEl && target instanceof Node && menuEl.contains(target)) return;
      this.closeTargetMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      this.clearSearchTimer();
      this.clearPreview();
      this.conflict.choose(false);
    });
  }

  /** What is being shared; the access preview says "Access to this dashboard" or "... widget". */
  protected readonly resourceKind = signal<'dashboard' | 'widget'>('dashboard');

  open(
    api: ShareApi,
    resourceName: string,
    canAdmin: boolean,
    resourceKind: 'dashboard' | 'widget' = 'dashboard',
  ): void {
    const seq = ++this.openSeq;
    this.resourceKind.set(resourceKind);
    this.currentApi = api;
    this.resourceName.set(resourceName);
    this.canAdmin.set(canAdmin);
    this.resetForm();
    this.readOnly.set(false);
    this.readFailure.set(null);
    this.shareDrafts.set({});
    this.addIntent = null;
    this.shares.set([]);
    this.modal().open();
    void this.loadShares(seq);
  }

  protected close(): void {
    this.closeTargetMenu();
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.conflict.choose(false);
    this.openSeq++;
    this.searchSeq++;
    this.previewSeq++;
    this.clearSearchTimer();
    this.clearPreview();
    this.closeTargetMenu();
    this.currentApi = null;
  }

  protected onTargetInput(value: string): void {
    this.searchText.set(value);
    this.targetError.set(null);
    const current = this.selectedTarget();
    if (current && value !== current.name) {
      this.selectedTarget.set(null);
      this.clearPreview();
    }
    this.openTargetMenu();
    this.scheduleTargetSearch(value);
  }

  protected onTargetClick(): void {
    if (!this.currentApi) return;
    if (!this.targetMenuOpen()) {
      this.openTargetMenu();
      void this.loadTargets(this.searchText());
    }
  }

  protected clearTarget(): void {
    this.selectedTarget.set(null);
    this.clearPreview();
    this.searchText.set('');
    this.targetError.set(null);
    this.openTargetMenu();
    void this.loadTargets('');
    this.targetInput()?.nativeElement.focus({ preventScroll: true });
  }

  protected chooseTarget(option: ShareTarget): void {
    this.selectedTarget.set(option);
    this.searchText.set(option.name);
    this.targetError.set(null);
    this.closeTargetMenu();
    void this.loadPreview(option);
    this.targetInput()?.nativeElement.focus({ preventScroll: true });
  }

  protected onTargetKeydown(event: KeyboardEvent): void {
    const options = this.targetOptions();
    if (event.key === 'Escape') {
      if (this.targetMenuOpen()) {
        event.preventDefault();
        event.stopPropagation();
        this.closeTargetMenu();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.targetMenuOpen()) {
        this.openTargetMenu();
        void this.loadTargets(this.searchText());
        return;
      }
      if (options.length === 0) return;
      const next = (this.activeTargetIndex() + 1) % options.length;
      this.activeTargetIndex.set(next);
      this.scrollActiveTarget(next);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.targetMenuOpen() || options.length === 0) return;
      const prev = (this.activeTargetIndex() - 1 + options.length) % options.length;
      this.activeTargetIndex.set(prev);
      this.scrollActiveTarget(prev);
      return;
    }

    if (event.key === 'Enter' && this.targetMenuOpen()) {
      const option = options[this.activeTargetIndex()];
      if (option) {
        event.preventDefault();
        this.chooseTarget(option);
      }
    }
  }

  protected closeTargetsIfOutside(event: Event): void {
    if (!this.targetMenuOpen()) return;
    const target = event.target as Node | null;
    const areaEl = this.targetArea()?.nativeElement;
    const menuEl = this.targetMenu()?.nativeElement;
    if (
      (areaEl && target && areaEl.contains(target)) ||
      (menuEl && target && menuEl.contains(target))
    ) {
      return;
    }
    this.closeTargetMenu();
  }

  protected closeTargetMenu(): void {
    this.placeSeq++;
    this.targetMenuOpen.set(false);
    this.targetPlaced.set(false);
  }

  protected onAccessLevelChange(next: string | null): void {
    if (next === 'VIEW' || next === 'EDIT') {
      this.accessLevel.set(next);
    }
  }

  protected onExpiresChange(value: string | null): void {
    this.expiresAt.set(value);
    this.validateExpiry(value);
  }

  protected clearExpires(): void {
    this.expiresAt.set(null);
    this.expiryError.set(null);
  }

  protected async addShare(): Promise<void> {
    const api = this.currentApi;
    if (!api || this.adding() || this.readOnly()) return;

    const target = this.selectedTarget();
    if (!target) {
      this.targetError.set(this.transloco.translate('share.targetRequired'));
      return;
    }

    const expiry = this.expiresAt();
    if (!this.validateExpiry(expiry)) return;

    this.adding.set(true);
    this.accessError.set(null);
    try {
      const body = {
        subjectType: target.type,
        subjectId: target.id,
        accessLevel: this.accessLevel(),
        expiresAt: expiry ? endOfLocalDayIso(expiry) : null,
      };
      this.addIntent = writeIntent(body, this.addIntent);
      await api.add(body, this.addIntent.key);
      this.addIntent = null;
      this.selectedTarget.set(null);
      this.clearPreview();
      this.searchText.set('');
      this.accessLevel.set('VIEW');
      this.expiresAt.set(null);
      this.targetError.set(null);
      this.expiryError.set(null);
      this.notify.success(this.transloco.translate('share.toast.added'));
      this.changed.emit();
      await this.loadShares(this.openSeq);
    } catch (error) {
      if (!retainWriteIntent(error)) this.addIntent = null;
      const code = errorCodeOf(error);
      const fields = fieldErrorsOf(error);
      if (fields['subjectId'] || fields['subjectType'])
        this.targetError.set(this.transloco.translate('share.targetRequired'));
      else if (fields['expiresAt'])
        this.expiryError.set(this.transloco.translate('share.expiryPast'));
      else if (fields['accessLevel'])
        this.accessError.set(this.transloco.translate('share.invalidAccess'));
      else if (code === 'CRM_SHARE_SELF_INVALID' || code === 'CRM_SHARE_TARGET_INVALID') {
        this.targetError.set(this.translateError(code));
      } else if (code === 'CRM_SHARE_EXPIRY_INVALID') {
        this.expiryError.set(this.translateError(code));
      } else {
        this.showWriteError(error);
      }
    } finally {
      this.adding.set(false);
    }
  }

  protected async updateAccess(item: ShareListItem, next: 'VIEW' | 'EDIT'): Promise<void> {
    const api = this.currentApi;
    if (!api || this.readOnly() || next === item.accessLevel || this.updatingIds().has(item.id))
      return;
    this.rowErrors.update((errors) => {
      const nextErrors = { ...errors };
      delete nextErrors[item.id];
      return nextErrors;
    });
    this.shareDrafts.update((drafts) => ({ ...drafts, [item.id]: next }));
    this.updatingIds.update((set) => new Set(set).add(item.id));
    try {
      const updated = await api.update(item.id, { accessLevel: next });
      this.shares.update((rows) =>
        rows.map((row) =>
          row.id === item.id
            ? { ...row, ...updated, effectiveAccessLevel: updated.accessLevel }
            : row,
        ),
      );
      this.clearShareDraft(item.id);
      this.notify.success(this.transloco.translate('share.toast.updated'));
      this.changed.emit();
    } catch (error) {
      if (fieldErrorsOf(error)['accessLevel']) {
        this.rowErrors.update((errors) => ({
          ...errors,
          [item.id]: this.transloco.translate('share.invalidAccess'),
        }));
      } else if (isAnalyticsConflict(error)) {
        const keep = await this.conflict.open();
        await this.loadShares(this.openSeq);
        if (!keep) this.clearShareDraft(item.id);
      } else this.showWriteError(error);
    } finally {
      this.updatingIds.update((set) => {
        const copy = new Set(set);
        copy.delete(item.id);
        return copy;
      });
    }
  }
  private clearShareDraft(id: string): void {
    this.shareDrafts.update((drafts) => {
      const copy = { ...drafts };
      delete copy[id];
      return copy;
    });
  }
  protected async revokeShare(item: ShareListItem): Promise<void> {
    if (!this.currentApi || this.readOnly() || this.revokingId()) return;
    this.revokingItem.set(item);
    this.reasonError.set(null);
    this.revokeReason.set(
      this.canAdmin() && item.sharedByUserId !== this.tenantScope?.me()?.id
        ? 'ADMIN_REVOKED'
        : 'OWNER_REVOKED',
    );
    this.revokeModal().open();
  }
  protected async confirmRevoke(): Promise<void> {
    const api = this.currentApi;
    const item = this.revokingItem();
    const reason = this.revokeReason();
    if (!api || !item || this.revokingId() || this.readOnly()) return;
    if (!reason) {
      this.reasonError.set(this.transloco.translate('share.reasonRequired'));
      return;
    }
    this.revokingId.set(item.id);
    this.reasonError.set(null);
    try {
      await api.revoke(item.id, reason);
      this.shares.update((rows) => rows.filter((row) => row.id !== item.id));
      this.notify.success(this.transloco.translate('share.toast.revoked'));
      this.changed.emit();
      this.revokeModal().close();
    } catch (error) {
      if (
        errorCodeOf(error) === 'CRM_SHARE_REVOKE_REASON_REQUIRED' ||
        fieldErrorsOf(error)['reason']
      ) {
        this.reasonError.set(this.transloco.translate('share.reasonRequired'));
      } else if (isAnalyticsConflict(error)) {
        const keep = await this.conflict.open();
        await this.loadShares(this.openSeq);
        if (!keep) this.revokeModal().close();
      } else this.showWriteError(error);
    } finally {
      this.revokingId.set(null);
    }
  }
  protected cancelRevoke(): void {
    if (!this.revokingId()) this.revokeModal().close();
  }
  protected revokeClosed(): void {
    this.revokingItem.set(null);
  }
  protected retryShares(): void {
    if (this.readFailure()?.kind === 'provisioning' && this.canViewReadiness) {
      this.modal().close();
      void this.router.navigate(['/crm/settings/data-readiness']);
    } else void this.loadShares(this.openSeq);
  }
  private showWriteError(error: unknown): void {
    const failure = dashboardWriteError(this.transloco, error, 'share');
    this.readOnly.set(this.readOnly() || failure.readOnly || failure.reloadRequired);
    this.notify.error(failure.message);
  }
  protected asShare(row: unknown): ShareListItem {
    return row as ShareListItem;
  }

  protected shareName(item: ShareListItem): string {
    return item.subjectName || item.subjectId;
  }

  protected formatExpiry(iso: string | null): string {
    if (!iso) return DASH;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return DASH;
    // Show the calendar day in the viewer's local time zone, not the UTC day.
    return formatDate(
      new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate())),
      this.language(),
    );
  }

  protected targetOptionId(option: ShareTarget): string {
    return `share-target-opt-${option.type}-${option.id}`;
  }

  protected targetSubline(option: ShareTarget): string {
    return option.email ?? option.code ?? '';
  }

  private resetForm(): void {
    this.accessError.set(null);
    this.rowErrors.set({});
    this.reasonError.set(null);
    this.clearSearchTimer();
    this.selectedTarget.set(null);
    this.clearPreview();
    this.searchText.set('');
    this.targetOptions.set([]);
    this.loadingTargets.set(false);
    this.targetMenuOpen.set(false);
    this.targetPlaced.set(false);
    this.activeTargetIndex.set(0);
    this.accessLevel.set('VIEW');
    this.expiresAt.set(null);
    this.targetError.set(null);
    this.expiryError.set(null);
    this.adding.set(false);
    this.updatingIds.set(new Set());
    this.revokingId.set(null);
    this.revokingItem.set(null);
  }

  private validateExpiry(iso: string | null): boolean {
    if (iso && endOfLocalDayIso(iso) <= new Date().toISOString()) {
      this.expiryError.set(this.transloco.translate('share.expiryPast'));
      return false;
    }
    this.expiryError.set(null);
    return true;
  }

  private async loadShares(seq: number): Promise<void> {
    const api = this.currentApi;
    if (!api) return;
    this.loadingShares.set(true);
    this.readFailure.set(null);
    try {
      const items = await api.list();
      if (seq !== this.openSeq) return;
      this.shares.set(items);
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.readFailure.set(dashboardWriteError(this.transloco, error, 'share', false));
    } finally {
      if (seq === this.openSeq) {
        this.loadingShares.set(false);
      }
    }
  }

  private scheduleTargetSearch(term: string): void {
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.loadTargets(term);
    }, SEARCH_DEBOUNCE_MS);
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private async loadTargets(term: string): Promise<void> {
    const api = this.currentApi;
    if (!api) return;
    const seq = ++this.searchSeq;
    this.loadingTargets.set(true);
    try {
      const results = await api.targets(term);
      if (seq !== this.searchSeq) return;
      this.targetOptions.set(results);
      this.activeTargetIndex.set(0);
      if (this.targetMenuOpen()) {
        const placeSeq = ++this.placeSeq;
        afterNextRender(() => this.placeTargetMenu(placeSeq), { injector: this.injector });
      }
    } catch (error) {
      if (seq !== this.searchSeq) return;
      this.targetOptions.set([]);
      this.notify.error(this.translateError(errorCodeOf(error)));
    } finally {
      if (seq === this.searchSeq) {
        this.loadingTargets.set(false);
      }
    }
  }

  private openTargetMenu(): void {
    const seq = ++this.placeSeq;
    this.targetPlaced.set(false);
    this.targetPlace.set(this.initialTargetPlace());
    this.targetMenuOpen.set(true);
    queueMicrotask(() => this.placeTargetMenu(seq));
    afterNextRender(() => this.placeTargetMenu(seq), { injector: this.injector });
  }

  private initialTargetPlace(): TargetPlace {
    const anchor = this.targetAnchorEl();
    if (!anchor) return { top: 0, start: 0, width: 260 };
    const rect = rectInPage(anchor);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
    };
  }

  private placeTargetMenu(seq: number): void {
    if (seq !== this.placeSeq || !this.targetMenuOpen()) return;
    const anchor = this.targetAnchorEl();
    const menuEl = this.targetMenu()?.nativeElement;
    if (!anchor || !menuEl) return;

    const rect = rectInPage(anchor);
    const menuRect = rectInPage(menuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const menuHeight = menuRect.height || ESTIMATED_LIST_HEIGHT;
    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = menuHeight > spaceBelow && spaceAbove > spaceBelow;
    const top = flipUp ? Math.max(8, rect.top - 4 - Math.min(menuHeight, spaceAbove)) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const menuWidth = Math.max(rect.width, menuRect.width || rect.width);
    const start = Math.min(Math.max(8, triggerStart), Math.max(8, width - 8 - menuWidth));

    this.targetPlace.set({ top, start, width: rect.width });
    this.targetPlaced.set(true);
  }

  private targetAnchorEl(): HTMLElement | null {
    const inputEl = this.targetInput()?.nativeElement;
    if (!inputEl) return null;
    return inputEl.parentElement ?? inputEl;
  }

  private scrollActiveTarget(index: number): void {
    this.targetOptionBtns()[index]?.nativeElement.scrollIntoView({ block: 'nearest' });
  }

  private clearPreview(): void {
    if (this.previewTimer !== null) clearTimeout(this.previewTimer);
    this.previewTimer = null;
    this.previewSeq++;
    this.previewLoading.set(false);
    this.previewData.set(null);
    this.previewError.set(null);
    this.previewHidden.set(false);
  }

  private async loadPreview(target: ShareTarget): Promise<void> {
    this.clearPreview();
    this.previewLoading.set(true);
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      void this.fetchPreview(target);
    }, 600);
  }
  private async fetchPreview(target: ShareTarget): Promise<void> {
    const api = this.currentApi;
    if (!api?.preview) return;
    const seq = ++this.previewSeq;
    const modalSeq = this.openSeq;
    this.previewLoading.set(true);
    this.previewData.set(null);
    this.previewError.set(null);
    this.previewHidden.set(false);
    try {
      const res = await api.preview(target.type, target.id);
      if (
        seq !== this.previewSeq ||
        modalSeq !== this.openSeq ||
        this.selectedTarget()?.id !== target.id
      ) {
        return;
      }
      this.previewData.set(res);
    } catch (error) {
      if (
        seq !== this.previewSeq ||
        modalSeq !== this.openSeq ||
        this.selectedTarget()?.id !== target.id
      ) {
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        this.previewHidden.set(true);
        return;
      }
      this.previewError.set(this.translateError(errorCodeOf(error)));
    } finally {
      if (seq === this.previewSeq) {
        this.previewLoading.set(false);
      }
    }
  }

  protected reasonText(code: string): string {
    return this.transloco.translate(reasonKey(code));
  }

  private translateError(code: string | null): string {
    return this.transloco.translate(errorKey(code));
  }
}

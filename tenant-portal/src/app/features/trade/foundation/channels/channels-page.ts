import {
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerRefresh } from '@ng-icons/tabler-icons';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FacetSearch } from '../../../../shared/ui/facet-search/facet-search';
import type { SearchFacet, SearchField } from '../../../../shared/ui/facet-search/facet-search.model';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { branchGrants } from '../../shared/trade-access';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import type { Channel, ChannelStatus, ChannelType } from '../../shared/trade-foundation.model';
import { CHANNEL_TYPE_KEY } from '../../shared/trade-labels';
import { ChannelModal } from './channel-modal/channel-modal';
import { ChannelTable } from './channel-table/channel-table';
import {
  channelErrorKey,
  countChannels,
  getChannel,
  listChannelRows,
  patchChannel,
} from './channels.api';
import {
  CHANNEL_LIMITS,
  CHANNEL_TYPES,
  type ChannelCountFilter,
  type ChannelListQuery,
  type ChannelRow,
  type ChannelStatusCounts,
  type ChannelStatusFilter,
} from './channels.model';

const LIMIT_PLACEHOLDER = '__LIMIT_TOTAL__';

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

interface LimitedParts {
  before: string;
  hasTotal: boolean;
  after: string;
}

function parseStatusFilter(raw: string | undefined): ChannelStatusFilter {
  if (raw === 'inactive' || raw === 'all') return raw;
  return 'active';
}

function parseTypesParam(raw: string | undefined): ChannelType[] {
  if (!raw) return [];
  const valid = new Set<string>(CHANNEL_TYPES);
  const seen = new Set<ChannelType>();
  const result: ChannelType[] = [];

  for (const part of raw.split(',')) {
    const token = part.trim() as ChannelType;
    if (valid.has(token) && !seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}

@Component({
  selector: 'app-channels-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    FacetSearch,
    FullState,
    StepFilter,
    UnsavedDialog,
    ChannelTable,
    ChannelModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-channels', alias: 'tradeChannels' }),
    provideIcons({ tablerPlus, tablerRefresh }),
  ],
  templateUrl: './channels-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ChannelsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly channelModal = viewChild(ChannelModal);
  private readonly deactivateDialog = viewChild.required<ConfirmDialog>('deactivateDialog');
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');

  /** Bound from `?status=` (absent = active). */
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  /** Bound from `?type=` (comma list). */
  readonly typeParam = input<string | undefined>(undefined, { alias: 'type' });
  /** Bound from `?q=` (text). */
  readonly qParam = input<string | undefined>(undefined, { alias: 'q' });
  /** Bound from `?channel=` (`new` or id). */
  readonly channelParam = input<string | undefined>(undefined, { alias: 'channel' });

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => this.hasCompanyGrant('trade.items.read'));
  protected readonly canManage = computed(
    () => !this.forbidden() && this.hasCompanyGrant('trade.items.manage'),
  );
  protected readonly limits = CHANNEL_LIMITS;

  protected readonly rows = signal<readonly ChannelRow[]>([]);
  protected readonly totalRows = signal(0);
  protected readonly statusCounts = signal<ChannelStatusCounts>({
    ACTIVE: 0,
    INACTIVE: 0,
    total: 0,
  });
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busyChannelId = signal<string | null>(null);
  protected readonly deactivateName = signal('');

  private lastCompanyId: string | null = null;
  private lastFilterKey = '';
  private pendingCompanyReset = false;
  private loadSeq = 0;
  private suppressModalCloseNav = false;

  protected readonly statusFilter = computed<ChannelStatusFilter>(() =>
    parseStatusFilter(this.statusParam()),
  );
  protected readonly selectedTypes = computed<ChannelType[]>(() =>
    parseTypesParam(this.typeParam()),
  );
  protected readonly searchQuery = computed(() => this.qParam()?.trim() ?? '');

  protected readonly modalOpen = computed(() => !!this.channelParam()?.trim());
  protected readonly activeChannelId = computed<string | null>(() => {
    const param = this.channelParam()?.trim();
    if (!param || param === 'new') return null;
    return param;
  });

  protected readonly companyName = computed(() => {
    const comp = this.scope.company();
    if (!comp) return '';
    return this.language() === 'ar' ? comp.nameAr : comp.nameEn;
  });

  protected readonly searchFields = computed<SearchField[]>(() => {
    this.i18n();
    this.language();
    return [
      {
        id: 'text',
        label: this.transloco.translate('tradeChannels.facets.text'),
        hint: this.transloco.translate('tradeChannels.facets.textHint'),
      },
      {
        id: 'type',
        label: this.transloco.translate('tradeChannels.facets.type'),
        hint: this.transloco.translate('tradeChannels.facets.typeHint'),
        options: CHANNEL_TYPES.map((type) => ({
          value: type,
          label: this.transloco.translate(CHANNEL_TYPE_KEY[type]),
        })),
      },
    ];
  });

  protected readonly facets = computed<SearchFacet[]>(() => {
    this.i18n();
    this.language();
    const next: SearchFacet[] = [];
    const q = this.searchQuery();
    if (q) {
      next.push({
        field: 'text',
        label: this.transloco.translate('tradeChannels.facets.text'),
        values: [{ value: q, label: q }],
      });
    }
    const types = this.selectedTypes();
    if (types.length > 0) {
      next.push({
        field: 'type',
        label: this.transloco.translate('tradeChannels.facets.type'),
        values: types.map((type) => ({
          value: type,
          label: this.transloco.translate(CHANNEL_TYPE_KEY[type]),
        })),
      });
    }
    return next;
  });

  protected readonly hasSearchFilter = computed(
    () => this.searchQuery().length > 0 || this.selectedTypes().length > 0,
  );

  protected readonly hasAnyChannels = computed(
    () => this.hasSearchFilter() || this.statusCounts().total > 0,
  );

  protected readonly statusSteps = computed<StepOption[]>(() => {
    this.i18n();
    this.language();
    const counts = this.statusCounts();

    return [
      {
        id: 'all',
        label: this.transloco.translate('tradeChannels.steps.all'),
        count: counts.total,
      },
      {
        id: 'active',
        label: this.transloco.translate('tradeChannels.steps.active'),
        count: counts.ACTIVE,
      },
      {
        id: 'inactive',
        label: this.transloco.translate('tradeChannels.steps.inactive'),
        count: counts.INACTIVE,
      },
    ];
  });

  protected readonly limitedParts = computed<LimitedParts>(() => {
    this.i18n();
    this.language();
    const raw = this.transloco.translate('tradeChannels.toolbar.limited', {
      total: LIMIT_PLACEHOLDER,
    });
    const idx = raw.indexOf(LIMIT_PLACEHOLDER);
    if (idx < 0) {
      return { before: raw, hasTotal: false, after: '' };
    }
    return {
      before: raw.slice(0, idx),
      hasTotal: true,
      after: raw.slice(idx + LIMIT_PLACEHOLDER.length),
    };
  });

  constructor() {
    effect(() => {
      const allowed = this.canRead();
      const companyId = this.scope.company()?.id ?? '';
      const status = this.statusFilter();
      const search = this.searchQuery();
      const types = this.selectedTypes();
      const filterKey = `${companyId}|${status}|${search}|${types.join(',')}`;

      if (!allowed) {
        this.lastCompanyId = companyId || null;
        this.lastFilterKey = '';
        untracked(() => {
          this.loadSeq += 1;
          this.rows.set([]);
          this.totalRows.set(0);
          this.statusCounts.set({ ACTIVE: 0, INACTIVE: 0, total: 0 });
          this.loading.set(false);
          this.loadFailed.set(false);
        });
        return;
      }

      if (this.lastCompanyId === null) {
        this.lastCompanyId = companyId;
        this.lastFilterKey = filterKey;
        untracked(() => {
          this.forbidden.set(false);
          void this.loadChannels();
        });
        return;
      }

      if (this.lastCompanyId !== companyId) {
        this.lastCompanyId = companyId;
        this.lastFilterKey = `${companyId}|active||`;
        untracked(() => {
          this.forbidden.set(false);
          void this.handleCompanyChanged(companyId);
        });
        return;
      }

      if (this.pendingCompanyReset || filterKey === this.lastFilterKey) {
        return;
      }

      this.lastFilterKey = filterKey;
      untracked(() => {
        this.forbidden.set(false);
        void this.loadChannels();
      });
    });
  }

  async canDeactivate(): Promise<boolean> {
    return (await this.channelModal()?.canDeactivate()) ?? true;
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onModalForbidden(): void {
    this.forbidden.set(true);
  }

  protected reload(): void {
    void this.loadChannels();
  }

  protected openNew(): void {
    if (!this.canManage()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { channel: 'new' },
      queryParamsHandling: 'merge',
    });
  }

  protected openChannel(row: ChannelRow): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { channel: row.id },
      queryParamsHandling: 'merge',
    });
  }

  protected onStatusChange(next: string): void {
    const status = parseStatusFilter(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: status === 'active' ? null : status },
      queryParamsHandling: 'merge',
    });
  }

  protected onFacetsChange(nextFacets: SearchFacet[]): void {
    const textFacet = nextFacets.find((facet) => facet.field === 'text');
    const latestText = textFacet?.values.at(-1)?.value.trim() ?? '';

    const validTypeSet = new Set<string>(CHANNEL_TYPES);
    const typeFacet = nextFacets.find((facet) => facet.field === 'type');
    const nextTypes: ChannelType[] = [];
    for (const option of typeFacet?.values ?? []) {
      if (validTypeSet.has(option.value) && !nextTypes.includes(option.value as ChannelType)) {
        nextTypes.push(option.value as ChannelType);
      }
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: latestText || null,
        type: nextTypes.length > 0 ? nextTypes.join(',') : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected clearSearch(): void {
    const counts = this.statusCounts();
    const statusParam = !this.hasSearchFilter()
      ? counts.ACTIVE > 0 && this.statusFilter() === 'inactive'
        ? null
        : 'all'
      : this.statusFilter() === 'inactive'
        ? null
        : undefined;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: null,
        type: null,
        ...(statusParam !== undefined ? { status: statusParam } : {}),
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onModalSaved(channel: Channel): void {
    if (this.channelParam() === 'new') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { channel: channel.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    void this.loadChannels();
  }

  protected onModalClosed(): void {
    if (this.suppressModalCloseNav) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { channel: null },
      queryParamsHandling: 'merge',
    });
  }

  protected async onToggleStatus(row: ChannelRow): Promise<void> {
    if (!this.canManage() || this.busyChannelId()) return;
    const nextStatus: ChannelStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (nextStatus === 'INACTIVE') {
      this.deactivateName.set(row.name);
      const confirmed = await this.deactivateDialog().open();
      if (!confirmed) return;
    }

    await this.applyRowStatusChange(row.id, row.name, row.version, nextStatus, false);
  }

  private async applyRowStatusChange(
    channelId: string,
    channelName: string,
    version: number,
    nextStatus: ChannelStatus,
    isRetryAfterConflict: boolean,
  ): Promise<void> {
    const ctx = tradeContext(this.scope, 'COMPANY');
    const companyAtStart = ctx.companyId;
    this.busyChannelId.set(channelId);

    try {
      await patchChannel(ctx, channelId, version, { status: nextStatus }, newIdempotencyKey());
      if (this.scope.company()?.id !== companyAtStart) return;
      const toastKey =
        nextStatus === 'ACTIVE' ? 'tradeChannels.toast.activated' : 'tradeChannels.toast.deactivated';
      this.notify.success(this.transloco.translate(toastKey, { name: channelName }));
      await this.loadChannels();
    } catch (error) {
      if (this.scope.company()?.id !== companyAtStart) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (
        !isRetryAfterConflict &&
        error instanceof ApiError &&
        error.status === 409 &&
        errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION'
      ) {
        this.busyChannelId.set(null);
        await this.resolveRowConflict(channelId, channelName, nextStatus);
        return;
      }
      this.notify.error(this.transloco.translate(channelErrorKey(error)));
    } finally {
      this.busyChannelId.set(null);
    }
  }

  private async resolveRowConflict(
    channelId: string,
    channelName: string,
    nextStatus: ChannelStatus,
  ): Promise<void> {
    const choice = await this.conflictDialog().open();
    if (choice === 'cancel') return;
    if (choice === 'save') {
      await this.loadChannels();
      return;
    }

    const ctx = tradeContext(this.scope, 'COMPANY');
    this.busyChannelId.set(channelId);
    try {
      const fresh = await getChannel(ctx, channelId);
      if (fresh.status === nextStatus) {
        const toastKey =
          nextStatus === 'ACTIVE'
            ? 'tradeChannels.toast.activated'
            : 'tradeChannels.toast.deactivated';
        this.notify.success(this.transloco.translate(toastKey, { name: fresh.name }));
        await this.loadChannels();
        return;
      }
      await this.applyRowStatusChange(fresh.id, fresh.name, fresh.version, nextStatus, true);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      this.notify.error(this.transloco.translate(channelErrorKey(error)));
    } finally {
      this.busyChannelId.set(null);
    }
  }

  private async handleCompanyChanged(targetCompanyId: string): Promise<void> {
    const modal = this.channelModal();
    if (modal?.isDirty()) {
      this.notify.warning(this.transloco.translate('tradeChannels.toast.companyChanged'));
    }
    if (modal) {
      this.suppressModalCloseNav = true;
      modal.forceClose();
      this.suppressModalCloseNav = false;
    }

    const hasQueryParams =
      this.statusParam() !== undefined ||
      this.typeParam() !== undefined ||
      this.qParam() !== undefined ||
      this.channelParam() !== undefined;

    if (hasQueryParams) {
      this.pendingCompanyReset = true;
      try {
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            status: null,
            type: null,
            q: null,
            channel: null,
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      } finally {
        this.pendingCompanyReset = false;
      }
    }

    if (this.scope.company()?.id !== targetCompanyId) return;
    void this.loadChannels({ status: 'active', search: '', types: [] });
  }

  private hasCompanyGrant(key: string): boolean {
    const grants = runInInjectionContext(this.injector, () => branchGrants(key));
    if (grants === 'ALL') return true;
    const company = this.scope.company();
    if (!company?.id) return grants.size > 0;
    const branchId = company.branches.length > 0 ? this.scope.branch()?.id : undefined;
    if (branchId && grants.has(branchId)) return true;
    return !branchId && company.branches.some((branch) => grants.has(branch.id));
  }

  private async loadChannels(override?: {
    status: ChannelStatusFilter;
    search: string;
    types: readonly ChannelType[];
  }): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.loadSeq;
    const ctx = tradeContext(this.scope, 'COMPANY');
    const statusFilter = override ? override.status : this.statusFilter();
    const search = override ? override.search : this.searchQuery();
    const types = override ? override.types : this.selectedTypes();

    const status: ChannelStatus | undefined =
      statusFilter === 'active' ? 'ACTIVE' : statusFilter === 'inactive' ? 'INACTIVE' : undefined;

    const countFilter: ChannelCountFilter = {
      search: search || undefined,
      channelType: types.length > 0 ? types : undefined,
    };
    const listQuery: ChannelListQuery = {
      ...countFilter,
      status,
      sort: 'createdAt',
      direction: 'desc',
      page: 1,
      limit: CHANNEL_LIMITS.page,
    };

    this.loading.set(true);
    this.loadFailed.set(false);
    this.forbidden.set(false);

    try {
      const [result, counts] = await Promise.all([
        listChannelRows(ctx, listQuery),
        countChannels(ctx, countFilter),
      ]);
      if (seq !== this.loadSeq) return;
      this.rows.set(result.items);
      this.totalRows.set(result.total);
      this.statusCounts.set(counts);
      this.loading.set(false);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.rows.set([]);
      this.totalRows.set(0);
      this.statusCounts.set({ ACTIVE: 0, INACTIVE: 0, total: 0 });
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
        return;
      }
      this.loadFailed.set(true);
      this.notify.error(this.transloco.translate(channelErrorKey(error)));
    }
  }
}

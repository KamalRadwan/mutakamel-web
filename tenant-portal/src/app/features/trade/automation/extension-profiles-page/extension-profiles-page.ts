import { Component, Injector, computed, inject, input, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerEdit,
  tablerEye,
  tablerInbox,
  tablerPlus,
  tablerPuzzle,
  tablerRefresh,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ApiError, type TradeContext, tradeContext } from '../../shared/trade-api';
import { formatDate } from '../../shared/trade-format';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ScopeChip } from '../automation-shared/scope-chip/scope-chip';
import { ExtensionProfileModal } from '../extension-profile-modal/extension-profile-modal';
import { getProfileCounts, listProfiles } from '../extensions.api';
import type { ScopeTarget } from '../automation-shared/automation.model';
import type { ExtensionProfile, ExtensionProfileDraftResult } from '../extensions.model';
import { TARGET_CODES } from '../extensions.registry';
import {
  EXTENSION_PERMISSIONS,
  hasExtensionReadGrant,
  hasExtensionScopeGrant,
  isForbiddenError,
  parseExtensionScope,
} from './extension-access';

type TargetCode = ExtensionProfile['targetCode'];
type ProfileStatus = ExtensionProfile['status'];

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES: readonly number[] = [12, 24, 48, 96];

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(raw: string | undefined): number {
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseStatus(raw: string | undefined): 'DRAFT' | 'ACTIVE' | null {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'DRAFT' || upper === 'ACTIVE') return upper;
  return null;
}

function parseTarget(raw: string | undefined): 'all' | TargetCode {
  const upper = raw?.trim().toUpperCase();
  if (upper && (TARGET_CODES as readonly string[]).includes(upper)) {
    return upper as TargetCode;
  }
  return 'all';
}

@Component({
  selector: 'app-extension-profiles-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    AutomationBadge,
    Button,
    FullState,
    Pagination,
    ScopeChip,
    StepFilter,
    ExtensionProfileModal,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-automation', alias: 'automation' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-auto-extensions', alias: 'extensions' }),
    provideIcons({
      tablerAlertTriangle,
      tablerEdit,
      tablerEye,
      tablerInbox,
      tablerPlus,
      tablerPuzzle,
      tablerRefresh,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './extension-profiles-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ExtensionProfilesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly createModal = viewChild.required(ExtensionProfileModal);

  readonly targetParam = input<string | undefined>(undefined, { alias: 'target' });
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  readonly scopeParam = input<string | undefined>(undefined, { alias: 'scope' });

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasExtensionReadGrant(this.injector));
  protected readonly pageSizes = [...PAGE_SIZES];
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly search = signal('');
  private readonly refreshTick = signal(0);

  protected readonly scopeTarget = computed<ScopeTarget>(() => parseExtensionScope(this.scopeParam()));
  protected readonly ctx = computed<TradeContext>(() => tradeContext(this.scopeState, this.scopeTarget()));

  protected readonly selectedTarget = linkedSignal<string | undefined, 'all' | TargetCode>({
    source: () => this.targetParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parseTarget(param);
      return previous?.value ?? parseTarget(param);
    },
  });

  protected readonly statusFilter = linkedSignal<string | undefined, 'DRAFT' | 'ACTIVE' | null>({
    source: () => this.statusParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parseStatus(param);
      return previous?.value ?? parseStatus(param);
    },
  });

  protected readonly page = linkedSignal<string | undefined, number>({
    source: () => this.pageParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePositiveInt(param, DEFAULT_PAGE);
      return previous?.value ?? parsePositiveInt(param, DEFAULT_PAGE);
    },
  });

  protected readonly pageSize = linkedSignal<string | undefined, number>({
    source: () => this.sizeParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parsePageSize(param);
      return previous?.value ?? parsePageSize(param);
    },
  });

  private readonly countsResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden()) return undefined;
      return {
        ctx: this.ctx(),
        status: this.statusFilter() ?? undefined,
        tick: this.refreshTick(),
      };
    },
    loader: ({ params }) =>
      getProfileCounts(
        params.status ? { status: params.status as ProfileStatus } : {},
        params.ctx,
      ).catch((error) => {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
        }
        return null;
      }),
  });

  private readonly listResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden()) return undefined;
      return {
        ctx: this.ctx(),
        targetCode: this.selectedTarget() === 'all' ? undefined : this.selectedTarget(),
        status: this.statusFilter() ?? undefined,
        page: this.page(),
        limit: this.pageSize(),
        tick: this.refreshTick(),
      };
    },
    loader: async ({ params }) => {
      try {
        return await listProfiles(
          {
            page: params.page,
            limit: params.limit,
            ...(params.targetCode ? { targetCode: params.targetCode as TargetCode } : {}),
            ...(params.status ? { status: params.status as ProfileStatus } : {}),
          },
          params.ctx,
        );
      } catch (error) {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
          throw error;
        }
        this.notify.error(this.resolveErrorMessage(error));
        throw error;
      }
    },
  });

  private readonly listForbidden = computed(
    () => this.listResource.status() === 'error' && isForbiddenError(this.listResource.error()),
  );
  protected readonly isForbidden = computed(
    () => !this.canRead() || this.forbidden() || this.listForbidden(),
  );
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasExtensionScopeGrant(this.injector, this.scopeState, EXTENSION_PERMISSIONS.manage, this.scopeTarget()),
  );

  protected readonly listLoading = computed(() => this.listResource.isLoading());
  protected readonly listFailed = computed(() => !!this.listResource.error() && !this.listForbidden());

  private readonly rawItems = computed<ExtensionProfile[]>(() =>
    this.listResource.hasValue() ? this.listResource.value().items : [],
  );

  protected readonly items = computed<ExtensionProfile[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rawItems();
    return this.rawItems().filter((row) => row.code.toLowerCase().includes(q));
  });

  protected readonly totalItems = computed(() =>
    this.listResource.hasValue() ? this.listResource.value().total : 0,
  );

  protected readonly hasFilters = computed(
    () =>
      this.search().trim().length > 0 ||
      this.statusFilter() !== null ||
      this.selectedTarget() !== 'all',
  );

  protected readonly targetSteps = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.countsResource.hasValue() ? this.countsResource.value() : null;
    const byTarget = (counts && 'byTarget' in counts ? counts.byTarget : null) as
      | Partial<Record<TargetCode, number>>
      | null;
    const total =
      counts && 'total' in counts && typeof counts.total === 'number'
        ? counts.total
        : byTarget
          ? Object.values(byTarget).reduce((acc, n) => acc + (n ?? 0), 0)
          : null;

    return [
      {
        id: 'all',
        label: this.transloco.translate('extensions.list.steps.all'),
        count: total,
      },
      ...TARGET_CODES.map((target) => ({
        id: target,
        label: this.transloco.translate(`extensions.targets.${target}`),
        count: byTarget ? (byTarget[target] ?? 0) : null,
      })),
    ];
  });

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    const target = this.selectedTarget();
    this.createModal().open(target === 'all' ? undefined : target);
  }

  protected reload(): void {
    if (this.isForbidden()) return;
    this.refreshTick.update((n) => n + 1);
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected toggleStatus(next: 'DRAFT' | 'ACTIVE'): void {
    const resolved = this.statusFilter() === next ? null : next;
    this.statusFilter.set(resolved);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: resolved,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setTarget(next: string): void {
    const resolved = parseTarget(next);
    if (resolved === this.selectedTarget()) return;
    this.selectedTarget.set(resolved);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        target: resolved === 'all' ? null : resolved,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(next: number): void {
    const clamped = Math.max(DEFAULT_PAGE, next);
    if (clamped === this.page()) return;
    this.page.set(clamped);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: clamped === DEFAULT_PAGE ? null : clamped,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(next: number): void {
    if (!PAGE_SIZES.includes(next) || next === this.pageSize()) return;
    this.pageSize.set(next);
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: next === DEFAULT_PAGE_SIZE ? null : next,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    this.search.set('');
    this.statusFilter.set(null);
    this.selectedTarget.set('all');
    this.page.set(DEFAULT_PAGE);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        target: null,
        status: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected openProfile(row: ExtensionProfile): void {
    const scope = row.scopeTarget === 'TENANT' ? 'tenant' : undefined;
    void this.router.navigate(['/trade/automation/extension-profiles', row.id], {
      ...(scope ? { queryParams: { scope } } : {}),
    });
  }

  protected onRowKeydown(event: KeyboardEvent, row: ExtensionProfile): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openProfile(row);
  }

  protected onProfileCreated(created: ExtensionProfileDraftResult): void {
    this.reload();
    const scope = created.scopeTarget === 'TENANT' ? 'tenant' : undefined;
    void this.router.navigate(['/trade/automation/extension-profiles', created.id], {
      ...(scope ? { queryParams: { scope } } : {}),
    });
  }

  protected actionsFor(_row: ExtensionProfile): ActionItem[] {
    this.i18n();
    return [
      {
        id: 'open',
        title: this.transloco.translate('extensions.list.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('extensions.list.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
    ];
  }

  protected menuLabelFor(row: ExtensionProfile): string {
    this.i18n();
    return this.transloco.translate('extensions.list.actions.menuLabel', { code: row.code });
  }

  protected onRowAction(row: ExtensionProfile, _selection: ActionSelection): void {
    this.openProfile(row);
  }

  protected dateText(iso: string | null | undefined): string {
    if (!iso) return this.transloco.translate('extensions.list.table.none');
    return formatDate(iso, this.language());
  }

  private resolveErrorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) {
      return this.transloco.translate('extensions.errors.network');
    }
    const reason = error.details?.['reason']?.[0];
    const candidates: string[] = [];
    if (reason) {
      candidates.push(`automation.errors.${error.code}.${reason}`);
      candidates.push(`extensions.errors.${error.code}.${reason}`);
    }
    candidates.push(`automation.errors.${error.code}`);
    candidates.push(`extensions.errors.${error.code}`);
    candidates.push(`tradeShared.errors.${error.code.replaceAll('.', '_')}`);
    for (const key of candidates) {
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
    }
    return this.transloco.translate('extensions.errors.generic');
  }
}

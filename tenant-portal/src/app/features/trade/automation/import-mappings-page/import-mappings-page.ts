import { Component, Injector, computed, inject, input, resource, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuilding,
  tablerInbox,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerTable,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ScopeChip } from '../automation-shared/scope-chip/scope-chip';
import { ImportMappingModal } from '../import-mapping-modal/import-mapping-modal';
import { listMappings } from '../imports.api';
import type { ImportMapping } from '../imports.model';
import {
  IMPORT_PERMISSIONS,
  hasImportReadGrant,
  hasImportScopeGrant,
  importContext,
  isForbiddenError,
} from '../mapping-rows/import-access';
import {
  currentScopeTarget,
  formatDateTime,
  isScopeMismatchError,
  isTenantScope,
  normalizePage,
  targetLabel,
} from '../mapping-rows/mapping-rows';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES = [12, 24, 48, 96];

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

@Component({
  selector: 'app-import-mappings-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    FullState,
    Pagination,
    AutomationBadge,
    ScopeChip,
    ImportMappingModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-auto-imports', alias: 'imports' },
      { scope: 'trade-automation', alias: 'automation' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      'settings',
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerBuilding,
      tablerInbox,
      tablerPlus,
      tablerRefresh,
      tablerSearch,
      tablerTable,
      tablerX,
    }),
  ],
  templateUrl: './import-mappings-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ImportMappingsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly createModal = viewChild(ImportMappingModal);

  protected readonly lang = inject(LanguageState).current;
  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasImportReadGrant(this.injector));
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });

  protected readonly search = signal('');
  private readonly refreshTick = signal(0);

  protected readonly statusFilter = computed<'ALL' | 'DRAFT' | 'ACTIVE'>(() => {
    const raw = this.statusParam()?.toUpperCase();
    return raw === 'DRAFT' || raw === 'ACTIVE' ? raw : 'ALL';
  });

  protected readonly page = computed(() => parsePositiveInt(this.pageParam(), DEFAULT_PAGE));

  protected readonly pageSize = computed(() => {
    const parsed = parsePositiveInt(this.sizeParam(), DEFAULT_PAGE_SIZE);
    return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
  });

  protected readonly scopeTarget = computed(() => currentScopeTarget(this.scopeState));
  protected readonly tenantBlockedByScope = computed(() => isTenantScope(this.scopeState));

  private readonly mappingsResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden() || this.tenantBlockedByScope()) return undefined;
      return {
        ctx: importContext(this.scopeState),
        status: this.statusFilter(),
        tick: this.refreshTick(),
      };
    },
    loader: async ({ params }) => {
      // The backend list has no search; one page of 100 is searched and paged here.
      const res = await listMappings(
        {
          ...(params.status !== 'ALL' ? { status: params.status } : {}),
          limit: 100,
        },
        params.ctx,
      );
      return normalizePage<ImportMapping>(res, 1, 100).items;
    },
  });

  private readonly listForbidden = computed(
    () => this.mappingsResource.status() === 'error' && isForbiddenError(this.mappingsResource.error()),
  );
  protected readonly isForbidden = computed(
    () => !this.canRead() || this.forbidden() || this.listForbidden(),
  );
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasImportScopeGrant(this.injector, this.scopeState, IMPORT_PERMISSIONS.manage),
  );
  protected readonly canExecute = computed(
    () =>
      !this.isForbidden() &&
      hasImportScopeGrant(this.injector, this.scopeState, IMPORT_PERMISSIONS.execute),
  );

  protected readonly tenantBlocked = computed(
    () => this.tenantBlockedByScope() || isScopeMismatchError(this.mappingsResource.error()),
  );
  protected readonly loading = computed(
    () => !this.isForbidden() && !this.tenantBlocked() && this.mappingsResource.isLoading() && !this.mappingsResource.hasValue(),
  );
  protected readonly refreshing = computed(() => this.mappingsResource.isLoading());
  protected readonly failed = computed(
    () => !this.isForbidden() && !this.tenantBlocked() && !!this.mappingsResource.error(),
  );

  protected readonly filteredMappings = computed<ImportMapping[]>(() => {
    this.i18n();
    const all = this.mappingsResource.hasValue() ? this.mappingsResource.value() : [];
    const status = this.statusFilter();
    const needle = this.search().trim().toLowerCase();

    return all.filter((mapping) => {
      if (status !== 'ALL' && mapping.status !== status) return false;
      if (!needle) return true;
      const codeMatch = mapping.code.toLowerCase().includes(needle);
      const targetMatch = this.targetName(mapping.targetCode).toLowerCase().includes(needle);
      return codeMatch || targetMatch;
    });
  });

  protected readonly total = computed(() => this.filteredMappings().length);

  protected readonly visibleMappings = computed<ImportMapping[]>(() => {
    const items = this.filteredMappings();
    const size = this.pageSize();
    const maxPage = Math.max(1, Math.ceil(items.length / size));
    const safePage = Math.min(this.page(), maxPage);
    const start = (safePage - 1) * size;
    return items.slice(start, start + size);
  });

  protected readonly hasFilters = computed(() => this.statusFilter() !== 'ALL' || this.search().trim() !== '');

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected openCreate(): void {
    if (!this.canManage() || this.tenantBlocked()) return;
    this.createModal()?.open();
  }

  protected onCreated(mapping: ImportMapping): void {
    this.refreshTick.update((n) => n + 1);
    void this.router.navigate(['/trade/automation/import-mappings', mapping.id]);
  }

  protected reload(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    if (this.page() !== 1) {
      this.setPage(1);
    }
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected toggleStatus(status: 'DRAFT' | 'ACTIVE'): void {
    const next = this.statusFilter() === status ? null : status;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: next, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearAllFilters(): void {
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number): void {
    const safe = Math.max(DEFAULT_PAGE, page);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safe === DEFAULT_PAGE ? null : safe },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(size: number): void {
    if (!PAGE_SIZES.includes(size)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { size: size === DEFAULT_PAGE_SIZE ? null : size, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected openMapping(mapping: ImportMapping): void {
    void this.router.navigate(['/trade/automation/import-mappings', mapping.id]);
  }

  protected onRowKeydown(event: KeyboardEvent, mapping: ImportMapping): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openMapping(mapping);
    }
  }

  protected targetName(code: string): string {
    return targetLabel(this.transloco, code);
  }

  protected scopeLabel(mapping: ImportMapping): string {
    const companies = this.scopeState.companies();
    const language = this.lang();
    if (mapping.scopeTarget === 'BRANCH' && mapping.branchId) {
      for (const comp of companies) {
        const branch = comp.branches.find((b) => b.id === mapping.branchId);
        if (branch) {
          return language === 'ar' ? branch.nameAr : branch.nameEn;
        }
      }
      return this.transloco.translate('imports.common.branch');
    }
    const company = companies.find((c) => c.id === mapping.companyId) ?? this.scopeState.company();
    if (company) {
      return language === 'ar' ? company.nameAr : company.nameEn;
    }
    return this.transloco.translate('imports.common.company');
  }

  protected formatUpdatedDate(iso: string | null | undefined): string {
    return formatDateTime(iso, this.lang());
  }

  protected menuActions(mapping: ImportMapping): ActionItem[] {
    this.i18n();
    const isActive = mapping.status === 'ACTIVE';
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('imports.mappings.menu.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('imports.mappings.menu.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
    ];
    if (this.canExecute()) {
      items.push({
        id: 'import',
        title: this.transloco.translate('imports.mappings.menu.importWithMapping'),
        icon: 'tablerFileImport',
        tile: 'bg-icon-teal',
        disabled: !isActive,
        reason: isActive ? undefined : this.transloco.translate('imports.mappings.menu.importNeedsActive'),
      });
    }
    return items;
  }

  protected onMenuSelected(mapping: ImportMapping, selection: ActionSelection): void {
    if (selection.id === 'open' || selection.id === 'edit') {
      this.openMapping(mapping);
    } else if (selection.id === 'import' && this.canExecute() && mapping.status === 'ACTIVE') {
      void this.router.navigate(['/trade/automation/import-runs'], {
        queryParams: { new: '1', mapping: mapping.id },
      });
    }
  }
}

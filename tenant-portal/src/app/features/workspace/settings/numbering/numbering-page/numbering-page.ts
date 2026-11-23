import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding, tablerHash, tablerPlus } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { ApiError, errorMessage } from '../../../../../core/api/api-errors';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { NumberingModal } from '../numbering-modal/numbering-modal';
import { NumberingApi } from '../numbering.api';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { hasTenantWidePermission } from '../../../../../core/auth/tenant-wide-permission';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import {
  CompanyOption,
  NUMBERING_PAGE_SIZES,
  NumberingAccess,
  NumberingListQuery,
  type NumberingPage as NumberingPageResult,
  NumberingSequence,
  companyOption,
  numberingAccess,
} from '../numbering.model';

const ALL_COMPANIES = '__all__';
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;

type SortKey = 'codeAsc' | 'codeDesc' | 'newest' | 'nextDesc';

const SORT_CONFIG: Readonly<Record<SortKey, { sortBy: 'code' | 'nextValue' | 'createdAt'; sortDir: 'ASC' | 'DESC' }>> = {
  codeAsc: { sortBy: 'code', sortDir: 'ASC' },
  codeDesc: { sortBy: 'code', sortDir: 'DESC' },
  newest: { sortBy: 'createdAt', sortDir: 'DESC' },
  nextDesc: { sortBy: 'nextValue', sortDir: 'DESC' },
};

@Component({
  selector: 'app-numbering-page',
  imports: [
    NgIcon,
    FullState,
    TranslocoPipe,
    ActionsMenu,
    Button,
    Dropdown,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    NumberingModal,
  ],
  providers: [provideIcons({ tablerBuilding, tablerHash, tablerPlus })],
  templateUrl: './numbering-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class NumberingPage {
  private readonly api = inject(NumberingApi);
  private readonly auth = inject(AuthSession);
  private readonly lookups = inject(WorkspaceLookups);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly numberingModal = viewChild.required(NumberingModal);

  protected readonly canRead = computed(() => {
    const me = this.auth.me();
    return me?.isTenantOwner === true || me?.permissions.includes('numbering.read') === true;
  });
  protected readonly scopedReader = computed(() =>
    this.canRead() && !hasTenantWidePermission(this.auth.me(), 'numbering.read'));
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = NUMBERING_PAGE_SIZES;
  protected readonly gridColumns = 'grid-cols-ws-numbering-row-actions';

  protected readonly search = signal('');
  private readonly debouncedSearch = signal('');
  protected readonly companyFilter = signal(ALL_COMPANIES);
  protected readonly sortKey = signal<SortKey>('codeAsc');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(NUMBERING_PAGE_SIZES[0]);
  private readonly reloadTick = signal(0);

  private readonly companiesResource = resource({
    params: () => this.auth.me() ? this.api.scopeRevision() : undefined,
    loader: async () => (await this.lookups.allCompanies()).map(companyOption),
  });

  private readonly listQuery = computed<NumberingListQuery>(() => {
    this.reloadTick();
    const sort = SORT_CONFIG[this.sortKey()];
    const query: NumberingListQuery = {
      page: this.page(),
      limit: this.pageSize(),
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
    };
    const term = this.debouncedSearch().trim().slice(0, 200);
    if (term) query.search = term;
    const companyId = this.companyFilter();
    if (companyId !== ALL_COMPANIES) query.companyId = companyId;
    return query;
  });

  private readonly listResource = resource({
    params: () => this.canRead() ? { query: this.listQuery(), scope: this.api.scopeRevision() } : undefined,
    loader: ({ params }) => this.api.listNumbering(params.query),
  });

  protected readonly companies = computed<CompanyOption[]>(() =>
    this.companiesResource.hasValue() ? this.companiesResource.value()
      : (this.auth.me()?.accessibleCompanies ?? []).map((id) => ({
        id, label: this.fallbackCompanyLabel(id), active: true,
      })),
  );

  protected readonly companiesFailed = computed(
    () => !this.companiesResource.isLoading() && Boolean(this.companiesResource.error()),
  );

  protected readonly access = computed<NumberingAccess>(() => numberingAccess(this.auth.me()));

  protected readonly canCreate = computed(() => {
    const access = this.access();
    return access.tenantWideManage || access.manageCompanyIds.length > 0;
  });

  protected readonly isReadOnly = computed(
    () => !this.canCreate(),
  );

  protected readonly loading = this.listResource.isLoading;
  protected readonly forbidden = computed(() => {
    const error = this.listResource.error();
    return !this.canRead() || (error instanceof ApiError && error.status === 403);
  });
  protected readonly loadFailed = computed(
    () => !this.forbidden() && !this.loading() && Boolean(this.listResource.error()),
  );

  private readonly activePage = computed<NumberingPageResult | null>(() => {
    if (this.listResource.hasValue()) {
      return this.listResource.value();
    }
    return null;
  });

  protected readonly rows = computed<NumberingSequence[]>(() => this.activePage()?.data ?? []);
  protected readonly total = computed(() => this.activePage()?.meta.total ?? 0);

  protected readonly hasActiveFilters = computed(
    () => this.companyFilter() !== ALL_COMPANIES || this.search().trim().length > 0,
  );

  protected readonly companyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ALL_COMPANIES, label: this.transloco.translate('wsNumbering.filters.allCompanies') },
      ...this.companies().map((company) => ({
        value: company.id,
        label: company.label,
      })),
    ];
  });

  protected readonly sortOptions = computed<DropdownOption<SortKey>[]>(() => {
    this.i18n();
    const keys: readonly SortKey[] = ['codeAsc', 'codeDesc', 'newest', 'nextDesc'];
    return keys.map((key) => ({
      value: key,
      label: this.transloco.translate(`wsNumbering.sort.${key}`),
    }));
  });

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'open',
        title: this.transloco.translate('wsNumbering.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'copyCode',
        title: this.transloco.translate('wsNumbering.actions.copyCode'),
        icon: 'tablerCopy',
        tile: 'bg-icon-teal',
      },
    ];
  });

  private readonly companyMap = computed(
    () => new Map(this.companies().map((company) => [company.id, company])),
  );

  constructor() {
    effect(() => {
      const error = this.listResource.error();
      if (error instanceof ApiError && error.status === 0) {
        this.notify.connectionLost(errorMessage(error, 'wsNumbering', this.transloco), '');
      } else if (this.listResource.hasValue()) {
        this.notify.connectionRestored();
      }
    });
    effect((onCleanup) => {
      const next = this.search();
      if (next === untracked(() => this.debouncedSearch())) return;
      const timer = setTimeout(() => {
        this.debouncedSearch.set(next);
        this.page.set(1);
      }, SEARCH_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });

    effect(() => {
      if (!this.listResource.hasValue()) return;
      const result = this.listResource.value();
      const maxPage = Math.max(1, result.meta.totalPages);
      const current = untracked(() => this.page());
      if (current > maxPage) {
        this.page.set(maxPage);
      }
    });
  }

  protected reload(): void {
    this.reloadTick.update((n) => n + 1);
    if (this.companiesFailed()) {
      this.companiesResource.reload();
    }
  }

  protected retryCompanies(): void {
    this.companiesResource.reload();
  }

  protected onCompanyFilterChange(value: string): void {
    if (value === this.companyFilter()) return;
    this.companyFilter.set(value);
    this.page.set(1);
  }

  protected onSortChange(value: SortKey): void {
    if (value === this.sortKey()) return;
    this.sortKey.set(value);
    this.page.set(1);
  }

  protected onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.debouncedSearch.set('');
    this.companyFilter.set(ALL_COMPANIES);
    this.page.set(1);
  }

  protected openCreate(): void {
    if (!this.canCreate()) return;
    const activeCompany = this.companyFilter();
    this.numberingModal().openCreate(
      activeCompany !== ALL_COMPANIES ? { companyId: activeCompany } : undefined,
    );
  }

  protected openSequence(sequence: NumberingSequence): void {
    this.numberingModal().openEdit(sequence);
  }

  protected onRowAction(sequence: NumberingSequence, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openSequence(sequence);
      return;
    }
    if (selection.id === 'copyCode') {
      void this.copyCode(sequence.code);
    }
  }

  protected onModalSaved(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected onSequenceNotFound(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected companyLabel(companyId: string | null): string | null {
    if (companyId === null) return null;
    const match = this.companyMap().get(companyId);
    return match?.label ?? this.fallbackCompanyLabel(companyId);
  }

  private fallbackCompanyLabel(id: string): string {
    this.i18n();
    return this.transloco.translate('wsNumbering.companyFallback', { id: id.slice(0, 8) });
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.notify.success(this.transloco.translate('wsNumbering.toast.copied'));
    } catch (error) {
      this.notify.error(errorMessage(error, 'wsNumbering', this.transloco));
    }
  }
}

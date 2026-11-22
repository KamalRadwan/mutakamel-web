import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerArrowDown,
  tablerArrowUp,
  tablerArrowsSort,
  tablerBuilding,
  tablerCheck,
  tablerMinus,
  tablerPlus,
  tablerSearch,
  tablerStar,
  tablerUser,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { PhoneActionSource, PhoneActions } from '../../../../shared/widgets/phone-actions/phone-actions';
import { ApiError } from '../../settings/shared/settings-api';
import { DUE_BADGE, STARS } from '../../shared/record/card/record-card.model';
import {
  DEFAULT_LIST_PAGE_SIZE,
  DEFAULT_LIST_PAGE_SIZES,
  createListPageSize,
} from '../../shared/record/list/page-size';
import {
  canCreateCustomer,
  canDeleteCustomer,
  canUpdateCustomer,
  customerActions,
  customerCity,
  customerEmail,
  customerErrorMessage,
  customerPhone,
  customerPhoneSource,
  customerStatusBadgeClass,
  formatCustomerDate,
  ownerInitials,
  tagBgColor,
  tagTextColor,
} from '../customer-card/customer-card';
import { CustomerSelection, toSelectedCustomerRow } from '../customer-bulk/customer-selection';
import {
  deleteCustomer,
  searchCustomers,
  setCustomerColor,
  setCustomerRating,
} from '../customers.api';
import {
  CardColor,
  CustomerCapabilities,
  CustomerRow,
  CustomerSearchBody,
  CustomerSort,
  CustomerSortField,
  CustomerStatus,
  SearchResponse,
  StatusCounts,
  TagSummary,
  nameIn,
  ownerFullName,
} from '../customers.model';

export type CustomerTableColumnId =
  | 'name'
  | 'status'
  | 'primaryContact'
  | 'phone'
  | 'email'
  | 'city'
  | 'owner'
  | 'source'
  | 'tags'
  | 'rating'
  | 'nextActivity'
  | 'createdAt'
  | 'updatedAt';

interface ColumnDef {
  readonly id: CustomerTableColumnId;
  readonly track: string;
  readonly defaultVisible: boolean;
  readonly locked?: boolean;
  readonly sortField?: CustomerSortField;
  readonly defaultDir?: 'ASC' | 'DESC';
}

export const CUSTOMER_TABLE_COLUMNS: readonly ColumnDef[] = [
  { id: 'name', track: 'minmax(0,1.9fr)', defaultVisible: true, locked: true, sortField: 'displayName', defaultDir: 'ASC' },
  { id: 'status', track: 'minmax(0,1.35fr)', defaultVisible: true, sortField: 'status', defaultDir: 'ASC' },
  { id: 'primaryContact', track: 'minmax(0,1.5fr)', defaultVisible: true },
  { id: 'phone', track: 'minmax(0,2.3fr)', defaultVisible: true },
  { id: 'email', track: 'minmax(0,1.5fr)', defaultVisible: true },
  { id: 'city', track: 'minmax(0,0.9fr)', defaultVisible: true },
  { id: 'owner', track: 'minmax(0,1.3fr)', defaultVisible: true },
  { id: 'source', track: 'minmax(0,1fr)', defaultVisible: true },
  { id: 'tags', track: 'minmax(0,1.4fr)', defaultVisible: true },
  { id: 'rating', track: 'minmax(0,0.8fr)', defaultVisible: true, sortField: 'rating', defaultDir: 'DESC' },
  { id: 'nextActivity', track: 'minmax(0,1.5fr)', defaultVisible: true },
  { id: 'createdAt', track: 'minmax(0,1.1fr)', defaultVisible: true, sortField: 'createdAt', defaultDir: 'DESC' },
  { id: 'updatedAt', track: 'minmax(0,1.1fr)', defaultVisible: false, sortField: 'updatedAt', defaultDir: 'DESC' },
];

const COLUMNS_STORAGE_KEY = 'crm.customers.table.columns';
const VALID_COLUMN_IDS = new Set<CustomerTableColumnId>(CUSTOMER_TABLE_COLUMNS.map((col) => col.id));

function defaultVisibleColumns(): CustomerTableColumnId[] {
  return CUSTOMER_TABLE_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.id);
}

function readStoredColumns(): CustomerTableColumnId[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return defaultVisibleColumns();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultVisibleColumns();
    const set = new Set<CustomerTableColumnId>(['name']);
    for (const item of parsed) {
      if (typeof item === 'string' && VALID_COLUMN_IDS.has(item as CustomerTableColumnId)) {
        set.add(item as CustomerTableColumnId);
      }
    }
    return CUSTOMER_TABLE_COLUMNS.filter((col) => set.has(col.id)).map((col) => col.id);
  } catch {
    return defaultVisibleColumns();
  }
}

function writeStoredColumns(ids: readonly CustomerTableColumnId[]): void {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

interface ChooserPlace {
  top: number;
  end: number;
}

@Component({
  selector: 'app-customer-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, Checkbox, ConfirmDialog, Pagination, PhoneActions],
  providers: [
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerArrowDown,
      tablerArrowUp,
      tablerArrowsSort,
      tablerBuilding,
      tablerCheck,
      tablerMinus,
      tablerPlus,
      tablerSearch,
      tablerStar,
      tablerStarFill,
      tablerUser,
      tablerUsers,
    }),
  ],
  templateUrl: './customer-table.html',
  host: {
    class: 'flex flex-1 shrink-0 flex-col gap-8',
    '(document:click)': 'closeChooserIfOutside($event)',
    '(window:resize)': 'closeChooser()',
  },
})
export class CustomerTable {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  protected readonly selection = inject(CustomerSelection, { optional: true });

  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly headerCheckboxEl = viewChild('pageCb', { read: ElementRef });
  private readonly chooserTrigger = viewChild<ElementRef<HTMLButtonElement>>('chooserTrigger');
  private readonly chooserMenu = viewChild<ElementRef<HTMLElement>>('chooserMenu');

  readonly body = input.required<CustomerSearchBody>();
  readonly ready = input(true);
  readonly status = input<'ALL' | CustomerStatus>('ALL');
  readonly hasFilter = input(false);
  readonly capabilities = input<CustomerCapabilities | null>(null);
  readonly selectionEnabled = input(false);
  readonly page = model(1);
  readonly pageSize = model(DEFAULT_LIST_PAGE_SIZE);
  readonly sort = model<CustomerSort | null>(null);

  readonly view = output<CustomerRow>();
  readonly activities = output<CustomerRow>();
  readonly create = output<void>();
  readonly clearSearch = output<void>();
  readonly countsLoaded = output<StatusCounts>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly stars = STARS;
  protected readonly allColumns = CUSTOMER_TABLE_COLUMNS;
  protected readonly ownerInitials = ownerInitials;
  protected readonly ownerFullName = ownerFullName;

  protected readonly pageSizePref = createListPageSize({
    storageKey: 'customers.table.pageSize',
    sizes: DEFAULT_LIST_PAGE_SIZES,
    defaultSize: DEFAULT_LIST_PAGE_SIZE,
  });
  protected readonly pageSizes = this.pageSizePref.sizes;
  private syncedInitialPageSize = false;
  private lastPageResult: SearchResponse | undefined;
  private readonly refreshTick = signal(0);
  private chooserSeq = 0;
  private lastClickedId: string | null = null;
  private lastShiftKey = false;

  protected readonly showSelection = computed(() => !!this.selection && this.selectionEnabled());
  protected readonly visibleColumnIds = signal<CustomerTableColumnId[]>(readStoredColumns());
  protected readonly visibleColumns = computed(() => {
    const enabled = new Set(this.visibleColumnIds());
    return CUSTOMER_TABLE_COLUMNS.filter((col) => col.locked || enabled.has(col.id));
  });
  protected readonly gridCols = computed(() =>
    [
      ...(this.showSelection() ? ['var(--select-col-w)'] : []),
      ...this.visibleColumns().map((col) => col.track),
      'var(--table-head-h)',
    ].join(' '),
  );

  protected readonly chooserOpen = signal(false);
  protected readonly chooserPlaced = signal(false);
  protected readonly chooserPlace = signal<ChooserPlace>({ top: 0, end: 0 });

  private readonly requestBody = computed<CustomerSearchBody>(() => {
    const base = this.body();
    const activeStatus = this.status();
    const activeSort = this.sort();
    return {
      ...base,
      ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}),
      ...(activeSort ? { sort: activeSort } : {}),
      includeStatusCounts: true,
    };
  });

  private readonly pageResource = resource({
    params: () =>
      this.ready()
        ? {
            query: this.requestBody(),
            page: this.page(),
            pageSize: this.pageSize(),
            tick: this.refreshTick(),
          }
        : undefined,
    loader: async ({ params }) => {
      try {
        const res = await searchCustomers(params.query, params.page, params.pageSize);
        if (res.items.length === 0 && params.page > 1) {
          const target = Math.max(1, Math.min(params.page - 1, res.totalPages || 1));
          if (target !== params.page) {
            this.page.set(target);
            const fallback = await searchCustomers(params.query, target, params.pageSize);
            this.lastPageResult = fallback;
            return fallback;
          }
        }
        this.lastPageResult = res;
        return res;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          this.notify.error(this.transloco.translate('customers.search.invalid'));
          return this.lastPageResult;
        }
        throw error;
      }
    },
  });

  private readonly pageData = linkedSignal<SearchResponse | undefined>(() => this.pageResource.value());

  readonly items = computed(() => this.pageData()?.items ?? []);
  readonly loading = this.pageResource.isLoading;
  protected readonly failed = computed(() => !!this.pageResource.error());

  protected retryLoad(): void {
    this.pageResource.reload();
  }
  protected readonly canCreate = computed(() => canCreateCustomer(this.capabilities()));

  readonly totalCount = linkedSignal<{ total: number; loading: boolean }, number>({
    source: () => ({
      total: this.pageData()?.total ?? 0,
      loading: this.loading(),
    }),
    computation: ({ total, loading }, previous) =>
      loading && total === 0 ? (previous?.value ?? 0) : total,
  });

  protected readonly pageRows = computed(() => this.items().map(toSelectedCustomerRow));
  private readonly currentPageIds = computed(() => this.items().map((item) => item.id));
  protected readonly pageState = computed<'none' | 'some' | 'all'>(() =>
    this.showSelection() && this.selection && this.currentPageIds().length > 0
      ? this.selection.pageState(this.currentPageIds())
      : 'none',
  );

  protected readonly hovered = signal<{ customerId: string; value: number } | null>(null);
  protected readonly deletingName = signal('');
  protected readonly deletingHasSourceLead = signal(false);

  protected readonly phoneSources = computed<Record<string, PhoneActionSource>>(() => {
    const map: Record<string, PhoneActionSource> = {};
    for (const customer of this.items()) {
      map[customer.id] = customerPhoneSource(customer);
    }
    return map;
  });

  constructor() {
    let lastPage = this.page();
    effect(() => {
      const current = this.page();
      if (current === lastPage) return;
      lastPage = current;
      this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
    });

    effect(() => {
      const counts = this.pageResource.value()?.counts;
      if (counts) {
        untracked(() => this.countsLoaded.emit(counts));
      }
    });

    effect(() => {
      const state = this.pageState();
      const inputEl = this.headerCheckboxEl()?.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.indeterminate = state === 'some';
      }
    });

    effect(() => {
      const sizes = this.pageSizePref.sizes();
      const preferred = this.pageSizePref.size();
      const current = this.pageSize();
      untracked(() => {
        if (!this.syncedInitialPageSize) {
          this.syncedInitialPageSize = true;
          if (current === DEFAULT_LIST_PAGE_SIZE && preferred !== current && sizes.includes(preferred)) {
            this.pageSize.set(preferred);
          } else if (!sizes.includes(current)) {
            this.pageSize.set(preferred);
          }
          return;
        }
        if (!sizes.includes(current)) {
          this.pageSize.set(preferred);
        }
      });
    });

    const onScroll = (event: Event) => {
      if (!this.chooserOpen()) return;
      const target = event.target;
      const menuEl = this.chooserMenu()?.nativeElement;
      if (menuEl && target instanceof Node && menuEl.contains(target)) return;
      this.closeChooser();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  refresh(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected canUpdate(customer: CustomerRow): boolean {
    return canUpdateCustomer(this.capabilities(), customer);
  }

  protected canDelete(customer: CustomerRow): boolean {
    return canDeleteCustomer(this.capabilities(), customer);
  }

  protected isColumnVisible(id: CustomerTableColumnId): boolean {
    return this.visibleColumns().some((col) => col.id === id);
  }

  protected toggleColumn(id: CustomerTableColumnId): void {
    const def = CUSTOMER_TABLE_COLUMNS.find((col) => col.id === id);
    if (!def || def.locked) return;
    const current = new Set(this.visibleColumnIds());
    if (current.has(id)) {
      current.delete(id);
      if (def.sortField && this.sortField() === def.sortField) {
        this.sort.set(null);
      }
    } else {
      current.add(id);
    }
    const next = CUSTOMER_TABLE_COLUMNS.filter((col) => col.locked || current.has(col.id)).map((col) => col.id);
    this.visibleColumnIds.set(next);
    writeStoredColumns(next);
  }

  protected toggleChooser(): void {
    if (this.chooserOpen()) {
      this.closeChooser();
      return;
    }
    const seq = ++this.chooserSeq;
    this.chooserPlaced.set(false);
    const triggerEl = this.chooserTrigger()?.nativeElement;
    if (triggerEl) {
      const rect = rectInPage(triggerEl);
      const { width } = viewport();
      const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
      this.chooserPlace.set({
        top: rect.bottom + 4,
        end: rtl ? rect.left : width - rect.right,
      });
    }
    this.chooserOpen.set(true);
    const place = () => this.placeChooser(seq);
    queueMicrotask(place);
    afterNextRender(place, { injector: this.injector });
  }

  protected closeChooser(restoreFocus = false): void {
    this.chooserSeq += 1;
    this.chooserOpen.set(false);
    this.chooserPlaced.set(false);
    if (restoreFocus) {
      this.chooserTrigger()?.nativeElement.focus();
    }
  }

  protected closeChooserIfOutside(event: Event): void {
    if (!this.chooserOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (
      this.chooserTrigger()?.nativeElement.contains(target) ||
      this.chooserMenu()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closeChooser();
  }

  protected onChooserKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeChooser(true);
      return;
    }
    const menuEl = this.chooserMenu()?.nativeElement;
    if (!menuEl) return;
    const buttons = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (!buttons.length) return;
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    }
  }

  private placeChooser(seq: number): void {
    if (seq !== this.chooserSeq || !this.chooserOpen() || this.chooserPlaced()) return;
    const triggerEl = this.chooserTrigger()?.nativeElement;
    const menuEl = this.chooserMenu()?.nativeElement;
    if (!triggerEl || !menuEl) return;

    const rect = rectInPage(triggerEl);
    const menuRect = rectInPage(menuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top =
      belowTop + menuRect.height > height - 8 ? Math.max(8, rect.top - 4 - menuRect.height) : belowTop;
    const rawEnd = rtl ? rect.left : width - rect.right;
    const maxEnd = Math.max(8, width - 8 - menuRect.width);
    const end = Math.min(Math.max(8, rawEnd), maxEnd);

    this.chooserPlace.set({ top, end });
    this.chooserPlaced.set(true);
    menuEl.style.top = `${top}px`;
    menuEl.style.insetInlineEnd = `${end}px`;
    menuEl.classList.remove('invisible');
    menuEl.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  protected sortField(): CustomerSortField | null {
    const active = this.sort();
    if (!active) return null;
    return active.split(':')[0] as CustomerSortField;
  }

  protected sortDir(): 'ASC' | 'DESC' | null {
    const active = this.sort();
    if (!active) return null;
    return active.split(':')[1] as 'ASC' | 'DESC';
  }

  protected ariaSort(field: CustomerSortField | undefined): 'ascending' | 'descending' | 'none' | null {
    if (!field) return null;
    if (this.sortField() !== field) return 'none';
    return this.sortDir() === 'ASC' ? 'ascending' : 'descending';
  }

  protected sortIcon(field: CustomerSortField): string {
    if (this.sortField() !== field) return 'tablerArrowsSort';
    return this.sortDir() === 'ASC' ? 'tablerArrowUp' : 'tablerArrowDown';
  }

  protected toggleSort(col: ColumnDef): void {
    if (!col.sortField) return;
    const field = col.sortField;
    const initialDir = col.defaultDir ?? 'ASC';
    const oppositeDir = initialDir === 'ASC' ? 'DESC' : 'ASC';

    if (this.sortField() !== field) {
      this.sort.set(`${field}:${initialDir}`);
    } else if (this.sortDir() === initialDir) {
      this.sort.set(`${field}:${oppositeDir}`);
    } else {
      this.sort.set(null);
    }
    if (this.page() !== 1) {
      this.page.set(1);
    }
  }

  protected statusBadgeClass(status: CustomerStatus): string {
    return customerStatusBadgeClass(status);
  }

  protected primaryContactText(customer: CustomerRow): string {
    if (customer.profileType !== 'CORPORATE' || !customer.primaryContact) return '';
    const { displayName, jobTitle } = customer.primaryContact;
    return jobTitle ? `${displayName} — ${jobTitle}` : displayName;
  }

  protected phone(customer: CustomerRow): string | null {
    return customerPhone(customer);
  }

  protected email(customer: CustomerRow): string | null {
    return customerEmail(customer);
  }

  protected city(customer: CustomerRow): string {
    return customerCity(customer, this.language());
  }

  protected sourceName(customer: CustomerRow): string {
    return customer.acquisitionSource ? nameIn(customer.acquisitionSource, this.language()) : '';
  }

  protected visibleTags(customer: CustomerRow): TagSummary[] {
    return customer.tags.slice(0, 2);
  }

  protected extraTagsCount(customer: CustomerRow): number {
    return Math.max(0, customer.tags.length - 2);
  }

  protected extraTagsTitle(customer: CustomerRow): string {
    return customer.tags
      .slice(2)
      .map((tag) => tag.name)
      .join(', ');
  }

  protected tagBg(tag: TagSummary): string | null {
    return tagBgColor(tag);
  }

  protected tagText(tag: TagSummary): string | null {
    return tagTextColor(tag);
  }

  protected phoneSource(customer: CustomerRow): PhoneActionSource {
    return this.phoneSources()[customer.id] ?? customerPhoneSource(customer);
  }

  protected dueClass(customer: CustomerRow): string {
    return DUE_BADGE[customer.nextActivity?.bucket ?? 'NONE'];
  }

  protected formatDate(iso: string | null | undefined): string {
    return formatCustomerDate(iso, this.language());
  }

  protected ratingValue(customer: CustomerRow): number {
    const hovered = this.hovered();
    return hovered?.customerId === customer.id ? hovered.value : customer.rating;
  }

  protected async rate(customer: CustomerRow, star: number): Promise<void> {
    if (!this.canUpdate(customer)) return;
    this.hovered.set(null);
    const nextRating = star === customer.rating ? 0 : star;
    const before = this.pageData();
    this.pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === customer.id ? { ...item, rating: nextRating } : item,
            ),
          }
        : current,
    );
    try {
      const saved = await setCustomerRating(customer.id, nextRating);
      this.pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === customer.id ? { ...item, rating: saved.rating, updatedAt: saved.updatedAt } : item,
              ),
            }
          : current,
      );
    } catch (error) {
      this.pageData.set(before);
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.rate.failed'));
    }
  }

  protected actions(customer: CustomerRow) {
    this.i18n();
    return customerActions(
      customer,
      { canUpdate: this.canUpdate(customer), canDelete: this.canDelete(customer) },
      (key) => this.transloco.translate(key),
    );
  }

  protected act(customer: CustomerRow, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.view.emit(customer);
        break;
      case 'color':
        void this.recolor(customer, (selection.value as CardColor | null) ?? null);
        break;
      case 'delete':
        void this.remove(customer);
        break;
    }
  }

  protected onPageSizeChange(size: number): void {
    if (!this.pageSizes().includes(size)) return;
    this.pageSizePref.set(size);
    if (size !== this.pageSize()) {
      this.pageSize.set(size);
    }
  }

  protected isSelected(id: string): boolean {
    return this.showSelection() ? (this.selection?.isSelected(id) ?? false) : false;
  }

  protected togglePage(cb?: Checkbox): void {
    if (!this.showSelection() || !this.selection || !this.pageRows().length) {
      cb?.checked.set(false);
      return;
    }
    const next = this.pageState() !== 'all';
    this.selection.setRows(this.pageRows(), next);
    cb?.checked.set(this.pageState() === 'all');
  }

  protected onRowCheckboxClick(event: MouseEvent): void {
    this.lastShiftKey = event.shiftKey;
    event.stopPropagation();
  }

  protected onRowCheckedChange(customer: CustomerRow, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(customer, shift);
    cb?.checked.set(this.isSelected(customer.id));
  }

  protected onSelectCellClick(event: MouseEvent, customer: CustomerRow, cb?: Checkbox): void {
    event.stopPropagation();
    if (!this.showSelection() || !this.selection) return;
    this.applyRowSelection(customer, event.shiftKey);
    cb?.checked.set(this.isSelected(customer.id));
  }

  protected onRowKeydown(event: KeyboardEvent, customer: CustomerRow): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.code === 'Space') {
      if (!this.showSelection() || !this.selection) return;
      event.preventDefault();
      this.applyRowSelection(customer, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.view.emit(customer);
    }
  }

  private applyRowSelection(customer: CustomerRow, shiftKey: boolean): void {
    if (!this.showSelection() || !this.selection) return;
    const rows = this.items();
    if (shiftKey && this.lastClickedId) {
      const startIndex = rows.findIndex((row) => row.id === this.lastClickedId);
      const endIndex = rows.findIndex((row) => row.id === customer.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        const range = rows.slice(from, to + 1).map(toSelectedCustomerRow);
        this.selection.setRows(range, true);
        this.lastClickedId = customer.id;
        return;
      }
    }
    this.selection.toggle(toSelectedCustomerRow(customer));
    this.lastClickedId = customer.id;
  }

  private async recolor(customer: CustomerRow, cardColor: CardColor | null): Promise<void> {
    if (!this.canUpdate(customer)) return;
    const before = this.pageData();
    this.pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === customer.id ? { ...item, cardColor } : item)),
          }
        : current,
    );
    try {
      const saved = await setCustomerColor(customer.id, cardColor);
      this.pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === customer.id
                  ? { ...item, cardColor: saved.cardColor, updatedAt: saved.updatedAt }
                  : item,
              ),
            }
          : current,
      );
    } catch (error) {
      this.pageData.set(before);
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.color.failed'));
    }
  }

  private async remove(customer: CustomerRow): Promise<void> {
    if (!this.canDelete(customer) || customer.status === 'BLACKLISTED') return;
    this.deletingName.set(customer.displayName);
    this.deletingHasSourceLead.set(Boolean(customer.sourceLeadId));
    if (!(await this.confirmDialog().open())) return;

    const before = this.pageData();
    this.pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => item.id !== customer.id),
            total: Math.max(0, current.total - 1),
          }
        : current,
    );
    try {
      await deleteCustomer(customer.id);
      this.notify.success(this.transloco.translate('customers.delete.done'));
      this.refresh();
    } catch (error) {
      this.pageData.set(before);
      this.notify.error(customerErrorMessage(error, this.transloco, 'customers.delete.failed'));
    }
  }
}

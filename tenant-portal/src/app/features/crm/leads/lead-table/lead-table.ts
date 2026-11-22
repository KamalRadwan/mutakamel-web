import { Component, ElementRef, computed, effect, inject, input, linkedSignal, model, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowsExchange, tablerBuilding, tablerCalendarEvent, tablerMinus, tablerStar, tablerUser } from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { PhoneActionSource, PhoneActionSourceType, PhoneActions } from '../../../../shared/widgets/phone-actions/phone-actions';
import { DEFAULT_LIST_PAGE_SIZE, createListPageSize } from '../../shared/record/list/page-size';
import { listPageSizes } from '../lead-bulk/lead-bulk.api';
import { FALLBACK_PAGE_SIZES, SelectedRow } from '../lead-bulk/lead-bulk.model';
import { LeadSelection, toSelectedRow } from '../lead-bulk/lead-selection';
import { DUE_BADGE, STARS, leadActions } from '../lead-card/lead-card';
import { LeadDisqualify } from '../lead-disqualify/lead-disqualify';
import { leadList } from '../lead-list';
import { LeadLocations } from '../lead-location';
import { LeadSearchBody } from '../lead-search/lead-search.compile';
import { CardColor, LeadNavContext, LeadRow, LeadStage, initials, nameIn, ownerName } from '../leads.model';

export const TABLE_COLUMNS = ['lead', 'contact', 'phone', 'country', 'stage', 'source', 'owner', 'followUp', 'rating'];

const PHONE_SOURCE_TYPE: PhoneActionSourceType = 'LEAD';

@Component({
  selector: 'app-lead-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Checkbox, ConfirmDialog, Pagination, PhoneActions, LeadDisqualify],
  providers: [provideIcons({ tablerArrowsExchange, tablerBuilding, tablerCalendarEvent, tablerMinus, tablerUser, tablerStar, tablerStarFill })],
  templateUrl: './lead-table.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class LeadTable {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly disqualifyDialog = viewChild(LeadDisqualify);
  private readonly headerCheckboxEl = viewChild('pageCb', { read: ElementRef<HTMLElement> });
  protected readonly selection = inject(LeadSelection, { optional: true });
  protected readonly language = inject(LanguageState).current;
  private readonly locations = inject(LeadLocations);

  readonly body = input.required<LeadSearchBody>();
  readonly stages = input.required<LeadStage[]>();
  readonly stage = input('all');
  readonly page = model(1);
  readonly pageSize = model(DEFAULT_LIST_PAGE_SIZE);
  readonly view = output<LeadRow>();
  readonly activities = output<LeadRow>();
  readonly countsChanged = output<void>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly pageSizePref = createListPageSize({
    storageKey: 'leads.table.pageSize',
    sizes: FALLBACK_PAGE_SIZES,
    defaultSize: DEFAULT_LIST_PAGE_SIZE,
    load: listPageSizes,
  });
  protected readonly pageSizes = this.pageSizePref.sizes;
  private syncedInitialPageSize = false;
  private lastClickedId: string | null = null;
  private lastShiftKey = false;

  private readonly refreshTick = signal(0);
  private readonly listBody = computed<LeadSearchBody>(() => {
    this.refreshTick();
    return { ...this.body() };
  });

  protected readonly list = leadList(
    this.listBody,
    this.stages,
    this.stage,
    this.page,
    this.pageSize,
    (nextPage) => this.page.set(nextPage),
    () => this.countsChanged.emit(),
    this.disqualifyDialog,
  );

  private readonly patches = linkedSignal({
    source: () => ({ body: this.body(), stage: this.stage(), tick: this.refreshTick() }),
    computation: () => ({}) as Record<string, Partial<LeadRow>>,
  });

  protected readonly items = computed(() => {
    const patchMap = this.patches();
    const activeStage = this.stage();
    return this.list
      .items()
      .map((item) => {
        const patch = patchMap[item.id];
        if (!patch) return item;
        if (patch.updatedAt && item.updatedAt > patch.updatedAt) return item;
        return { ...item, ...patch };
      })
      .filter((item) => !activeStage || activeStage === 'all' || item.stageId === activeStage);
  });

  private readonly filteredOutCount = computed(() => {
    const patchMap = this.patches();
    const activeStage = this.stage();
    if (!activeStage || activeStage === 'all') return 0;
    let removed = 0;
    for (const item of this.list.items()) {
      const patch = patchMap[item.id];
      if (!patch) continue;
      if (patch.updatedAt && item.updatedAt > patch.updatedAt) continue;
      if ((patch.stageId ?? item.stageId) !== activeStage) removed++;
    }
    return removed;
  });

  protected readonly totalCount = linkedSignal<{ total: number; loading: boolean; filteredOut: number }, number>({
    source: () => ({
      total: this.list.total(),
      loading: this.list.loading(),
      filteredOut: this.filteredOutCount(),
    }),
    computation: ({ total, loading, filteredOut }, previous) =>
      loading && total === 0 ? (previous?.value ?? 0) : Math.max(0, total - filteredOut),
  });

  protected readonly pageRows = computed<SelectedRow[]>(() => this.items().map(toSelectedRow));
  protected readonly currentPageIds = computed<string[]>(() => this.items().map((item) => item.id));
  protected readonly pageState = computed<'none' | 'some' | 'all'>(() =>
    this.selection && this.currentPageIds().length > 0
      ? this.selection.pageState(this.currentPageIds())
      : 'none',
  );

  protected readonly deletingName = signal('');
  protected readonly hovered = signal<{ leadId: string; value: number } | null>(null);
  protected readonly columns = TABLE_COLUMNS;
  protected readonly stars = STARS;
  protected readonly ownerName = ownerName;
  protected readonly initials = initials;

  protected readonly phoneSources = computed<Record<string, PhoneActionSource>>(() => {
    const map: Record<string, PhoneActionSource> = {};
    for (const lead of this.items()) {
      const label =
        lead.leadProfileType === 'CORPORATE'
          ? (lead.companyName ?? lead.displayName)
          : lead.displayName;
      map[lead.id] = { type: PHONE_SOURCE_TYPE, id: lead.id, label };
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
      const state = this.pageState();
      const input = this.headerCheckboxEl()?.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (input) {
        input.indeterminate = state === 'some';
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
  }

  refresh(): void {
    this.patches.set({});
    this.refreshTick.update((n) => n + 1);
  }

  hasItem(id: string): boolean {
    return this.items().some((item) => item.id === id);
  }

  patchItem(row: Partial<LeadRow> & { id: string }): void {
    this.patches.update((current) => ({ ...current, [row.id]: { ...current[row.id], ...row } }));
  }

  navContext(): LeadNavContext {
    const ids = this.items().map((item) => item.id);
    return {
      ids,
      total: ids.length,
      loadMore: null,
    };
  }

  protected stageName(lead: LeadRow) {
    const stage = this.stages().find((item) => item.id === lead.stageId);
    return stage ? nameIn(stage, this.language()) : '';
  }

  protected sourceName(lead: LeadRow) {
    return lead.acquisitionSource ? nameIn(lead.acquisitionSource, this.language()) : '';
  }

  protected location(lead: LeadRow) {
    return this.locations.of(lead.address, this.language());
  }

  protected due(lead: LeadRow) {
    return lead.nextActivity?.bucket ?? 'NONE';
  }

  protected dueClass(lead: LeadRow) {
    return DUE_BADGE[this.due(lead)];
  }

  protected phone(lead: LeadRow): string | null {
    return lead.leadProfileType === 'CORPORATE' ? (lead.primaryContact?.phones[0] ?? null) : lead.primaryMobile;
  }

  protected phoneSource(lead: LeadRow): PhoneActionSource {
    return (
      this.phoneSources()[lead.id] ?? {
        type: PHONE_SOURCE_TYPE,
        id: lead.id,
        label: lead.leadProfileType === 'CORPORATE' ? (lead.companyName ?? lead.displayName) : lead.displayName,
      }
    );
  }

  protected rating(lead: LeadRow) {
    const hovered = this.hovered();
    return hovered?.leadId === lead.id ? hovered.value : lead.rating;
  }

  protected rate(lead: LeadRow, star: number) {
    this.hovered.set(null);
    this.list.rate(lead, star === lead.rating ? 0 : star);
  }

  protected actions(lead: LeadRow) {
    this.i18n();
    return leadActions(lead, this.stages(), this.language(), (key, params) => this.transloco.translate(key, params));
  }

  protected act(lead: LeadRow, selection: ActionSelection) {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.view.emit(lead);
        break;
      case 'activities':
        this.activities.emit(lead);
        break;
      case 'color':
        this.list.recolor(lead, (selection.value as CardColor | null) ?? null);
        break;
      case 'move':
        if (selection.value) this.list.move(lead, selection.value);
        break;
      case 'delete':
        this.remove(lead);
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
    return this.selection?.isSelected(id) ?? false;
  }

  protected togglePage(cb?: Checkbox): void {
    if (!this.selection || !this.pageRows().length) {
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

  protected onRowCheckedChange(lead: LeadRow, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(lead, shift);
    cb?.checked.set(this.isSelected(lead.id));
  }

  protected onSelectCellClick(event: MouseEvent, lead: LeadRow, cb?: Checkbox): void {
    event.stopPropagation();
    if (!this.selection) return;
    this.applyRowSelection(lead, event.shiftKey);
    cb?.checked.set(this.isSelected(lead.id));
  }

  protected onRowKeydown(event: KeyboardEvent, lead: LeadRow): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.code === 'Space') {
      if (!this.selection) return;
      event.preventDefault();
      this.applyRowSelection(lead, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.view.emit(lead);
    }
  }

  private applyRowSelection(lead: LeadRow, shiftKey: boolean): void {
    if (!this.selection) return;
    const rows = this.items();
    if (shiftKey && this.lastClickedId) {
      const startIndex = rows.findIndex((row) => row.id === this.lastClickedId);
      const endIndex = rows.findIndex((row) => row.id === lead.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        const range = rows.slice(from, to + 1).map(toSelectedRow);
        this.selection.setRows(range, true);
        this.lastClickedId = lead.id;
        return;
      }
    }
    this.selection.toggle(toSelectedRow(lead));
    this.lastClickedId = lead.id;
  }

  protected async remove(lead: LeadRow) {
    this.deletingName.set(lead.displayName);
    if (await this.confirmDialog().open()) await this.list.remove(lead);
  }
}

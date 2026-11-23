import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerCloudOff, tablerRefresh } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import type { SparklineSpec } from '../../../../shared/ui/sparkline/sparkline';
import { StatCard } from '../../../../shared/ui/stat-card/stat-card';
import { tradeContext } from '../../shared/trade-api';
import { getDiff, listPriceBooks } from '../pricing.api';
import type {
  PriceBookListItem,
  PriceDiff as PriceDiffData,
  PriceDiffEntry,
  PriceDiffEntryChange,
  PriceDiffPromotionChange,
  PromotionBenefit,
  VersionHead,
} from '../pricing.model';
import { formatMoney, formatQty } from '../../shared/trade-format';
import { formatUnitPrice, isForbiddenError } from '../pricing.service';

export type DiffFilter = 'ALL_CHANGES' | PriceDiffEntryChange;

const OTHER_BOOK_SENTINEL = '__other__';

const ENTRY_BADGE_CLASS: Readonly<Record<PriceDiffEntryChange, string>> = {
  ADDED: 'bg-success-soft text-on-success-soft',
  REMOVED: 'bg-danger-soft text-on-danger-soft',
  INCREASED: 'bg-neutral-soft text-on-neutral-soft',
  DECREASED: 'bg-neutral-soft text-on-neutral-soft',
  UNCHANGED: 'bg-neutral-soft text-text-muted',
};

const PROMO_BADGE_CLASS: Readonly<Record<PriceDiffPromotionChange, string>> = {
  ADDED: 'bg-success-soft text-on-success-soft',
  REMOVED: 'bg-danger-soft text-on-danger-soft',
  MODIFIED: 'bg-neutral-soft text-on-neutral-soft',
  UNCHANGED: 'bg-neutral-soft text-text-muted',
};

@Component({
  selector: 'app-price-diff',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Segmented, StatCard],
  providers: [provideIcons({ tablerArrowRight, tablerCloudOff, tablerRefresh })],
  templateUrl: './price-diff.html',
  host: { class: 'flex flex-col gap-8' },
})
export class PriceDiff {
  private static nextId = 0;
  protected readonly uid = `gov-price-diff-${++PriceDiff.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly scope = inject(ScopeState);
  protected readonly lang = inject(LanguageState).current;

  readonly versionId = input.required<string>();
  readonly bookId = input.required<string>();
  readonly currencyCode = input.required<string>();
  readonly bookVersions = input.required<readonly VersionHead[]>();
  readonly baselineId = model<string | null>(null);
  readonly forbidden = output<void>();

  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly filter = signal<DiffFilter>('ALL_CHANGES');
  protected readonly useOtherBook = signal(false);
  protected readonly otherBooks = signal<readonly PriceBookListItem[]>([]);
  protected readonly loadingOtherBooks = signal(false);

  protected readonly diff = signal<PriceDiffData | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  private readonly reloadTick = signal(0);

  private diffSeq = 0;
  private otherBooksSeq = 0;

  protected readonly sameBookVersions = computed<VersionHead[]>(() => {
    const currentId = this.versionId();
    return this.bookVersions()
      .filter((v) => v.id !== currentId)
      .slice()
      .sort((a, b) => b.versionNumber - a.versionNumber);
  });

  protected readonly defaultSameBookBaselineId = computed<string | null>(() => {
    const candidates = this.sameBookVersions();
    if (candidates.length === 0) return null;
    const live =
      candidates.find((v) => v.status === 'PUBLISHED' && v.supersededAt === null) ??
      candidates.find((v) => v.status === 'SCHEDULED' && v.supersededAt === null) ??
      candidates[0];
    return live?.id ?? null;
  });

  protected readonly selectedPrimaryValue = computed<string>(() => {
    if (this.useOtherBook()) {
      return OTHER_BOOK_SENTINEL;
    }
    const base = this.baselineId();
    if (base) {
      const inSameBook = this.sameBookVersions().some((v) => v.id === base);
      return inSameBook ? base : OTHER_BOOK_SENTINEL;
    }
    return this.defaultSameBookBaselineId() ?? OTHER_BOOK_SENTINEL;
  });

  protected readonly showOtherBookPicker = computed(
    () => this.selectedPrimaryValue() === OTHER_BOOK_SENTINEL,
  );

  protected readonly effectiveBaselineId = computed<string | null>(() => {
    const currentId = this.versionId();
    const explicit = this.baselineId();
    if (explicit && explicit !== currentId) {
      return explicit;
    }
    if (!this.useOtherBook()) {
      return this.defaultSameBookBaselineId();
    }
    const firstOther = this.otherBookVersionOptions()[0]?.value;
    return firstOther || null;
  });

  protected readonly primaryOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.sameBookVersions().map((v) => {
      const statusLabel = this.transloco.translate(`governance.status.price.${v.status}`);
      return {
        value: v.id,
        label: this.transloco.translate('pricing.compare.versionOption', {
          n: v.versionNumber,
          status: statusLabel,
        }),
      };
    });
    list.push({
      value: OTHER_BOOK_SENTINEL,
      label: this.transloco.translate('pricing.compare.otherBookOption'),
    });
    return list;
  });

  protected readonly otherBookVersionOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const language = this.lang();
    const currentBookId = this.bookId();
    const currency = this.currencyCode();
    const options: DropdownOption<string>[] = [];

    for (const book of this.otherBooks()) {
      if (book.id === currentBookId || book.currencyCode !== currency) continue;
      const bookName =
        book.localizedNames[language] ||
        book.localizedNames['en'] ||
        book.localizedNames['ar'] ||
        book.name ||
        book.code;
      for (const v of book.versions) {
        const statusLabel = this.transloco.translate(`governance.status.price.${v.status}`);
        options.push({
          value: v.id,
          label: this.transloco.translate('pricing.compare.otherVersionOption', {
            book: bookName,
            n: v.versionNumber,
            status: statusLabel,
          }),
        });
      }
    }
    return options;
  });

  protected readonly filterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'ALL_CHANGES', label: this.transloco.translate('pricing.compare.filters.allChanges') },
      { value: 'ADDED', label: this.transloco.translate('pricing.compare.filters.added') },
      { value: 'REMOVED', label: this.transloco.translate('pricing.compare.filters.removed') },
      { value: 'INCREASED', label: this.transloco.translate('pricing.compare.filters.increased') },
      { value: 'DECREASED', label: this.transloco.translate('pricing.compare.filters.decreased') },
      { value: 'UNCHANGED', label: this.transloco.translate('pricing.compare.filters.unchanged') },
    ];
  });

  protected readonly statCards = computed<
    { key: string; labelKey: string; hintKey: string; count: number; chart: SparklineSpec }[]
  >(() => {
    const d = this.diff();
    const s = d?.summary;
    const totalEntries = Math.max(1, d?.entries.length ?? 1);
    const totalPromos = Math.max(1, d?.promotions.length ?? 1);
    return [
      {
        key: 'added',
        labelKey: 'pricing.compare.stats.added',
        hintKey: 'pricing.compare.stats.addedHint',
        count: s?.added ?? 0,
        chart: { shape: 'progress', ratio: (s?.added ?? 0) / totalEntries },
      },
      {
        key: 'removed',
        labelKey: 'pricing.compare.stats.removed',
        hintKey: 'pricing.compare.stats.removedHint',
        count: s?.removed ?? 0,
        chart: { shape: 'progress', ratio: (s?.removed ?? 0) / totalEntries },
      },
      {
        key: 'increased',
        labelKey: 'pricing.compare.stats.increased',
        hintKey: 'pricing.compare.stats.increasedHint',
        count: s?.increased ?? 0,
        chart: { shape: 'progress', ratio: (s?.increased ?? 0) / totalEntries },
      },
      {
        key: 'decreased',
        labelKey: 'pricing.compare.stats.decreased',
        hintKey: 'pricing.compare.stats.decreasedHint',
        count: s?.decreased ?? 0,
        chart: { shape: 'progress', ratio: (s?.decreased ?? 0) / totalEntries },
      },
      {
        key: 'promotionsChanged',
        labelKey: 'pricing.compare.stats.promotionsChanged',
        hintKey: 'pricing.compare.stats.promotionsChangedHint',
        count: s?.promotionsChanged ?? 0,
        chart: { shape: 'progress', ratio: (s?.promotionsChanged ?? 0) / totalPromos },
      },
    ];
  });

  protected readonly filteredEntries = computed<readonly PriceDiffEntry[]>(() => {
    const d = this.diff();
    if (!d) return [];
    const currentFilter = this.filter();
    if (currentFilter === 'ALL_CHANGES') {
      return d.entries.filter((e) => e.changeType !== 'UNCHANGED');
    }
    return d.entries.filter((e) => e.changeType === currentFilter);
  });

  protected readonly promotions = computed(() => this.diff()?.promotions ?? []);

  protected countText(count: number): string {
    return `${count}`;
  }

  protected readonly entryGrid =
    'grid-cols-trade-price-diff-entry-row';
  protected readonly promoGrid = 'grid-cols-trade-price-diff-promo-row';

  constructor() {
    effect(() => {
      const showOther = this.showOtherBookPicker();
      if (!showOther) return;
      if (this.otherBooks().length > 0) return;
      untracked(() => void this.loadOtherBooks());
    });

    effect(() => {
      const vId = this.versionId();
      const baseId = this.effectiveBaselineId();
      const _tick = this.reloadTick();
      if (!vId || !baseId) {
        untracked(() => {
          this.diff.set(null);
          this.loading.set(false);
          this.loadFailed.set(false);
        });
        return;
      }
      untracked(() => void this.loadDiff(vId, baseId));
    });
  }

  protected onPrimaryChange(next: string): void {
    if (next === OTHER_BOOK_SENTINEL) {
      this.useOtherBook.set(true);
      const firstOther = this.otherBookVersionOptions()[0]?.value ?? null;
      this.baselineId.set(firstOther);
      return;
    }
    this.useOtherBook.set(false);
    this.baselineId.set(next);
  }

  protected onOtherBookVersionChange(next: string): void {
    if (!next) return;
    this.useOtherBook.set(true);
    this.baselineId.set(next);
  }

  protected onFilterChange(next: string | null): void {
    if (!next) return;
    this.filter.set(next as DiffFilter);
  }

  protected retry(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected itemDisplayName(entry: PriceDiffEntry): string {
    const language = this.lang();
    return (
      entry.itemLocalizedNames[language] ||
      entry.itemLocalizedNames['en'] ||
      entry.itemLocalizedNames['ar'] ||
      entry.itemCode
    );
  }

  /** The diff carries the unit code only. */
  protected uomDisplayName(entry: PriceDiffEntry): string {
    return entry.uomCode;
  }

  /** Diff rows have no id; the tier key is unique (itemId:uomId:minimumQuantity:priority). */
  protected entryKey(entry: PriceDiffEntry): string {
    return `${entry.itemId}:${entry.uomId}:${entry.minimumQuantity}:${entry.priority}`;
  }

  protected formatQtyValue(val: string): string {
    return formatQty(val);
  }

  protected formatPriceValue(val: string | null): string {
    return val ? formatUnitPrice(this.currencyCode(), val) : '—';
  }

  protected deltaText(entry: PriceDiffEntry): string {
    if (!entry.deltaAmount || entry.changeType === 'ADDED' || entry.changeType === 'REMOVED') {
      return '—';
    }
    const formatted = formatMoney(this.currencyCode(), entry.deltaAmount);
    const signedMoney = entry.changeType === 'INCREASED' ? `+${formatted}` : formatted;
    if (entry.deltaPct === null) {
      return signedMoney;
    }
    const pct = entry.deltaPct.toFixed(2);
    const signedPct = entry.changeType === 'INCREASED' ? `+${pct}%` : `${pct}%`;
    return `${signedMoney} (${signedPct})`;
  }

  protected deltaClass(change: PriceDiffEntryChange): string {
    if (change === 'DECREASED') return 'text-success-text font-medium';
    if (change === 'INCREASED') return 'text-danger-text font-medium';
    return 'text-text-muted';
  }

  protected entryBadgeClass(change: PriceDiffEntryChange): string {
    return ENTRY_BADGE_CLASS[change];
  }

  protected promoBadgeClass(change: PriceDiffPromotionChange): string {
    return PROMO_BADGE_CLASS[change];
  }

  protected formatBenefit(benefit: PromotionBenefit | null): string {
    if (!benefit) return '—';
    if (benefit.type === 'PERCENTAGE') {
      return `${benefit.value} %`;
    }
    return formatMoney(this.currencyCode(), benefit.value);
  }

  private async loadOtherBooks(): Promise<void> {
    const seq = ++this.otherBooksSeq;
    this.loadingOtherBooks.set(true);
    try {
      const page = await listPriceBooks({ limit: 100 }, tradeContext(this.scope, 'COMPANY'));
      if (seq !== this.otherBooksSeq) return;
      this.otherBooks.set(page.items);
      if (this.useOtherBook() && !this.baselineId()) {
        const first = this.otherBookVersionOptions()[0]?.value;
        if (first) {
          this.baselineId.set(first);
        }
      }
    } catch (error) {
      if (seq !== this.otherBooksSeq) return;
      if (isForbiddenError(error)) this.forbidden.emit();
      this.otherBooks.set([]);
    } finally {
      if (seq === this.otherBooksSeq) {
        this.loadingOtherBooks.set(false);
      }
    }
  }

  private async loadDiff(versionId: string, compareId: string): Promise<void> {
    const seq = ++this.diffSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const data = await getDiff(versionId, compareId, tradeContext(this.scope, 'COMPANY'));
      if (seq !== this.diffSeq) return;
      this.diff.set(data);
    } catch (error) {
      if (seq !== this.diffSeq) return;
      this.diff.set(null);
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      this.loadFailed.set(true);
    } finally {
      if (seq === this.diffSeq) {
        this.loading.set(false);
      }
    }
  }
}

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowRight,
  tablerChevronDown,
  tablerChevronUp,
  tablerFilterX,
  tablerMinus,
  tablerPackage,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { catalogueNames } from '../../../billing/shared/catalogue-names';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import {
  badgeClassForTone,
  eligibilityBadgeClass,
  eligibilityOf,
  formatDateTime,
  riskTone,
  shortChecksum,
} from '../updates.logic';
import { TenantAvailableUpdate } from '../updates.model';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-updates-table',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox],
  providers: [
    provideIcons({
      tablerArrowRight,
      tablerChevronDown,
      tablerChevronUp,
      tablerFilterX,
      tablerMinus,
      tablerPackage,
    }),
  ],
  templateUrl: './updates-table.html',
  host: { class: 'block min-w-0' },
})
export class UpdatesTable {
  private static nextId = 0;
  protected readonly uid = `updates-table-${++UpdatesTable.nextId}`;
  protected readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly names = catalogueNames(this.transloco);

  readonly rows = input.required<readonly TenantAvailableUpdate[]>();
  readonly loading = input(false);
  readonly selectable = input(false);
  readonly selectedKeys = input<ReadonlySet<string>>(new Set());
  readonly locked = input(false);
  readonly capReached = input(false);
  readonly filtered = input(false);

  readonly toggle = output<string>();
  readonly togglePage = output<boolean>();
  readonly clearFilters = output<void>();

  protected readonly skeletonRows = SKELETON_ROWS;
  private readonly expandedKeys = signal<ReadonlySet<string>>(new Set());

  protected readonly gridColumns = computed(() =>
    this.selectable()
      ? 'grid-cols-ws-update-row-select-actions'
      : 'grid-cols-ws-update-row-actions',
  );

  protected readonly eligibleKeys = computed(() =>
    this.rows()
      .filter((row) => eligibilityOf(row) === 'ELIGIBLE')
      .map((row) => row.componentKey),
  );

  protected readonly pageState = computed<'none' | 'some' | 'all'>(() => {
    const eligible = this.eligibleKeys();
    if (eligible.length === 0) return 'none';
    const selected = this.selectedKeys();
    let count = 0;
    for (const key of eligible) {
      if (selected.has(key)) count++;
    }
    if (count === 0) return 'none';
    if (count === eligible.length) return 'all';
    return 'some';
  });

  protected readonly headerSelectDisabled = computed(() => {
    if (!this.selectable() || this.locked() || this.eligibleKeys().length === 0) return true;
    return this.capReached() && this.pageState() === 'none';
  });

  protected isSelected(key: string): boolean {
    return this.selectedKeys().has(key);
  }

  protected isRowEligible(row: TenantAvailableUpdate): boolean {
    return eligibilityOf(row) === 'ELIGIBLE';
  }

  protected isRowCheckboxDisabled(row: TenantAvailableUpdate): boolean {
    if (!this.selectable() || this.locked() || !this.isRowEligible(row)) return true;
    return this.capReached() && !this.isSelected(row.componentKey);
  }

  protected eligibility(row: TenantAvailableUpdate) {
    return eligibilityOf(row);
  }

  protected riskBadgeClass(row: TenantAvailableUpdate): string {
    return badgeClassForTone(riskTone(row.availableRelease.riskLevel));
  }

  protected eligibilityBadge(row: TenantAvailableUpdate): string {
    return eligibilityBadgeClass(eligibilityOf(row));
  }

  protected isExpanded(key: string): boolean {
    return this.expandedKeys().has(key);
  }

  protected toggleExpanded(key: string): void {
    this.expandedKeys.update((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  /** Translated application name (nav.apps.*), falling back to the raw owner app key. */
  protected appName(ownerApp: string): string {
    this.i18n();
    return this.names.app(ownerApp.toLowerCase(), ownerApp);
  }

  protected formatPublished(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  protected checksumPreview(checksum: string): string {
    return shortChecksum(checksum);
  }

  protected onHeaderCheckedChange(checked: boolean, cb: Checkbox): void {
    if (this.headerSelectDisabled()) {
      cb.checked.set(this.pageState() === 'all');
      return;
    }
    const selectAll = this.pageState() !== 'all' ? true : checked;
    this.togglePage.emit(selectAll);
  }

  protected onRowCheckedChange(row: TenantAvailableUpdate, cb: Checkbox): void {
    if (this.isRowCheckboxDisabled(row)) {
      cb.checked.set(this.isSelected(row.componentKey));
      return;
    }
    this.toggle.emit(row.componentKey);
  }
}

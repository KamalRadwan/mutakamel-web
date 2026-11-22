import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuildingStore,
  tablerBuildingWarehouse,
  tablerCloud,
} from '@ng-icons/tabler-icons';

export type InventoryBadgeKind =
  | 'nodeStatus'
  | 'nodeType'
  | 'period'
  | 'uom'
  | 'serial'
  | 'serialEvent'
  | 'movement'
  | 'outcome'
  | 'decision'
  | 'source';

const NODE_TYPE_ICONS: Readonly<Record<string, string>> = {
  WAREHOUSE: 'tablerBuildingWarehouse',
  STORE: 'tablerBuildingStore',
  VIRTUAL: 'tablerCloud',
};

const TONE_SUCCESS = 'bg-success text-on-success';
const TONE_WARNING = 'bg-warning text-on-warning';
const TONE_DANGER = 'bg-danger text-on-danger';
const TONE_MUTED = 'bg-neutral-soft text-text-muted';
const TONE_NEUTRAL = 'bg-neutral-soft text-text';
const TONE_BRAND_SOFT = 'bg-brand-soft text-on-brand-soft';
const TONE_SUCCESS_SOFT = 'bg-success-soft text-on-success-soft';
const TONE_DANGER_SOFT = 'bg-danger-soft text-on-danger-soft';

function resolveToneClass(kind: InventoryBadgeKind, value: string): string {
  switch (kind) {
    case 'nodeStatus':
      return value === 'ACTIVE' ? TONE_SUCCESS : TONE_MUTED;
    case 'nodeType':
    case 'decision':
      return TONE_NEUTRAL;
    case 'period':
      return value === 'OPEN' ? TONE_SUCCESS : TONE_MUTED;
    case 'uom':
      if (value === 'PUBLISHED') return TONE_SUCCESS;
      if (value === 'RETIRED') return TONE_MUTED;
      return TONE_NEUTRAL;
    case 'serial':
      if (value === 'ON_HAND') return TONE_SUCCESS;
      if (value === 'RESERVED') return TONE_WARNING;
      if (value === 'DELIVERED') return TONE_BRAND_SOFT;
      return TONE_MUTED;
    case 'serialEvent':
      if (value === 'RECEIPT') return TONE_SUCCESS_SOFT;
      if (value === 'RESERVATION') return TONE_WARNING;
      if (value === 'DELIVERY') return TONE_BRAND_SOFT;
      if (value === 'RECEIPT_REVERSAL' || value === 'DELIVERY_REVERSAL') return TONE_DANGER_SOFT;
      return TONE_NEUTRAL;
    case 'movement':
      if (value === 'PURCHASE_RECEIPT') return TONE_SUCCESS_SOFT;
      if (value === 'SALES_DELIVERY') return TONE_BRAND_SOFT;
      if (value === 'PURCHASE_RECEIPT_REVERSAL' || value === 'SALES_DELIVERY_REVERSAL') {
        return TONE_DANGER_SOFT;
      }
      return TONE_NEUTRAL;
    case 'outcome':
      if (value === 'ALLOW') return TONE_SUCCESS;
      if (value === 'PARTIAL' || value === 'BACKORDER') return TONE_WARNING;
      if (value === 'REJECT') return TONE_DANGER;
      return TONE_NEUTRAL;
    case 'source':
      if (value === 'POSTED') return TONE_SUCCESS_SOFT;
      if (value === 'PARTIALLY_REVERSED') return TONE_WARNING;
      if (value === 'REVERSED') return TONE_DANGER_SOFT;
      return TONE_NEUTRAL;
  }
}

@Component({
  selector: 'app-inventory-badge',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerBuildingWarehouse, tablerBuildingStore, tablerCloud })],
  templateUrl: './inventory-badge.html',
  host: { class: 'inline-flex shrink-0' },
})
export class InventoryBadge {
  readonly kind = input.required<InventoryBadgeKind>();
  readonly value = input.required<string>();

  protected readonly toneClass = computed(() => resolveToneClass(this.kind(), this.value()));
  protected readonly iconName = computed(() =>
    this.kind() === 'nodeType' ? (NODE_TYPE_ICONS[this.value()] ?? '') : '',
  );
  protected readonly labelKey = computed(
    () => `tradeInventory.badge.${this.kind()}.${this.value()}`,
  );
}

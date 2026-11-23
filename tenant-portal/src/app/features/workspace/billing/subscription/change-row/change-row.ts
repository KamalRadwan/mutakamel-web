import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerPuzzle, tablerTrendingUp, tablerUsers } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import {
  BillingCycle,
  CommercialChange,
  OfferLadder,
  SourceKind,
  SubscriptionAddonSelection,
  SubscriptionBaseItem,
  SubscriptionOffer,
  SubscriptionView,
} from '../../billing.model';

export interface AddAppCartRow {
  kind: 'add-app';
  selectionKey: string;
  applicationId: string;
  tierId: string;
  seats: string;
  touched?: boolean;
  serverError?: string | null;
}

export interface ChangeSeatsCartRow {
  kind: 'change-seats';
  selectionKey: string;
  targetKind: SourceKind;
  targetId: string;
  newSeats: string;
  locked: boolean;
  touched?: boolean;
  serverError?: string | null;
  freeSeatsModuleKey?: string | null;
}

export interface UpgradeTierCartRow {
  kind: 'upgrade-tier';
  selectionKey: string;
  itemId: string;
  tierId: string;
  locked: boolean;
  touched?: boolean;
  serverError?: string | null;
}

export interface AddAddonCartRow {
  kind: 'add-addon';
  selectionKey: string;
  addonId: string;
  targetDefinitionVersionId: string;
  parentItemId: string;
  seats: string;
  touched?: boolean;
  serverError?: string | null;
}

export type CartRow = AddAppCartRow | ChangeSeatsCartRow | UpgradeTierCartRow | AddAddonCartRow;

export type AppOffer = Extract<SubscriptionOffer, { sourceKind: 'APPLICATION' }>;
export type AddonOffer = Extract<SubscriptionOffer, { sourceKind: 'ADDON' }>;

export interface AppCatalogGroup {
  readonly applicationId: string;
  readonly applicationKey: string;
  readonly applicationName: string;
  readonly tiers: AppOffer[];
}

export const MAX_SEATS = 100_000;

export function parseSeatInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_SEATS) return null;
  return n;
}

export function ladderForCycle(offer: SubscriptionOffer, cycle: BillingCycle): OfferLadder {
  return cycle === 'ANNUAL' ? offer.ladders[1] : offer.ladders[0];
}

export function isAppTierAvailable(offer: AppOffer, cycle: BillingCycle): boolean {
  return offer.status !== 'UNAVAILABLE' && ladderForCycle(offer, cycle).state === 'CONFIGURED';
}

export function buildAppCatalogGroups(offers: readonly SubscriptionOffer[]): AppCatalogGroup[] {
  const map = new Map<string, AppCatalogGroup>();
  for (const offer of offers) {
    if (offer.sourceKind !== 'APPLICATION') continue;
    const existing = map.get(offer.application.id);
    if (existing) {
      existing.tiers.push(offer);
    } else {
      map.set(offer.application.id, {
        applicationId: offer.application.id,
        applicationKey: offer.application.key,
        applicationName: offer.application.name,
        tiers: [offer],
      });
    }
  }
  const groups = Array.from(map.values());
  for (const group of groups) {
    group.tiers.sort((a, b) => a.tier.rank - b.tier.rank);
  }
  groups.sort((a, b) => a.applicationName.localeCompare(b.applicationName));
  return groups;
}

export function effectiveParentSeats(
  parentItemId: string,
  subscription: SubscriptionView,
  allRows: readonly CartRow[],
): number {
  const parent = subscription.baseItems.find((b) => b.id === parentItemId);
  const baseSeats = parent?.seats ?? 0;
  const parentSeatRow = allRows.find(
    (r): r is ChangeSeatsCartRow =>
      r.kind === 'change-seats' && r.targetKind === 'APPLICATION' && r.targetId === parentItemId,
  );
  if (!parentSeatRow) return baseSeats;
  const parsed = parseSeatInt(parentSeatRow.newSeats);
  return parsed ?? baseSeats;
}

export function validateCartRow(
  row: CartRow,
  subscription: SubscriptionView,
  catalogueGroups: readonly AppCatalogGroup[],
  allRows: readonly CartRow[],
  transloco: TranslocoService,
): string | null {
  const cycle = subscription.subscription.billingCycle;

  switch (row.kind) {
    case 'add-app': {
      if (!row.applicationId) {
        return transloco.translate('bsub.change.row.errors.appRequired');
      }
      const group = catalogueGroups.find((g) => g.applicationId === row.applicationId);
      const tier = group?.tiers.find((t) => t.tier.id === row.tierId);
      if (!tier || !isAppTierAvailable(tier, cycle)) {
        return transloco.translate('bsub.change.row.errors.tierRequired');
      }
      if (parseSeatInt(row.seats) === null) {
        return transloco.translate('bsub.change.row.errors.seatsRange');
      }
      return null;
    }

    case 'change-seats': {
      if (!row.targetId) {
        return transloco.translate('bsub.change.row.errors.itemRequired');
      }
      const parsed = parseSeatInt(row.newSeats);
      if (parsed === null) {
        return transloco.translate('bsub.change.row.errors.seatsRange');
      }
      if (row.targetKind === 'APPLICATION') {
        const base = subscription.baseItems.find((b) => b.id === row.targetId);
        if (!base) {
          return transloco.translate('bsub.change.row.errors.itemRequired');
        }
        if (parsed === base.seats) {
          return transloco.translate('bsub.change.row.errors.seatsUnchanged');
        }
        return null;
      }
      const addon = subscription.addonSelections.find((a) => a.id === row.targetId);
      if (!addon) {
        return transloco.translate('bsub.change.row.errors.itemRequired');
      }
      if (parsed <= addon.seats) {
        return transloco.translate('bsub.change.row.errors.addonSeatsHigher', {
          current: addon.seats,
        });
      }
      const maxParent = effectiveParentSeats(addon.parentItemId, subscription, allRows);
      if (parsed > maxParent) {
        return transloco.translate('bsub.change.row.errors.addonSeatsMax', { max: maxParent });
      }
      return null;
    }

    case 'upgrade-tier': {
      const base = subscription.baseItems.find((b) => b.id === row.itemId);
      if (!base) {
        return transloco.translate('bsub.change.row.errors.appRequired');
      }
      const group = catalogueGroups.find((g) => g.applicationId === base.applicationId);
      const higherTiers = (group?.tiers ?? []).filter((t) => t.tier.rank > base.tierRank);
      if (!higherTiers.length) {
        return transloco.translate('bsub.change.row.errors.noHigherTier');
      }
      const selected = higherTiers.find((t) => t.tier.id === row.tierId);
      if (!selected || !isAppTierAvailable(selected, cycle)) {
        return transloco.translate('bsub.change.row.errors.tierRequired');
      }
      return null;
    }

    case 'add-addon': {
      const parent = subscription.baseItems.find((b) => b.id === row.parentItemId);
      if (!parent) {
        return transloco.translate('bsub.change.row.errors.appRequired');
      }
      const parsed = parseSeatInt(row.seats);
      if (parsed === null) {
        return transloco.translate('bsub.change.row.errors.seatsRange');
      }
      const maxParent = effectiveParentSeats(parent.id, subscription, allRows);
      if (parsed > maxParent) {
        return transloco.translate('bsub.change.row.errors.addonSeatsMax', { max: maxParent });
      }
      return null;
    }
  }
}

export function toCommercialChange(row: CartRow): CommercialChange | null {
  switch (row.kind) {
    case 'add-app': {
      const seats = parseSeatInt(row.seats);
      if (!row.applicationId || !row.tierId || seats === null) return null;
      return {
        sourceKind: 'APPLICATION',
        operation: 'ADD',
        selectionKey: row.selectionKey,
        applicationId: row.applicationId,
        tierId: row.tierId,
        seats,
      };
    }
    case 'change-seats': {
      const seats = parseSeatInt(row.newSeats);
      if (!row.targetId || seats === null) return null;
      if (row.targetKind === 'APPLICATION') {
        return {
          sourceKind: 'APPLICATION',
          operation: 'CHANGE',
          selectionKey: row.selectionKey,
          itemId: row.targetId,
          seats,
        };
      }
      return {
        sourceKind: 'ADDON',
        operation: 'CHANGE',
        selectionKey: row.selectionKey,
        addonSelectionId: row.targetId,
        seats,
      };
    }
    case 'upgrade-tier': {
      if (!row.itemId || !row.tierId) return null;
      return {
        sourceKind: 'APPLICATION',
        operation: 'CHANGE',
        selectionKey: row.selectionKey,
        itemId: row.itemId,
        tierId: row.tierId,
      };
    }
    case 'add-addon': {
      const seats = parseSeatInt(row.seats);
      if (!row.addonId || !row.targetDefinitionVersionId || !row.parentItemId || seats === null) {
        return null;
      }
      return {
        sourceKind: 'ADDON',
        operation: 'ADD',
        selectionKey: row.selectionKey,
        addonId: row.addonId,
        targetDefinitionVersionId: row.targetDefinitionVersionId,
        parentItemId: row.parentItemId,
        seats,
      };
    }
  }
}

const KIND_LOOK: Readonly<
  Record<CartRow['kind'], { icon: string; tile: string; labelKey: string }>
> = {
  'add-app': {
    icon: 'tablerPlus',
    tile: 'bg-icon-green',
    labelKey: 'bsub.change.row.kinds.addApp',
  },
  'change-seats': {
    icon: 'tablerUsers',
    tile: 'bg-icon-teal',
    labelKey: 'bsub.change.row.kinds.changeSeats',
  },
  'upgrade-tier': {
    icon: 'tablerTrendingUp',
    tile: 'bg-icon-blue',
    labelKey: 'bsub.change.row.kinds.upgradeTier',
  },
  'add-addon': {
    icon: 'tablerPuzzle',
    tile: 'bg-icon-violet',
    labelKey: 'bsub.change.row.kinds.addAddon',
  },
};

@Component({
  selector: 'app-change-row',
  imports: [RouterLink, NgIcon, TranslocoPipe, Button, Dropdown, Field],
  providers: [provideIcons({ tablerPlus, tablerPuzzle, tablerTrendingUp, tablerUsers })],
  templateUrl: './change-row.html',
  host: { class: 'block' },
})
export class ChangeRow {
  private static nextId = 0;
  protected readonly uid = `change-row-${++ChangeRow.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly bsubReady = toSignal(
    this.transloco.selectTranslation('ws-billing-subscription'),
  );

  readonly row = input.required<CartRow>();
  readonly subscription = input.required<SubscriptionView>();
  readonly catalogueGroups = input.required<AppCatalogGroup[]>();
  readonly catalogueOffers = input.required<SubscriptionOffer[]>();
  readonly allRows = input.required<CartRow[]>();
  readonly submitted = input(false);

  readonly changed = output<CartRow>();

  private readonly localTouched = signal(false);

  protected readonly showErrors = computed(() => {
    const r = this.row();
    return Boolean(this.submitted() || this.localTouched() || r.touched);
  });

  protected readonly kindLook = computed(() => KIND_LOOK[this.row().kind]);

  protected readonly addonNamesById = computed(() => {
    const map = new Map<string, string>();
    for (const offer of this.catalogueOffers()) {
      if (offer.sourceKind === 'ADDON') {
        map.set(offer.addon.id, offer.addon.name);
      }
    }
    return map;
  });

  protected readonly appOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.bsubReady();
    const r = this.row();
    if (r.kind !== 'add-app') return [];
    const subAppIds = new Set(this.subscription().baseItems.map((b) => b.applicationId));
    const usedAppIds = new Set(
      this.allRows()
        .filter(
          (other): other is AddAppCartRow =>
            other.kind === 'add-app' && other.selectionKey !== r.selectionKey,
        )
        .map((other) => other.applicationId),
    );
    const options: DropdownOption<string>[] = this.catalogueGroups()
      .filter((g) => !subAppIds.has(g.applicationId) && !usedAppIds.has(g.applicationId))
      .map((g) => ({ value: g.applicationId, label: g.applicationName }));

    if (!r.applicationId) {
      options.unshift({
        value: '',
        label: this.transloco.translate('bsub.change.row.selectApplication'),
        disabled: true,
      });
    }
    return options;
  });

  protected readonly addAppTierOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.bsubReady();
    const r = this.row();
    if (r.kind !== 'add-app') return [];
    const group = this.catalogueGroups().find((g) => g.applicationId === r.applicationId);
    const cycle = this.subscription().subscription.billingCycle;
    const unavailReason = this.transloco.translate('bill.offerStatus.UNAVAILABLE');
    const options: DropdownOption<string>[] = (group?.tiers ?? []).map((offer) => {
      const available = isAppTierAvailable(offer, cycle);
      return {
        value: offer.tier.id,
        label: available ? offer.tier.name : `${offer.tier.name} — ${unavailReason}`,
        disabled: !available,
      };
    });
    if (!r.tierId) {
      options.unshift({
        value: '',
        label: this.transloco.translate('bsub.change.row.selectTier'),
        disabled: true,
      });
    }
    return options;
  });

  protected readonly seatTargetOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.bsubReady();
    const r = this.row();
    if (r.kind !== 'change-seats') return [];
    const sub = this.subscription();
    const usedTargets = new Set(
      this.allRows()
        .filter(
          (other): other is ChangeSeatsCartRow =>
            other.kind === 'change-seats' && other.selectionKey !== r.selectionKey,
        )
        .map((other) => `${other.targetKind}:${other.targetId}`),
    );
    const addonNames = this.addonNamesById();
    const options: DropdownOption<string>[] = [];
    for (const item of sub.baseItems) {
      const token = `APPLICATION:${item.id}`;
      if (!usedTargets.has(token)) {
        options.push({
          value: token,
          label: item.applicationName ?? item.applicationKey,
        });
      }
    }
    for (const addon of sub.addonSelections) {
      const token = `ADDON:${addon.id}`;
      if (!usedTargets.has(token)) {
        const addonName = addonNames.get(addon.addonId) ?? addon.addonKey;
        const parent = sub.baseItems.find((b) => b.id === addon.parentItemId);
        const parentLabel = parent ? (parent.applicationName ?? parent.applicationKey) : '';
        options.push({
          value: token,
          label: parentLabel ? `${addonName} (${parentLabel})` : addonName,
        });
      }
    }
    if (!r.targetId) {
      options.unshift({
        value: '',
        label: this.transloco.translate('bsub.change.row.selectItem'),
        disabled: true,
      });
    }
    return options;
  });

  protected readonly currentSeatTargetToken = computed(() => {
    const r = this.row();
    if (r.kind !== 'change-seats' || !r.targetId) return '';
    return `${r.targetKind}:${r.targetId}`;
  });

  protected readonly seatTargetLabel = computed(() => {
    const r = this.row();
    if (r.kind !== 'change-seats') return '';
    const sub = this.subscription();
    if (r.targetKind === 'APPLICATION') {
      const item = sub.baseItems.find((b) => b.id === r.targetId);
      return item ? (item.applicationName ?? item.applicationKey) : r.targetId;
    }
    const addon = sub.addonSelections.find((a) => a.id === r.targetId);
    if (!addon) return r.targetId;
    const addonName = this.addonNamesById().get(addon.addonId) ?? addon.addonKey;
    const parent = sub.baseItems.find((b) => b.id === addon.parentItemId);
    const parentLabel = parent ? (parent.applicationName ?? parent.applicationKey) : '';
    return parentLabel ? `${addonName} (${parentLabel})` : addonName;
  });

  protected readonly currentSeatsValue = computed(() => {
    const r = this.row();
    if (r.kind !== 'change-seats') return '';
    const sub = this.subscription();
    if (r.targetKind === 'APPLICATION') {
      const item = sub.baseItems.find((b) => b.id === r.targetId);
      return item ? String(item.seats) : '—';
    }
    const addon = sub.addonSelections.find((a) => a.id === r.targetId);
    return addon ? String(addon.seats) : '—';
  });

  protected readonly upgradeItemOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.bsubReady();
    const r = this.row();
    if (r.kind !== 'upgrade-tier') return [];
    const sub = this.subscription();
    const usedItemIds = new Set(
      this.allRows()
        .filter(
          (other): other is UpgradeTierCartRow =>
            other.kind === 'upgrade-tier' && other.selectionKey !== r.selectionKey,
        )
        .map((other) => other.itemId),
    );
    const options: DropdownOption<string>[] = sub.baseItems
      .filter((item) => {
        if (usedItemIds.has(item.id) && item.id !== r.itemId) return false;
        const group = this.catalogueGroups().find((g) => g.applicationId === item.applicationId);
        return (group?.tiers ?? []).some((t) => t.tier.rank > item.tierRank);
      })
      .map((item) => ({
        value: item.id,
        label: item.applicationName ?? item.applicationKey,
      }));
    if (!r.itemId) {
      options.unshift({
        value: '',
        label: this.transloco.translate('bsub.change.row.selectApplication'),
        disabled: true,
      });
    }
    return options;
  });

  protected readonly upgradeBaseItem = computed<SubscriptionBaseItem | null>(() => {
    const r = this.row();
    if (r.kind !== 'upgrade-tier') return null;
    return this.subscription().baseItems.find((b) => b.id === r.itemId) ?? null;
  });

  protected readonly upgradeTierOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.bsubReady();
    const r = this.row();
    if (r.kind !== 'upgrade-tier') return [];
    const base = this.upgradeBaseItem();
    if (!base) {
      return [
        {
          value: '',
          label: this.transloco.translate('bsub.change.row.selectTier'),
          disabled: true,
        },
      ];
    }
    const group = this.catalogueGroups().find((g) => g.applicationId === base.applicationId);
    const cycle = this.subscription().subscription.billingCycle;
    const unavailReason = this.transloco.translate('bill.offerStatus.UNAVAILABLE');
    const higherTiers = (group?.tiers ?? []).filter((t) => t.tier.rank > base.tierRank);
    if (!higherTiers.length) {
      return [
        {
          value: '',
          label: this.transloco.translate('bsub.change.row.errors.noHigherTier'),
          disabled: true,
        },
      ];
    }
    const options: DropdownOption<string>[] = higherTiers.map((offer) => {
      const available = isAppTierAvailable(offer, cycle);
      return {
        value: offer.tier.id,
        label: available ? offer.tier.name : `${offer.tier.name} — ${unavailReason}`,
        disabled: !available,
      };
    });
    if (!r.tierId) {
      options.unshift({
        value: '',
        label: this.transloco.translate('bsub.change.row.selectTier'),
        disabled: true,
      });
    }
    return options;
  });

  protected readonly addAddonDisplayName = computed(() => {
    const r = this.row();
    if (r.kind !== 'add-addon') return '';
    return this.addonNamesById().get(r.addonId) ?? r.addonId;
  });

  protected readonly addAddonParentName = computed(() => {
    const r = this.row();
    if (r.kind !== 'add-addon') return '';
    const parent = this.subscription().baseItems.find((b) => b.id === r.parentItemId);
    return parent ? (parent.applicationName ?? parent.applicationKey) : r.parentItemId;
  });

  protected readonly addAddonMaxSeats = computed(() => {
    const r = this.row();
    if (r.kind !== 'add-addon') return MAX_SEATS;
    return Math.max(1, effectiveParentSeats(r.parentItemId, this.subscription(), this.allRows()));
  });

  protected readonly seatInputMax = computed(() => {
    const r = this.row();
    if (r.kind !== 'change-seats' || r.targetKind !== 'ADDON') return MAX_SEATS;
    const addon = this.subscription().addonSelections.find((a) => a.id === r.targetId);
    if (!addon) return MAX_SEATS;
    return Math.max(
      1,
      effectiveParentSeats(addon.parentItemId, this.subscription(), this.allRows()),
    );
  });

  protected readonly seatInputMin = computed(() => {
    const row = this.row();
    if (row.kind !== 'change-seats' || row.targetKind !== 'ADDON') return 1;
    const addon = this.subscription().addonSelections.find((item) => item.id === row.targetId);
    return addon ? addon.seats + 1 : 1;
  });

  protected readonly seatHintKey = computed(() => {
    const r = this.row();
    return r.kind === 'change-seats' && r.targetKind === 'ADDON'
      ? 'bsub.change.row.addonSeatsHint'
      : 'bsub.change.row.newSeatsHint';
  });

  protected readonly rowValidationError = computed<string | null>(() => {
    this.i18n();
    this.bsubReady();
    const r = this.row();
    if (r.serverError) return r.serverError;
    if (!this.showErrors()) return null;
    return validateCartRow(
      r,
      this.subscription(),
      this.catalogueGroups(),
      this.allRows(),
      this.transloco,
    );
  });

  protected readonly appFieldError = computed<string | null>(() => {
    const r = this.row();
    if (r.kind !== 'add-app' || !this.showErrors()) return null;
    return r.applicationId ? null : this.rowValidationError();
  });

  protected readonly tierFieldError = computed<string | null>(() => {
    const r = this.row();
    if (r.kind === 'add-app') {
      if (r.serverError) return r.serverError;
      if (!this.showErrors() || !r.applicationId) return null;
      const err = validateCartRow(
        r,
        this.subscription(),
        this.catalogueGroups(),
        this.allRows(),
        this.transloco,
      );
      return !r.tierId ? err : null;
    }
    if (r.kind === 'upgrade-tier') {
      if (r.serverError) return r.serverError;
      if (!this.showErrors()) return null;
      return validateCartRow(
        r,
        this.subscription(),
        this.catalogueGroups(),
        this.allRows(),
        this.transloco,
      );
    }
    return null;
  });

  protected readonly seatsFieldError = computed<string | null>(() => {
    const r = this.row();
    if (r.kind === 'add-app') {
      if (!this.showErrors() || !r.applicationId || !r.tierId) return null;
      return validateCartRow(
        r,
        this.subscription(),
        this.catalogueGroups(),
        this.allRows(),
        this.transloco,
      );
    }
    if (r.kind === 'change-seats' || r.kind === 'add-addon') {
      return this.rowValidationError();
    }
    return null;
  });

  protected onAddAppChange(applicationId: string): void {
    const r = this.row();
    if (r.kind !== 'add-app') return;
    const group = this.catalogueGroups().find((g) => g.applicationId === applicationId);
    const cycle = this.subscription().subscription.billingCycle;
    const firstTier = group?.tiers.find((t) => isAppTierAvailable(t, cycle))?.tier.id ?? '';
    this.localTouched.set(true);
    this.changed.emit({
      ...r,
      applicationId,
      tierId: firstTier,
      touched: true,
      serverError: null,
    });
  }

  protected onAddAppTierChange(tierId: string): void {
    const r = this.row();
    if (r.kind !== 'add-app') return;
    this.localTouched.set(true);
    this.changed.emit({ ...r, tierId, touched: true, serverError: null });
  }

  protected onAddAppSeatsInput(event: Event): void {
    const r = this.row();
    if (r.kind !== 'add-app') return;
    this.localTouched.set(true);
    this.changed.emit({
      ...r,
      seats: (event.target as HTMLInputElement).value,
      touched: true,
      serverError: null,
    });
  }

  protected onSeatTargetChange(token: string): void {
    const r = this.row();
    if (r.kind !== 'change-seats') return;
    const colon = token.indexOf(':');
    if (colon === -1) return;
    const targetKind = token.slice(0, colon) as SourceKind;
    const targetId = token.slice(colon + 1);
    this.localTouched.set(false);
    this.changed.emit({
      ...r,
      targetKind,
      targetId,
      newSeats: '',
      touched: false,
      serverError: null,
      freeSeatsModuleKey: null,
    });
  }

  protected onNewSeatsInput(event: Event): void {
    const r = this.row();
    if (r.kind !== 'change-seats') return;
    this.localTouched.set(true);
    this.changed.emit({
      ...r,
      newSeats: (event.target as HTMLInputElement).value,
      touched: true,
      serverError: null,
      freeSeatsModuleKey: null,
    });
  }

  protected onUpgradeItemChange(itemId: string): void {
    const r = this.row();
    if (r.kind !== 'upgrade-tier') return;
    const base = this.subscription().baseItems.find((b) => b.id === itemId);
    const group = base
      ? this.catalogueGroups().find((g) => g.applicationId === base.applicationId)
      : undefined;
    const cycle = this.subscription().subscription.billingCycle;
    const firstHigher =
      base && group
        ? (group.tiers.find((t) => t.tier.rank > base.tierRank && isAppTierAvailable(t, cycle))
            ?.tier.id ?? '')
        : '';
    this.localTouched.set(false);
    this.changed.emit({
      ...r,
      itemId,
      tierId: firstHigher,
      touched: false,
      serverError: null,
    });
  }

  protected onUpgradeTierChange(tierId: string): void {
    const r = this.row();
    if (r.kind !== 'upgrade-tier') return;
    this.localTouched.set(true);
    this.changed.emit({ ...r, tierId, touched: true, serverError: null });
  }

  protected onAddonSeatsInput(event: Event): void {
    const r = this.row();
    if (r.kind !== 'add-addon') return;
    this.localTouched.set(true);
    this.changed.emit({
      ...r,
      seats: (event.target as HTMLInputElement).value,
      touched: true,
      serverError: null,
    });
  }

  protected markTouched(): void {
    this.localTouched.set(true);
  }
}

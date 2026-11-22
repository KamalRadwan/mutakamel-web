import { Component, computed, inject, input, model, output } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerBuildingStore, tablerPlus } from '@ng-icons/tabler-icons';
import { NgIcon } from '@ng-icons/core';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { RECORD_PAGE_GRID } from '../../../../../../shared/ui/section-bar/record-layout';
import { SectionBar } from '../../../../../../shared/ui/section-bar/section-bar';
import { Segmented, type SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../../shared/ui/switch/switch';
import { TradeUomPicker } from '../../../../shared/pickers/uom-picker/uom-picker';
import { formatMoney } from '../../../../shared/trade-format';
import { itemName } from '../../../../shared/trade-foundation.api';
import type {
  ItemCompanyProfile,
  ItemKind,
  ItemTrackingMode,
  Tax,
  Uom,
} from '../../../../shared/trade-foundation.model';
import { TRACKING_KEY } from '../../../../shared/trade-labels';
import {
  ITEM_LIMITS,
  NON_NEGATIVE_DECIMAL,
  type CompanyProfileBody,
  type CompanyProfilePatch,
} from '../../items.model';
import type { DraftErrors, FieldError } from '../../item-form/item-draft';
import { StandardCostSection } from './standard-cost-section/standard-cost-section';

export interface CompanyProfileDraft {
  enabled: boolean;
  canSell: boolean;
  canPurchase: boolean;
  canPos: boolean;
  trackInventory: boolean;
  trackingMode: ItemTrackingMode;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  salesPrice: string;
  currencyCode: string | null;
  salesTaxId: string | null;
  purchaseTaxId: string | null;
  taxClassificationKey: string;
  accountingMappingKey: string;
  status: 'DRAFT' | 'ACTIVE';
}

export function emptyCompanyProfileDraft(currencyCode: string | null): CompanyProfileDraft {
  return {
    enabled: false,
    canSell: false,
    canPurchase: false,
    canPos: false,
    trackInventory: false,
    trackingMode: 'NONE',
    defaultSalesUomId: null,
    defaultPurchaseUomId: null,
    salesPrice: '',
    currencyCode,
    salesTaxId: null,
    purchaseTaxId: null,
    taxClassificationKey: '',
    accountingMappingKey: '',
    status: 'DRAFT',
  };
}

export function companyProfileDraftFromModel(
  profile: ItemCompanyProfile | null,
  companyCurrencyCode: string | null,
): CompanyProfileDraft {
  if (!profile) {
    return emptyCompanyProfileDraft(companyCurrencyCode);
  }
  return {
    enabled: true,
    canSell: profile.canSell,
    canPurchase: profile.canPurchase,
    canPos: profile.canPos,
    trackInventory: profile.trackInventory,
    trackingMode: profile.trackingMode,
    defaultSalesUomId: profile.defaultSalesUomId,
    defaultPurchaseUomId: profile.defaultPurchaseUomId,
    salesPrice: profile.salesPrice ?? '',
    currencyCode: profile.currencyCode ?? companyCurrencyCode,
    salesTaxId: profile.salesTaxId,
    purchaseTaxId: profile.purchaseTaxId,
    taxClassificationKey: profile.taxClassificationKey ?? '',
    accountingMappingKey: profile.accountingMappingKey ?? '',
    status: profile.status,
  };
}

export function defaultEnabledCompanyProfile(
  itemKind: ItemKind,
  companyCurrencyCode: string | null,
): CompanyProfileDraft {
  return {
    enabled: true,
    canSell: true,
    canPurchase: true,
    canPos: false,
    trackInventory: itemKind === 'PRODUCT',
    trackingMode: 'NONE',
    defaultSalesUomId: null,
    defaultPurchaseUomId: null,
    salesPrice: '',
    currencyCode: companyCurrencyCode,
    salesTaxId: null,
    purchaseTaxId: null,
    taxClassificationKey: '',
    accountingMappingKey: '',
    status: 'DRAFT',
  };
}

export function companyProfileDraftsEqual(a: CompanyProfileDraft, b: CompanyProfileDraft): boolean {
  return (
    a.enabled === b.enabled &&
    a.canSell === b.canSell &&
    a.canPurchase === b.canPurchase &&
    a.canPos === b.canPos &&
    a.trackInventory === b.trackInventory &&
    a.trackingMode === b.trackingMode &&
    a.defaultSalesUomId === b.defaultSalesUomId &&
    a.defaultPurchaseUomId === b.defaultPurchaseUomId &&
    a.salesPrice === b.salesPrice &&
    a.currencyCode === b.currencyCode &&
    a.salesTaxId === b.salesTaxId &&
    a.purchaseTaxId === b.purchaseTaxId &&
    a.taxClassificationKey === b.taxClassificationKey &&
    a.accountingMappingKey === b.accountingMappingKey &&
    a.status === b.status
  );
}

export function rebaseCompanyProfileDraft(
  oldBase: CompanyProfileDraft,
  freshBase: CompanyProfileDraft,
  currentDraft: CompanyProfileDraft,
): CompanyProfileDraft {
  if (!oldBase.enabled && currentDraft.enabled) {
    return freshBase.enabled ? { ...freshBase } : { ...currentDraft };
  }
  if (!freshBase.enabled) {
    return { ...currentDraft };
  }
  return {
    enabled: true,
    canSell: currentDraft.canSell !== oldBase.canSell ? currentDraft.canSell : freshBase.canSell,
    canPurchase: currentDraft.canPurchase !== oldBase.canPurchase ? currentDraft.canPurchase : freshBase.canPurchase,
    canPos: currentDraft.canPos !== oldBase.canPos ? currentDraft.canPos : freshBase.canPos,
    trackInventory:
      currentDraft.trackInventory !== oldBase.trackInventory
        ? currentDraft.trackInventory
        : freshBase.trackInventory,
    trackingMode:
      currentDraft.trackingMode !== oldBase.trackingMode ? currentDraft.trackingMode : freshBase.trackingMode,
    defaultSalesUomId:
      currentDraft.defaultSalesUomId !== oldBase.defaultSalesUomId
        ? currentDraft.defaultSalesUomId
        : freshBase.defaultSalesUomId,
    defaultPurchaseUomId:
      currentDraft.defaultPurchaseUomId !== oldBase.defaultPurchaseUomId
        ? currentDraft.defaultPurchaseUomId
        : freshBase.defaultPurchaseUomId,
    salesPrice: currentDraft.salesPrice !== oldBase.salesPrice ? currentDraft.salesPrice : freshBase.salesPrice,
    currencyCode: freshBase.currencyCode,
    salesTaxId: currentDraft.salesTaxId !== oldBase.salesTaxId ? currentDraft.salesTaxId : freshBase.salesTaxId,
    purchaseTaxId:
      currentDraft.purchaseTaxId !== oldBase.purchaseTaxId ? currentDraft.purchaseTaxId : freshBase.purchaseTaxId,
    taxClassificationKey:
      currentDraft.taxClassificationKey !== oldBase.taxClassificationKey
        ? currentDraft.taxClassificationKey
        : freshBase.taxClassificationKey,
    accountingMappingKey:
      currentDraft.accountingMappingKey !== oldBase.accountingMappingKey
        ? currentDraft.accountingMappingKey
        : freshBase.accountingMappingKey,
    status: freshBase.status,
  };
}

function validateNonNegativeDecimal(raw: string): FieldError | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (NON_NEGATIVE_DECIMAL.test(trimmed)) return null;
  if (/^-\d+(?:\.\d{1,8})?$/.test(trimmed)) {
    return { key: 'itemForm.validation.noNegative' };
  }
  return { key: 'itemForm.validation.decimal' };
}

export function validateCompanyProfileDraft(
  draft: CompanyProfileDraft,
  standardCost: string,
  canManageCost: boolean,
  hasProfileOnServer: boolean,
): DraftErrors {
  const errors: DraftErrors = {};

  if (draft.enabled) {
    const priceErr = validateNonNegativeDecimal(draft.salesPrice);
    if (priceErr) {
      errors['salesPrice'] = priceErr;
    } else if (draft.salesPrice.trim() && !draft.currencyCode) {
      errors['currencyCode'] = { key: 'itemForm.reasons.noCurrency' };
    }

    if (draft.taxClassificationKey.trim().length > ITEM_LIMITS.key) {
      errors['taxClassificationKey'] = {
        key: 'itemForm.validation.maxLength',
        params: { max: ITEM_LIMITS.key },
      };
    }

    if (draft.accountingMappingKey.trim().length > ITEM_LIMITS.key) {
      errors['accountingMappingKey'] = {
        key: 'itemForm.validation.maxLength',
        params: { max: ITEM_LIMITS.key },
      };
    }
  }

  if ((draft.enabled || hasProfileOnServer) && canManageCost && standardCost.trim()) {
    const costErr = validateNonNegativeDecimal(standardCost);
    if (costErr) {
      errors['standardCost'] = costErr;
    }
  }

  return errors;
}

function trimOrNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function toCompanyProfileCreateBody(draft: CompanyProfileDraft): CompanyProfileBody {
  const salesPrice = trimOrNull(draft.salesPrice);
  const body: CompanyProfileBody = {
    canSell: draft.canSell,
    canPurchase: draft.canPurchase,
    canPos: draft.canSell ? draft.canPos : false,
    trackInventory: draft.trackInventory,
    trackingMode: draft.trackInventory ? draft.trackingMode : 'NONE',
    defaultSalesUomId: draft.defaultSalesUomId,
    defaultPurchaseUomId: draft.defaultPurchaseUomId,
    salesPrice,
    currencyCode: draft.currencyCode,
    salesTaxId: draft.salesTaxId,
    purchaseTaxId: draft.purchaseTaxId,
    taxClassificationKey: trimOrNull(draft.taxClassificationKey),
    accountingMappingKey: trimOrNull(draft.accountingMappingKey),
  };
  return body;
}

export function toCompanyProfilePatchBody(
  base: CompanyProfileDraft,
  draft: CompanyProfileDraft,
): CompanyProfilePatch {
  const patch: CompanyProfilePatch = {};
  if (base.canSell !== draft.canSell) patch.canSell = draft.canSell;
  if (base.canPurchase !== draft.canPurchase) patch.canPurchase = draft.canPurchase;
  const nextPos = draft.canSell ? draft.canPos : false;
  if (base.canPos !== nextPos) patch.canPos = nextPos;
  if (base.trackInventory !== draft.trackInventory) patch.trackInventory = draft.trackInventory;
  const nextMode = draft.trackInventory ? draft.trackingMode : 'NONE';
  if (base.trackingMode !== nextMode) patch.trackingMode = nextMode;
  if (base.defaultSalesUomId !== draft.defaultSalesUomId) patch.defaultSalesUomId = draft.defaultSalesUomId;
  if (base.defaultPurchaseUomId !== draft.defaultPurchaseUomId) {
    patch.defaultPurchaseUomId = draft.defaultPurchaseUomId;
  }

  const basePrice = trimOrNull(base.salesPrice);
  const nextPrice = trimOrNull(draft.salesPrice);
  if (basePrice !== nextPrice) {
    patch.salesPrice = nextPrice;
    if (nextPrice !== null) {
      patch.currencyCode = draft.currencyCode;
    }
  }

  if (base.salesTaxId !== draft.salesTaxId) patch.salesTaxId = draft.salesTaxId;
  if (base.purchaseTaxId !== draft.purchaseTaxId) patch.purchaseTaxId = draft.purchaseTaxId;

  const nextTaxClass = trimOrNull(draft.taxClassificationKey);
  if (trimOrNull(base.taxClassificationKey) !== nextTaxClass) patch.taxClassificationKey = nextTaxClass;

  const nextAcct = trimOrNull(draft.accountingMappingKey);
  if (trimOrNull(base.accountingMappingKey) !== nextAcct) patch.accountingMappingKey = nextAcct;

  return patch;
}

@Component({
  selector: 'app-item-company-profile-tab',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    SectionBar,
    Segmented,
    Switch,
    TradeUomPicker,
    StandardCostSection,
  ],
  providers: [provideIcons({ tablerBuildingStore, tablerPlus })],
  templateUrl: './company-profile-tab.html',
  host: { class: 'flex flex-col gap-10' },
})
export class CompanyProfileTab {
  private static nextId = 0;
  protected readonly uid = `item-cp-${++CompanyProfileTab.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly itemKind = input.required<ItemKind>();
  readonly companyName = input('');
  readonly companyCurrencyCode = input<string | null>(null);
  readonly taxes = input<readonly Tax[]>([]);
  readonly uoms = input<readonly Uom[]>([]);
  readonly hasServerProfile = input(false);
  readonly trackingLocked = input(false);
  readonly readonly = input(false);
  readonly canViewCost = input(true);
  readonly canManageCost = input(true);
  readonly errors = input<DraftErrors>({});

  readonly draft = model.required<CompanyProfileDraft>();
  readonly standardCost = model('');
  readonly enabledChange = output<void>();

  protected readonly limits = ITEM_LIMITS;
  protected readonly pageGrid = RECORD_PAGE_GRID;

  protected readonly isProduct = computed(() => this.itemKind() === 'PRODUCT');
  protected readonly trackingDisabled = computed(
    () => this.readonly() || !this.isProduct() || this.trackingLocked(),
  );

  protected readonly trackingDisabledReason = computed<string | null>(() => {
    this.i18n();
    if (!this.isProduct()) {
      return this.transloco.translate('itemForm.reasons.noTracking');
    }
    if (this.trackingLocked()) {
      return this.transloco.translate('itemForm.reasons.locked');
    }
    return null;
  });

  protected readonly posDisabled = computed(() => this.readonly() || !this.draft().canSell);
  protected readonly posDisabledReason = computed<string | null>(() => {
    this.i18n();
    if (!this.draft().canSell) {
      return this.transloco.translate('itemForm.reasons.needSell');
    }
    return null;
  });

  protected readonly trackingOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const disabled = this.trackingDisabled();
    return (['NONE', 'LOT', 'SERIAL'] as const).map((mode) => ({
      value: mode,
      label: this.transloco.translate(TRACKING_KEY[mode]),
      disabled,
    }));
  });

  protected readonly taxOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const options: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('itemForm.states.noTax') },
    ];
    for (const tax of this.taxes()) {
      options.push({ value: tax.id, label: `${tax.name} · ${tax.rate}` });
    }
    return options;
  });

  protected readonly profileStatusLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.draft().status === 'ACTIVE' ? 'tradeShared.common.active' : 'tradeShared.itemStatus.DRAFT',
    );
  });

  protected readonly displayCurrencyCode = computed(
    () => this.draft().currencyCode ?? this.companyCurrencyCode(),
  );

  protected readonly formattedSalesPrice = computed(() =>
    formatMoney(this.displayCurrencyCode(), this.draft().salesPrice),
  );

  protected errorText(path: string): string | null {
    this.i18n();
    const err = this.errors()[path];
    if (!err) return null;
    return this.transloco.translate(err.key, err.params);
  }

  protected describedBy(path: string, controlId: string): string {
    return this.errorText(path) ? `${controlId}-hint ${controlId}-error` : `${controlId}-hint`;
  }

  protected uomDisplayLabel(uomId: string | null): string {
    if (!uomId) return '—';
    const lang = this.language();
    const found = this.uoms().find((u) => u.id === uomId);
    if (!found) return uomId;
    return `${found.code} — ${itemName(found, lang) || found.displayName}`;
  }

  protected taxDisplayLabel(taxId: string | null): string {
    this.i18n();
    if (!taxId) return this.transloco.translate('itemForm.states.noTax');
    const found = this.taxes().find((t) => t.id === taxId);
    return found ? `${found.name} · ${found.rate}` : taxId;
  }

  protected enableProfile(): void {
    if (this.readonly()) return;
    this.draft.set(defaultEnabledCompanyProfile(this.itemKind(), this.companyCurrencyCode()));
    this.enabledChange.emit();
  }

  protected onCanSellChange(canSell: boolean): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({
      ...d,
      canSell,
      canPos: canSell ? d.canPos : false,
    }));
  }

  protected onCanPurchaseChange(canPurchase: boolean): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, canPurchase }));
  }

  protected onCanPosChange(canPos: boolean): void {
    if (this.posDisabled()) return;
    this.draft.update((d) => ({ ...d, canPos }));
  }

  protected onTrackInventoryChange(trackInventory: boolean): void {
    if (this.trackingDisabled()) return;
    this.draft.update((d) => ({
      ...d,
      trackInventory,
      trackingMode: trackInventory ? d.trackingMode : 'NONE',
    }));
  }

  protected onTrackingModeChange(mode: string | null): void {
    if (this.trackingDisabled() || !mode) return;
    const next = mode as ItemTrackingMode;
    this.draft.update((d) => ({
      ...d,
      trackInventory: next === 'NONE' ? d.trackInventory : true,
      trackingMode: next,
    }));
  }

  protected onUomChange(field: 'defaultSalesUomId' | 'defaultPurchaseUomId', value: string | null): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected onTaxChange(field: 'salesTaxId' | 'purchaseTaxId', value: string): void {
    if (this.readonly()) return;
    this.draft.update((d) => ({ ...d, [field]: value || null }));
  }

  protected onTextChange(
    field: 'salesPrice' | 'taxClassificationKey' | 'accountingMappingKey',
    event: Event,
  ): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }
}

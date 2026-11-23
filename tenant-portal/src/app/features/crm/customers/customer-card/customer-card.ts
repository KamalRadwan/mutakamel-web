import { Component, computed, inject, input, model, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuilding,
  tablerMail,
  tablerMapPin,
  tablerPhone,
  tablerUser,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { runInCrm } from '../../shared/crm-runtime';
import { branchGrants } from '../../settings/shared/settings-access';
import { ApiError, correlationIdOf } from '../../../../core/api/api-errors';
import { ActionItem, ActionSelection, ActionSwatch } from '../../../../shared/ui/actions-menu/actions-menu';
import { contrastInkFor } from '../../../../shared/ui/color/contrast-ink';
import {
  PhoneActionSource,
  PhoneActionSourceType,
  PhoneActions,
} from '../../../../shared/widgets/phone-actions/phone-actions';
import { errorCodeOf } from '../../settings/shared/settings-api';
import { RecordCard } from '../../shared/record/card/record-card';
import { RecordCardOwner } from '../../shared/record/card/record-card.model';
import { CUSTOMER_ERROR_KEYS } from '../customers.api';
import { CUSTOMER_STATUS_TONE } from '../customer-statuses';
import {
  CARD_COLORS,
  Cap,
  CardColor,
  CustomerBoardItem,
  CustomerCapabilities,
  CustomerRow,
  CustomerStatus,
  TagSummary,
  nameIn,
  ownerFullName,
} from '../customers.model';

const PHONE_SOURCE_TYPE: PhoneActionSourceType = 'CUSTOMER_PROFILE';
const COLOR_KEYS = Object.keys(CARD_COLORS) as CardColor[];

const STATUS_BADGE_TONE: Record<'brand' | 'success' | 'danger', string> = {
  brand: 'bg-brand text-on-brand',
  success: 'bg-success text-on-success',
  danger: 'bg-danger text-on-danger',
};

export function canManageCustomerStatus(branchId: string): boolean {
  return runInCrm(() => {
    if (inject(TenantScopeState).me()?.isTenantOwner) return true;
    const grants = branchGrants('crm.customer_profiles.status.manage');
    return grants === 'ALL' || grants.has(branchId);
  });
}

export function customerStatusBadgeClass(status: CustomerStatus): string {
  return STATUS_BADGE_TONE[CUSTOMER_STATUS_TONE[status]];
}

function hasScopedCapability(cap: Cap | null | undefined, ownerUserId: string | null): boolean {
  if (!cap) return false;
  return cap.scope === 'all' || (!!ownerUserId && !!cap.ownerUserIds?.includes(ownerUserId));
}

export function canCreateCustomer(capabilities: CustomerCapabilities | null): boolean {
  return Boolean(capabilities?.customerProfiles.create);
}

export function canUpdateCustomer(
  capabilities: CustomerCapabilities | null,
  item: Pick<CustomerBoardItem, 'ownerUserId'>,
): boolean {
  return hasScopedCapability(capabilities?.customerProfiles.update, item.ownerUserId);
}

export function canDeleteCustomer(
  capabilities: CustomerCapabilities | null,
  item: Pick<CustomerBoardItem, 'ownerUserId'>,
): boolean {
  return hasScopedCapability(capabilities?.customerProfiles.delete, item.ownerUserId);
}

export function isCustomerRow(item: CustomerBoardItem | CustomerRow): item is CustomerRow {
  return 'createdAt' in item;
}

export function customerPhone(item: CustomerRow): string | null {
  const candidates = [item.primaryMobile, item.companyPhone, item.primaryContact?.phones?.[0]];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function customerEmail(item: CustomerRow): string | null {
  const candidates = [item.email, item.companyEmail, item.primaryContact?.email];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function customerCityOrNull(item: CustomerRow, language: string): string | null {
  if (item.cityName) {
    const localized = nameIn(item.cityName, language).trim();
    if (localized) return localized;
  }
  if (item.address?.cityName) {
    const localized = nameIn(item.address.cityName, language).trim();
    if (localized) return localized;
  }
  const legacy = item.address?.city?.trim();
  return legacy || null;
}

export function customerCity(item: CustomerRow, language: string): string {
  return customerCityOrNull(item, language) ?? '—';
}

export function customerPhoneSource(item: Pick<CustomerBoardItem, 'id' | 'displayName'>): PhoneActionSource {
  return {
    type: PHONE_SOURCE_TYPE,
    id: item.id,
    label: item.displayName,
  };
}

export function tagBgColor(tag: TagSummary): string | null {
  return tag.backgroundColor?.trim() || null;
}

export function tagTextColor(tag: TagSummary): string | null {
  const text = tag.textColor?.trim();
  if (text) return text;
  const bg = tagBgColor(tag);
  return bg ? contrastInkFor(bg) : null;
}

export function ownerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatCustomerDate(iso: string | null | undefined, language: string, timeZone = 'UTC'): string {
  if (!iso || !iso.trim()) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    day: 'numeric', month: language === 'ar' ? 'long' : 'short', year: 'numeric', timeZone,
  }).format(parsed);
}

export function customerErrorMessage(
  error: unknown,
  transloco: TranslocoService,
  fallbackKey: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return transloco.translate('customers.errors.notSaved');
    if (error.status === 429) {
      const value = error.details?.['retryAfterSeconds'];
      const seconds = Array.isArray(value) ? value[0] : value;
      return transloco.translate('customers.errors.rateLimited', { seconds: seconds ?? 0 });
    }
  }
  const code = errorCodeOf(error);
  if (code) {
    const mappedKey = code.endsWith('_IDEMPOTENCY_MISMATCH') ? 'customers.errors.GW.IDEM.MISMATCH'
      : CUSTOMER_ERROR_KEYS[code] ?? `customers.errors.${code}`;
    if (Object.hasOwn(transloco.getTranslation(transloco.getActiveLang()), mappedKey)) return transloco.translate(mappedKey);
  }
  return transloco.translate(fallbackKey);
}

export function customerReadState(error: unknown, transloco: TranslocoService) {
  const correlation = correlationIdOf(error);
  return {
    kind: error instanceof ApiError && error.status === 403 ? 'forbidden' as const
      : error instanceof ApiError && error.status === 404 ? 'not-found' as const : 'load-failure' as const,
    text: [customerErrorMessage(error, transloco, 'customers.empty.loadFailed'), correlation].filter(Boolean).join(' · '),
  };
}

export function customerNeedsReload(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE'
    || error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'));
}

export function customerReadOnlyError(error: unknown): boolean {
  return error instanceof ApiError && ['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY',
    'CRM_LEADS_DISABLED', 'CRM_OPPORTUNITIES_DISABLED'].includes(error.code);
}

/** Build the card and table Actions menu items for a customer. */
export function customerActions(
  item: CustomerBoardItem,
  perms: { canUpdate: boolean; canDelete: boolean },
  translate: (key: string) => string,
): ActionItem[] {
  const items: ActionItem[] = [
    {
      id: 'open',
      title: translate('customers.card.menu.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    },
    {
      id: 'edit',
      title: translate('customers.card.menu.edit'),
      icon: 'tablerEdit',
      tile: 'bg-icon-orange',
      ...(!perms.canUpdate ? { disabled: true, reason: translate('customers.card.menu.editDenied') } : {}),
    },
  ];

  if (perms.canUpdate) {
    const swatches: ActionSwatch[] = [
      ...COLOR_KEYS.map((color) => ({
        id: color,
        label: translate(`customers.color.${color}`),
        color: CARD_COLORS[color],
        selected: item.cardColor === color,
      })),
      {
        id: null,
        label: translate('customers.color.none'),
        color: null,
        selected: item.cardColor === null,
      },
    ];

    items.push({
      id: 'color',
      title: translate('customers.card.menu.color'),
      icon: 'tablerPalette',
      tile: 'bg-icon-violet',
      swatches,
    });
  }

  if (perms.canDelete) {
    const blacklisted = item.status === 'BLACKLISTED';
    items.push({
      id: 'delete',
      title: translate('customers.card.menu.delete'),
      icon: 'tablerTrash',
      tile: 'bg-icon-red',
      danger: true,
      ...(blacklisted
        ? {
            disabled: true,
            reason: translate('customers.card.menu.deleteBlacklistedReason'),
          }
        : {}),
    });
  }

  return items;
}

@Component({
  selector: 'app-customer-card',
  imports: [NgIcon, TranslocoPipe, PhoneActions, RecordCard],
  providers: [
    provideIcons({
      tablerBuilding,
      tablerUser,
      tablerPhone,
      tablerMail,
      tablerMapPin,
    }),
  ],
  templateUrl: './customer-card.html',
  host: { class: 'block' },
})
export class CustomerCard {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly item = input.required<CustomerBoardItem | CustomerRow>();
  readonly detailed = input(false);
  readonly canUpdate = input(true);
  readonly canDelete = input(true);
  readonly expanded = model(false);

  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly delete = output<void>();
  readonly view = output<void>();
  readonly activities = output<void>();

  protected readonly isCorporate = computed(() => this.item().profileType === 'CORPORATE');
  protected readonly cardTypeIcon = computed(() => (this.isCorporate() ? 'tablerBuilding' : 'tablerUser'));
  protected readonly cardTypeTile = computed(() => (this.isCorporate() ? 'bg-icon-navy' : 'bg-icon-blue'));

  protected readonly cardSubtitle = computed(() => {
    const current = this.item();
    if (current.profileType === 'CORPORATE') {
      if (isCustomerRow(current)) {
        return current.primaryContact?.displayName ?? current.primaryContactName ?? null;
      }
      return current.primaryContactName ?? null;
    }
    if (isCustomerRow(current)) {
      return current.primaryMobile || current.email || null;
    }
    return null;
  });

  protected readonly cardOwner = computed<RecordCardOwner | null>(() => {
    const owner = this.item().owner;
    const name = ownerFullName(owner);
    return name ? { name, avatarUrl: owner?.avatarUrl ?? null } : null;
  });

  protected readonly statusBadgeClass = computed(() => customerStatusBadgeClass(this.item().status));
  protected readonly visibleTags = computed(() => this.item().tags.slice(0, 2));
  protected readonly extraTagsCount = computed(() => Math.max(0, this.item().tags.length - 2));
  protected readonly extraTagsTitle = computed(() =>
    this.item()
      .tags.slice(2)
      .map((tag) => tag.name)
      .join(', '),
  );

  protected readonly rowPhone = computed(() => {
    const current = this.item();
    return this.detailed() && isCustomerRow(current) ? customerPhone(current) : null;
  });

  protected readonly rowEmail = computed(() => {
    const current = this.item();
    return this.detailed() && isCustomerRow(current) ? customerEmail(current) : null;
  });

  protected readonly rowCity = computed(() => {
    const current = this.item();
    return this.detailed() && isCustomerRow(current) ? customerCityOrNull(current, this.language()) : null;
  });

  protected readonly phoneSource = computed<PhoneActionSource>(() => customerPhoneSource(this.item()));

  protected readonly actions = computed(() => {
    this.i18n();
    return customerActions(
      this.item(),
      { canUpdate: this.canUpdate(), canDelete: this.canDelete() },
      (key) => this.transloco.translate(key),
    );
  });

  protected tagBg(tag: TagSummary): string | null {
    return tagBgColor(tag);
  }

  protected tagText(tag: TagSummary): string | null {
    return tagTextColor(tag);
  }

  protected act(selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.view.emit();
        break;
      case 'color':
        this.recolor.emit((selection.value as CardColor | null) ?? null);
        break;
      case 'delete':
        this.delete.emit();
        break;
    }
  }
}

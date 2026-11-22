import { Component, computed, inject, input, model, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsExchange,
  tablerArrowsRightLeft,
  tablerCalendarDue,
  tablerCalendarPlus,
  tablerCash,
  tablerPercentage,
  tablerPhone,
  tablerTarget,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionSwatch } from '../../../../shared/ui/actions-menu/actions-menu';
import { contrastInkFor } from '../../../../shared/ui/color/contrast-ink';
import {
  PhoneActionSource,
  PhoneActionSourceType,
  PhoneActions,
} from '../../../../shared/widgets/phone-actions/phone-actions';
import { ApiError, errorCodeOf } from '../../settings/shared/settings-api';
import { RecordCard } from '../../shared/record/card/record-card';
import { DueBucket, RecordCardOwner } from '../../shared/record/card/record-card.model';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { OPPORTUNITY_ERROR_KEYS, opportunitySharedErrorKey } from '../opportunities.api';
import {
  ActivityState,
  CARD_COLORS,
  CardColor,
  OpportunityBoardRow,
  OpportunityCapabilities,
  OpportunityRow,
  OpportunityStageFlag,
  OpportunityTag,
  PipelineStageView,
  Scope,
  formatMoney,
  isClosed,
  moneyNoCurrencyKey,
  stageLabel,
} from '../opportunities.model';
import { StageTone, stageTone } from '../opportunity-stage-tone';

export type OpportunityCardRow = OpportunityRow | OpportunityBoardRow;

export interface OpportunityOpenEvent<T extends OpportunityCardRow = OpportunityRow> {
  row: T;
  nav: RecordNavContext;
}

const PHONE_SOURCE_TYPE: PhoneActionSourceType = 'OPPORTUNITY';
const COLOR_KEYS = Object.keys(CARD_COLORS) as CardColor[];
const MAX_CARD_TAGS = 3;

const STAGE_BADGE_CLASSES: Record<StageTone, string> = {
  brand: 'bg-brand-soft text-on-brand-soft',
  success: 'bg-success-soft text-on-success-soft',
  danger: 'bg-danger-soft text-on-danger-soft',
  neutral: 'bg-neutral-soft text-on-neutral-soft',
};

const EN_SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const AR_SHORT_DATE = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function isFullOpportunityRow(row: OpportunityCardRow): row is OpportunityRow {
  return 'primaryContact' in row;
}

export function boardRowToOpportunityRow(row: OpportunityBoardRow): OpportunityRow {
  const { contactDisplayName: _contactDisplayName, ...base } = row;
  return {
    ...base,
    customerPhone: null,
    customerEmail: null,
    customerCountry: null,
    customerCity: null,
    primaryContact: null,
    leadSourceName: null,
    leadSourceIconUrl: null,
  };
}

export function opportunityRowToBoardRow(
  row: OpportunityRow,
  fallbackContactDisplayName: string | null = null,
): OpportunityBoardRow {
  const {
    customerPhone: _customerPhone,
    customerEmail: _customerEmail,
    customerCountry: _customerCountry,
    customerCity: _customerCity,
    primaryContact,
    leadSourceName: _leadSourceName,
    leadSourceIconUrl: _leadSourceIconUrl,
    ...base
  } = row;
  return {
    ...base,
    contactDisplayName: primaryContact?.displayName ?? fallbackContactDisplayName,
  };
}

function hasScopedCapability(cap: Scope | null | undefined, ownerUserId: string | null): boolean {
  if (!cap) return false;
  if (cap.ownerUserIds) {
    return !!ownerUserId && cap.ownerUserIds.includes(ownerUserId);
  }
  return true;
}

export function canCreateOpportunity(capabilities: OpportunityCapabilities | null | undefined): boolean {
  return Boolean(capabilities?.create);
}

export function canUpdateOpportunity(
  capabilities: OpportunityCapabilities | null | undefined,
  row: Pick<OpportunityCardRow, 'ownerUserId'>,
): boolean {
  return hasScopedCapability(capabilities?.update, row.ownerUserId);
}

export function canDeleteOpportunity(
  capabilities: OpportunityCapabilities | null | undefined,
  row: Pick<OpportunityCardRow, 'ownerUserId'>,
): boolean {
  return hasScopedCapability(capabilities?.delete, row.ownerUserId);
}

export function canMoveOpportunity(
  capabilities: OpportunityCapabilities | null | undefined,
  row: Pick<OpportunityCardRow, 'ownerUserId'>,
): boolean {
  return hasScopedCapability(capabilities?.move, row.ownerUserId);
}

export function canTransferOpportunity(
  capabilities: OpportunityCapabilities | null | undefined,
  row: Pick<OpportunityCardRow, 'ownerUserId'>,
): boolean {
  return hasScopedCapability(capabilities?.transfer, row.ownerUserId);
}

export function stageBadgeClass(flag: OpportunityStageFlag): string {
  return STAGE_BADGE_CLASSES[stageTone(flag)];
}

export function activityDueBucket(state: ActivityState): DueBucket | null {
  return state === 'NO_OPEN' ? null : state;
}

export function opportunityCustomerName(
  row: Pick<OpportunityCardRow, 'customerCompanyName' | 'customerDisplayName'>,
): string | null {
  return row.customerCompanyName?.trim() || row.customerDisplayName?.trim() || null;
}

export function opportunityContactName(row: OpportunityCardRow): string | null {
  const raw = isFullOpportunityRow(row) ? row.primaryContact?.displayName : row.contactDisplayName;
  return raw?.trim() || null;
}

export function opportunitySubtitle(row: OpportunityCardRow): string | null {
  const customer = opportunityCustomerName(row);
  const contact = opportunityContactName(row);
  if (customer && contact && contact !== customer) {
    return `${customer} · ${contact}`;
  }
  return customer ?? contact ?? null;
}

export function opportunityPhone(row: OpportunityCardRow): string | null {
  if (!isFullOpportunityRow(row)) return null;
  return row.primaryContact?.phones?.[0]?.trim() || row.customerPhone?.trim() || null;
}

export function opportunityPhoneSource(row: Pick<OpportunityCardRow, 'id' | 'title'>): PhoneActionSource {
  return {
    type: PHONE_SOURCE_TYPE,
    id: row.id,
    label: row.title,
  };
}

function extractIsoDateParts(raw: string | null | undefined): { year: number; month: number; day: number; iso: string } | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day, iso: `${match[1]}-${match[2]}-${match[3]}` };
}

export function formatShortDate(raw: string | null | undefined, lang: 'ar' | 'en'): string | null {
  const parts = extractIsoDateParts(raw);
  if (!parts) {
    if (!raw?.trim()) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return (lang === 'ar' ? AR_SHORT_DATE : EN_SHORT_DATE).format(parsed);
  }
  const local = new Date(parts.year, parts.month - 1, parts.day);
  return (lang === 'ar' ? AR_SHORT_DATE : EN_SHORT_DATE).format(local);
}

export function isCloseDateOverdue(row: Pick<OpportunityCardRow, 'expectedCloseDate' | 'status'>): boolean {
  if (isClosed(row)) return false;
  const parts = extractIsoDateParts(row.expectedCloseDate);
  if (!parts) return false;
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return parts.iso < todayIso;
}

export function opportunityTagBg(tag: OpportunityTag): string | null {
  return tag.backgroundColor?.trim() || null;
}

export function opportunityTagText(tag: OpportunityTag): string | null {
  const text = tag.textColor?.trim();
  if (text) return text;
  const bg = opportunityTagBg(tag);
  return bg ? contrastInkFor(bg) : null;
}

export function isConflictError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 409 || error.code === 'CRM.OPPORTUNITY.CONCURRENT_UPDATE')
  );
}

export function opportunityErrorMessage(
  error: unknown,
  transloco: TranslocoService,
  fallbackKey: string,
): string {
  const code = errorCodeOf(error);
  if (code) {
    const mappedKey = OPPORTUNITY_ERROR_KEYS[code] ?? `opportunities.errors.${code}`;
    for (const key of [mappedKey, opportunitySharedErrorKey(code)]) {
      if (!key) continue;
      const translated = transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
  }
  return transloco.translate(fallbackKey);
}

/** Build the card and table Actions menu items for an opportunity. */
export function opportunityActions(
  row: OpportunityCardRow,
  stages: readonly PipelineStageView[],
  language: string,
  perms: {
    canUpdate: boolean;
    canDelete: boolean;
    canMove?: boolean;
    canTransfer?: boolean;
  },
  translate: (key: string) => string,
): ActionItem[] {
  const items: ActionItem[] = [
    {
      id: 'open',
      title: translate('opportunities.card.menu.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    },
    {
      id: 'edit',
      title: translate('opportunities.card.menu.edit'),
      icon: 'tablerEdit',
      tile: 'bg-icon-orange',
    },
  ];

  const allowMove = perms.canMove ?? perms.canUpdate;
  if (allowMove) {
    const activeStages = stages
      .filter((stage) => stage.isActive)
      .slice()
      .sort((a, b) => a.rank - b.rank);
    if (activeStages.length > 0) {
      items.push({
        id: 'move',
        title: translate('opportunities.card.menu.move'),
        icon: 'tablerArrowsExchange',
        tile: 'bg-icon-teal',
        choices: activeStages.map((stage) => ({
          id: stage.id,
          label: stageLabel(stage, language),
          selected: stage.id === row.stageId,
        })),
      });
    }
  }

  const allowTransfer = perms.canTransfer ?? perms.canUpdate;
  if (allowTransfer) {
    items.push({
      id: 'transfer',
      title: translate('opportunities.card.menu.transfer'),
      icon: 'tablerArrowsRightLeft',
      tile: 'bg-icon-navy',
    });
  }

  if (perms.canUpdate) {
    const swatches: ActionSwatch[] = [
      ...COLOR_KEYS.map((color) => ({
        id: color,
        label: translate(`opportunities.card.color.${color}`),
        color: CARD_COLORS[color],
        selected: row.cardColor === color,
      })),
      {
        id: null,
        label: translate('opportunities.card.color.none'),
        color: null,
        selected: row.cardColor === null,
      },
    ];

    items.push({
      id: 'color',
      title: translate('opportunities.card.menu.color'),
      icon: 'tablerPalette',
      tile: 'bg-icon-violet',
      swatches,
    });
  }

  items.push({
    id: 'activities',
    title: translate('opportunities.card.menu.activities'),
    icon: 'tablerCalendarPlus',
    tile: 'bg-icon-green',
  });

  if (perms.canDelete) {
    items.push({
      id: 'delete',
      title: translate('opportunities.card.menu.delete'),
      icon: 'tablerTrash',
      tile: 'bg-icon-red',
      danger: true,
    });
  }

  return items;
}

@Component({
  selector: 'app-opportunity-card',
  imports: [NgIcon, TranslocoPipe, PhoneActions, RecordCard],
  providers: [
    provideIcons({
      tablerTarget,
      tablerCash,
      tablerCalendarDue,
      tablerPercentage,
      tablerPhone,
      tablerCalendarPlus,
      tablerArrowsExchange,
      tablerArrowsRightLeft,
    }),
  ],
  templateUrl: './opportunity-card.html',
  host: { class: 'block h-full' },
})
export class OpportunityCard {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly row = input.required<OpportunityCardRow>();
  readonly stages = input.required<PipelineStageView[]>();
  readonly detailed = input(false);
  readonly expanded = model(false);
  readonly canUpdate = input(true);
  readonly canDelete = input(true);
  readonly canMove = input<boolean | null>(null);
  readonly canTransfer = input<boolean | null>(null);

  readonly open = output<OpportunityCardRow>();
  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly moveTo = output<string>();
  readonly transfer = output<OpportunityCardRow>();
  readonly activities = output<OpportunityCardRow>();
  readonly remove = output<OpportunityCardRow>();

  protected readonly cardSubtitle = computed(() => opportunitySubtitle(this.row()));
  protected readonly dueBucket = computed(() => activityDueBucket(this.row().activityState));
  protected readonly showDetails = computed(() => this.detailed() || this.expanded());

  protected readonly cardOwner = computed<RecordCardOwner | null>(() => {
    const current = this.row();
    const name = current.ownerDisplayName?.trim();
    return name ? { name, avatarUrl: current.ownerAvatarUrl } : null;
  });

  protected readonly stage = computed(() =>
    this.stages().find((item) => item.id === this.row().stageId) ?? null,
  );

  protected readonly stageName = computed(() => {
    const current = this.stage();
    return current ? stageLabel(current, this.language()) : '';
  });

  protected readonly stageBadge = computed(() => stageBadgeClass(this.row().stageFlag));

  protected readonly amountText = computed<string | null>(() => {
    const current = this.row();
    if (current.amount === null) return null;
    const formatted = formatMoney(current.amount, current.currencyCode, this.language());
    return formatted === '—' ? null : formatted;
  });

  protected readonly noCurrencyText = computed<string | null>(() => {
    this.i18n();
    const current = this.row();
    const key = moneyNoCurrencyKey(current.amount, current.currencyCode);
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly closeDateText = computed<string | null>(() =>
    formatShortDate(this.row().expectedCloseDate, this.language()),
  );

  protected readonly closeDateOverdue = computed(() => isCloseDateOverdue(this.row()));

  protected readonly probabilityText = computed<string | null>(() => {
    const pct = this.row().probabilityPercent;
    return pct === null ? null : `${pct}%`;
  });

  protected readonly contactPhone = computed(() => opportunityPhone(this.row()));
  protected readonly phoneSource = computed<PhoneActionSource>(() => opportunityPhoneSource(this.row()));

  protected readonly visibleTags = computed(() => this.row().tags.slice(0, MAX_CARD_TAGS));
  protected readonly extraTagsCount = computed(() => Math.max(0, this.row().tags.length - MAX_CARD_TAGS));
  protected readonly extraTagsTitle = computed(() =>
    this.row()
      .tags.slice(MAX_CARD_TAGS)
      .map((tag) => tag.name)
      .join(', '),
  );

  protected readonly actions = computed(() => {
    this.i18n();
    const current = this.row();
    return opportunityActions(
      current,
      this.stages(),
      this.language(),
      {
        canUpdate: this.canUpdate(),
        canDelete: this.canDelete(),
        canMove: this.canMove() ?? this.canUpdate(),
        canTransfer: this.canTransfer() ?? this.canUpdate(),
      },
      (key) => this.transloco.translate(key),
    );
  });

  protected tagBg(tag: OpportunityTag): string | null {
    return opportunityTagBg(tag);
  }

  protected tagText(tag: OpportunityTag): string | null {
    return opportunityTagText(tag);
  }

  protected act(selection: ActionSelection): void {
    const current = this.row();
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.open.emit(current);
        break;
      case 'move':
        if (selection.value) this.moveTo.emit(selection.value);
        break;
      case 'transfer':
        this.transfer.emit(current);
        break;
      case 'color':
        this.recolor.emit((selection.value as CardColor | null) ?? null);
        break;
      case 'activities':
        this.activities.emit(current);
        break;
      case 'delete':
        this.remove.emit(current);
        break;
    }
  }
}

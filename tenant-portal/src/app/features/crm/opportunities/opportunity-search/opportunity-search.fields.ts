import { FieldOption, QueryField, rememberFieldOptions } from '../../../../shared/query-builder/query.model';
import { reasonNameIn } from '../../settings/reasons/reasons.model';
import type { OpportunityReason } from '../opportunities.model';
import {
  ActivityState,
  CARD_COLORS,
  CardColor,
  ClosingFilter,
  CurrencyOption,
  CustomerProfileType,
  OPPORTUNITY_LIMITS,
  OpportunityTag,
  PipelineStageView,
  StageCategory,
  nameIn,
  stageLabel,
} from '../opportunities.model';

export interface OpportunitySearchSourceOption {
  id: string;
  nameAr: string;
  nameEn: string;
  iconUrl?: string | null;
}

export interface OpportunitySearchFieldsContext {
  t: (key: string) => string;
  stages: readonly PipelineStageView[];
  sources: readonly OpportunitySearchSourceOption[];
  tags: readonly OpportunityTag[] | null;
  currencies: readonly CurrencyOption[];
  winReasons: readonly OpportunityReason[];
  lossReasons: readonly OpportunityReason[];
  owners: (term: string) => Promise<FieldOption[]>;
  teams: (term: string) => Promise<FieldOption[]>;
  customers: (term: string) => Promise<FieldOption[]>;
  ownerOptions?: readonly FieldOption[];
  teamOptions?: readonly FieldOption[];
  language: 'ar' | 'en';
}

export type OpportunityStatusOption = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'WON' | 'LOST';
export type CustomerStatusOption = 'PROSPECT' | 'ACTIVE_CUSTOMER' | 'INACTIVE' | 'BLACKLISTED';

const TEXT_SEARCH_IDS = ['q', 'customer', 'email', 'phone'] as const;
const STAGE_CATEGORIES: readonly StageCategory[] = ['OPEN', 'IN_PROGRESS', 'POSITIVE', 'NEGATIVE'];
const STATUS_OPTIONS: readonly OpportunityStatusOption[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'WON', 'LOST'];
const CUSTOMER_TYPES: readonly CustomerProfileType[] = ['INDIVIDUAL', 'CORPORATE'];
const CUSTOMER_STATUSES: readonly CustomerStatusOption[] = [
  'PROSPECT',
  'ACTIVE_CUSTOMER',
  'INACTIVE',
  'BLACKLISTED',
];
const ACTIVITY_STATES: readonly ActivityState[] = ['NO_OPEN', 'OVERDUE', 'TODAY', 'FUTURE'];
const CLOSING_FILTERS: readonly ClosingFilter[] = ['OVERDUE', 'NEXT_7_DAYS', 'NEXT_30_DAYS', 'NO_DATE'];
const CARD_COLOR_ORDER: readonly CardColor[] = [
  'RED',
  'ORANGE',
  'AMBER',
  'YELLOW',
  'GREEN',
  'TEAL',
  'BLUE',
  'INDIGO',
  'PURPLE',
  'PINK',
  'SLATE',
];

function tr(ctx: OpportunitySearchFieldsContext, key: string): string {
  const scopedKey = `opportunities.${key}`;
  const scoped = ctx.t(scopedKey);
  if (scoped && scoped !== scopedKey) return scoped;
  const direct = ctx.t(key);
  if (direct && direct !== key) return direct;
  return key;
}

function nullLabels(ctx: OpportunitySearchFieldsContext, fieldId: string): { isNull: string; isNotNull: string } {
  return {
    isNull: tr(ctx, `search.nullLabels.${fieldId}.isNull`),
    isNotNull: tr(ctx, `search.nullLabels.${fieldId}.isNotNull`),
  };
}

function exclusiveOtherTextSearches(id: (typeof TEXT_SEARCH_IDS)[number]): string[] {
  return TEXT_SEARCH_IDS.filter((item) => item !== id);
}

/** Build the 36 opportunity search field definitions (tags hidden when ctx.tags is null). */
export function opportunitySearchFields(ctx: OpportunitySearchFieldsContext): QueryField[] {
  const textGroup = tr(ctx, 'search.groups.text');
  const stageGroup = tr(ctx, 'search.groups.stage');
  const peopleGroup = tr(ctx, 'search.groups.people');
  const valueGroup = tr(ctx, 'search.groups.value');
  const datesGroup = tr(ctx, 'search.groups.datesAndActivities');

  const meOption: FieldOption = { value: '$me', label: tr(ctx, 'search.me') };
  const textReplacesHint = tr(ctx, 'search.textReplaces');

  const ownerOptions = ctx.ownerOptions && ctx.ownerOptions.length > 0 ? [...ctx.ownerOptions] : undefined;
  if (ownerOptions) {
    rememberFieldOptions('owner', ownerOptions);
    rememberFieldOptions('createdBy', ownerOptions);
  }

  const teamOptions = ctx.teamOptions && ctx.teamOptions.length > 0 ? [...ctx.teamOptions] : undefined;
  if (teamOptions) {
    rememberFieldOptions('ownerTeam', teamOptions);
  }

  const sortedStages = [...ctx.stages].sort((a, b) => a.rank - b.rank);
  // GET /crm/opportunities/reasons returns active reasons only.
  const sortedWinReasons = ctx.winReasons
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const sortedLossReasons = ctx.lossReasons
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  const fields: QueryField[] = [
    {
      id: 'q',
      label: tr(ctx, 'search.fields.q.label'),
      kind: 'textSearch',
      hint: tr(ctx, 'search.fields.q.hint'),
      group: textGroup,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('q'),
      maxLength: 200,
      inputMode: 'text',
      chip: true,
      chipHint: textReplacesHint,
    },
    {
      id: 'customer',
      label: tr(ctx, 'search.fields.customer.label'),
      kind: 'textSearch',
      hint: tr(ctx, 'search.fields.customer.hint'),
      group: textGroup,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('customer'),
      maxLength: 200,
      inputMode: 'text',
      chip: true,
      chipHint: textReplacesHint,
    },
    {
      id: 'email',
      label: tr(ctx, 'search.fields.email.label'),
      kind: 'textSearch',
      hint: tr(ctx, 'search.fields.email.hint'),
      group: textGroup,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('email'),
      maxLength: 200,
      inputMode: 'email',
      chip: true,
      chipHint: textReplacesHint,
    },
    {
      id: 'phone',
      label: tr(ctx, 'search.fields.phone.label'),
      kind: 'textSearch',
      hint: tr(ctx, 'search.fields.phone.hint'),
      group: textGroup,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('phone'),
      maxLength: 200,
      inputMode: 'tel',
      chip: true,
      chipHint: textReplacesHint,
    },
    {
      id: 'title',
      label: tr(ctx, 'search.fields.title.label'),
      kind: 'text',
      hint: tr(ctx, 'search.fields.title.hint'),
      group: textGroup,
      placement: 'tree',
      maxLength: OPPORTUNITY_LIMITS.title,
    },
    {
      id: 'description',
      label: tr(ctx, 'search.fields.description.label'),
      kind: 'text',
      hint: tr(ctx, 'search.fields.description.hint'),
      group: textGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'description'),
      maxLength: 200,
    },
    {
      id: 'stage',
      label: tr(ctx, 'search.fields.stage.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.stage.hint'),
      group: stageGroup,
      placement: 'tree',
      operators: ['eq', 'neq', 'in', 'nin'],
      options: sortedStages.map((stage) => ({
        value: stage.id,
        label: stageLabel(stage, ctx.language),
      })),
    },
    {
      id: 'stageCategory',
      label: tr(ctx, 'search.fields.stageCategory.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.stageCategory.hint'),
      group: stageGroup,
      placement: 'tree',
      options: STAGE_CATEGORIES.map((value) => ({
        value,
        label: tr(ctx, `search.options.stageCategory.${value}`),
      })),
    },
    {
      id: 'status',
      label: tr(ctx, 'search.fields.status.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.status.hint'),
      group: stageGroup,
      placement: 'tree',
      options: STATUS_OPTIONS.map((value) => ({
        value,
        label: tr(ctx, `search.options.status.${value}`),
      })),
      chip: true,
    },
    {
      id: 'owner',
      label: tr(ctx, 'search.fields.owner.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.owner.hint'),
      group: peopleGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'owner'),
      ...(ownerOptions ? { options: ownerOptions } : {}),
      searchOptions: ctx.owners,
      specialOptions: [meOption],
      chip: true,
    },
    {
      id: 'ownerTeam',
      label: tr(ctx, 'search.fields.ownerTeam.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.ownerTeam.hint'),
      group: peopleGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'ownerTeam'),
      ...(teamOptions ? { options: teamOptions } : {}),
      searchOptions: ctx.teams,
    },
    {
      id: 'createdBy',
      label: tr(ctx, 'search.fields.createdBy.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.createdBy.hint'),
      group: peopleGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'createdBy'),
      ...(ownerOptions ? { options: ownerOptions } : {}),
      searchOptions: ctx.owners,
      specialOptions: [meOption],
    },
    {
      id: 'customerRecord',
      label: tr(ctx, 'search.fields.customerRecord.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.customerRecord.hint'),
      group: peopleGroup,
      placement: 'tree',
      searchOptions: ctx.customers,
    },
    {
      id: 'customerType',
      label: tr(ctx, 'search.fields.customerType.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.customerType.hint'),
      group: peopleGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'customerType'),
      options: CUSTOMER_TYPES.map((value) => ({
        value,
        label: tr(ctx, `search.options.customerType.${value}`),
      })),
    },
    {
      id: 'customerStatus',
      label: tr(ctx, 'search.fields.customerStatus.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.customerStatus.hint'),
      group: peopleGroup,
      placement: 'tree',
      options: CUSTOMER_STATUSES.map((value) => ({
        value,
        label: tr(ctx, `search.options.customerStatus.${value}`),
      })),
    },
    {
      id: 'contact',
      label: tr(ctx, 'search.fields.contact.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.contact.hint'),
      group: peopleGroup,
      placement: 'tree',
      nullable: true,
      operators: ['isNotNull', 'isNull'],
      nullLabels: nullLabels(ctx, 'contact'),
    },
    {
      id: 'fromLead',
      label: tr(ctx, 'search.fields.fromLead.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.fromLead.hint'),
      group: peopleGroup,
      placement: 'tree',
      nullable: true,
      operators: ['isNotNull', 'isNull'],
      nullLabels: nullLabels(ctx, 'fromLead'),
    },
    {
      id: 'leadSource',
      label: tr(ctx, 'search.fields.leadSource.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.leadSource.hint'),
      group: peopleGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'leadSource'),
      options: ctx.sources.map((source) => ({
        value: source.id,
        label: nameIn(source, ctx.language),
        ...(source.iconUrl ? { icon: source.iconUrl } : {}),
      })),
    },
    {
      id: 'amount',
      label: tr(ctx, 'search.fields.amount.label'),
      kind: 'number',
      hint: tr(ctx, 'search.fields.amount.hint'),
      group: valueGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'amount'),
      min: 0,
      operators: ['eq', 'neq', 'gte', 'lte', 'between'],
    },
    {
      id: 'currency',
      label: tr(ctx, 'search.fields.currency.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.currency.hint'),
      group: valueGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'currency'),
      operators: ['eq', 'neq', 'in', 'nin'],
      options: ctx.currencies.map((currency) => ({
        value: currency.code,
        label: currency.name ? `${currency.code} · ${currency.name}` : currency.code,
      })),
      chip: true,
    },
    {
      id: 'probability',
      label: tr(ctx, 'search.fields.probability.label'),
      kind: 'number',
      hint: tr(ctx, 'search.fields.probability.hint'),
      group: valueGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'probability'),
      min: OPPORTUNITY_LIMITS.probabilityMin,
      max: OPPORTUNITY_LIMITS.probabilityMax,
    },
    {
      id: 'importance',
      label: tr(ctx, 'search.fields.importance.label'),
      kind: 'rating',
      hint: tr(ctx, 'search.fields.importance.hint'),
      group: valueGroup,
      placement: 'tree',
      min: 0,
      max: 3,
    },
    {
      id: 'color',
      label: tr(ctx, 'search.fields.color.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.color.hint'),
      group: valueGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'color'),
      options: CARD_COLOR_ORDER.map((value) => ({
        value,
        label: tr(ctx, `card.color.${value}`),
        colorClass: CARD_COLORS[value],
      })),
    },
  ];

  if (ctx.tags !== null) {
    fields.push({
      id: 'tags',
      label: tr(ctx, 'search.fields.tags.label'),
      kind: 'tags',
      hint: tr(ctx, 'search.fields.tags.hint'),
      group: valueGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'tags'),
      options: ctx.tags.map((tag) => ({ value: tag.id, label: tag.name })),
      chip: true,
    });
  }

  fields.push(
    {
      id: 'closing',
      label: tr(ctx, 'search.fields.closing.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.closing.hint'),
      group: datesGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'closing'),
      options: CLOSING_FILTERS.map((value) => ({
        value,
        label: tr(ctx, `closing.${value}`),
      })),
      chip: true,
    },
    {
      id: 'activityState',
      label: tr(ctx, 'search.fields.activityState.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.activityState.hint'),
      group: datesGroup,
      placement: 'tree',
      options: ACTIVITY_STATES.map((value) => ({
        value,
        label: tr(ctx, `search.options.activityState.${value}`),
      })),
    },
    {
      id: 'nextActivity',
      label: tr(ctx, 'search.fields.nextActivity.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.nextActivity.hint'),
      group: datesGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'nextActivity'),
    },
    {
      id: 'openActivities',
      label: tr(ctx, 'search.fields.openActivities.label'),
      kind: 'number',
      hint: tr(ctx, 'search.fields.openActivities.hint'),
      group: datesGroup,
      placement: 'tree',
      min: 0,
    },
    {
      id: 'daysInStage',
      label: tr(ctx, 'search.fields.daysInStage.label'),
      kind: 'number',
      hint: tr(ctx, 'search.fields.daysInStage.hint'),
      group: stageGroup,
      placement: 'tree',
      min: 0,
    },
    {
      id: 'lostReason',
      label: tr(ctx, 'search.fields.lostReason.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.lostReason.hint'),
      group: stageGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'lostReason'),
      options: sortedLossReasons.map((reason) => ({
        value: reason.id,
        label: reasonNameIn(reason, ctx.language),
      })),
    },
    {
      id: 'winReason',
      label: tr(ctx, 'search.fields.winReason.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.winReason.hint'),
      group: stageGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'winReason'),
      options: sortedWinReasons.map((reason) => ({
        value: reason.id,
        label: reasonNameIn(reason, ctx.language),
      })),
    },
    {
      id: 'lostNote',
      label: tr(ctx, 'search.fields.lostNote.label'),
      kind: 'text',
      hint: tr(ctx, 'search.fields.lostNote.hint'),
      group: stageGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'lostNote'),
      maxLength: OPPORTUNITY_LIMITS.reason,
    },
    {
      id: 'created',
      label: tr(ctx, 'search.fields.created.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.created.hint'),
      group: datesGroup,
      placement: 'tree',
    },
    {
      id: 'updated',
      label: tr(ctx, 'search.fields.updated.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.updated.hint'),
      group: datesGroup,
      placement: 'tree',
    },
    {
      id: 'wonAt',
      label: tr(ctx, 'search.fields.wonAt.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.wonAt.hint'),
      group: datesGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'wonAt'),
    },
    {
      id: 'lostAt',
      label: tr(ctx, 'search.fields.lostAt.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.lostAt.hint'),
      group: datesGroup,
      placement: 'tree',
      nullable: true,
      nullLabels: nullLabels(ctx, 'lostAt'),
    },
  );

  return fields;
}

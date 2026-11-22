import { FieldOption, QueryField, rememberFieldOptions } from '../../../../shared/query-builder/query.model';
import { CUSTOMER_STATUS_ORDER } from '../customer-statuses';
import {
  CARD_COLORS,
  CardColor,
  ProfileType,
  SourceOption,
  TagSummary,
  nameIn,
} from '../customers.model';

export interface CustomerSearchFieldsContext {
  t: (key: string) => string;
  sources: SourceOption[];
  tags: TagSummary[] | null;
  owners: (term: string) => Promise<FieldOption[]>;
  ownerOptions?: FieldOption[];
  language: 'ar' | 'en';
}

const PROFILE_TYPES: readonly ProfileType[] = ['INDIVIDUAL', 'CORPORATE'];
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
const TEXT_SEARCH_IDS = ['customer', 'email', 'phone'] as const;

function tr(ctx: CustomerSearchFieldsContext, key: string): string {
  const scopedKey = `customers.${key}`;
  const scoped = ctx.t(scopedKey);
  if (scoped && scoped !== scopedKey) return scoped;
  const direct = ctx.t(key);
  if (direct && direct !== key) return direct;
  return key;
}

function exclusiveOtherTextSearches(id: (typeof TEXT_SEARCH_IDS)[number]): string[] {
  return TEXT_SEARCH_IDS.filter((item) => item !== id);
}

/** Build the customer search field definitions for both facet search and advanced query builder. */
export function customerSearchFields(ctx: CustomerSearchFieldsContext): QueryField[] {
  const contactAndText = tr(ctx, 'search.groups.contactAndText');
  const classification = tr(ctx, 'search.groups.classification');
  const people = tr(ctx, 'search.groups.people');
  const dates = tr(ctx, 'search.groups.dates');
  const tagsGroup = tr(ctx, 'search.groups.tags');
  const meOption: FieldOption = { value: '$me', label: tr(ctx, 'search.me') };
  const textReplacesHint = tr(ctx, 'search.textReplaces');
  const ownerOptions = ctx.ownerOptions && ctx.ownerOptions.length > 0 ? ctx.ownerOptions : undefined;
  if (ownerOptions) {
    rememberFieldOptions('ownerUserId', ownerOptions);
  }

  const fields: QueryField[] = [
    {
      id: 'customer',
      label: tr(ctx, 'search.fields.customer.label'),
      kind: 'textSearch',
      hint: tr(ctx, 'search.fields.customer.hint'),
      group: contactAndText,
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
      group: contactAndText,
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
      group: contactAndText,
      placement: 'root',
      singleton: true,
      exclusiveWith: exclusiveOtherTextSearches('phone'),
      maxLength: 200,
      inputMode: 'tel',
      chip: true,
      chipHint: textReplacesHint,
    },
  ];

  if (ctx.tags !== null) {
    fields.push({
      id: 'tags',
      label: tr(ctx, 'search.fields.tags.label'),
      kind: 'tags',
      hint: tr(ctx, 'search.fields.tags.hint'),
      group: tagsGroup,
      placement: 'root',
      singleton: true,
      options: ctx.tags.map((tag) => ({ value: tag.id, label: tag.name })),
      chip: true,
    });
  }

  fields.push(
    {
      id: 'status',
      label: tr(ctx, 'search.fields.status.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.status.hint'),
      group: classification,
      placement: 'tree',
      options: CUSTOMER_STATUS_ORDER.map((value) => ({ value, label: tr(ctx, `statuses.${value}`) })),
      chip: true,
    },
    {
      id: 'profileType',
      label: tr(ctx, 'search.fields.profileType.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.profileType.hint'),
      group: classification,
      placement: 'tree',
      options: PROFILE_TYPES.map((value) => ({ value, label: tr(ctx, `types.${value}`) })),
      chip: true,
    },
    {
      id: 'ownerUserId',
      label: tr(ctx, 'search.fields.ownerUserId.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.ownerUserId.hint'),
      group: people,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'search.nullLabels.ownerUserId.isNull'),
        isNotNull: tr(ctx, 'search.nullLabels.ownerUserId.isNotNull'),
      },
      ...(ownerOptions ? { options: ownerOptions } : {}),
      searchOptions: ctx.owners,
      specialOptions: [meOption],
      chip: true,
    },
    {
      id: 'acquisitionSourceId',
      label: tr(ctx, 'search.fields.acquisitionSourceId.label'),
      kind: 'lookup',
      hint: tr(ctx, 'search.fields.acquisitionSourceId.hint'),
      group: classification,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'search.nullLabels.acquisitionSourceId.isNull'),
        isNotNull: tr(ctx, 'search.nullLabels.acquisitionSourceId.isNotNull'),
      },
      options: ctx.sources.map((source) => ({
        value: source.id,
        label: nameIn(source, ctx.language),
        ...(source.iconUrl ? { icon: source.iconUrl } : {}),
      })),
      chip: true,
    },
    {
      id: 'rating',
      label: tr(ctx, 'search.fields.rating.label'),
      kind: 'rating',
      hint: tr(ctx, 'search.fields.rating.hint'),
      group: classification,
      placement: 'tree',
      min: 0,
      max: 3,
    },
    {
      id: 'cardColor',
      label: tr(ctx, 'search.fields.cardColor.label'),
      kind: 'enum',
      hint: tr(ctx, 'search.fields.cardColor.hint'),
      group: classification,
      placement: 'tree',
      nullable: true,
      nullLabels: {
        isNull: tr(ctx, 'search.nullLabels.cardColor.isNull'),
        isNotNull: tr(ctx, 'search.nullLabels.cardColor.isNotNull'),
      },
      options: CARD_COLOR_ORDER.map((value) => ({
        value,
        label: tr(ctx, `color.${value}`),
        colorClass: CARD_COLORS[value],
      })),
    },
    {
      id: 'createdAt',
      label: tr(ctx, 'search.fields.createdAt.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.createdAt.hint'),
      group: dates,
      placement: 'tree',
    },
    {
      id: 'updatedAt',
      label: tr(ctx, 'search.fields.updatedAt.label'),
      kind: 'date',
      hint: tr(ctx, 'search.fields.updatedAt.hint'),
      group: dates,
      placement: 'tree',
    },
    {
      id: 'description',
      label: tr(ctx, 'search.fields.description.label'),
      kind: 'text',
      hint: tr(ctx, 'search.fields.description.hint'),
      group: contactAndText,
      placement: 'tree',
      nullable: true,
      maxLength: 200,
    },
    {
      id: 'fromLead',
      label: tr(ctx, 'search.fields.fromLead.label'),
      kind: 'boolean',
      hint: tr(ctx, 'search.fields.fromLead.hint'),
      group: classification,
      placement: 'tree',
    },
  );

  return fields;
}

import { Language } from '../../../../core/i18n/language';
import { AttachmentFamilyKey, CrmStaticData, L, Opt, formatSizeBytes } from './static-data.model';

export type StaticGroupKind = 'enum' | 'permission' | 'owner' | 'event' | 'attachment' | 'rule';

export type StaticGroupDetailVariant =
  | 'options'
  | 'attachmentPolicy'
  | 'stageStatusRule'
  | 'leadConversionRule';

export interface AttachmentFamilyRow {
  key: string;
  label: L;
  extensions: string[];
  mimeTypes: string[];
}

export interface StageStatusRuleRow {
  stageKey: 'WON' | 'LOST' | 'ON_HOLD' | 'default';
  stageLabel: L | null;
  statusValue: 'WON' | 'LOST' | 'ON_HOLD' | 'IN_PROGRESS';
  statusLabel: L;
}

export interface StaticDataGroup {
  key: string;
  titleKey: string;
  kind: StaticGroupKind;
  icon: string;
  tile: string;
  detailVariant: StaticGroupDetailVariant;
  options: Opt[];
  entryCount: number;
  maxSizeBytes: number | null;
  maxSizeText: string | null;
  attachmentFamilies: AttachmentFamilyRow[];
  stageStatusRows: StageStatusRuleRow[];
  copiedOwnerOption: Opt | null;
  searchTokens: string[];
}

const KIND_LOOK: Readonly<Record<StaticGroupKind, { icon: string; tile: string }>> = {
  enum: { icon: 'tablerList', tile: 'bg-icon-blue' },
  permission: { icon: 'tablerShieldLock', tile: 'bg-icon-violet' },
  owner: { icon: 'tablerFolders', tile: 'bg-icon-navy' },
  event: { icon: 'tablerBolt', tile: 'bg-icon-orange' },
  attachment: { icon: 'tablerPaperclip', tile: 'bg-icon-teal' },
  rule: { icon: 'tablerArrowsSplit', tile: 'bg-icon-green' },
};

const CORE_GROUP_ORDER = [
  'profileTypes',
  'customerStatuses',
  'leadStatuses',
  'leadStageFlags',
  'opportunityStatuses',
  'opportunityStageFlags',
  'customFieldOwnerTypes',
  'customFieldTypes',
  'fieldRequirementOperations',
  'attachmentPolicy',
  'opportunityStatusByStageFlag',
  'activityTypes',
  'activityStatuses',
  'permissions',
  'ownerTypeOptions',
  'eventOptions',
  'rejectedAttachmentFamilies',
  'leadConversionCopiesCustomFieldOwnerType',
] as const;

const OPTIONAL_ENUM_KEYS = [
  'stageCategories',
  'pipelineAccessModes',
  'activityDirections',
  'priorities',
  'leadCardColors',
] as const;

const ATTACHMENT_FAMILY_KEYS = new Set<string>(['pdf', 'images', 'word', 'excel', 'text']);

function tokensFromOptions(options: readonly Opt[]): string[] {
  const tokens: string[] = [];
  for (const option of options) {
    tokens.push(option.value, option.label.en, option.label.ar);
  }
  return tokens;
}

function makeEnumGroup(key: string, titleKey: string, options: Opt[]): StaticDataGroup {
  const look = KIND_LOOK.enum;
  return {
    key,
    titleKey,
    kind: 'enum',
    icon: look.icon,
    tile: look.tile,
    detailVariant: 'options',
    options,
    entryCount: options.length,
    maxSizeBytes: null,
    maxSizeText: null,
    attachmentFamilies: [],
    stageStatusRows: [],
    copiedOwnerOption: null,
    searchTokens: tokensFromOptions(options),
  };
}

function buildAttachmentPolicyGroup(data: CrmStaticData): StaticDataGroup {
  const look = KIND_LOOK.attachment;
  const policy = data.attachmentPolicy;
  const options = policy.familyLabels;
  const maxSizeBytes = policy.maxSizeBytes > 0 ? policy.maxSizeBytes : null;
  const maxSizeText = maxSizeBytes ? formatSizeBytes(maxSizeBytes) : null;

  const attachmentFamilies: AttachmentFamilyRow[] = options.map((entry) => {
    const isKnownFamily = ATTACHMENT_FAMILY_KEYS.has(entry.value);
    const key = isKnownFamily ? (entry.value as AttachmentFamilyKey) : null;
    return {
      key: entry.value,
      label: entry.label,
      extensions: key ? policy.allowedExtensions[key] ?? [] : [],
      mimeTypes: key ? policy.allowedMimeTypes[key] ?? [] : [],
    };
  });

  const searchTokens = [...tokensFromOptions(options)];
  if (maxSizeText) searchTokens.push(maxSizeText);
  if (maxSizeBytes) searchTokens.push(String(maxSizeBytes));
  for (const fam of attachmentFamilies) {
    searchTokens.push(...fam.extensions, ...fam.mimeTypes);
  }

  return {
    key: 'attachmentPolicy',
    titleKey: 'staticData.groups.attachmentPolicy',
    kind: 'attachment',
    icon: look.icon,
    tile: look.tile,
    detailVariant: 'attachmentPolicy',
    options,
    entryCount: options.length,
    maxSizeBytes,
    maxSizeText,
    attachmentFamilies,
    stageStatusRows: [],
    copiedOwnerOption: null,
    searchTokens,
  };
}

function findOptionLabel(options: readonly Opt[] | undefined, value: string): L {
  const match = options?.find((item) => item.value === value);
  return match ? match.label : { en: value, ar: value };
}

function buildStageStatusRuleGroup(data: CrmStaticData): StaticDataGroup {
  const look = KIND_LOOK.rule;
  const rule = data.derivedRules.opportunityStatusByStageFlag;
  const stageOpts = data.enumOptions['opportunityStageFlags'] ?? [];
  const statusOpts = data.enumOptions['opportunityStatuses'] ?? [];

  const rows: StageStatusRuleRow[] = [
    {
      stageKey: 'WON',
      stageLabel: findOptionLabel(stageOpts, 'WON'),
      statusValue: rule.WON,
      statusLabel: findOptionLabel(statusOpts, rule.WON),
    },
    {
      stageKey: 'LOST',
      stageLabel: findOptionLabel(stageOpts, 'LOST'),
      statusValue: rule.LOST,
      statusLabel: findOptionLabel(statusOpts, rule.LOST),
    },
    {
      stageKey: 'ON_HOLD',
      stageLabel: findOptionLabel(stageOpts, 'ON_HOLD'),
      statusValue: rule.ON_HOLD,
      statusLabel: findOptionLabel(statusOpts, rule.ON_HOLD),
    },
    {
      stageKey: 'default',
      stageLabel: null,
      statusValue: rule.default,
      statusLabel: findOptionLabel(statusOpts, rule.default),
    },
  ];

  const searchTokens: string[] = [];
  for (const row of rows) {
    searchTokens.push(row.stageKey, row.statusValue, row.statusLabel.en, row.statusLabel.ar);
    if (row.stageLabel) {
      searchTokens.push(row.stageLabel.en, row.stageLabel.ar);
    }
  }

  return {
    key: 'opportunityStatusByStageFlag',
    titleKey: 'staticData.groups.opportunityStatusByStageFlag',
    kind: 'rule',
    icon: look.icon,
    tile: look.tile,
    detailVariant: 'stageStatusRule',
    options: [],
    entryCount: rows.length,
    maxSizeBytes: null,
    maxSizeText: null,
    attachmentFamilies: [],
    stageStatusRows: rows,
    copiedOwnerOption: null,
    searchTokens,
  };
}

function buildLeadConversionRuleGroup(data: CrmStaticData): StaticDataGroup {
  const look = KIND_LOOK.rule;
  const targetValue = data.derivedRules.leadConversionCopiesCustomFieldOwnerType;
  const ownerOpts = data.enumOptions['customFieldOwnerTypes'] ?? [];
  const label = findOptionLabel(ownerOpts, targetValue);
  const copiedOption: Opt = { value: targetValue, label };

  return {
    key: 'leadConversionCopiesCustomFieldOwnerType',
    titleKey: 'staticData.groups.leadConversionCopiesCustomFieldOwnerType',
    kind: 'rule',
    icon: look.icon,
    tile: look.tile,
    detailVariant: 'leadConversionRule',
    options: [copiedOption],
    entryCount: 1,
    maxSizeBytes: null,
    maxSizeText: null,
    attachmentFamilies: [],
    stageStatusRows: [],
    copiedOwnerOption: copiedOption,
    searchTokens: [targetValue, label.en, label.ar],
  };
}

function buildOptionsGroup(
  key: string,
  kind: StaticGroupKind,
  options: Opt[],
): StaticDataGroup {
  const look = KIND_LOOK[kind];
  return {
    key,
    titleKey: `staticData.groups.${key}`,
    kind,
    icon: look.icon,
    tile: look.tile,
    detailVariant: 'options',
    options,
    entryCount: options.length,
    maxSizeBytes: null,
    maxSizeText: null,
    attachmentFamilies: [],
    stageStatusRows: [],
    copiedOwnerOption: null,
    searchTokens: tokensFromOptions(options),
  };
}

export function buildStaticDataGroups(data: CrmStaticData): StaticDataGroup[] {
  const groups: StaticDataGroup[] = [];
  const includedEnumKeys = new Set<string>();

  for (const key of CORE_GROUP_ORDER) {
    switch (key) {
      case 'attachmentPolicy':
        groups.push(buildAttachmentPolicyGroup(data));
        break;
      case 'opportunityStatusByStageFlag':
        groups.push(buildStageStatusRuleGroup(data));
        break;
      case 'permissions':
        groups.push(buildOptionsGroup('permissions', 'permission', data.permissionOptions));
        break;
      case 'ownerTypeOptions':
        groups.push(buildOptionsGroup('ownerTypeOptions', 'owner', data.ownerTypeOptions));
        break;
      case 'eventOptions':
        groups.push(buildOptionsGroup('eventOptions', 'event', data.eventOptions));
        break;
      case 'rejectedAttachmentFamilies':
        groups.push(
          buildOptionsGroup(
            'rejectedAttachmentFamilies',
            'attachment',
            data.attachmentPolicy.rejectedFamilyLabels,
          ),
        );
        break;
      case 'leadConversionCopiesCustomFieldOwnerType':
        groups.push(buildLeadConversionRuleGroup(data));
        break;
      default: {
        const opts = data.enumOptions[key];
        if (opts) {
          includedEnumKeys.add(key);
          groups.push(makeEnumGroup(key, `staticData.groups.${key}`, opts));
        }
        break;
      }
    }
  }

  for (const key of OPTIONAL_ENUM_KEYS) {
    const opts = data.enumOptions[key];
    if (opts) {
      includedEnumKeys.add(key);
      groups.push(makeEnumGroup(key, `staticData.groups.${key}`, opts));
    }
  }

  for (const [key, opts] of Object.entries(data.enumOptions)) {
    if (!includedEnumKeys.has(key)) {
      groups.push(makeEnumGroup(key, 'staticData.groups.other', opts));
    }
  }

  return groups;
}

export function matchesGroupSearch(
  group: StaticDataGroup,
  query: string,
  translatedGroupName: string,
  lang: Language,
): boolean {
  const term = query.trim().toLocaleLowerCase(lang);
  if (!term) return true;

  if (group.key.toLocaleLowerCase(lang).includes(term)) return true;
  if (translatedGroupName.toLocaleLowerCase(lang).includes(term)) return true;

  return group.searchTokens.some((token) => token.toLocaleLowerCase(lang).includes(term));
}

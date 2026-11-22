export const REASON_KINDS = [
  'LOSS',
  'WIN',
  'DISQUALIFICATION',
  'ACTIVITY_OUTCOME',
  'CONTACT_ROLE',
] as const;
export type ReasonKind = (typeof REASON_KINDS)[number];

export const REASON_POLARITIES = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
export type ReasonPolarity = (typeof REASON_POLARITIES)[number];

export const REASON_ACTIVITY_TYPES = [
  'CALL',
  'MEETING',
  'EMAIL',
  'VISIT',
  'NOTE',
  'FOLLOW_UP',
  'OTHER',
] as const;
export type ReasonActivityType = (typeof REASON_ACTIVITY_TYPES)[number];

export interface Reason {
  id: string;
  reasonKind: ReasonKind;
  code: string;
  nameEn: string;
  nameAr: string;
  definitionEn: string | null;
  definitionAr: string | null;
  polarity: ReasonPolarity | null;
  activityType: ReasonActivityType | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  revision: number;
}

// GET /settings/reasons query (backend ListGovernedReasonsDto): `active` filters by is_active
// when sent ('true' = active only, 'false' = inactive only); omitted = all.
export interface ListReasonsQuery {
  kind?: ReasonKind;
  active?: 'true' | 'false';
}

// GET /settings/reasons response (backend reasons.controller.ts list returns { items }).
export interface ReasonListResponse {
  items: Reason[];
}

export interface CreateReasonInput {
  reasonKind: ReasonKind;
  code: string;
  nameEn: string;
  nameAr: string;
  definitionEn?: string | null;
  definitionAr?: string | null;
  polarity?: ReasonPolarity | null;
  activityType?: ReasonActivityType | null;
  sortOrder: number;
}

export interface UpdateReasonPatch {
  nameEn?: string;
  nameAr?: string;
  definitionEn?: string | null;
  definitionAr?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export const REASON_LIMITS = {
  maxCount: 500,
  codeMin: 2,
  codeMax: 64,
  nameMax: 120,
  defMax: 500,
  sortOrderMin: 0,
  sortOrderMax: 1_000_000,
} as const;

export const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export function reasonNameIn(reason: Pick<Reason, 'nameAr' | 'nameEn'>, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? reason.nameAr : reason.nameEn;
}

export function reasonOtherNameIn(reason: Pick<Reason, 'nameAr' | 'nameEn'>, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? reason.nameEn : reason.nameAr;
}

export function reasonDefinitionIn(
  reason: Pick<Reason, 'definitionAr' | 'definitionEn'>,
  lang: 'ar' | 'en',
): string | null {
  return lang === 'ar' ? reason.definitionAr : reason.definitionEn;
}

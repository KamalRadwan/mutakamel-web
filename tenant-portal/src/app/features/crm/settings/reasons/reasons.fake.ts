import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import { ApiError } from '../shared/settings-api';
import {
  CreateReasonInput,
  ListReasonsQuery,
  REASON_ACTIVITY_TYPES,
  REASON_CODE_PATTERN,
  REASON_KINDS,
  REASON_LIMITS,
  REASON_POLARITIES,
  Reason,
  ReasonKind,
  ReasonListResponse,
  UpdateReasonPatch,
} from './reasons.model';

export const FAKE_READ_ONLY = false;

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertWritable(): void {
  if (FAKE_READ_ONLY) {
    throw new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY');
  }
}

let reasonsState: Reason[] = [
  // LOSS (6)
  {
    id: '01950000-0000-7000-8000-000000000301',
    reasonKind: 'LOSS',
    code: 'PRICE',
    nameEn: 'Price',
    nameAr: 'السعر',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 10,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000302',
    reasonKind: 'LOSS',
    code: 'COMPETITOR',
    nameEn: 'Chose a competitor',
    nameAr: 'اختار منافسًا',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 20,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000303',
    reasonKind: 'LOSS',
    code: 'TIMING',
    nameEn: 'Timing',
    nameAr: 'التوقيت غير مناسب',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 30,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000304',
    reasonKind: 'LOSS',
    code: 'NO_RESPONSE',
    nameEn: 'No response',
    nameAr: 'لا استجابة من العميل',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 40,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000305',
    reasonKind: 'LOSS',
    code: 'OTHER',
    nameEn: 'Other',
    nameAr: 'سبب آخر',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: true,
    isActive: true,
    sortOrder: 90,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000306',
    reasonKind: 'LOSS',
    code: 'LEGACY_UNMAPPED',
    nameEn: 'Legacy reason (unmapped)',
    nameAr: 'سبب قديم غير مصنّف',
    definitionEn: 'A loss reason recorded as free text before governed reasons existed that matched no code.',
    definitionAr: 'سبب خسارة سُجّل نصًا حرًا قبل اعتماد الأسباب المنظّمة ولم يطابق أي رمز.',
    polarity: null,
    activityType: null,
    isSystem: true,
    isActive: true,
    sortOrder: 99,
    revision: 1,
  },

  // WIN (4)
  {
    id: '01950000-0000-7000-8000-000000000307',
    reasonKind: 'WIN',
    code: 'VALUE_FIT',
    nameEn: 'Value fit',
    nameAr: 'ملاءمة القيمة',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 10,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000308',
    reasonKind: 'WIN',
    code: 'RELATIONSHIP',
    nameEn: 'Relationship',
    nameAr: 'العلاقة مع العميل',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 20,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000309',
    reasonKind: 'WIN',
    code: 'PRICE',
    nameEn: 'Price',
    nameAr: 'السعر',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 30,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000310',
    reasonKind: 'WIN',
    code: 'OTHER',
    nameEn: 'Other',
    nameAr: 'سبب آخر',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: true,
    isActive: true,
    sortOrder: 90,
    revision: 1,
  },

  // DISQUALIFICATION (5)
  {
    id: '01950000-0000-7000-8000-000000000311',
    reasonKind: 'DISQUALIFICATION',
    code: 'BUDGET',
    nameEn: 'No budget',
    nameAr: 'لا توجد ميزانية',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 10,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000312',
    reasonKind: 'DISQUALIFICATION',
    code: 'FIT',
    nameEn: 'Not a fit',
    nameAr: 'غير مناسب',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 20,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000313',
    reasonKind: 'DISQUALIFICATION',
    code: 'UNREACHABLE',
    nameEn: 'Unreachable',
    nameAr: 'تعذّر الوصول',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 30,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000314',
    reasonKind: 'DISQUALIFICATION',
    code: 'CONFIRMED_DUPLICATE',
    nameEn: 'Confirmed duplicate',
    nameAr: 'مكرر مؤكد',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 40,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000315',
    reasonKind: 'DISQUALIFICATION',
    code: 'OTHER',
    nameEn: 'Other',
    nameAr: 'سبب آخر',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: true,
    isActive: true,
    sortOrder: 90,
    revision: 1,
  },

  // ACTIVITY_OUTCOME (6)
  {
    id: '01950000-0000-7000-8000-000000000316',
    reasonKind: 'ACTIVITY_OUTCOME',
    code: 'CALL_CONNECTED',
    nameEn: 'Call connected',
    nameAr: 'تم الاتصال',
    definitionEn: 'The contact was reached and spoken to.',
    definitionAr: 'تم التحدث مع جهة الاتصال.',
    polarity: 'POSITIVE',
    activityType: 'CALL',
    isSystem: false,
    isActive: true,
    sortOrder: 10,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000317',
    reasonKind: 'ACTIVITY_OUTCOME',
    code: 'CALL_NO_ANSWER',
    nameEn: 'No answer',
    nameAr: 'لم يتم الرد',
    definitionEn: 'The contact did not answer the call.',
    definitionAr: 'لم ترد جهة الاتصال على المكالمة.',
    polarity: 'NEGATIVE',
    activityType: 'CALL',
    isSystem: false,
    isActive: true,
    sortOrder: 20,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000318',
    reasonKind: 'ACTIVITY_OUTCOME',
    code: 'MEETING_HELD',
    nameEn: 'Meeting held',
    nameAr: 'عُقد الاجتماع',
    definitionEn: 'The meeting took place with the customer.',
    definitionAr: 'عُقد الاجتماع بحضور العميل.',
    polarity: 'POSITIVE',
    activityType: 'MEETING',
    isSystem: false,
    isActive: true,
    sortOrder: 30,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000319',
    reasonKind: 'ACTIVITY_OUTCOME',
    code: 'MEETING_NO_SHOW',
    nameEn: 'Customer no-show',
    nameAr: 'لم يحضر العميل',
    definitionEn: 'The customer did not attend the scheduled meeting.',
    definitionAr: 'لم يحضر العميل الاجتماع المحدد.',
    polarity: 'NEGATIVE',
    activityType: 'MEETING',
    isSystem: false,
    isActive: true,
    sortOrder: 40,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000320',
    reasonKind: 'ACTIVITY_OUTCOME',
    code: 'EMAIL_REPLY_LOGGED',
    nameEn: 'Email reply logged',
    nameAr: 'تم تسجيل رد على البريد',
    definitionEn: 'The customer replied to the email and the reply was logged.',
    definitionAr: 'ردّ العميل على البريد وتم تسجيل الرد.',
    polarity: 'POSITIVE',
    activityType: 'EMAIL',
    isSystem: false,
    isActive: true,
    sortOrder: 50,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000321',
    reasonKind: 'ACTIVITY_OUTCOME',
    code: 'OTHER',
    nameEn: 'Other outcome',
    nameAr: 'نتيجة أخرى',
    definitionEn: 'An outcome that matches no other code.',
    definitionAr: 'نتيجة لا تطابق أي رمز آخر.',
    polarity: 'NEUTRAL',
    activityType: null,
    isSystem: true,
    isActive: true,
    sortOrder: 90,
    revision: 1,
  },

  // CONTACT_ROLE (5)
  {
    id: '01950000-0000-7000-8000-000000000322',
    reasonKind: 'CONTACT_ROLE',
    code: 'DECISION_MAKER',
    nameEn: 'Decision maker',
    nameAr: 'صاحب القرار',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 10,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000323',
    reasonKind: 'CONTACT_ROLE',
    code: 'INFLUENCER',
    nameEn: 'Influencer',
    nameAr: 'مؤثر',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 20,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000324',
    reasonKind: 'CONTACT_ROLE',
    code: 'USER',
    nameEn: 'User',
    nameAr: 'مستخدم',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 30,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000325',
    reasonKind: 'CONTACT_ROLE',
    code: 'FINANCE',
    nameEn: 'Finance',
    nameAr: 'المالية',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: false,
    isActive: true,
    sortOrder: 40,
    revision: 1,
  },
  {
    id: '01950000-0000-7000-8000-000000000326',
    reasonKind: 'CONTACT_ROLE',
    code: 'OTHER',
    nameEn: 'Other',
    nameAr: 'دور آخر',
    definitionEn: null,
    definitionAr: null,
    polarity: null,
    activityType: null,
    isSystem: true,
    isActive: true,
    sortOrder: 90,
    revision: 1,
  },
];

const inFlightIdempotencyKeys = new Set<string>();
const seenIdempotencyKeys = new Map<string, { fingerprint: string; reason: Reason }>();

function cloneReason(reason: Reason): Reason {
  return { ...reason };
}

function createFingerprint(input: CreateReasonInput): string {
  return JSON.stringify({
    reasonKind: input.reasonKind,
    code: input.code.trim().toUpperCase(),
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr.trim(),
    definitionEn: input.definitionEn?.trim() || null,
    definitionAr: input.definitionAr?.trim() || null,
    polarity: input.polarity ?? null,
    activityType: input.activityType ?? null,
    sortOrder: input.sortOrder,
  });
}

// GET /api/tenant/crm/v1/settings/reasons, shaped like the backend: `active` filters by
// isActive when sent, the order is reasonKind, sortOrder, code, and the body is { items }.
export async function fakeGetReasons(query: ListReasonsQuery = {}): Promise<ReasonListResponse> {
  await fakeDelay();
  const active = query.active === undefined ? null : query.active === 'true';
  const items = reasonsState
    .filter((item) => (!query.kind || item.reasonKind === query.kind) && (active === null || item.isActive === active))
    .slice()
    .sort((a, b) => {
      if (a.reasonKind !== b.reasonKind) return a.reasonKind < b.reasonKind ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    })
    .slice(0, REASON_LIMITS.maxCount)
    .map(cloneReason);
  return { items };
}

// Fake-data helper for other features' fakes (leads, opportunities); not an HTTP mirror.
export async function fakeListReasons(kind?: ReasonKind, activeOnly?: boolean): Promise<Reason[]> {
  await fakeDelay();
  const kindOrder = new Map(REASON_KINDS.map((value, index) => [value, index]));
  return reasonsState
    .filter((item) => (!kind || item.reasonKind === kind) && (!activeOnly || item.isActive))
    .slice()
    .sort((a, b) => {
      const kindDiff = (kindOrder.get(a.reasonKind) ?? 0) - (kindOrder.get(b.reasonKind) ?? 0);
      if (kindDiff !== 0) return kindDiff;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.code.localeCompare(b.code);
    })
    .slice(0, REASON_LIMITS.maxCount)
    .map(cloneReason);
}

// POST /api/tenant/crm/v1/settings/reasons
export async function fakeCreateReason(input: CreateReasonInput, idempotencyKey: string): Promise<Reason> {
  const key = idempotencyKey.trim();
  // Backend normalizeIdempotencyKey: a missing or malformed key is the same 400.
  if (!key || !UUID_V7_PATTERN.test(key)) {
    throw new ApiError(400, 'CRM_IDEMPOTENCY_KEY_INVALID');
  }
  if (inFlightIdempotencyKeys.has(key)) {
    throw new ApiError(409, 'CRM_IDEMPOTENCY_IN_FLIGHT');
  }

  inFlightIdempotencyKeys.add(key);
  try {
    await fakeDelay();
    assertWritable();

    const fingerprint = createFingerprint(input);
    const existing = seenIdempotencyKeys.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ApiError(422, 'CRM_IDEMPOTENCY_KEY_REUSED');
      }
      return cloneReason(existing.reason);
    }

    if (!REASON_KINDS.includes(input.reasonKind)) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'reasonKind' });
    }

    const code = input.code.trim().toUpperCase();
    if (!REASON_CODE_PATTERN.test(code)) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'code' });
    }

    const nameEn = input.nameEn.trim();
    const nameAr = input.nameAr.trim();
    if (!nameEn || nameEn.length > REASON_LIMITS.nameMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'nameEn' });
    }
    if (!nameAr || nameAr.length > REASON_LIMITS.nameMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'nameAr' });
    }

    const defEnTrimmed = input.definitionEn?.trim() ?? '';
    const defArTrimmed = input.definitionAr?.trim() ?? '';
    if (defEnTrimmed.length > REASON_LIMITS.defMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'definitionEn' });
    }
    if (defArTrimmed.length > REASON_LIMITS.defMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'definitionAr' });
    }

    if (
      !Number.isInteger(input.sortOrder) ||
      input.sortOrder < REASON_LIMITS.sortOrderMin ||
      input.sortOrder > REASON_LIMITS.sortOrderMax
    ) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'sortOrder' });
    }

    if (input.reasonKind === 'ACTIVITY_OUTCOME') {
      if (!input.polarity || !REASON_POLARITIES.includes(input.polarity)) {
        throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
      }
      if (input.activityType != null && !REASON_ACTIVITY_TYPES.includes(input.activityType)) {
        throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
      }
    } else if (input.polarity != null || input.activityType != null) {
      throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
    }

    const duplicate = reasonsState.some((item) => item.reasonKind === input.reasonKind && item.code === code);
    if (duplicate) {
      throw new ApiError(409, 'CRM_REASON_CODE_TAKEN');
    }

    const created: Reason = {
      id: fakeId(),
      reasonKind: input.reasonKind,
      code,
      nameEn,
      nameAr,
      definitionEn: defEnTrimmed || null,
      definitionAr: defArTrimmed || null,
      polarity: input.reasonKind === 'ACTIVITY_OUTCOME' ? (input.polarity ?? null) : null,
      activityType: input.reasonKind === 'ACTIVITY_OUTCOME' ? (input.activityType ?? null) : null,
      isSystem: false,
      isActive: true,
      sortOrder: input.sortOrder,
      revision: 1,
    };

    reasonsState = [...reasonsState, created];
    seenIdempotencyKeys.set(key, { fingerprint, reason: created });
    return cloneReason(created);
  } finally {
    inFlightIdempotencyKeys.delete(key);
  }
}

// PATCH /api/tenant/crm/v1/settings/reasons/:id
export async function fakeUpdateReason(id: string, revision: number, patch: UpdateReasonPatch): Promise<Reason> {
  await fakeDelay();
  assertWritable();

  const index = reasonsState.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new ApiError(404, 'CRM_REASON_NOT_FOUND');
  }

  const current = reasonsState[index];

  if (current.isSystem && patch.isActive === false) {
    throw new ApiError(409, 'CRM_REASON_SYSTEM_IMMUTABLE');
  }

  if (current.revision !== revision) {
    throw new ApiError(409, 'CRM_REASON_REVISION_STALE');
  }

  const next: Reason = { ...current };

  if (patch.nameEn !== undefined) {
    const nameEn = patch.nameEn.trim();
    if (!nameEn || nameEn.length > REASON_LIMITS.nameMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'nameEn' });
    }
    next.nameEn = nameEn;
  }

  if (patch.nameAr !== undefined) {
    const nameAr = patch.nameAr.trim();
    if (!nameAr || nameAr.length > REASON_LIMITS.nameMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'nameAr' });
    }
    next.nameAr = nameAr;
  }

  if ('definitionEn' in patch) {
    const defEn = patch.definitionEn?.trim() ?? '';
    if (defEn.length > REASON_LIMITS.defMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'definitionEn' });
    }
    next.definitionEn = defEn || null;
  }

  if ('definitionAr' in patch) {
    const defAr = patch.definitionAr?.trim() ?? '';
    if (defAr.length > REASON_LIMITS.defMax) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'definitionAr' });
    }
    next.definitionAr = defAr || null;
  }

  if (patch.sortOrder !== undefined) {
    if (
      !Number.isInteger(patch.sortOrder) ||
      patch.sortOrder < REASON_LIMITS.sortOrderMin ||
      patch.sortOrder > REASON_LIMITS.sortOrderMax
    ) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'sortOrder' });
    }
    next.sortOrder = patch.sortOrder;
  }

  if (patch.isActive !== undefined) {
    next.isActive = patch.isActive;
  }

  const changed =
    next.nameEn !== current.nameEn ||
    next.nameAr !== current.nameAr ||
    next.definitionEn !== current.definitionEn ||
    next.definitionAr !== current.definitionAr ||
    next.sortOrder !== current.sortOrder ||
    next.isActive !== current.isActive;
  if (!changed) {
    return cloneReason(current);
  }

  next.revision += 1;
  reasonsState = reasonsState.map((item, idx) => (idx === index ? next : item));
  return cloneReason(next);
}

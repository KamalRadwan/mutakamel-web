import { ApiError, assertBodyBooleans, fakeDelay, fakeId } from '../shared/trade-api';
import { TRADE_FAKE_DB, clone, nowIso } from '../shared/trade-foundation.fake';
import type { LocalizedNames, Page } from '../shared/trade-foundation.model';
import {
  FAKE_COLLEAGUE,
  FAKE_ME,
  actorDisplayName,
  checkIfMatch,
  computeHash,
  currentUiLang,
  fakeIdem,
  getFakeActor,
  normalizeWriteOpts,
  type WriteOptions,
} from './governance-fake-actors';
import type {
  AdjustmentMode,
  MatchedPromotion,
  PreviewableVersionStatus,
  ChangeEntriesInput,
  ChangeEntriesResult,
  ChangePromotionsInput,
  ChangePromotionsResult,
  CloneVersionInput,
  CompanyDefault,
  CompanyDefaultList,
  CompanyDefaultMapping,
  CompanyDefaultRow,
  CreatedPriceBook,
  CreatePriceBookInput,
  CreateVersionInput,
  DeletedResult,
  EntryInput,
  GovernanceAuditEntry,
  GovernanceState,
  LinkedAccount,
  ListEntriesQuery,
  ListPriceBooksQuery,
  PriceBookDossier,
  PriceBookHeader,
  PriceBookKpis,
  PriceBookKpisQuery,
  PriceBookListItem,
  PriceBookSource,
  PriceBookStatus,
  PriceDiff,
  PriceDiffEntry,
  PriceDiffEntryChange,
  PriceDiffPromotion,
  PriceEntry,
  PriceEntrySortKey,
  PricePurpose,
  PriceTestEvidence,
  PriceTestResult,
  PriceVersionDetail,
  PriceVersionDetailHead,
  PriceVersionHeadDetail,
  PriceVersionRow,
  PriceVersionStatus,
  PricingDecision,
  PricingErrorReason,
  PricingEvaluateInput,
  PricingReferenceData,
  PromotionBenefit,
  PromotionInput,
  PromotionRejectReason,
  PromotionRule,
  PromotionSelector,
  PublishPriceVersionInput,
  ReferenceBranch,
  ReferenceCurrency,
  RejectedPromotion,
  RetirePriceVersionInput,
  RoundingMode,
  SavedPriceVersion,
  SourceMode,
  UpdatePriceBookInput,
  UpdateVersionInput,
  VersionHead,
  VersionSummary,
} from './pricing.model';
import { PRICING_ENGINE_VERSION } from './pricing.model';
import { promotionToInput } from './pricing.service';
import { validateGovernanceReason } from './governance-reasons.seed';

const FAKE_COMPANY_ID = 'c1';
const POSITIVE_DECIMAL_RE = /^(?!0(?:\.0{1,8})?$)(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const PREVIEWABLE_STATUSES: ReadonlySet<PriceVersionStatus> = new Set(['DRAFT', 'TESTED', 'SCHEDULED', 'PUBLISHED']);
const SCALE = 8;
const SCALE_FACTOR = 100_000_000n;
const DECIMAL_RE = /^(0|[1-9]\d{0,15})(\.\d{1,8})?$/;
const SIGNED_DECIMAL_RE = /^[+-]?(0|[1-9]\d{0,15})(\.\d{1,8})?$/;
const PROMO_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const idem = fakeIdem();

const REFERENCE_BRANCHES: ReferenceBranch[] = [
  { id: 'b1', code: 'CAI-HQ', nameEn: 'Cairo HQ', nameAr: 'المقر الرئيسي بالقاهرة', companyId: 'c1' },
  { id: 'b2', code: 'ALX', nameEn: 'Alexandria', nameAr: 'الإسكندرية', companyId: 'c1' },
  { id: 'b3', code: 'GIZ', nameEn: 'Giza', nameAr: 'الجيزة', companyId: 'c1' },
  { id: 'b4', code: 'RAM-FAC', nameEn: '10th of Ramadan Factory', nameAr: 'مصنع العاشر من رمضان', companyId: 'c2' },
  { id: 'b5', code: 'CAI-OFC', nameEn: 'Cairo Office', nameAr: 'مكتب القاهرة', companyId: 'c2' },
];

const REFERENCE_CURRENCIES: ReferenceCurrency[] = [
  { code: 'EGP', nameEn: 'Egyptian pound', nameAr: 'الجنيه المصري', decimalPlaces: 3 },
  { code: 'USD', nameEn: 'US dollar', nameAr: 'الدولار الأمريكي', decimalPlaces: 2 },
  { code: 'SAR', nameEn: 'Saudi riyal', nameAr: 'الريال السعودي', decimalPlaces: 2 },
  { code: 'KWD', nameEn: 'Kuwaiti dinar', nameAr: 'الدينار الكويتي', decimalPlaces: 3 },
  { code: 'JPY', nameEn: 'Japanese yen', nameAr: 'الين الياباني', decimalPlaces: 0 },
];

interface StoredVersion {
  id: string;
  bookId: string;
  versionNumber: number;
  status: PriceVersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt: string | null;
  supersededByVersionId: string | null;
  version: number;
  checksum: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  clonedFromVersionId: string | null;
  sourceMode: SourceMode;
  entries: PriceEntry[];
  promotions: PromotionRule[];
  latestTestEvidence: PriceTestEvidence | null;
}

interface StoredBook {
  id: string;
  code: string;
  purpose: PricePurpose;
  currencyCode: string;
  status: PriceBookStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  localizedNames: LocalizedNames;
  description: string | null;
  deletedAt: string | null;
}

interface StoredDefault {
  id: string;
  purpose: PricePurpose;
  currencyCode: string;
  priceBookId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Fixed-point 8-decimal arithmetic helpers
// ---------------------------------------------------------------------------

function toScaled(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!SIGNED_DECIMAL_RE.test(trimmed)) return null;
  let neg = false;
  let s = trimmed;
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const [intPart, fracRaw = ''] = s.split('.');
  const fracPart = fracRaw.slice(0, SCALE).padEnd(SCALE, '0');
  const val = BigInt(intPart) * SCALE_FACTOR + BigInt(fracPart);
  return neg ? -val : val;
}

function fromScaled(val: bigint, minDecimals = 3, stripExtra = true): string {
  const neg = val < 0n;
  const abs = neg ? -val : val;
  const intPart = (abs / SCALE_FACTOR).toString();
  const fracFull = (abs % SCALE_FACTOR).toString().padStart(SCALE, '0');
  let frac = fracFull;
  if (stripExtra) {
    frac = fracFull.replace(/0+$/, '');
    if (frac.length < minDecimals) {
      frac = fracFull.slice(0, minDecimals);
    }
  }
  const prefix = neg && abs > 0n ? '-' : '';
  return frac.length > 0 ? `${prefix}${intPart}.${frac}` : `${prefix}${intPart}`;
}

/** fixedDecimalText (trade-app common/fixed-decimal.ts): trailing zeros stripped, no forced decimals. */
function fixedDecimalText(val: bigint): string {
  return fromScaled(val, 0, true);
}

function roundScaledHalfUp(val: bigint, decimals: number): bigint {
  if (decimals >= SCALE) return val;
  const neg = val < 0n;
  const abs = neg ? -val : val;
  const step = 10n ** BigInt(SCALE - decimals);
  const rem = abs % step;
  let q = abs / step;
  if (rem * 2n >= step) {
    q += 1n;
  }
  const res = q * step;
  return neg ? -res : res;
}

function applyPriceAdjustment(
  basePriceStr: string,
  mode: AdjustmentMode,
  valueStr: string | null | undefined,
  rounding: RoundingMode,
  currencyDecimals: number,
): string {
  let scaled = toScaled(basePriceStr) ?? 0n;
  const adj = valueStr ? toScaled(valueStr) : 0n;
  if (adj !== null) {
    if (mode === 'PERCENTAGE') {
      scaled = scaled + (scaled * adj) / (100n * SCALE_FACTOR);
    } else if (mode === 'FIXED_DELTA') {
      scaled = scaled + adj;
    }
  }

  if (scaled < 0n) {
    scaled = 0n;
  }

  switch (rounding) {
    case 'NEAREST_1': {
      scaled = roundScaledHalfUp(scaled, 0);
      break;
    }
    case 'NEAREST_0_50': {
      const half = SCALE_FACTOR / 2n;
      const units = (scaled + half / 2n) / half;
      scaled = units * half;
      break;
    }
    case 'END_95': {
      const whole = roundScaledHalfUp(scaled, 0) / SCALE_FACTOR;
      const ninetyFive = (SCALE_FACTOR * 95n) / 100n;
      scaled = whole * SCALE_FACTOR + ninetyFive;
      break;
    }
    case 'NONE':
      break;
  }

  return fromScaled(scaled, Math.min(currencyDecimals, 3), true);
}

// ---------------------------------------------------------------------------
// Helpers for items, uoms, checksums, overlaps
// ---------------------------------------------------------------------------

function resolveName(names: LocalizedNames, fallback: string): string {
  const lang = currentUiLang();
  return names[lang] || names['en'] || names['ar'] || fallback;
}

function findItemMeta(itemId: string): {
  profileId: string;
  code: string;
  localizedNames: LocalizedNames;
  standardCost: string | null;
  catalogSalesPrice: string | null;
} {
  const item = TRADE_FAKE_DB.items.find((i) => i.id === itemId && i.deletedAt === null);
  if (!item) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  const cp = TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === itemId && p.companyId === 'c1')
    ?? TRADE_FAKE_DB.companyProfiles.find((p) => p.itemId === itemId);
  const sc = cp
    ? TRADE_FAKE_DB.standardCosts.find((c) => c.companyProfileId === cp.id)
    : undefined;
  return {
    profileId: cp?.id ?? `cp-c1-${itemId}`,
    code: item.canonicalCode,
    localizedNames: { ...item.localizedNames },
    standardCost: sc?.standardCost ?? null,
    catalogSalesPrice: cp?.salesPrice ?? null,
  };
}

function findUomMeta(uomId: string): { code: string; displayName: string | null; localizedNames: LocalizedNames } {
  const uom = TRADE_FAKE_DB.uoms.find((u) => u.id === uomId);
  if (!uom) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  return {
    code: uom.code,
    displayName: uom.localizedNames['en'] ?? null,
    localizedNames: { ...uom.localizedNames },
  };
}

function computeVersionChecksum(v: Pick<StoredVersion, 'entries' | 'promotions'>): string {
  return computeHash({
    entries: v.entries.map((e) => ({
      id: e.id,
      itemId: e.itemId,
      uomId: e.uomId,
      min: e.minimumQuantity,
      max: e.maximumQuantity,
      price: e.unitPrice,
      floor: e.minimumAllowedPrice,
      priority: e.priority,
    })),
    promotions: v.promotions.map((p) => ({
      id: p.id,
      code: p.code,
      selector: p.selector,
      benefit: p.benefit,
      priority: p.priority,
      stackGroup: p.stackGroup,
      exclusive: p.exclusive,
    })),
  });
}

function intervalsOverlap(
  minA: bigint,
  maxA: bigint | null,
  minB: bigint,
  maxB: bigint | null,
): boolean {
  const aBeforeB = maxA !== null && maxA <= minB;
  const bBeforeA = maxB !== null && maxB <= minA;
  return !aBeforeB && !bBeforeA;
}

function dateWindowsOverlap(
  fromA: string,
  toA: string | null,
  fromB: string,
  toB: string | null,
): boolean {
  const startA = Date.parse(fromA);
  const endA = toA ? Date.parse(toA) : Number.POSITIVE_INFINITY;
  const startB = Date.parse(fromB);
  const endB = toB ? Date.parse(toB) : Number.POSITIVE_INFINITY;
  return startA < endB && startB < endA;
}

/**
 * Mirrors backend governed-supersession.ts: the supersession fields stamped on a replaced predecessor.
 * `cutoff` is when the successor takes over. effectiveTo is never rewritten.
 * - open, or authored end after the cutoff: supersededAt = cutoff, linked to the successor;
 * - authored end at/before the cutoff, successor starts at/before that end (adjacent): supersededAt = effectiveTo, linked;
 * - authored end before the successor starts (a gap): both fields stay null (DB-4 pairs them).
 */
function supersessionFields(
  predecessorEffectiveTo: string | null,
  cutoff: string,
  successorFrom: string,
  successorId: string,
): { supersededAt: string | null; supersededByVersionId: string | null } {
  if (predecessorEffectiveTo && Date.parse(predecessorEffectiveTo) <= Date.parse(cutoff)) {
    if (Date.parse(successorFrom) <= Date.parse(predecessorEffectiveTo)) {
      return { supersededAt: predecessorEffectiveTo, supersededByVersionId: successorId };
    }
    return { supersededAt: null, supersededByVersionId: null };
  }
  return { supersededAt: cutoff, supersededByVersionId: successorId };
}

function validateAndBuildEntry(
  input: EntryInput,
  bookCurrency: string,
  existing?: PriceEntry,
): PriceEntry {
  if (input.currencyCode && input.currencyCode.toUpperCase() !== bookCurrency) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  if (!DECIMAL_RE.test(input.minimumQuantity.trim())) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  const minScaled = toScaled(input.minimumQuantity);
  if (minScaled === null || minScaled < 0n) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }

  let maxScaled: bigint | null = null;
  let maxStr: string | null = null;
  if (input.maximumQuantity !== undefined && input.maximumQuantity !== null && input.maximumQuantity.trim() !== '') {
    if (!DECIMAL_RE.test(input.maximumQuantity.trim())) {
      throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
    }
    maxScaled = toScaled(input.maximumQuantity);
    if (maxScaled === null || maxScaled <= minScaled) {
      throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
    }
    maxStr = input.maximumQuantity.trim();
  }

  if (!DECIMAL_RE.test(input.unitPrice.trim())) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  const priceScaled = toScaled(input.unitPrice);
  if (priceScaled === null || priceScaled < 0n) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }

  let floorStr: string | null = null;
  if (
    input.minimumAllowedPrice !== undefined &&
    input.minimumAllowedPrice !== null &&
    input.minimumAllowedPrice.trim() !== ''
  ) {
    if (!DECIMAL_RE.test(input.minimumAllowedPrice.trim())) {
      throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
    }
    const floorScaled = toScaled(input.minimumAllowedPrice);
    if (floorScaled === null || floorScaled > priceScaled) {
      throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
    }
    floorStr = input.minimumAllowedPrice.trim();
  }

  const priority = input.priority ?? 100;
  if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }

  const itemMeta = findItemMeta(input.itemId);
  const uomMeta = findUomMeta(input.uomId);

  const stableId =
    existing?.id ??
    (input.id && !input.id.startsWith('temp-') ? input.id : fakeId());

  return {
    id: stableId,
    version: existing ? existing.version + 1 : 1,
    itemCompanyProfileId: itemMeta.profileId,
    itemId: input.itemId,
    itemCode: itemMeta.code,
    itemLocalizedNames: itemMeta.localizedNames,
    uomId: input.uomId,
    uomCode: uomMeta.code,
    uomDisplayName: uomMeta.displayName,
    uomLocalizedNames: uomMeta.localizedNames,
    currencyCode: bookCurrency,
    minimumQuantity: input.minimumQuantity.trim(),
    maximumQuantity: maxStr,
    unitPrice: input.unitPrice.trim(),
    minimumAllowedPrice: floorStr,
    priority,
    standardCost: itemMeta.standardCost,
    catalogSalesPrice: itemMeta.catalogSalesPrice,
  };
}

function validateAndBuildPromotions(inputs: readonly PromotionInput[], existingById?: Map<string, PromotionRule>): PromotionRule[] {
  const seenCodes = new Set<string>();
  return inputs.map((input) => {
    const code = input.code.trim();
    if (!code || code.length > 80 || !PROMO_CODE_RE.test(code)) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }
    const upper = code.toUpperCase();
    if (seenCodes.has(upper)) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }
    seenCodes.add(upper);

    const name = input.name.trim();
    if (!name || name.length > 160) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }

    const discountValue = input.discountValue.trim();
    if (!DECIMAL_RE.test(discountValue)) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }
    const benefitScaled = toScaled(discountValue);
    if (benefitScaled === null || benefitScaled <= 0n) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }
    if (input.benefitType === 'PERCENTAGE' && benefitScaled > 100n * SCALE_FACTOR) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }

    const minQtyStr = (input.minimumQuantity ?? '0').trim() || '0';
    const minQty = toScaled(minQtyStr);
    if (minQty === null || minQty < 0n) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }
    let maxQtyStr: string | null = null;
    if (input.maximumQuantity && input.maximumQuantity.trim() !== '') {
      const maxQty = toScaled(input.maximumQuantity);
      if (maxQty === null || maxQty <= minQty) {
        throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
      }
      maxQtyStr = input.maximumQuantity.trim();
    }

    const priority = input.priority ?? 100;
    if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID');
    }

    const prev = input.id ? existingById?.get(input.id) : undefined;
    // promotionSelector(): only the keys that were sent.
    const selector: PromotionSelector = {
      ...(input.itemId ? { itemId: input.itemId } : {}),
      ...(input.uomId ? { uomId: input.uomId } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.channelId ? { channelId: input.channelId } : {}),
      ...(input.partyId ? { partyId: input.partyId } : {}),
      minimumQuantity: minQtyStr,
      maximumQuantity: maxQtyStr,
    };
    return promotionRule(
      prev?.id ?? fakeId(),
      code,
      name,
      selector,
      { type: input.benefitType, value: discountValue },
      priority,
      (input.stackGroup ?? 'DEFAULT').trim() || 'DEFAULT',
      Boolean(input.exclusive),
      prev ? prev.versionNumber + 1 : 1,
    );
  });
}

function promotionRule(
  id: string,
  code: string,
  name: string,
  selector: PromotionSelector,
  benefit: PromotionBenefit,
  priority: number,
  stackGroup: string,
  exclusive: boolean,
  versionNumber = 1,
): PromotionRule {
  return {
    id,
    version: 1,
    promotionDefinitionId: `pd-${code.toLowerCase()}`,
    code,
    name,
    versionNumber,
    status: 'DRAFT',
    selector,
    itemCode: selector.itemId ? findItemMeta(selector.itemId).code : null,
    uomCode: selector.uomId ? findUomMeta(selector.uomId).code : null,
    benefit,
    priority,
    stackGroup,
    exclusive,
    effectiveFrom: '',
    effectiveTo: null,
    contentHash: computeHash({ selector, benefit, priority, stackGroup, exclusive }),
  };
}

/** Promotion versions follow their price version's status and window. */
function toPromotionView(p: PromotionRule, v: StoredVersion): PromotionRule {
  return { ...clone(p), status: v.status, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo };
}

/** changeVersionRows: the same stackGroup and priority twice is rejected. */
function assertDistinctPrecedence(promotions: readonly PromotionRule[]): void {
  const seen = new Set<string>();
  for (const p of promotions) {
    const key = `${p.stackGroup.toUpperCase()}:${p.priority}`;
    if (seen.has(key)) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID', { reason: ['equal_precedence'] });
    }
    seen.add(key);
  }
}

function findEntryOverlapIndexes(entries: readonly PriceEntry[]): [number, number] | null {
  for (let i = 0; i < entries.length; i += 1) {
    const a = entries[i];
    const minA = toScaled(a.minimumQuantity) ?? 0n;
    const maxA = a.maximumQuantity ? toScaled(a.maximumQuantity) : null;
    for (let j = i + 1; j < entries.length; j += 1) {
      const b = entries[j];
      if (a.itemId !== b.itemId || a.uomId !== b.uomId || a.priority !== b.priority) {
        continue;
      }
      const minB = toScaled(b.minimumQuantity) ?? 0n;
      const maxB = b.maximumQuantity ? toScaled(b.maximumQuantity) : null;
      if (intervalsOverlap(minA, maxA, minB, maxB)) {
        return [i, j];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Seed builder (6 books, >=40 entries, promotions, linked accounts, audit)
// ---------------------------------------------------------------------------

function makeEntry(
  id: string,
  itemId: string,
  uomId: string,
  currencyCode: string,
  minimumQuantity: string,
  maximumQuantity: string | null,
  unitPrice: string,
  minimumAllowedPrice: string | null,
  priority = 100,
): PriceEntry {
  const itemMeta = findItemMeta(itemId);
  const uomMeta = findUomMeta(uomId);
  return {
    id,
    version: 1,
    itemCompanyProfileId: itemMeta.profileId,
    itemId,
    itemCode: itemMeta.code,
    itemLocalizedNames: itemMeta.localizedNames,
    uomId,
    uomCode: uomMeta.code,
    uomDisplayName: uomMeta.displayName,
    uomLocalizedNames: uomMeta.localizedNames,
    currencyCode,
    minimumQuantity,
    maximumQuantity,
    unitPrice,
    minimumAllowedPrice,
    priority,
    standardCost: itemMeta.standardCost,
    catalogSalesPrice: itemMeta.catalogSalesPrice,
  };
}

function seedEvidence(v: StoredVersion, id: string, testedAt: string): PriceTestEvidence {
  return {
    id,
    aggregateVersion: v.version,
    contentHash: v.checksum,
    passed: true,
    testedAt,
    report: {
      passed: true,
      entryCount: v.entries.length,
      promotionCount: v.promotions.length,
      conflicts: [],
      promotionConflicts: [],
    },
  };
}

function buildSeedState(): {
  books: StoredBook[];
  versions: StoredVersion[];
  defaults: StoredDefault[];
  auditTrail: GovernanceAuditEntry[];
  accountLinks: Map<string, string[]>;
} {
  const books: StoredBook[] = [
    {
      id: 'pb-retail-egp',
      code: 'RETAIL-EGP',
      purpose: 'SALES',
      currencyCode: 'EGP',
      status: 'ACTIVE',
      version: 4,
      createdAt: '2025-01-01T08:00:00.000Z',
      updatedAt: '2026-11-18T10:30:00.000Z',
      localizedNames: { en: 'Retail price list', ar: 'قائمة أسعار التجزئة' },
      description: 'Standard retail sales pricing across Egyptian branches.',
      deletedAt: null,
    },
    {
      id: 'pb-wholesale-egp',
      code: 'WHOLESALE-EGP',
      purpose: 'SALES',
      currencyCode: 'EGP',
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-02-10T09:00:00.000Z',
      updatedAt: '2026-11-15T14:00:00.000Z',
      localizedNames: { en: 'Wholesale', ar: 'الجملة' },
      description: 'Volume wholesale pricing effective December 2026.',
      deletedAt: null,
    },
    {
      id: 'pb-export-usd',
      code: 'EXPORT-USD',
      purpose: 'SALES',
      currencyCode: 'USD',
      status: 'ACTIVE',
      version: 3,
      createdAt: '2025-06-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
      localizedNames: { en: 'Export customers', ar: 'عملاء التصدير' },
      description: 'Quarterly USD export tariff.',
      deletedAt: null,
    },
    {
      id: 'pb-suppliers-egp',
      code: 'SUPPLIERS-EGP',
      purpose: 'PURCHASE',
      currencyCode: 'EGP',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-11-12T11:20:00.000Z',
      localizedNames: { en: 'Supplier costs', ar: 'تكاليف الموردين' },
      description: 'Approved supplier purchase agreements in EGP.',
      deletedAt: null,
    },
    {
      id: 'pb-ramadan-egp',
      code: 'RAMADAN-EGP',
      purpose: 'SALES',
      currencyCode: 'EGP',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-11-10T08:00:00.000Z',
      updatedAt: '2026-11-19T16:00:00.000Z',
      localizedNames: { en: 'Ramadan offers', ar: 'عروض رمضان' },
      description: 'Upcoming seasonal promotional rules (awaiting price lines).',
      deletedAt: null,
    },
    {
      id: 'pb-list-2025',
      code: 'LIST-2025',
      purpose: 'SALES',
      currencyCode: 'EGP',
      status: 'INACTIVE',
      version: 5,
      createdAt: '2025-01-01T08:00:00.000Z',
      updatedAt: '2026-01-02T09:00:00.000Z',
      localizedNames: { en: 'Old 2025 list', ar: 'قائمة 2025 القديمة' },
      description: 'Retired 2025 catalog price list.',
      deletedAt: null,
    },
  ];

  const allItems = { minimumQuantity: '1', maximumQuantity: null };
  const retailPromos: PromotionRule[] = [
    promotionRule('promo-winter10', 'WINTER10', 'Winter 10% discount', allItems,
      { type: 'PERCENTAGE', value: '10' }, 10, 'DEFAULT', false),
    promotionRule('promo-vip5', 'VIP5', 'VIP account 5%', allItems,
      { type: 'PERCENTAGE', value: '5' }, 20, 'DEFAULT', false),
    promotionRule('promo-alex-only', 'ALEX-ONLY', 'Alexandria branch rebate', { ...allItems, branchId: 'b2' },
      { type: 'FIXED_AMOUNT', value: '5.000' }, 30, 'REGIONAL', false),
    promotionRule('promo-flash25', 'FLASH25', 'Galaxy A54 exclusive flash', { ...allItems, itemId: 'item-01' },
      { type: 'PERCENTAGE', value: '25' }, 5, 'FLASH', true),
  ];

  const retailV4Entries: PriceEntry[] = [
    makeEntry('pe-r4-01', 'item-17', 'uom-ctn', 'EGP', '1', '10', '118.750', '104.000', 100),
    makeEntry('pe-r4-02', 'item-17', 'uom-ctn', 'EGP', '10', null, '112.500', '104.000', 100),
    makeEntry('pe-r4-03', 'item-17', 'uom-ctn', 'EGP', '1', null, '125.000', '104.000', 200),
    makeEntry('pe-r4-04', 'item-17', 'uom-pcs', 'EGP', '1', null, '10.500', '8.500', 100),
    makeEntry('pe-r4-05', 'item-01', 'uom-pcs', 'EGP', '1', null, '14500.000', '12800.000', 100),
    makeEntry('pe-r4-06', 'item-02', 'uom-pcs', 'EGP', '1', null, '42500.000', '39000.000', 100),
    makeEntry('pe-r4-07', 'item-06', 'uom-pcs', 'EGP', '1', null, '54000.000', '49500.000', 100),
    makeEntry('pe-r4-08', 'item-11', 'uom-pcs', 'EGP', '1', null, '890.000', '740.000', 100),
    makeEntry('pe-r4-09', 'item-14', 'uom-pcs', 'EGP', '1', null, '240.000', '180.000', 100),
    makeEntry('pe-r4-10', 'item-22', 'uom-pack', 'EGP', '1', null, '35.000', '28.000', 100),
    makeEntry('pe-r4-11', 'item-26', 'uom-box', 'EGP', '1', null, '1150.000', '980.000', 100),
    makeEntry('pe-r4-12', 'item-30', 'uom-pcs', 'EGP', '1', null, '12.500', '9.000', 100),
  ];

  const retailV5Entries: PriceEntry[] = [
    makeEntry('pe-r5-01', 'item-17', 'uom-ctn', 'EGP', '1', '10', '122.000', '106.000', 100),
    makeEntry('pe-r5-02', 'item-17', 'uom-ctn', 'EGP', '10', null, '114.000', '106.000', 100),
    makeEntry('pe-r5-03', 'item-17', 'uom-pcs', 'EGP', '1', null, '11.000', '8.500', 100),
    makeEntry('pe-r5-04', 'item-01', 'uom-pcs', 'EGP', '1', null, '14250.000', '12800.000', 100),
    makeEntry('pe-r5-05', 'item-02', 'uom-pcs', 'EGP', '1', null, '43900.000', '39500.000', 100),
    makeEntry('pe-r5-06', 'item-06', 'uom-pcs', 'EGP', '1', null, '54000.000', '49500.000', 100),
    makeEntry('pe-r5-07', 'item-11', 'uom-pcs', 'EGP', '1', null, '875.000', '740.000', 100),
    makeEntry('pe-r5-08', 'item-14', 'uom-pcs', 'EGP', '1', null, '240.000', '180.000', 100),
    makeEntry('pe-r5-09', 'item-22', 'uom-pack', 'EGP', '1', null, '38.000', '30.000', 100),
    makeEntry('pe-r5-10', 'item-26', 'uom-box', 'EGP', '1', null, '1190.000', '1020.000', 100),
    makeEntry('pe-r5-11', 'item-49', 'uom-pcs', 'EGP', '1', null, '1850.000', '1600.000', 100),
    makeEntry('pe-r5-12', 'item-50', 'uom-box', 'EGP', '1', null, '495.000', '420.000', 100),
  ];

  const retailV1Entries: PriceEntry[] = [
    makeEntry('pe-r1-01', 'item-17', 'uom-ctn', 'EGP', '1', null, '95.000', '82.000', 100),
    makeEntry('pe-r1-02', 'item-01', 'uom-pcs', 'EGP', '1', null, '12900.000', '11500.000', 100),
  ];

  const retailV2Entries: PriceEntry[] = [
    makeEntry('pe-r2-01', 'item-17', 'uom-ctn', 'EGP', '1', null, '108.000', '94.000', 100),
    makeEntry('pe-r2-02', 'item-01', 'uom-pcs', 'EGP', '1', null, '13800.000', '12200.000', 100),
  ];

  const wholesaleEntries: PriceEntry[] = [
    makeEntry('pe-w2-01', 'item-17', 'uom-ctn', 'EGP', '1', '10', '105.000', '96.000', 100),
    makeEntry('pe-w2-02', 'item-17', 'uom-ctn', 'EGP', '10', null, '99.500', '92.000', 100),
    makeEntry('pe-w2-03', 'item-01', 'uom-pcs', 'EGP', '5', null, '13400.000', '12500.000', 100),
    makeEntry('pe-w2-04', 'item-02', 'uom-pcs', 'EGP', '5', null, '39800.000', '37500.000', 100),
    makeEntry('pe-w2-05', 'item-11', 'uom-pcs', 'EGP', '10', null, '780.000', '700.000', 100),
    makeEntry('pe-w2-06', 'item-14', 'uom-pcs', 'EGP', '20', null, '195.000', '170.000', 100),
    makeEntry('pe-w2-07', 'item-26', 'uom-box', 'EGP', '10', null, '1060.000', '960.000', 100),
    makeEntry('pe-w2-08', 'item-49', 'uom-pcs', 'EGP', '10', null, '1710.000', '1550.000', 100),
  ];

  const exportUsdEntries: PriceEntry[] = [
    makeEntry('pe-e7-01', 'item-01', 'uom-pcs', 'USD', '1', null, '295.00', '260.00', 100),
    makeEntry('pe-e7-02', 'item-02', 'uom-pcs', 'USD', '1', null, '860.00', '790.00', 100),
    makeEntry('pe-e7-03', 'item-06', 'uom-pcs', 'USD', '1', null, '1120.00', '1010.00', 100),
    makeEntry('pe-e7-04', 'item-11', 'uom-pcs', 'USD', '1', null, '18.50', '15.00', 100),
    makeEntry('pe-e7-05', 'item-14', 'uom-pcs', 'USD', '1', null, '5.25', '4.00', 100),
    makeEntry('pe-e7-06', 'item-49', 'uom-pcs', 'USD', '1', null, '38.00', '33.00', 100),
  ];

  const supplierEntries: PriceEntry[] = [
    makeEntry('pe-s1-01', 'item-01', 'uom-pcs', 'EGP', '1', null, '11400.000', null, 100),
    makeEntry('pe-s1-02', 'item-02', 'uom-pcs', 'EGP', '1', null, '34200.000', null, 100),
    makeEntry('pe-s1-03', 'item-11', 'uom-pcs', 'EGP', '1', null, '610.000', null, 100),
    makeEntry('pe-s1-04', 'item-14', 'uom-pcs', 'EGP', '1', null, '145.000', null, 100),
    makeEntry('pe-s1-05', 'item-17', 'uom-ctn', 'EGP', '1', null, '84.000', null, 100),
    makeEntry('pe-s1-06', 'item-26', 'uom-box', 'EGP', '1', null, '890.000', null, 100),
  ];

  const list2025Entries: PriceEntry[] = [
    makeEntry('pe-l9-01', 'item-01', 'uom-pcs', 'EGP', '1', null, '11900.000', '10500.000', 100),
    makeEntry('pe-l9-02', 'item-02', 'uom-pcs', 'EGP', '1', null, '36900.000', '33500.000', 100),
    makeEntry('pe-l9-03', 'item-06', 'uom-pcs', 'EGP', '1', null, '46500.000', '42000.000', 100),
    makeEntry('pe-l9-04', 'item-11', 'uom-pcs', 'EGP', '1', null, '740.000', '620.000', 100),
    makeEntry('pe-l9-05', 'item-14', 'uom-pcs', 'EGP', '1', null, '180.000', '140.000', 100),
    makeEntry('pe-l9-06', 'item-17', 'uom-ctn', 'EGP', '1', null, '98.000', '85.000', 100),
    makeEntry('pe-l9-07', 'item-22', 'uom-pack', 'EGP', '1', null, '28.000', '22.000', 100),
    makeEntry('pe-l9-08', 'item-26', 'uom-box', 'EGP', '1', null, '940.000', '810.000', 100),
  ];

  const v4Draft: StoredVersion = {
    id: 'pbv-retail-4',
    bookId: 'pb-retail-egp',
    versionNumber: 4,
    status: 'PUBLISHED',
    effectiveFrom: '2026-11-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 3,
    checksum: '',
    createdByUserId: FAKE_COLLEAGUE,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    notes: 'November 2026 retail release.',
    clonedFromVersionId: 'pbv-retail-2',
    sourceMode: 'CLONE_VERSION',
    entries: retailV4Entries,
    promotions: clone(retailPromos),
    latestTestEvidence: null,
  };
  v4Draft.checksum = computeVersionChecksum(v4Draft);
  v4Draft.latestTestEvidence = seedEvidence(v4Draft, 'pte-retail-4', '2026-10-25T12:00:00.000Z');

  const v5Draft: StoredVersion = {
    id: 'pbv-retail-5',
    bookId: 'pb-retail-egp',
    versionNumber: 5,
    status: 'TESTED',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 2,
    checksum: '',
    createdByUserId: FAKE_ME,
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:30:00.000Z',
    notes: 'December seasonal adjustment.',
    clonedFromVersionId: 'pbv-retail-4',
    sourceMode: 'CLONE_VERSION',
    entries: retailV5Entries,
    promotions: clone(retailPromos),
    latestTestEvidence: null,
  };
  v5Draft.checksum = computeVersionChecksum(v5Draft);
  v5Draft.latestTestEvidence = seedEvidence(v5Draft, 'pte-retail-5', '2026-11-18T10:30:00.000Z');

  const v1Retail: StoredVersion = {
    id: 'pbv-retail-1',
    bookId: 'pb-retail-egp',
    versionNumber: 1,
    status: 'RETIRED',
    effectiveFrom: '2025-01-01T00:00:00.000Z',
    effectiveTo: '2026-01-01T00:00:00.000Z',
    supersededAt: null,
    supersededByVersionId: null,
    version: 2,
    checksum: '',
    createdByUserId: FAKE_COLLEAGUE,
    createdAt: '2025-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
    notes: '2025 opening retail tariff.',
    clonedFromVersionId: null,
    sourceMode: 'MANUAL',
    entries: retailV1Entries,
    promotions: [],
    latestTestEvidence: null,
  };
  v1Retail.checksum = computeVersionChecksum(v1Retail);

  const v2Retail: StoredVersion = {
    id: 'pbv-retail-2',
    bookId: 'pb-retail-egp',
    versionNumber: 2,
    status: 'PUBLISHED',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2026-11-01T00:00:00.000Z',
    supersededAt: '2026-11-01T00:00:00.000Z',
    supersededByVersionId: 'pbv-retail-4',
    version: 3,
    checksum: '',
    createdByUserId: FAKE_COLLEAGUE,
    createdAt: '2025-12-15T09:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    notes: '2026 Q1-Q3 retail price list.',
    clonedFromVersionId: 'pbv-retail-1',
    sourceMode: 'CLONE_VERSION',
    entries: retailV2Entries,
    promotions: [],
    latestTestEvidence: null,
  };
  v2Retail.checksum = computeVersionChecksum(v2Retail);

  const v2Wholesale: StoredVersion = {
    id: 'pbv-wholesale-2',
    bookId: 'pb-wholesale-egp',
    versionNumber: 2,
    status: 'SCHEDULED',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 2,
    checksum: '',
    createdByUserId: FAKE_COLLEAGUE,
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-15T14:00:00.000Z',
    notes: 'Wholesale Q4 tier schedule.',
    clonedFromVersionId: null,
    sourceMode: 'MANUAL',
    entries: wholesaleEntries,
    promotions: clone(retailPromos.slice(0, 2)),
    latestTestEvidence: null,
  };
  v2Wholesale.checksum = computeVersionChecksum(v2Wholesale);
  v2Wholesale.latestTestEvidence = seedEvidence(v2Wholesale, 'pte-wholesale-2', '2026-11-14T15:00:00.000Z');

  const v7Export: StoredVersion = {
    id: 'pbv-export-7',
    bookId: 'pb-export-usd',
    versionNumber: 7,
    status: 'PUBLISHED',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.000Z',
    supersededAt: null,
    supersededByVersionId: null,
    version: 2,
    checksum: '',
    createdByUserId: FAKE_COLLEAGUE,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    notes: 'Q4 2026 export prices.',
    clonedFromVersionId: null,
    sourceMode: 'MANUAL',
    entries: exportUsdEntries,
    promotions: [],
    latestTestEvidence: null,
  };
  v7Export.checksum = computeVersionChecksum(v7Export);
  v7Export.latestTestEvidence = seedEvidence(v7Export, 'pte-export-7', '2026-09-28T11:00:00.000Z');

  const v1Suppliers: StoredVersion = {
    id: 'pbv-suppliers-1',
    bookId: 'pb-suppliers-egp',
    versionNumber: 1,
    status: 'TESTED',
    effectiveFrom: '2026-11-25T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 2,
    checksum: '',
    createdByUserId: FAKE_COLLEAGUE,
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-12T11:20:00.000Z',
    notes: 'Initial supplier cost list ready for review.',
    clonedFromVersionId: null,
    sourceMode: 'SEED_FROM_CATALOG',
    entries: supplierEntries,
    promotions: [
      promotionRule('promo-early-rebate', 'EARLY3', 'Early payment supplier rebate 3%', allItems,
        { type: 'PERCENTAGE', value: '3' }, 10, 'SUPPLIER', false),
    ],
    latestTestEvidence: null,
  };
  v1Suppliers.checksum = computeVersionChecksum(v1Suppliers);
  v1Suppliers.latestTestEvidence = seedEvidence(v1Suppliers, 'pte-suppliers-1', '2026-11-12T11:20:00.000Z');

  const v1Ramadan: StoredVersion = {
    id: 'pbv-ramadan-1',
    bookId: 'pb-ramadan-egp',
    versionNumber: 1,
    status: 'DRAFT',
    effectiveFrom: '2027-02-15T00:00:00.000Z',
    effectiveTo: '2027-04-01T00:00:00.000Z',
    supersededAt: null,
    supersededByVersionId: null,
    version: 1,
    checksum: '',
    createdByUserId: FAKE_ME,
    createdAt: '2026-11-10T08:00:00.000Z',
    updatedAt: '2026-11-19T16:00:00.000Z',
    notes: 'Ramadan campaign structure.',
    clonedFromVersionId: null,
    sourceMode: 'EMPTY_DRAFT',
    entries: [],
    promotions: clone(retailPromos),
    latestTestEvidence: null,
  };
  v1Ramadan.checksum = computeVersionChecksum(v1Ramadan);

  const v9List2025: StoredVersion = {
    id: 'pbv-list2025-9',
    bookId: 'pb-list-2025',
    versionNumber: 9,
    status: 'RETIRED',
    effectiveFrom: '2025-07-01T00:00:00.000Z',
    effectiveTo: '2026-01-01T00:00:00.000Z',
    supersededAt: null,
    supersededByVersionId: null,
    version: 3,
    checksum: '',
    createdByUserId: FAKE_COLLEAGUE,
    createdAt: '2025-06-20T09:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
    notes: 'Retired 2025 edition.',
    clonedFromVersionId: null,
    sourceMode: 'MANUAL',
    entries: list2025Entries,
    promotions: [],
    latestTestEvidence: null,
  };
  v9List2025.checksum = computeVersionChecksum(v9List2025);

  const versions = [
    v1Retail,
    v2Retail,
    v4Draft,
    v5Draft,
    v2Wholesale,
    v7Export,
    v1Suppliers,
    v1Ramadan,
    v9List2025,
  ];

  const defaults: StoredDefault[] = [
    {
      id: 'cd-sales-egp',
      purpose: 'SALES',
      currencyCode: 'EGP',
      priceBookId: 'pb-retail-egp',
      version: 1,
      createdAt: '2026-01-05T08:00:00.000Z',
      updatedAt: '2026-01-05T08:00:00.000Z',
    },
    {
      id: 'cd-sales-usd',
      purpose: 'SALES',
      currencyCode: 'USD',
      priceBookId: 'pb-export-usd',
      version: 1,
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
    },
  ];

  const accountLinks = new Map<string, string[]>([
    ['pb-retail-egp', ['acc-c1-c-01', 'acc-c1-c-02', 'acc-c1-c-03', 'acc-c1-c-04']],
    ['pb-wholesale-egp', ['acc-c1-c-05', 'acc-c1-c-06']],
    ['pb-export-usd', ['acc-c1-c-08']],
    ['pb-suppliers-egp', ['acc-c1-s-09', 'acc-c1-s-10']],
  ]);

  const auditTrail: GovernanceAuditEntry[] = [
    {
      id: 'aud-pb-1',
      resourceType: 'PRICE_BOOK',
      resourceId: 'pb-retail-egp',
      action: 'CREATE',
      actorUserId: FAKE_COLLEAGUE,
      actorDisplayName: actorDisplayName(FAKE_COLLEAGUE),
      reason: null,
      occurredAt: '2025-01-01T08:00:00.000Z',
    },
    {
      id: 'aud-pb-2',
      resourceType: 'PRICE_BOOK_VERSION',
      resourceId: 'pbv-retail-4',
      action: 'PUBLISH',
      actorUserId: FAKE_COLLEAGUE,
      actorDisplayName: actorDisplayName(FAKE_COLLEAGUE),
      reason: null,
      occurredAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: 'aud-pb-3',
      resourceType: 'PRICE_BOOK_VERSION',
      resourceId: 'pbv-retail-5',
      action: 'CLONE',
      actorUserId: FAKE_ME,
      actorDisplayName: actorDisplayName(FAKE_ME),
      reason: null,
      occurredAt: '2026-11-18T10:00:00.000Z',
    },
    {
      id: 'aud-pb-4',
      resourceType: 'PRICE_BOOK_VERSION',
      resourceId: 'pbv-retail-5',
      action: 'TEST_PASSED',
      actorUserId: FAKE_ME,
      actorDisplayName: actorDisplayName(FAKE_ME),
      reason: null,
      occurredAt: '2026-11-18T10:30:00.000Z',
    },
  ];

  return { books, versions, defaults, auditTrail, accountLinks };
}

const DB = buildSeedState();

// ---------------------------------------------------------------------------
// Projection helpers & background scheduled activator
// ---------------------------------------------------------------------------

function activateDueScheduledVersions(): void {
  const nowMs = Date.now();
  for (const v of DB.versions) {
    if (v.status === 'SCHEDULED' && Date.parse(v.effectiveFrom) <= nowMs) {
      v.status = 'PUBLISHED';
      v.updatedAt = nowIso();
    }
  }
}

function versionsForBook(bookId: string): StoredVersion[] {
  return DB.versions
    .filter((v) => v.bookId === bookId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

/**
 * The moment a version stops applying: `supersededAt` when a successor replaced it,
 * else its own (immutable) `effectiveTo`. Supersession never rewrites `effectiveTo`.
 */
function effectiveEndOf(v: StoredVersion): string | null {
  return v.supersededAt ?? v.effectiveTo;
}

function isVersionLive(v: StoredVersion, atMs: number = Date.now()): boolean {
  if (v.status !== 'PUBLISHED' && v.status !== 'SCHEDULED') return false;
  const start = Date.parse(v.effectiveFrom);
  const endIso = effectiveEndOf(v);
  const end = endIso ? Date.parse(endIso) : Number.POSITIVE_INFINITY;
  return start <= atMs && atMs < end;
}

function toVersionHead(v: StoredVersion): VersionHead {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    status: v.status,
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    supersededAt: v.supersededAt,
    version: v.version,
  };
}

function toVersionSummary(v: StoredVersion): VersionSummary {
  return {
    ...toVersionHead(v),
    supersededByVersionId: v.supersededByVersionId,
    checksum: v.checksum,
    createdByUserId: v.createdByUserId,
    createdByDisplayName: actorDisplayName(v.createdByUserId),
    createdByEmail: null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    entryCount: v.entries.length,
    promotionCount: v.promotions.length,
    latestTestPassed: v.latestTestEvidence ? v.latestTestEvidence.passed : null,
    latestTestedAt: v.latestTestEvidence ? v.latestTestEvidence.testedAt : null,
    notes: v.notes,
    clonedFromVersionId: v.clonedFromVersionId,
    sourceMode: v.sourceMode,
  };
}

function toVersionDetailHead(v: StoredVersion): PriceVersionDetailHead {
  return {
    ...toVersionHead(v),
    supersededByVersionId: v.supersededByVersionId,
    checksum: v.checksum,
    createdByUserId: v.createdByUserId,
    createdByDisplayName: actorDisplayName(v.createdByUserId),
    createdByEmail: null,
    notes: v.notes,
    clonedFromVersionId: v.clonedFromVersionId,
    sourceMode: v.sourceMode,
  };
}

/** The bare trade_price_book_versions row (publish and retire return it). */
function toVersionRow(v: StoredVersion): PriceVersionRow {
  return {
    ...toVersionHead(v),
    priceBookId: v.bookId,
    supersededByVersionId: v.supersededByVersionId,
    checksum: v.checksum,
    createdBy: v.createdByUserId,
    updatedBy: getFakeActor(),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function toSavedVersion(v: StoredVersion, extra: Partial<SavedPriceVersion> = {}): SavedPriceVersion {
  return {
    ...toVersionRow(v),
    entryCount: v.entries.length,
    promotionCount: v.promotions.length,
    ...extra,
  };
}

function toBookHeader(book: StoredBook): PriceBookHeader {
  return {
    id: book.id,
    companyId: FAKE_COMPANY_ID,
    code: book.code,
    purpose: book.purpose,
    currencyCode: book.currencyCode,
    status: book.status,
    version: book.version,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    name: resolveName(book.localizedNames, book.code),
    localizedNames: { ...book.localizedNames },
    description: book.description,
  };
}

/** Head counts come from the PUBLISHED > SCHEDULED > TESTED > DRAFT version, newest first. */
function headVersionOf(bVersions: readonly StoredVersion[]): StoredVersion | undefined {
  const rank: Record<PriceVersionStatus, number> = { PUBLISHED: 1, SCHEDULED: 2, TESTED: 3, DRAFT: 4, RETIRED: 5 };
  return [...bVersions].sort((a, b) => rank[a.status] - rank[b.status] || b.versionNumber - a.versionNumber)[0];
}

function toBookListItem(book: StoredBook): PriceBookListItem {
  const bVersions = versionsForBook(book.id);
  const head = headVersionOf(bVersions);
  return {
    ...toBookHeader(book),
    versionCount: bVersions.length,
    versions: bVersions.slice(0, 5).map((v) => ({ ...toVersionHead(v), createdByUserId: v.createdByUserId })),
    isCompanyDefault: DB.defaults.some((d) => d.priceBookId === book.id),
    linkedAccountsCount: (DB.accountLinks.get(book.id) ?? []).length,
    entryCount: head?.entries.length ?? 0,
    promotionCount: head?.promotions.length ?? 0,
  };
}

/** The PriceBookGovernanceFilter SQL: a book can match more than one filter. */
function matchesGovernanceFilter(book: StoredBook, filter: GovernanceState, nowMs: number): boolean {
  if (filter === 'INACTIVE') return book.status === 'INACTIVE';
  if (book.status !== 'ACTIVE') return false;
  const bVersions = versionsForBook(book.id);
  switch (filter) {
    case 'PUBLISHED':
      return bVersions.some((v) => isVersionLive(v, nowMs));
    case 'SCHEDULED':
      return bVersions.some((v) => v.status === 'SCHEDULED' && Date.parse(v.effectiveFrom) > nowMs);
    case 'TESTED':
      return bVersions.some((v) => v.status === 'TESTED');
    case 'DRAFT_ONLY':
      return !bVersions.some((v) => v.status === 'PUBLISHED' || v.status === 'SCHEDULED' || v.status === 'TESTED');
  }
}

function matchesBookSearch(book: StoredBook, needle: string): boolean {
  if (!needle) return true;
  const fields = [book.code, ...Object.values(book.localizedNames), book.description ?? ''];
  return fields.some((field) => field.toLowerCase().includes(needle));
}

function buildLinkedAccounts(bookId: string): LinkedAccount[] {
  const ids = DB.accountLinks.get(bookId) ?? [];
  const partyMap = new Map(TRADE_FAKE_DB.parties.map((p) => [p.id, p]));
  const lang = currentUiLang();
  const result: LinkedAccount[] = [];
  for (const accId of ids) {
    const acc = TRADE_FAKE_DB.accounts.find((a) => a.id === accId);
    if (!acc) continue;
    const party = partyMap.get(acc.partyId);
    result.push({
      id: acc.id,
      partyId: acc.partyId,
      partyName: party ? (lang === 'ar' ? party.displayNameAr : party.displayName) : acc.partyId,
      partyType: party?.partyType ?? 'ORGANIZATION',
      accountRole: acc.accountRole,
      status: acc.status,
      creditLimit: acc.creditLimit,
      creditCurrencyCode: acc.creditCurrencyCode,
    });
  }
  return result;
}

function appendAudit(
  resourceType: string,
  resourceId: string,
  action: string,
  reason: string | null = null,
  reasonMeta?: { code: string; nameEn: string; nameAr: string },
): void {
  const actor = getFakeActor();
  DB.auditTrail.unshift({
    id: fakeId(),
    resourceType,
    resourceId,
    action,
    actorUserId: actor,
    actorDisplayName: actorDisplayName(actor),
    reason,
    reasonCode: reasonMeta?.code ?? null,
    reasonNameEn: reasonMeta?.nameEn ?? null,
    reasonNameAr: reasonMeta?.nameAr ?? null,
    occurredAt: nowIso(),
  });
}

function requireBook(id: string): StoredBook {
  const book = DB.books.find((b) => b.id === id && b.deletedAt === null);
  if (!book) {
    throw new ApiError(404, 'TRADE.PRICE.BOOK_NOT_FOUND');
  }
  return book;
}

function requireVersion(id: string): { version: StoredVersion; book: StoredBook } {
  const v = DB.versions.find((item) => item.id === id);
  if (!v) {
    throw new ApiError(404, 'TRADE.PRICE.BOOK_NOT_FOUND');
  }
  const book = requireBook(v.bookId);
  return { version: v, book };
}

function auditForBook(bookId: string): GovernanceAuditEntry[] {
  const versionIds = new Set(versionsForBook(bookId).map((v) => v.id));
  return DB.auditTrail.filter(
    (entry) =>
      (entry.resourceType === 'PRICE_BOOK' && entry.resourceId === bookId) ||
      (entry.resourceType === 'PRICE_BOOK_VERSION' && versionIds.has(entry.resourceId)),
  );
}

function auditForVersion(versionId: string): GovernanceAuditEntry[] {
  return DB.auditTrail.filter(
    (entry) => entry.resourceType === 'PRICE_BOOK_VERSION' && entry.resourceId === versionId,
  );
}

function currencyDecimalsOf(code: string): number {
  return REFERENCE_CURRENCIES.find((c) => c.code === code)?.decimalPlaces ?? 3;
}

// ---------------------------------------------------------------------------
// Public Fake API Functions
// ---------------------------------------------------------------------------

export async function fakeListPriceBooks(q: ListPriceBooksQuery = {}): Promise<Page<PriceBookListItem>> {
  await fakeDelay();
  activateDueScheduledVersions();

  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (q.currencyCode !== undefined && !/^[A-Z]{3}$/.test(q.currencyCode)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const needle = q.q?.trim().toLowerCase() ?? '';
  const nowMs = Date.now();
  const books = DB.books
    .filter((b) => b.deletedAt === null)
    .filter((b) => !q.purpose || b.purpose === q.purpose)
    .filter((b) => !q.status || b.status === q.status)
    .filter((b) => !q.currencyCode || b.currencyCode === q.currencyCode)
    .filter((b) => matchesBookSearch(b, needle))
    .filter((b) => !q.governanceState || matchesGovernanceFilter(b, q.governanceState, nowMs))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const start = (page - 1) * limit;
  return clone({
    items: books.slice(start, start + limit).map(toBookListItem),
    total: books.length,
    page,
    limit,
  });
}

export async function fakeGetKpis(q: PriceBookKpisQuery = {}): Promise<PriceBookKpis> {
  await fakeDelay(150);
  activateDueScheduledVersions();

  const needle = q.q?.trim().toLowerCase() ?? '';
  const nowMs = Date.now();
  const books = DB.books
    .filter((b) => b.deletedAt === null)
    .filter((b) => !q.purpose || b.purpose === q.purpose)
    .filter((b) => !q.status || b.status === q.status)
    .filter((b) => !q.currencyCode || b.currencyCode === q.currencyCode)
    .filter((b) => matchesBookSearch(b, needle));
  const count = (state: GovernanceState) => books.filter((b) => matchesGovernanceFilter(b, state, nowMs)).length;

  return clone({
    total: books.length,
    active: books.filter((b) => b.status === 'ACTIVE').length,
    inactive: books.filter((b) => b.status === 'INACTIVE').length,
    sales: books.filter((b) => b.purpose === 'SALES').length,
    purchase: books.filter((b) => b.purpose === 'PURCHASE').length,
    publishedBooks: count('PUBLISHED'),
    scheduledBooks: count('SCHEDULED'),
    testedBooks: count('TESTED'),
    draftOnlyBooks: count('DRAFT_ONLY'),
    mappedDefaults: DB.defaults.filter((d) => books.some((b) => b.id === d.priceBookId)).length,
    distinctCurrencies: Array.from(new Set(books.map((b) => b.currencyCode))).sort(),
  });
}

export async function fakeGetPriceBook(id: string): Promise<PriceBookDossier> {
  await fakeDelay();
  activateDueScheduledVersions();

  const book = requireBook(id);
  const bVersions = versionsForBook(book.id);
  const mapped = DB.defaults.find(
    (d) => d.purpose === book.purpose && d.currencyCode === book.currencyCode,
  );
  const companyDefaultMapping: CompanyDefaultMapping | null = mapped
    ? {
        id: mapped.id,
        purpose: mapped.purpose,
        currencyCode: mapped.currencyCode,
        priceBookId: mapped.priceBookId,
        version: mapped.version,
        isThisBook: mapped.priceBookId === book.id,
      }
    : null;

  return clone({
    book: { ...toBookHeader(book), isCompanyDefault: mapped?.priceBookId === book.id },
    companyDefaultMapping,
    versions: bVersions.map(toVersionSummary),
    linkedAccounts: buildLinkedAccounts(book.id),
    activeLocksCount: bVersions.filter((v) => v.status === 'PUBLISHED' || v.status === 'SCHEDULED').length,
    auditTrail: auditForBook(book.id),
  });
}

/** Solo owners who may publish their own work with an attestation (resolveSoloOwnerGovernanceEligibility). */
const SOLO_OWNER_ELIGIBLE = new Set<string>();

/** Test hook: marks an actor as an eligible solo owner. */
export function setFakeSoloOwnerEligible(actorId: string, eligible: boolean): void {
  if (eligible) SOLO_OWNER_ELIGIBLE.add(actorId);
  else SOLO_OWNER_ELIGIBLE.delete(actorId);
}

export async function fakeGetPriceVersion(
  id: string,
  include: 'entries' | 'none' = 'entries',
): Promise<PriceVersionDetail | PriceVersionHeadDetail> {
  await fakeDelay();
  activateDueScheduledVersions();

  const { version: v, book } = requireVersion(id);
  const detail: PriceVersionDetail = {
    canViewCost: true,
    entryCount: v.entries.length,
    soloOwnerGovernanceEligible: SOLO_OWNER_ELIGIBLE.has(getFakeActor()),
    book: {
      id: book.id,
      code: book.code,
      purpose: book.purpose,
      currencyCode: book.currencyCode,
      status: book.status,
      version: book.version,
      name: resolveName(book.localizedNames, book.code),
      localizedNames: { ...book.localizedNames },
      description: book.description,
      versions: versionsForBook(book.id).map(toVersionHead),
    },
    version: toVersionDetailHead(v),
    entries: clone(v.entries),
    promotions: v.promotions.map((p) => toPromotionView(p, v)),
    latestTestEvidence: v.latestTestEvidence ? clone(v.latestTestEvidence) : null,
    auditTrail: clone(auditForVersion(v.id)),
  };
  if (include === 'none') {
    const { entries: _entries, version: versionHead, ...head } = detail;
    return { ...head, versionHead, version: versionHead.version };
  }
  return detail;
}

const ENTRY_SORT_KEYS: readonly PriceEntrySortKey[] = ['itemCode', 'priority', 'unitPrice'];

function compareScaled(a: string, b: string): number {
  const sa = toScaled(a) ?? 0n;
  const sb = toScaled(b) ?? 0n;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

export async function fakeListEntries(
  versionId: string,
  q: ListEntriesQuery = {},
): Promise<Page<PriceEntry>> {
  await fakeDelay(150);
  activateDueScheduledVersions();

  const { version: v } = requireVersion(versionId);
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  const sort = q.sort ?? 'itemCode';
  if (
    !Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 200 ||
    !ENTRY_SORT_KEYS.includes(sort)
  ) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const needle = q.q?.trim().toLowerCase() ?? '';
  const dir = q.dir === 'desc' ? -1 : 1;
  const filtered = v.entries
    .filter((entry) => !q.uomId || entry.uomId === q.uomId)
    .filter((entry) => !q.itemId || entry.itemId === q.itemId)
    .filter(
      (entry) =>
        !needle ||
        entry.itemCode.toLowerCase().includes(needle) ||
        Object.values(entry.itemLocalizedNames).some((n) => n.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      const primary =
        sort === 'itemCode'
          ? a.itemCode.localeCompare(b.itemCode)
          : sort === 'priority'
            ? a.priority - b.priority
            : compareScaled(a.unitPrice, b.unitPrice);
      return dir * primary || a.id.localeCompare(b.id);
    });

  const start = (page - 1) * limit;
  return clone({
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
  });
}

export async function fakeCreatePriceBook(
  input: CreatePriceBookInput,
  opts?: WriteOptions | string,
): Promise<CreatedPriceBook> {
  await fakeDelay();
  const resolvedOpts = typeof opts === 'string' ? { idempotencyKey: opts } : normalizeWriteOpts(opts);

  return idem.run('pricing:createBook', resolvedOpts.idempotencyKey, input, () => {
    const code = input.code.trim().toUpperCase();
    const currency = input.currencyCode.trim().toUpperCase();
    if (!code || code.length > 80) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
    if (!REFERENCE_CURRENCIES.some((c) => c.code === currency)) {
      throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID');
    }
    if (DB.books.some((b) => b.code.toUpperCase() === code)) {
      throw new ApiError(409, 'TRADE.PRICE.BOOK_ALREADY_EXISTS');
    }

    const localizedNames: LocalizedNames = { ...(input.localizedNames ?? {}) };
    if (input.name && !localizedNames['en']) {
      localizedNames['en'] = input.name.trim();
    }
    const hasMetadata =
      input.name !== undefined || input.localizedNames !== undefined || input.description !== undefined;

    const now = nowIso();
    const book: StoredBook = {
      id: fakeId(),
      code,
      purpose: input.purpose,
      currencyCode: currency,
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now,
      localizedNames,
      description: input.description?.trim() ? input.description.trim() : null,
      deletedAt: null,
    };
    DB.books.unshift(book);
    appendAudit('PRICE_BOOK', book.id, 'CREATE');
    const { name, localizedNames: names, description, ...row } = toBookHeader(book);
    return hasMetadata ? { ...row, name, localizedNames: names, description } : row;
  });
}

export async function fakeUpdatePriceBook(
  id: string,
  input: UpdatePriceBookInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceBookHeader> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:updateBook:${id}`, opts.idempotencyKey, { id, input, ifMatch: opts.ifMatch }, () => {
    const book = requireBook(id);
    checkIfMatch(opts.ifMatch, book.version);

    if (input.status === 'INACTIVE' && book.status !== 'INACTIVE') {
      if (DB.defaults.some((d) => d.priceBookId === book.id)) {
        throw new ApiError(409, 'TRADE.PRICE.BOOK_IN_USE', { reason: ['mapped_as_company_default'] });
      }
    }

    const wasStatus = book.status;
    if (input.localizedNames !== undefined) {
      book.localizedNames = { ...book.localizedNames, ...input.localizedNames };
    }
    if (input.name !== undefined) {
      book.localizedNames['en'] = input.name.trim();
    }
    if (input.description !== undefined) {
      book.description = input.description && input.description.trim() ? input.description.trim() : null;
    }
    if (input.status !== undefined) {
      book.status = input.status;
    }

    book.version += 1;
    book.updatedAt = nowIso();

    const action =
      book.status !== wasStatus ? (book.status === 'INACTIVE' ? 'DEACTIVATE' : 'ACTIVATE') : 'UPDATE';
    appendAudit('PRICE_BOOK', book.id, action);

    return toBookHeader(book);
  });
}

function assertWindow(from: string, to: string | null | undefined): void {
  const fromMs = Date.parse(from);
  if (Number.isNaN(fromMs)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (to && Date.parse(to) <= fromMs) {
    throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID');
  }
}

/** validateEntryTiers: overlapping tiers name the two rows (`newIndex:N` for unsaved rows). */
function assertNoTierOverlap(entries: readonly PriceEntry[], rowIds: readonly string[]): void {
  const overlap = findEntryOverlapIndexes(entries);
  if (overlap) {
    throw new ApiError(422, 'TRADE.PRICE.TIER_OVERLAP', {
      entryIds: [rowIds[overlap[0]], rowIds[overlap[1]]],
    });
  }
}

function storeNewVersion(
  book: StoredBook,
  input: { effectiveFrom: string; effectiveTo?: string | null; notes?: string },
  content: Pick<StoredVersion, 'entries' | 'promotions' | 'clonedFromVersionId' | 'sourceMode'>,
  auditAction: string,
): StoredVersion {
  const maxNum = versionsForBook(book.id).reduce((max, item) => Math.max(max, item.versionNumber), 0);
  const now = nowIso();
  const created: StoredVersion = {
    id: fakeId(),
    bookId: book.id,
    versionNumber: maxNum + 1,
    status: 'DRAFT',
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    supersededAt: null,
    supersededByVersionId: null,
    version: 1,
    checksum: '',
    createdByUserId: getFakeActor(),
    createdAt: now,
    updatedAt: now,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    latestTestEvidence: null,
    ...content,
  };
  created.checksum = computeVersionChecksum(created);
  DB.versions.push(created);
  appendAudit('PRICE_BOOK_VERSION', created.id, auditAction);
  return created;
}

export async function fakeCreateVersion(
  bookId: string,
  input: CreateVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<SavedPriceVersion> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:createVersion:${bookId}`, opts.idempotencyKey, { bookId, input, ifMatch: opts.ifMatch }, () => {
    const book = requireBook(bookId);
    checkIfMatch(opts.ifMatch, book.version);
    if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 10_000) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
    assertWindow(input.effectiveFrom, input.effectiveTo);

    const entries = input.entries.map((e) => validateAndBuildEntry(e, book.currencyCode));
    assertNoTierOverlap(entries, entries.map((_, index) => `newIndex:${index}`));
    const promotions = validateAndBuildPromotions(input.promotions ?? []);

    const created = storeNewVersion(
      book,
      input,
      { entries, promotions, clonedFromVersionId: null, sourceMode: 'MANUAL' },
      'CREATE',
    );
    return clone(
      toSavedVersion(created, input.notes !== undefined ? { notes: created.notes } : {}),
    );
  });
}

export async function fakeCloneVersion(
  bookId: string,
  input: CloneVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<SavedPriceVersion> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:cloneVersion:${bookId}`, opts.idempotencyKey, { bookId, input, ifMatch: opts.ifMatch }, () => {
    const book = requireBook(bookId);
    checkIfMatch(opts.ifMatch, book.version);
    assertWindow(input.effectiveFrom, input.effectiveTo);

    const currencyDecimals = currencyDecimalsOf(book.currencyCode);
    const rounding: RoundingMode = input.roundingMode ?? 'NONE';
    const adjustmentMode: AdjustmentMode = input.adjustmentMode ?? 'NONE';
    if ((rounding === 'NEAREST_0_50' || rounding === 'END_95') && currencyDecimals < 2) {
      throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID');
    }
    if (adjustmentMode !== 'NONE' && (!input.adjustmentValue || !SIGNED_DECIMAL_RE.test(input.adjustmentValue.trim()))) {
      throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID');
    }

    let entries: PriceEntry[] = [];
    let promotions: PromotionRule[] = [];
    let clonedFromVersionId: string | null = null;
    let auditAction = 'CREATE_EMPTY';

    if (input.sourceMode === 'CLONE_VERSION') {
      if (!input.sourceVersionId) {
        throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID');
      }
      const source = requireVersion(input.sourceVersionId);
      if (source.book.purpose !== book.purpose || source.book.currencyCode !== book.currencyCode) {
        throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID');
      }
      clonedFromVersionId = source.version.id;
      entries = source.version.entries.map((e) => ({
        ...clone(e),
        id: fakeId(),
        version: 1,
        unitPrice: applyPriceAdjustment(e.unitPrice, adjustmentMode, input.adjustmentValue, rounding, currencyDecimals),
      }));
      if (input.includePromotions !== false) {
        promotions = source.version.promotions.map((p) => ({ ...clone(p), id: fakeId() }));
      }
      auditAction = 'CLONE';
    } else if (input.sourceMode === 'SEED_FROM_CATALOG') {
      const eligibleProfiles = TRADE_FAKE_DB.companyProfiles.filter((cp) => {
        if (cp.status !== 'ACTIVE' || cp.currencyCode !== book.currencyCode) return false;
        if (book.purpose === 'SALES') return cp.canSell && cp.salesPrice !== null;
        return cp.canPurchase && cp.salesPrice !== null;
      });
      entries = eligibleProfiles.slice(0, 25).map((cp) => {
        const item = TRADE_FAKE_DB.items.find((i) => i.id === cp.itemId);
        const uomId =
          (book.purpose === 'SALES' ? cp.defaultSalesUomId : cp.defaultPurchaseUomId) ?? item?.baseUomId ?? 'uom-pcs';
        const adjusted = applyPriceAdjustment(
          cp.salesPrice ?? '0.000',
          adjustmentMode,
          input.adjustmentValue,
          rounding,
          currencyDecimals,
        );
        return makeEntry(fakeId(), cp.itemId, uomId, book.currencyCode, '1', null, adjusted, null, 100);
      });
      auditAction = 'SEED_CATALOG';
    }

    const created = storeNewVersion(
      book,
      input,
      { entries, promotions, clonedFromVersionId, sourceMode: input.sourceMode },
      auditAction,
    );
    return clone(
      toSavedVersion(created, {
        notes: created.notes,
        clonedFromVersionId: input.sourceVersionId ?? null,
        sourceMode: input.sourceMode,
      }),
    );
  });
}

function assertEditable(v: StoredVersion): void {
  if (v.status !== 'DRAFT' && v.status !== 'TESTED') {
    throw new ApiError(409, 'TRADE.PRICE.PUBLISH_NOT_ALLOWED', { reason: ['not_editable'] });
  }
}

/** Any content change drops the version back to DRAFT with a new checksum. */
function markDraftChanged(v: StoredVersion): void {
  v.status = 'DRAFT';
  v.version += 1;
  v.updatedAt = nowIso();
  v.checksum = computeVersionChecksum(v);
  appendAudit('PRICE_BOOK_VERSION', v.id, 'UPDATE_DRAFT');
}

export async function fakeUpdateVersion(
  id: string,
  input: UpdateVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<SavedPriceVersion> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:updateVersion:${id}`, opts.idempotencyKey, { id, input, ifMatch: opts.ifMatch }, () => {
    const { version: v, book } = requireVersion(id);
    checkIfMatch(opts.ifMatch, v.version);
    assertEditable(v);

    const nextFrom = input.effectiveFrom ?? v.effectiveFrom;
    const nextTo = input.effectiveTo !== undefined ? input.effectiveTo : v.effectiveTo;
    assertWindow(nextFrom, nextTo);

    if (input.entries !== undefined) {
      if (input.entries.length > 10_000) {
        throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
      }
      const nextEntries = input.entries.map((e) => validateAndBuildEntry(e, book.currencyCode));
      assertNoTierOverlap(nextEntries, nextEntries.map((_, index) => `newIndex:${index}`));
      v.entries = nextEntries;
    }
    if (input.promotions !== undefined) {
      if (input.promotions.length > 500) {
        throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
      }
      v.promotions = validateAndBuildPromotions(input.promotions);
    }

    v.effectiveFrom = nextFrom;
    v.effectiveTo = nextTo ?? null;
    if (input.notes !== undefined) {
      v.notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
    }
    markDraftChanged(v);
    return clone(toSavedVersion(v, { notes: v.notes }));
  });
}

/** applyRowChanges: the operation rules shared by entries/changes and promotions/changes. */
function assertRowChanges(
  existingIds: ReadonlySet<string>,
  upsertIds: readonly string[],
  deletes: readonly string[],
  code: 'TRADE.PRICE.ENTRY_INVALID' | 'TRADE.PRICE.RULE_INVALID',
  hasUpserts: boolean,
): void {
  const fail = (reason: PricingErrorReason): never => {
    throw new ApiError(422, code, { reason: [reason] });
  };
  if (!hasUpserts && deletes.length === 0) fail('operations_required');
  const named = [...upsertIds, ...deletes];
  if (new Set(named).size !== named.length) fail('duplicate_operation');
  if (named.some((rowId) => !existingIds.has(rowId))) fail('entry_not_in_version');
}

export async function fakeChangeEntries(
  versionId: string,
  input: ChangeEntriesInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ChangeEntriesResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);
  const upserts = input.upserts ?? [];
  const deletes = input.deletes ?? [];
  if (upserts.length > 1000 || deletes.length > 1000) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  return idem.run(`pricing:changeEntries:${versionId}`, opts.idempotencyKey, { versionId, input, ifMatch: opts.ifMatch }, () => {
    const { version: v, book } = requireVersion(versionId);
    checkIfMatch(opts.ifMatch, v.version);
    assertEditable(v);

    const upsertIds = upserts.flatMap((row) => (row.id ? [row.id] : []));
    assertRowChanges(new Set(v.entries.map((e) => e.id)), upsertIds, deletes, 'TRADE.PRICE.ENTRY_INVALID', upserts.length > 0);

    const removed = new Set([...upsertIds, ...deletes]);
    const kept = v.entries.filter((e) => !removed.has(e.id));
    const existingById = new Map(v.entries.map((e) => [e.id, e]));
    const built = upserts.map((row) => validateAndBuildEntry(row, book.currencyCode, row.id ? existingById.get(row.id) : undefined));
    const nextEntries = [...kept, ...built];
    if (nextEntries.length > 10_000) {
      throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID', { reason: ['row_limit_exceeded'] });
    }
    assertNoTierOverlap(nextEntries, [
      ...kept.map((e) => e.id),
      ...upserts.map((row, index) => row.id ?? `newIndex:${index}`),
    ]);

    v.entries = nextEntries;
    markDraftChanged(v);
    return {
      id: v.id,
      status: v.status,
      checksum: v.checksum,
      version: v.version,
      entryCount: v.entries.length,
      promotionCount: v.promotions.length,
      changedEntryIds: [...built.map((e) => e.id), ...deletes],
    };
  });
}

export async function fakeChangePromotions(
  versionId: string,
  input: ChangePromotionsInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ChangePromotionsResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);
  const upserts = input.upserts ?? [];
  const deletes = input.deletes ?? [];
  if (upserts.length > 500 || deletes.length > 500) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  return idem.run(`pricing:changePromotions:${versionId}`, opts.idempotencyKey, { versionId, input, ifMatch: opts.ifMatch }, () => {
    const { version: v } = requireVersion(versionId);
    checkIfMatch(opts.ifMatch, v.version);
    assertEditable(v);
    if (upserts.length + deletes.length > 500) {
      throw new ApiError(422, 'TRADE.PRICE.RULE_INVALID', { reason: ['operation_limit_exceeded'] });
    }

    const upsertIds = upserts.flatMap((row) => (row.id ? [row.id] : []));
    assertRowChanges(new Set(v.promotions.map((p) => p.id)), upsertIds, deletes, 'TRADE.PRICE.RULE_INVALID', upserts.length > 0);

    const removed = new Set([...upsertIds, ...deletes]);
    const kept = v.promotions.filter((p) => !removed.has(p.id));
    const existingById = new Map(v.promotions.map((p) => [p.id, p]));
    // Codes are unique across the whole next set (validatePromotionRules).
    const built = validateAndBuildPromotions(
      [...kept.map(promotionToInput), ...upserts],
      new Map([...existingById]),
    ).slice(kept.length);
    const nextPromotions = [...kept, ...built];
    assertDistinctPrecedence(nextPromotions);

    v.promotions = nextPromotions;
    markDraftChanged(v);
    return {
      id: v.id,
      status: v.status,
      checksum: v.checksum,
      version: v.version,
      entryCount: v.entries.length,
      promotionCount: v.promotions.length,
      changedPromotionIds: [...built.map((p) => p.id), ...deletes],
    };
  });
}

export async function fakeDeleteVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<DeletedResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:deleteVersion:${id}`, opts.idempotencyKey, { id, ifMatch: opts.ifMatch }, () => {
    const { version: v } = requireVersion(id);
    checkIfMatch(opts.ifMatch, v.version);
    if (v.status !== 'DRAFT') {
      throw new ApiError(409, 'TRADE.PRICE.PUBLISH_NOT_ALLOWED', { reason: ['not_editable'] });
    }
    DB.versions.splice(DB.versions.indexOf(v), 1);
    appendAudit('PRICE_BOOK_VERSION', id, 'DELETE_DRAFT');
    return { id, deleted: true as const };
  });
}

export async function fakeTestVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceTestResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:testVersion:${id}`, opts.idempotencyKey, { id, ifMatch: opts.ifMatch }, () => {
    const { version: v } = requireVersion(id);
    checkIfMatch(opts.ifMatch, v.version);
    if (v.status !== 'DRAFT' && v.status !== 'TESTED') {
      throw new ApiError(409, 'TRADE.PRICE.TEST_NOT_ALLOWED', { reason: ['not_editable'] });
    }

    const conflicts: string[] = [];
    for (let i = 0; i < v.entries.length; i += 1) {
      const a = v.entries[i];
      const minA = toScaled(a.minimumQuantity) ?? 0n;
      const maxA = a.maximumQuantity ? toScaled(a.maximumQuantity) : null;
      for (let j = i + 1; j < v.entries.length; j += 1) {
        const b = v.entries[j];
        if (a.itemId !== b.itemId || a.uomId !== b.uomId || a.priority !== b.priority) continue;
        const minB = toScaled(b.minimumQuantity) ?? 0n;
        const maxB = b.maximumQuantity ? toScaled(b.maximumQuantity) : null;
        if (intervalsOverlap(minA, maxA, minB, maxB)) {
          conflicts.push(`OVERLAP:${a.id}:${b.id}:${i + 1}:${j + 1}`);
        }
      }
    }

    const promotionConflicts: string[] = [];
    const seenPromoCodes = new Set<string>();
    for (const p of v.promotions) {
      const upper = p.code.toUpperCase();
      if (seenPromoCodes.has(upper)) promotionConflicts.push(`DUPLICATE:${p.code}`);
      seenPromoCodes.add(upper);
    }
    for (let i = 0; i < v.promotions.length; i += 1) {
      for (let j = i + 1; j < v.promotions.length; j += 1) {
        const a = v.promotions[i];
        const b = v.promotions[j];
        if (a.stackGroup === b.stackGroup && a.priority === b.priority) {
          promotionConflicts.push(`EQUAL_PRECEDENCE:${a.code}:${b.code}`);
        }
      }
    }

    // An empty version fails without a conflict line.
    const passed = v.entries.length > 0 && conflicts.length === 0 && promotionConflicts.length === 0;
    const report = {
      passed,
      entryCount: v.entries.length,
      promotionCount: v.promotions.length,
      conflicts,
      promotionConflicts,
    };
    const evidenceId = fakeId();
    v.latestTestEvidence = {
      id: evidenceId,
      aggregateVersion: v.version,
      contentHash: v.checksum,
      passed,
      report,
      testedAt: nowIso(),
    };
    if (passed) {
      v.status = 'TESTED';
      v.version += 1;
      v.updatedAt = nowIso();
    }
    appendAudit('PRICE_BOOK_VERSION', v.id, passed ? 'TEST_PASSED' : 'TEST_FAILED');
    return clone({ evidenceId, ...report, checksum: v.checksum, version: v.version });
  });
}

export async function fakePublishVersion(
  id: string,
  input: PublishPriceVersionInput = {},
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceVersionRow> {
  await fakeDelay();
  assertBodyBooleans(input, ['soloOwnerAttestation']);
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:publishVersion:${id}`, opts.idempotencyKey, { id, input, ifMatch: opts.ifMatch }, () => {
    const { version: v, book } = requireVersion(id);
    checkIfMatch(opts.ifMatch, v.version);
    if (v.status !== 'TESTED') {
      throw new ApiError(409, 'TRADE.PRICE.PUBLISH_NOT_ALLOWED', { reason: ['not_tested'] });
    }

    // Maker-checker: the maker may publish only as an eligible solo owner who attests.
    const actor = getFakeActor();
    let soloOwnerApproved = false;
    if (v.createdByUserId === actor) {
      if (input.soloOwnerAttestation !== true || !SOLO_OWNER_ELIGIBLE.has(actor)) {
        throw new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
      }
      soloOwnerApproved = true;
    }

    const evidence = v.latestTestEvidence;
    if (!evidence || !evidence.passed || evidence.contentHash !== v.checksum) {
      throw new ApiError(409, 'TRADE.PRICE.TEST_FAILED');
    }

    const nowMs = Date.now();
    const fromMs = Date.parse(v.effectiveFrom);
    let predecessor: StoredVersion | undefined;
    if (input.supersedesVersionId) {
      if (fromMs < nowMs) {
        throw new ApiError(409, 'TRADE.PRICE.PUBLISH_NOT_ALLOWED', { reason: ['retroactive_supersession'] });
      }
      // The predecessor must be live or scheduled, not yet replaced, start before the successor
      // and still apply when it starts (an earlier end leaves a gap; an ended one always does).
      predecessor = DB.versions.find((item) => item.id === input.supersedesVersionId && item.bookId === book.id);
      if (
        !predecessor ||
        predecessor.id === v.id ||
        (predecessor.status !== 'PUBLISHED' && predecessor.status !== 'SCHEDULED') ||
        predecessor.supersededAt !== null ||
        Date.parse(predecessor.effectiveFrom) >= fromMs ||
        (predecessor.effectiveTo !== null && Date.parse(predecessor.effectiveTo) < fromMs)
      ) {
        throw new ApiError(409, 'TRADE.PRICE.PUBLISH_NOT_ALLOWED', { reason: ['predecessor_invalid'] });
      }
    }

    // A replaced version applies until COALESCE(supersededAt, effectiveTo).
    const endOf = (other: StoredVersion) => (other === predecessor ? v.effectiveFrom : effectiveEndOf(other));
    const overlaps = versionsForBook(book.id).some(
      (other) =>
        other.id !== v.id &&
        (other.status === 'PUBLISHED' || other.status === 'SCHEDULED') &&
        dateWindowsOverlap(v.effectiveFrom, v.effectiveTo, other.effectiveFrom, endOf(other)),
    );
    if (overlaps) {
      throw new ApiError(409, 'TRADE.PRICE.VERSION_OVERLAP');
    }

    if (predecessor) {
      predecessor.supersededAt = v.effectiveFrom;
      predecessor.supersededByVersionId = v.id;
      predecessor.version += 1;
      predecessor.updatedAt = nowIso();
    }

    const scheduled = fromMs > nowMs;
    v.status = scheduled ? 'SCHEDULED' : 'PUBLISHED';
    v.version += 1;
    v.updatedAt = nowIso();

    const action = soloOwnerApproved
      ? scheduled
        ? 'SOLO_OWNER_SCHEDULE'
        : 'SOLO_OWNER_PUBLISH'
      : scheduled
        ? 'SCHEDULE'
        : 'PUBLISH';
    appendAudit('PRICE_BOOK_VERSION', v.id, action, input.approvalNotes?.trim() || null);
    return clone(toVersionRow(v));
  });
}

export async function fakeRetireVersion(
  id: string,
  body: RetirePriceVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<PriceVersionRow> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`pricing:retireVersion:${id}`, opts.idempotencyKey, { id, body, ifMatch: opts.ifMatch }, () => {
    const { version: v } = requireVersion(id);
    checkIfMatch(opts.ifMatch, v.version);
    if (v.status !== 'PUBLISHED' && v.status !== 'SCHEDULED') {
      throw new ApiError(409, 'TRADE.PRICE.PUBLISH_NOT_ALLOWED', { reason: ['not_live'] });
    }

    const { reason, reasonNote } = validateGovernanceReason('PRICE_VERSION_RETIRE', body.reasonCode, body.reasonNote);

    v.status = 'RETIRED';
    v.version += 1;
    v.updatedAt = nowIso();
    appendAudit('PRICE_BOOK_VERSION', v.id, 'RETIRE', reasonNote || null, {
      code: reason.code,
      nameEn: reason.localizedNames['en'] ?? reason.code,
      nameAr: reason.localizedNames['ar'] ?? reason.code,
    });
    return clone(toVersionRow(v));
  });
}

export async function fakeGetDiff(versionId: string, compareVersionId: string): Promise<PriceDiff> {
  await fakeDelay();
  activateDueScheduledVersions();

  const target = requireVersion(versionId);
  const baseline = requireVersion(compareVersionId);
  if (target.book.currencyCode !== baseline.book.currencyCode) {
    throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID');
  }

  const tierKey = (e: PriceEntry) =>
    `${e.itemId}:${e.uomId}:${fromScaled(toScaled(e.minimumQuantity) ?? 0n, 0, true)}:${e.priority}`;
  const baseMap = new Map(baseline.version.entries.map((e) => [tierKey(e), e]));
  const targetMap = new Map(target.version.entries.map((e) => [tierKey(e), e]));
  const allKeys = Array.from(new Set([...targetMap.keys(), ...baseMap.keys()]));
  const summary = { totalCompared: allKeys.length, added: 0, removed: 0, increased: 0, decreased: 0, unchanged: 0 };

  const entries: PriceDiffEntry[] = allKeys.map((key) => {
    const prev = baseMap.get(key) ?? null;
    const cur = targetMap.get(key) ?? null;
    const ref = (cur ?? prev)!;
    const common = {
      itemId: ref.itemId,
      itemCode: ref.itemCode,
      itemLocalizedNames: ref.itemLocalizedNames,
      uomId: ref.uomId,
      uomCode: ref.uomCode,
      minimumQuantity: ref.minimumQuantity,
      priority: ref.priority,
    };
    if (cur && !prev) {
      summary.added += 1;
      return { ...common, changeType: 'ADDED', maximumQuantity: cur.maximumQuantity, baselineUnitPrice: null,
        targetUnitPrice: cur.unitPrice, deltaAmount: cur.unitPrice, deltaPct: null };
    }
    if (prev && !cur) {
      summary.removed += 1;
      return { ...common, changeType: 'REMOVED', maximumQuantity: prev.maximumQuantity, baselineUnitPrice: prev.unitPrice,
        targetUnitPrice: null, deltaAmount: `-${prev.unitPrice}`, deltaPct: null };
    }
    const bVal = toScaled(prev!.unitPrice) ?? 0n;
    const delta = (toScaled(cur!.unitPrice) ?? 0n) - bVal;
    const changeType: PriceDiffEntryChange = delta > 0n ? 'INCREASED' : delta < 0n ? 'DECREASED' : 'UNCHANGED';
    if (changeType === 'INCREASED') summary.increased += 1;
    else if (changeType === 'DECREASED') summary.decreased += 1;
    else summary.unchanged += 1;
    return {
      ...common,
      changeType,
      maximumQuantity: cur!.maximumQuantity,
      baselineUnitPrice: prev!.unitPrice,
      targetUnitPrice: cur!.unitPrice,
      deltaAmount: fromScaled(delta, 3, true),
      // Truncated to two decimals like the backend's integer division.
      deltaPct: bVal > 0n ? Number((delta * 10000n) / bVal) / 100 : null,
    };
  });

  const basePromoMap = new Map(baseline.version.promotions.map((p) => [p.code, p]));
  const targetPromoMap = new Map(target.version.promotions.map((p) => [p.code, p]));
  const promoCodes = Array.from(new Set([...targetPromoMap.keys(), ...basePromoMap.keys()]));
  const promotions: PriceDiffPromotion[] = promoCodes.map((code) => {
    const prev = basePromoMap.get(code) ?? null;
    const cur = targetPromoMap.get(code) ?? null;
    if (cur && !prev) {
      return { changeType: 'ADDED', code, name: cur.name, baselineBenefit: null, targetBenefit: clone(cur.benefit) };
    }
    if (prev && !cur) {
      return { changeType: 'REMOVED', code, name: prev.name, baselineBenefit: clone(prev.benefit), targetBenefit: null };
    }
    const same =
      JSON.stringify(cur!.benefit) === JSON.stringify(prev!.benefit) &&
      JSON.stringify(cur!.selector) === JSON.stringify(prev!.selector) &&
      cur!.priority === prev!.priority &&
      cur!.stackGroup === prev!.stackGroup &&
      cur!.exclusive === prev!.exclusive;
    return {
      changeType: same ? 'UNCHANGED' : 'MODIFIED',
      code,
      name: cur!.name,
      baselineBenefit: clone(prev!.benefit),
      targetBenefit: clone(cur!.benefit),
    };
  });

  const versionRef = (found: { version: StoredVersion; book: StoredBook }) => ({
    id: found.version.id,
    priceBookId: found.book.id,
    priceBookCode: found.book.code,
    versionNumber: found.version.versionNumber,
    status: found.version.status,
  });
  return clone({
    currencyCode: target.book.currencyCode,
    targetVersion: versionRef(target),
    baselineVersion: versionRef(baseline),
    summary: { ...summary, promotionsChanged: promotions.filter((p) => p.changeType !== 'UNCHANGED').length },
    entries,
    promotions,
  });
}

export async function fakeGetReferenceData(): Promise<PricingReferenceData> {
  await fakeDelay(100);
  return clone({
    branches: REFERENCE_BRANCHES,
    currencies: REFERENCE_CURRENCIES,
  });
}

function toCompanyDefaultRow(d: StoredDefault): CompanyDefaultRow {
  return {
    id: d.id,
    companyId: FAKE_COMPANY_ID,
    purpose: d.purpose,
    currencyCode: d.currencyCode,
    priceBookId: d.priceBookId,
    version: d.version,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function fakeListCompanyDefaults(): Promise<CompanyDefaultList> {
  await fakeDelay(150);
  const items = [...DB.defaults]
    .sort((a, b) => a.purpose.localeCompare(b.purpose) || a.currencyCode.localeCompare(b.currencyCode))
    .flatMap((d): CompanyDefault[] => {
      const book = DB.books.find((b) => b.id === d.priceBookId);
      if (!book) return [];
      const { id, code, purpose, currencyCode, status, version, name, localizedNames, description } = toBookHeader(book);
      return [
        {
          id: d.id,
          companyId: FAKE_COMPANY_ID,
          purpose: d.purpose,
          currencyCode: d.currencyCode,
          priceBookId: d.priceBookId,
          version: d.version,
          updatedAt: d.updatedAt,
          priceBook: { id, code, purpose, currencyCode, status, version, name, localizedNames, description },
        },
      ];
    });
  return clone({ items });
}

export async function fakeUpsertCompanyDefault(
  purpose: PricePurpose,
  currencyCode: string,
  priceBookId: string,
  ifMatchOrOpts: number | WriteOptions = 0,
  idempotencyKey?: string,
): Promise<CompanyDefaultRow> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);
  const expected = opts.ifMatch ?? 0;

  return idem.run(
    `pricing:upsertDefault:${purpose}:${currencyCode}`,
    opts.idempotencyKey,
    { purpose, currencyCode, priceBookId, ifMatch: expected },
    () => {
      const book = DB.books.find((b) => b.id === priceBookId && b.deletedAt === null);
      if (!book || book.status !== 'ACTIVE' || book.purpose !== purpose || book.currencyCode !== currencyCode) {
        throw new ApiError(422, 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE');
      }

      const existing = DB.defaults.find((d) => d.purpose === purpose && d.currencyCode === currencyCode);
      if (!existing) {
        if (expected !== 0) {
          throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
        }
        const now = nowIso();
        const created: StoredDefault = {
          id: fakeId(),
          purpose,
          currencyCode,
          priceBookId: book.id,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        DB.defaults.push(created);
        appendAudit('PRICE_BOOK', book.id, 'SET_COMPANY_DEFAULT');
        return toCompanyDefaultRow(created);
      }

      if (expected === 0 || existing.version !== expected) {
        throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
      }
      if (existing.priceBookId !== book.id) {
        existing.priceBookId = book.id;
        existing.version += 1;
        existing.updatedAt = nowIso();
        appendAudit('PRICE_BOOK', book.id, 'SET_COMPANY_DEFAULT');
      }
      return toCompanyDefaultRow(existing);
    },
  );
}

export async function fakeDeleteCompanyDefault(
  purpose: PricePurpose,
  currencyCode: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<DeletedResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(
    `pricing:deleteDefault:${purpose}:${currencyCode}`,
    opts.idempotencyKey,
    { purpose, currencyCode, ifMatch: opts.ifMatch },
    () => {
      const idx = DB.defaults.findIndex((d) => d.purpose === purpose && d.currencyCode === currencyCode);
      if (idx < 0) {
        throw new ApiError(404, 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND');
      }
      const existing = DB.defaults[idx];
      checkIfMatch(opts.ifMatch, existing.version);
      DB.defaults.splice(idx, 1);
      appendAudit('PRICE_BOOK', existing.priceBookId, 'REMOVE_COMPANY_DEFAULT');
      return { id: existing.id, deleted: true as const };
    },
  );
}

/**
 * POST /pricing/evaluate. Mirrors trade-app `PricingService.evaluate` /
 * `evaluateWithManager`: same checks, error codes, precedence, promotion
 * stacking (discount rounded to the currency quantum, no extra rounding of the
 * final price) and the exact `PricingDecision` shape.
 */
export async function fakeEvaluatePricing(input: PricingEvaluateInput): Promise<PricingDecision> {
  await fakeDelay(180);
  activateDueScheduledVersions();

  // PricingEvaluateDto validation (class-validator: 400 TRADE.VALIDATION_FAILED).
  if (input.purpose !== 'SALES' && input.purpose !== 'PURCHASE') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { purpose: ['invalid'] });
  }
  if (!POSITIVE_DECIMAL_RE.test(input.quantity)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { quantity: ['invalid'] });
  }
  if (!CURRENCY_RE.test(input.currencyCode)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { currencyCode: ['invalid'] });
  }
  if (input.pricingAt !== undefined && Number.isNaN(Date.parse(input.pricingAt))) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { pricingAt: ['invalid'] });
  }
  const qtyScaled = toScaled(input.quantity) ?? 0n;
  const currency = input.currencyCode;

  // Item company profile: ACTIVE and allowed for the purpose; item ACTIVE.
  const profile = TRADE_FAKE_DB.companyProfiles.find(
    (p) => p.itemId === input.itemId && p.companyId === FAKE_COMPANY_ID,
  );
  if (
    !profile ||
    profile.status !== 'ACTIVE' ||
    (input.purpose === 'SALES' && !profile.canSell) ||
    (input.purpose === 'PURCHASE' && !profile.canPurchase)
  ) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  const item = TRADE_FAKE_DB.items.find((i) => i.id === input.itemId && i.deletedAt === null);
  if (!item || item.status !== 'ACTIVE') {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }

  // Explicit version preview (findVersion: 404 BOOK_NOT_FOUND).
  let previewVersion: StoredVersion | undefined;
  if (input.priceBookVersionId) {
    const found = requireVersion(input.priceBookVersionId);
    previewVersion = found.version;
    const notInBook = Boolean(input.priceBookId) && input.priceBookId !== found.book.id;
    if (notInBook || !PREVIEWABLE_STATUSES.has(previewVersion.status)) {
      throw new ApiError(422, 'TRADE.PRICE.BOOK_INVALID', {
        reason: [notInBook ? 'version_not_in_book' : 'preview_status_invalid'],
      });
    }
  }

  // resolvePriceBooks: explicit, then the account's book, then the company default.
  const requestedBookId = previewVersion ? previewVersion.bookId : input.priceBookId;
  const account = input.partyId
    ? TRADE_FAKE_DB.accounts.find(
        (a) =>
          a.partyId === input.partyId &&
          a.companyId === FAKE_COMPANY_ID &&
          a.accountRole === (input.purpose === 'SALES' ? 'CUSTOMER' : 'SUPPLIER') &&
          a.status === 'ACTIVE',
      ) ?? null
    : null;
  if (input.partyId && !account) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  const accountBookId = account?.priceBookId ?? null;
  const defaultBookId =
    DB.defaults.find((d) => d.purpose === input.purpose && d.currencyCode === currency)?.priceBookId ?? null;
  const resolvedBookId = accountBookId ?? defaultBookId;
  const selectedBookId = requestedBookId ?? resolvedBookId;
  if (!selectedBookId) {
    throw new ApiError(404, 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND');
  }
  const book = DB.books.find((b) => b.id === selectedBookId && b.deletedAt === null);
  if (!book || book.purpose !== input.purpose || book.currencyCode !== currency || book.status !== 'ACTIVE') {
    throw new ApiError(
      422,
      !requestedBookId && !accountBookId
        ? 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE'
        : 'TRADE.PRICE.BOOK_INVALID',
    );
  }
  const resolvedSource: PriceBookSource =
    requestedBookId && selectedBookId !== resolvedBookId
      ? 'EXPLICIT'
      : accountBookId
        ? 'ACCOUNT'
        : 'COMPANY_DEFAULT';

  // Branch and channel must be active in the company.
  if (input.branchId && !REFERENCE_BRANCHES.some((b) => b.id === input.branchId)) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }
  if (
    input.channelId &&
    !TRADE_FAKE_DB.channels.some((c) => c.id === input.channelId && c.status === 'ACTIVE')
  ) {
    throw new ApiError(422, 'TRADE.PRICE.ENTRY_INVALID');
  }

  const asOf = new Date(input.pricingAt ?? nowIso());
  const atMs = asOf.getTime();
  const candidateVersions = previewVersion
    ? [previewVersion]
    : versionsForBook(book.id).filter((v) => isVersionLive(v, atMs));

  interface Candidate {
    entry: PriceEntry;
    version: StoredVersion;
    minScaled: bigint;
  }
  const eligible: Candidate[] = [];
  for (const v of candidateVersions) {
    for (const e of v.entries) {
      if (e.itemId !== input.itemId || e.uomId !== input.uomId || e.currencyCode !== currency) continue;
      const minScaled = toScaled(e.minimumQuantity) ?? 0n;
      const maxScaled = e.maximumQuantity ? toScaled(e.maximumQuantity) : null;
      if (qtyScaled < minScaled) continue;
      if (maxScaled !== null && qtyScaled >= maxScaled) continue;
      eligible.push({ entry: e, version: v, minScaled });
    }
  }
  if (eligible.length === 0) {
    throw new ApiError(404, 'TRADE.PRICE.NO_ELIGIBLE_PRICE');
  }
  // ORDER BY priority ASC, minimum_quantity DESC, id ASC
  eligible.sort((a, b) => {
    if (a.entry.priority !== b.entry.priority) return a.entry.priority - b.entry.priority;
    if (a.minScaled !== b.minScaled) return a.minScaled > b.minScaled ? -1 : 1;
    return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
  });
  const winner = eligible[0];
  if (
    eligible.some(
      (c, index) => index > 0 && c.entry.priority === winner.entry.priority && c.minScaled === winner.minScaled,
    )
  ) {
    throw new ApiError(409, 'TRADE.PRICE.AMBIGUOUS_RULES');
  }

  // Promotions of the winning version: live ones only, unless previewing.
  const promotions = winner.version.promotions
    .map((p) => toPromotionView(p, winner.version))
    .filter((p) => {
      if (previewVersion) return true;
      if (p.status !== 'PUBLISHED' && p.status !== 'SCHEDULED') return false;
      if (Date.parse(p.effectiveFrom) > atMs) return false;
      return p.effectiveTo === null || Date.parse(p.effectiveTo) > atMs;
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

  const facts = {
    itemId: input.itemId,
    uomId: input.uomId,
    partyId: input.partyId,
    branchId: input.branchId,
    channelId: input.channelId,
    hasActiveAccount: Boolean(account),
  };
  const promotionMatch = (p: PromotionRule): true | 'ACCOUNT_REQUIRED' | 'SELECTOR_MISMATCH' => {
    const sel = p.selector;
    if (sel.partyId !== undefined && !facts.hasActiveAccount) return 'ACCOUNT_REQUIRED';
    for (const key of ['itemId', 'uomId', 'partyId', 'branchId', 'channelId'] as const) {
      if (sel[key] !== undefined && sel[key] !== facts[key]) return 'SELECTOR_MISMATCH';
    }
    const min = toScaled(sel.minimumQuantity ?? '0') ?? 0n;
    const max = sel.maximumQuantity ? toScaled(sel.maximumQuantity) : null;
    return qtyScaled >= min && (max === null || qtyScaled < max) ? true : 'SELECTOR_MISMATCH';
  };

  // Two matching promotions with the same stack group and priority are ambiguous.
  const matchingPriorities = new Map<string, Set<number>>();
  for (const p of promotions) {
    if (promotionMatch(p) !== true) continue;
    const seen = matchingPriorities.get(p.stackGroup) ?? new Set<number>();
    if (seen.has(p.priority)) {
      throw new ApiError(409, 'TRADE.PRICE.AMBIGUOUS_RULES');
    }
    seen.add(p.priority);
    matchingPriorities.set(p.stackGroup, seen);
  }

  const quantum = 10n ** BigInt(SCALE - currencyDecimalsOf(currency));
  const floorScaled = winner.entry.minimumAllowedPrice ? toScaled(winner.entry.minimumAllowedPrice) : null;
  let unitPriceText = winner.entry.unitPrice;
  let runningScaled = toScaled(winner.entry.unitPrice) ?? 0n;
  let exclusiveApplied = false;
  const usedStackGroups = new Set<string>();
  const matchedPromotions: MatchedPromotion[] = [];
  const rejectedPromotions: RejectedPromotion[] = [];
  const reject = (p: PromotionRule, reason: PromotionRejectReason): void => {
    rejectedPromotions.push({ promotionVersionId: p.id, code: p.code, reason });
  };

  for (const p of promotions) {
    if (exclusiveApplied) {
      reject(p, 'EXCLUSIVE_PROMOTION_APPLIED');
      continue;
    }
    const match = promotionMatch(p);
    if (match !== true) {
      reject(p, match);
      continue;
    }
    if (usedStackGroups.has(p.stackGroup)) {
      reject(p, 'STACK_GROUP_LOWER_PRECEDENCE');
      continue;
    }
    const benefitScaled = toScaled(p.benefit.value) ?? 0n;
    let discountScaled: bigint;
    if (p.benefit.type === 'PERCENTAGE') {
      // Round straight to the currency quantum, half up.
      const denominator = 100n * SCALE_FACTOR * quantum;
      discountScaled = ((runningScaled * benefitScaled + denominator / 2n) / denominator) * quantum;
    } else {
      discountScaled = ((benefitScaled + quantum / 2n) / quantum) * quantum;
    }
    if (discountScaled > runningScaled) discountScaled = runningScaled;
    const discounted = runningScaled - discountScaled;
    if (discounted < 0n || (floorScaled !== null && discounted < floorScaled)) {
      reject(p, 'MINIMUM_PRICE_GUARD');
      continue;
    }
    runningScaled = discounted;
    unitPriceText = fixedDecimalText(discounted);
    usedStackGroups.add(p.stackGroup);
    matchedPromotions.push({
      promotionDefinitionId: p.promotionDefinitionId,
      promotionVersionId: p.id,
      code: p.code,
      discountAmount: fixedDecimalText(discountScaled),
    });
    exclusiveApplied = p.exclusive;
  }

  const decision: PricingDecision = {
    decisionId: fakeId(),
    priceBookSource: previewVersion ? 'EXPLICIT' : resolvedSource,
    engineVersion: PRICING_ENGINE_VERSION,
    ...(previewVersion ? { previewOfStatus: previewVersion.status as PreviewableVersionStatus } : {}),
    decisionType: input.purpose === 'SALES' ? 'SALES_PRICE' : 'PURCHASE_PRICE',
    outcome: 'ALLOW',
    unitPrice: unitPriceText,
    currencyCode: currency,
    priceBookId: book.id,
    priceBookVersionId: winner.version.id,
    priceBookVersion: winner.version.versionNumber,
    checksum: winner.version.checksum,
    matchedEntryId: winner.entry.id,
    baselineUnitPrice: winner.entry.unitPrice,
    minimumAllowedPrice: winner.entry.minimumAllowedPrice,
    matchedPromotions,
    rejectedPromotions,
    components: [
      { kind: 'BASE_PRICE', referenceId: winner.entry.id, amount: winner.entry.unitPrice },
      ...matchedPromotions.map((m) => ({
        kind: 'PROMOTION_DISCOUNT' as const,
        referenceId: m.promotionVersionId,
        amount: m.discountAmount,
      })),
    ],
    rejectedCandidates: eligible.slice(1).map((c) => ({
      entryId: c.entry.id,
      reason: 'LOWER_PRECEDENCE' as const,
    })),
    inputFingerprint: computeHash({ ...input, companyId: FAKE_COMPANY_ID, asOf: asOf.toISOString() }),
    evaluatedAt: asOf.toISOString(),
    taxFinal: false,
  };
  return clone(decision);
}

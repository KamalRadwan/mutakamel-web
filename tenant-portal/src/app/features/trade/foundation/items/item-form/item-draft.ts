import { ApiError, errorCodeOf } from '../../../shared/trade-api';
import type {
  ComboComponent,
  ItemDetail,
  ItemKind,
  ItemStatus,
  LocalizedNames,
  OptionalProduct,
} from '../../../shared/trade-foundation.model';
import {
  ITEM_CODE_PATTERN,
  ITEM_IMAGE_RULES,
  ITEM_LIMITS,
  POSITIVE_DECIMAL,
  type ItemCreateBody,
  type ItemPatchBody,
} from '../items.model';

export interface ComboComponentDraft {
  key: string;
  componentItemId: string | null;
  quantity: string;
  sortOrder: string;
}

export interface OptionalProductDraft {
  key: string;
  optionalProductItemId: string | null;
  sortOrder: string;
}

export interface ItemDraft {
  canonicalCode: string;
  itemKind: ItemKind;
  status: ItemStatus;
  nameEn: string;
  nameAr: string;
  baseUomId: string | null;
  categoryId: string | null;
  barcode: string;
  ownerUserId: string | null;
  weightKg: string;
  volumeM3: string;
  quotationDescription: string;
  salesOrderDescription: string;
  receiptDescription: string;
  deliveryOrderDescription: string;
  notes: string;
  comboComponents: ComboComponentDraft[];
  optionalProducts: OptionalProductDraft[];
}

export interface FieldError {
  key: string;
  params?: Record<string, string | number>;
}

export type DraftErrors = Record<string, FieldError>;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function nextSortOrder(rows: readonly { sortOrder: string }[]): string {
  let max = -1;
  for (const row of rows) {
    const parsed = parseSortOrder(row.sortOrder);
    if (parsed !== null && parsed > max) {
      max = parsed;
    }
  }
  return String(Math.min(ITEM_LIMITS.sortOrder, max + 1));
}

export function emptyDraft(preset?: Partial<ItemDraft>): ItemDraft {
  const base: ItemDraft = {
    canonicalCode: '',
    itemKind: 'PRODUCT',
    status: 'DRAFT',
    nameEn: '',
    nameAr: '',
    baseUomId: null,
    categoryId: null,
    barcode: '',
    ownerUserId: null,
    weightKg: '',
    volumeM3: '',
    quotationDescription: '',
    salesOrderDescription: '',
    receiptDescription: '',
    deliveryOrderDescription: '',
    notes: '',
    comboComponents: [],
    optionalProducts: [],
  };

  if (!preset) return base;

  return {
    ...base,
    ...preset,
    comboComponents: preset.comboComponents
      ? preset.comboComponents.map((row) => ({ ...row }))
      : base.comboComponents,
    optionalProducts: preset.optionalProducts
      ? preset.optionalProducts.map((row) => ({ ...row }))
      : base.optionalProducts,
  };
}

export function draftFromDetail(detail: ItemDetail): ItemDraft {
  const combo = [...detail.comboComponents]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, idx) => ({
      key: `cc-${idx}-${row.componentItemId}`,
      componentItemId: row.componentItemId,
      quantity: row.quantity,
      sortOrder: String(row.sortOrder),
    }));

  const optional = [...detail.optionalProducts]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, idx) => ({
      key: `op-${idx}-${row.optionalProductItemId}`,
      optionalProductItemId: row.optionalProductItemId,
      sortOrder: String(row.sortOrder),
    }));

  return {
    canonicalCode: detail.canonicalCode,
    itemKind: detail.itemKind,
    status: detail.status,
    nameEn: detail.localizedNames['en'] ?? '',
    nameAr: detail.localizedNames['ar'] ?? '',
    baseUomId: detail.baseUomId,
    categoryId: detail.categoryId,
    barcode: detail.barcode ?? '',
    ownerUserId: detail.ownerUserId,
    weightKg: detail.weightKg ?? '',
    volumeM3: detail.volumeM3 ?? '',
    quotationDescription: detail.quotationDescription ?? '',
    salesOrderDescription: detail.salesOrderDescription ?? '',
    receiptDescription: detail.receiptDescription ?? '',
    deliveryOrderDescription: detail.deliveryOrderDescription ?? '',
    notes: detail.notes ?? '',
    comboComponents: combo,
    optionalProducts: optional,
  };
}

export function draftsEqual(a: ItemDraft, b: ItemDraft): boolean {
  if (
    a.canonicalCode !== b.canonicalCode ||
    a.itemKind !== b.itemKind ||
    a.status !== b.status ||
    a.nameEn !== b.nameEn ||
    a.nameAr !== b.nameAr ||
    a.baseUomId !== b.baseUomId ||
    a.categoryId !== b.categoryId ||
    a.barcode !== b.barcode ||
    a.ownerUserId !== b.ownerUserId ||
    a.weightKg !== b.weightKg ||
    a.volumeM3 !== b.volumeM3 ||
    a.quotationDescription !== b.quotationDescription ||
    a.salesOrderDescription !== b.salesOrderDescription ||
    a.receiptDescription !== b.receiptDescription ||
    a.deliveryOrderDescription !== b.deliveryOrderDescription ||
    a.notes !== b.notes
  ) {
    return false;
  }

  if (a.comboComponents.length !== b.comboComponents.length) return false;
  for (let i = 0; i < a.comboComponents.length; i += 1) {
    const ca = a.comboComponents[i];
    const cb = b.comboComponents[i];
    if (
      ca.componentItemId !== cb.componentItemId ||
      ca.quantity !== cb.quantity ||
      ca.sortOrder !== cb.sortOrder
    ) {
      return false;
    }
  }

  if (a.optionalProducts.length !== b.optionalProducts.length) return false;
  for (let i = 0; i < a.optionalProducts.length; i += 1) {
    const oa = a.optionalProducts[i];
    const ob = b.optionalProducts[i];
    if (oa.optionalProductItemId !== ob.optionalProductItemId || oa.sortOrder !== ob.sortOrder) {
      return false;
    }
  }

  return true;
}

export function rebaseItemDraft(oldBase: ItemDraft, freshBase: ItemDraft, currentDraft: ItemDraft): ItemDraft {
  const sameCombo = (a: readonly ComboComponentDraft[], b: readonly ComboComponentDraft[]) =>
    a.length === b.length &&
    a.every(
      (row, idx) =>
        row.componentItemId === b[idx].componentItemId &&
        row.quantity === b[idx].quantity &&
        row.sortOrder === b[idx].sortOrder,
    );

  const sameOptional = (a: readonly OptionalProductDraft[], b: readonly OptionalProductDraft[]) =>
    a.length === b.length &&
    a.every(
      (row, idx) =>
        row.optionalProductItemId === b[idx].optionalProductItemId && row.sortOrder === b[idx].sortOrder,
    );

  return {
    canonicalCode: freshBase.canonicalCode,
    itemKind: freshBase.itemKind,
    status: freshBase.status,
    baseUomId: freshBase.baseUomId,
    nameEn: currentDraft.nameEn !== oldBase.nameEn ? currentDraft.nameEn : freshBase.nameEn,
    nameAr: currentDraft.nameAr !== oldBase.nameAr ? currentDraft.nameAr : freshBase.nameAr,
    categoryId: currentDraft.categoryId !== oldBase.categoryId ? currentDraft.categoryId : freshBase.categoryId,
    barcode: currentDraft.barcode !== oldBase.barcode ? currentDraft.barcode : freshBase.barcode,
    ownerUserId: currentDraft.ownerUserId !== oldBase.ownerUserId ? currentDraft.ownerUserId : freshBase.ownerUserId,
    weightKg: currentDraft.weightKg !== oldBase.weightKg ? currentDraft.weightKg : freshBase.weightKg,
    volumeM3: currentDraft.volumeM3 !== oldBase.volumeM3 ? currentDraft.volumeM3 : freshBase.volumeM3,
    quotationDescription:
      currentDraft.quotationDescription !== oldBase.quotationDescription
        ? currentDraft.quotationDescription
        : freshBase.quotationDescription,
    salesOrderDescription:
      currentDraft.salesOrderDescription !== oldBase.salesOrderDescription
        ? currentDraft.salesOrderDescription
        : freshBase.salesOrderDescription,
    receiptDescription:
      currentDraft.receiptDescription !== oldBase.receiptDescription
        ? currentDraft.receiptDescription
        : freshBase.receiptDescription,
    deliveryOrderDescription:
      currentDraft.deliveryOrderDescription !== oldBase.deliveryOrderDescription
        ? currentDraft.deliveryOrderDescription
        : freshBase.deliveryOrderDescription,
    notes: currentDraft.notes !== oldBase.notes ? currentDraft.notes : freshBase.notes,
    comboComponents: sameCombo(currentDraft.comboComponents, oldBase.comboComponents)
      ? freshBase.comboComponents.map((row) => ({ ...row }))
      : currentDraft.comboComponents.map((row) => ({ ...row })),
    optionalProducts: sameOptional(currentDraft.optionalProducts, oldBase.optionalProducts)
      ? freshBase.optionalProducts.map((row) => ({ ...row }))
      : currentDraft.optionalProducts.map((row) => ({ ...row })),
  };
}

function buildLocalizedNames(draft: ItemDraft): LocalizedNames {
  const names: LocalizedNames = {};
  const en = draft.nameEn.trim();
  const ar = draft.nameAr.trim();
  if (en) names['en'] = en;
  if (ar) names['ar'] = ar;
  return names;
}

function trimOrNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function parseSortOrder(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 0 || num > ITEM_LIMITS.sortOrder) return null;
  return num;
}

function toComboBody(rows: readonly ComboComponentDraft[]): ComboComponent[] {
  return rows.map((row, idx) => ({
    componentItemId: row.componentItemId ?? '',
    quantity: row.quantity.trim(),
    sortOrder: parseSortOrder(row.sortOrder) ?? idx,
  }));
}

function toOptionalBody(rows: readonly OptionalProductDraft[]): OptionalProduct[] {
  return rows.map((row, idx) => ({
    optionalProductItemId: row.optionalProductItemId ?? '',
    sortOrder: parseSortOrder(row.sortOrder) ?? idx,
  }));
}

export function toCreateBody(draft: ItemDraft): ItemCreateBody {
  const body: ItemCreateBody = {
    canonicalCode: normalizeCode(draft.canonicalCode),
    itemKind: draft.itemKind,
    localizedNames: buildLocalizedNames(draft),
    baseUomId: draft.baseUomId ?? '',
  };

  if (draft.categoryId) body.categoryId = draft.categoryId;
  const barcode = trimOrNull(draft.barcode);
  if (barcode) body.barcode = barcode;
  if (draft.ownerUserId) body.ownerUserId = draft.ownerUserId;
  const weightKg = trimOrNull(draft.weightKg);
  if (weightKg) body.weightKg = weightKg;
  const volumeM3 = trimOrNull(draft.volumeM3);
  if (volumeM3) body.volumeM3 = volumeM3;
  const quotation = trimOrNull(draft.quotationDescription);
  if (quotation) body.quotationDescription = quotation;
  const salesOrder = trimOrNull(draft.salesOrderDescription);
  if (salesOrder) body.salesOrderDescription = salesOrder;
  const receipt = trimOrNull(draft.receiptDescription);
  if (receipt) body.receiptDescription = receipt;
  const delivery = trimOrNull(draft.deliveryOrderDescription);
  if (delivery) body.deliveryOrderDescription = delivery;
  const notes = trimOrNull(draft.notes);
  if (notes) body.notes = notes;

  if (draft.itemKind === 'COMBO') {
    body.comboComponents = toComboBody(draft.comboComponents);
  }
  if (draft.optionalProducts.length > 0) {
    body.optionalProducts = toOptionalBody(draft.optionalProducts);
  }

  return body;
}

export function toPatchBody(base: ItemDraft, draft: ItemDraft): ItemPatchBody {
  const body: ItemPatchBody = {};

  if (base.nameEn.trim() !== draft.nameEn.trim() || base.nameAr.trim() !== draft.nameAr.trim()) {
    body.localizedNames = buildLocalizedNames(draft);
  }
  if (base.categoryId !== draft.categoryId) {
    body.categoryId = draft.categoryId;
  }
  if (trimOrNull(base.barcode) !== trimOrNull(draft.barcode)) {
    body.barcode = trimOrNull(draft.barcode);
  }
  if (base.ownerUserId !== draft.ownerUserId) {
    body.ownerUserId = draft.ownerUserId;
  }
  if (trimOrNull(base.weightKg) !== trimOrNull(draft.weightKg)) {
    body.weightKg = trimOrNull(draft.weightKg);
  }
  if (trimOrNull(base.volumeM3) !== trimOrNull(draft.volumeM3)) {
    body.volumeM3 = trimOrNull(draft.volumeM3);
  }
  if (trimOrNull(base.quotationDescription) !== trimOrNull(draft.quotationDescription)) {
    body.quotationDescription = trimOrNull(draft.quotationDescription);
  }
  if (trimOrNull(base.salesOrderDescription) !== trimOrNull(draft.salesOrderDescription)) {
    body.salesOrderDescription = trimOrNull(draft.salesOrderDescription);
  }
  if (trimOrNull(base.receiptDescription) !== trimOrNull(draft.receiptDescription)) {
    body.receiptDescription = trimOrNull(draft.receiptDescription);
  }
  if (trimOrNull(base.deliveryOrderDescription) !== trimOrNull(draft.deliveryOrderDescription)) {
    body.deliveryOrderDescription = trimOrNull(draft.deliveryOrderDescription);
  }
  if (trimOrNull(base.notes) !== trimOrNull(draft.notes)) {
    body.notes = trimOrNull(draft.notes);
  }

  if (draft.itemKind === 'COMBO') {
    const baseCombo = JSON.stringify(toComboBody(base.comboComponents));
    const nextCombo = JSON.stringify(toComboBody(draft.comboComponents));
    if (baseCombo !== nextCombo) {
      body.comboComponents = toComboBody(draft.comboComponents);
    }
  }

  const baseOpt = JSON.stringify(toOptionalBody(base.optionalProducts));
  const nextOpt = JSON.stringify(toOptionalBody(draft.optionalProducts));
  if (baseOpt !== nextOpt) {
    body.optionalProducts = toOptionalBody(draft.optionalProducts);
  }

  return body;
}

function validatePositiveDecimal(raw: string): FieldError | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (POSITIVE_DECIMAL.test(trimmed)) return null;
  if (/^-\d+(?:\.\d{1,8})?$/.test(trimmed) || /^0+(?:\.0{1,8})?$/.test(trimmed)) {
    return { key: 'itemForm.validation.positive' };
  }
  return { key: 'itemForm.validation.decimal' };
}

function validateMax(raw: string, max: number, path: string, errors: DraftErrors): void {
  if (!errors[path] && raw.trim().length > max) {
    errors[path] = { key: 'itemForm.validation.maxLength', params: { max } };
  }
}

export function validateDraft(draft: ItemDraft, mode: 'create' | 'edit', selfId?: string | null): DraftErrors {
  const errors: DraftErrors = {};

  if (mode === 'create') {
    const code = normalizeCode(draft.canonicalCode);
    if (!code) {
      errors['canonicalCode'] = { key: 'itemForm.validation.required' };
    } else if (code.length > ITEM_LIMITS.code) {
      errors['canonicalCode'] = { key: 'itemForm.validation.maxLength', params: { max: ITEM_LIMITS.code } };
    } else if (!ITEM_CODE_PATTERN.test(code)) {
      errors['canonicalCode'] = { key: 'itemForm.validation.codePattern' };
    }

    if (!draft.baseUomId?.trim()) {
      errors['baseUomId'] = { key: 'itemForm.validation.required' };
    }
  }

  const nameEn = draft.nameEn.trim();
  const nameAr = draft.nameAr.trim();
  if (!nameEn && !nameAr) {
    errors['nameEn'] = { key: 'itemForm.validation.nameOne' };
    errors['nameAr'] = { key: 'itemForm.validation.nameOne' };
  } else {
    validateMax(draft.nameEn, ITEM_LIMITS.name, 'nameEn', errors);
    validateMax(draft.nameAr, ITEM_LIMITS.name, 'nameAr', errors);
  }

  validateMax(draft.barcode, ITEM_LIMITS.barcode, 'barcode', errors);

  const weightErr = validatePositiveDecimal(draft.weightKg);
  if (weightErr) errors['weightKg'] = weightErr;

  const volumeErr = validatePositiveDecimal(draft.volumeM3);
  if (volumeErr) errors['volumeM3'] = volumeErr;

  validateMax(draft.quotationDescription, ITEM_LIMITS.description, 'quotationDescription', errors);
  validateMax(draft.salesOrderDescription, ITEM_LIMITS.description, 'salesOrderDescription', errors);
  validateMax(draft.receiptDescription, ITEM_LIMITS.description, 'receiptDescription', errors);
  validateMax(draft.deliveryOrderDescription, ITEM_LIMITS.description, 'deliveryOrderDescription', errors);
  validateMax(draft.notes, ITEM_LIMITS.notes, 'notes', errors);

  if (draft.itemKind === 'COMBO') {
    if (draft.comboComponents.length < 1) {
      errors['comboComponents'] = { key: 'itemForm.validation.comboMin' };
    } else if (draft.comboComponents.length > ITEM_LIMITS.components) {
      errors['comboComponents'] = { key: 'tradeShared.errors.TRADE_VALIDATION_FAILED' };
    }

    const seenTargets = new Set<string>();
    const seenOrders = new Set<number>();
    for (let i = 0; i < draft.comboComponents.length; i += 1) {
      const row = draft.comboComponents[i];
      const itemId = row.componentItemId?.trim() ?? '';
      if (!itemId) {
        errors[`comboComponents.${i}.componentItemId`] = { key: 'itemForm.validation.required' };
      } else if ((selfId && itemId === selfId) || seenTargets.has(itemId)) {
        errors[`comboComponents.${i}.componentItemId`] = { key: 'itemForm.validation.duplicate' };
      } else {
        seenTargets.add(itemId);
      }

      const qtyTrimmed = row.quantity.trim();
      if (!qtyTrimmed) {
        errors[`comboComponents.${i}.quantity`] = { key: 'itemForm.validation.required' };
      } else {
        const qtyErr = validatePositiveDecimal(qtyTrimmed);
        if (qtyErr) errors[`comboComponents.${i}.quantity`] = qtyErr;
      }

      const orderTrimmed = row.sortOrder.trim();
      if (!orderTrimmed) {
        errors[`comboComponents.${i}.sortOrder`] = { key: 'itemForm.validation.required' };
      } else {
        const parsedOrder = parseSortOrder(orderTrimmed);
        if (parsedOrder === null) {
          errors[`comboComponents.${i}.sortOrder`] = { key: 'itemForm.validation.orderInvalid' };
        } else if (seenOrders.has(parsedOrder)) {
          errors[`comboComponents.${i}.sortOrder`] = { key: 'itemForm.validation.duplicate' };
        } else {
          seenOrders.add(parsedOrder);
        }
      }
    }
  }

  if (draft.optionalProducts.length > ITEM_LIMITS.components) {
    errors['optionalProducts'] = { key: 'tradeShared.errors.TRADE_VALIDATION_FAILED' };
  }
  const seenOptTargets = new Set<string>();
  const seenOptOrders = new Set<number>();
  for (let i = 0; i < draft.optionalProducts.length; i += 1) {
    const row = draft.optionalProducts[i];
    const itemId = row.optionalProductItemId?.trim() ?? '';
    if (!itemId) {
      errors[`optionalProducts.${i}.optionalProductItemId`] = { key: 'itemForm.validation.required' };
    } else if ((selfId && itemId === selfId) || seenOptTargets.has(itemId)) {
      errors[`optionalProducts.${i}.optionalProductItemId`] = { key: 'itemForm.validation.duplicate' };
    } else {
      seenOptTargets.add(itemId);
    }

    const orderTrimmed = row.sortOrder.trim();
    if (!orderTrimmed) {
      errors[`optionalProducts.${i}.sortOrder`] = { key: 'itemForm.validation.required' };
    } else {
      const parsedOrder = parseSortOrder(orderTrimmed);
      if (parsedOrder === null) {
        errors[`optionalProducts.${i}.sortOrder`] = { key: 'itemForm.validation.orderInvalid' };
      } else if (seenOptOrders.has(parsedOrder)) {
        errors[`optionalProducts.${i}.sortOrder`] = { key: 'itemForm.validation.duplicate' };
      } else {
        seenOptOrders.add(parsedOrder);
      }
    }
  }

  return errors;
}

export function mapItemServerError(error: unknown): DraftErrors | null {
  const code = errorCodeOf(error);
  if (!code) return null;
  const details = error instanceof ApiError ? error.details : undefined;
  // Only `details.field` reaches the client: the backend sends no combo reasons, and its image reasons are
  // upper case, which AllExceptionsFilter rewrites to generic text.
  const fields = details?.['field'] ?? [];

  switch (code) {
    case 'TRADE.CATALOG.CODE_TAKEN':
      return { canonicalCode: { key: 'tradeShared.errors.TRADE_CATALOG_CODE_TAKEN' } };
    case 'TRADE.CATALOG.ITEM_IDENTITY_CONFLICT': {
      if (fields.includes('barcode')) {
        return { barcode: { key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IDENTITY_CONFLICT' } };
      }
      if (fields.includes('canonicalCode')) {
        return { canonicalCode: { key: 'tradeShared.errors.TRADE_CATALOG_CODE_TAKEN' } };
      }
      return null;
    }
    case 'TRADE.CATALOG.UOM_INVALID':
      return { baseUomId: { key: 'tradeShared.errors.TRADE_CATALOG_UOM_INVALID' } };
    case 'TRADE.CATALOG.CATEGORY_ASSIGNMENT_INVALID':
      return { categoryId: { key: 'tradeShared.errors.TRADE_CATALOG_CATEGORY_ASSIGNMENT_INVALID' } };
    case 'TRADE.CATALOG.ITEM_IDENTITY_INVALID': {
      if (fields.includes('canonicalCode')) {
        return { canonicalCode: { key: 'itemForm.validation.codePattern' } };
      }
      if (fields.includes('status')) {
        return { status: { key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IDENTITY_INVALID' } };
      }
      return null;
    }
    case 'TRADE.CATALOG.ITEM_IMAGE_TOO_LARGE':
      return { image: { key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IMAGE_TOO_LARGE' } };
    case 'TRADE.CATALOG.ITEM_IMAGE_INVALID':
      return { image: { key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IMAGE_INVALID' } };
    case 'TRADE.CATALOG.ITEM_IMAGE_PRINT_BUDGET_EXCEEDED':
      return { image: { key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IMAGE_PRINT_BUDGET_EXCEEDED' } };
    default:
      return null;
  }
}

function extensionMatchesMime(fileName: string, mimeType: string): boolean {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return false;
  const ext = fileName.slice(idx).toLowerCase();
  if (mimeType === 'image/png') return ext === '.png';
  if (mimeType === 'image/jpeg') return ext === '.jpg' || ext === '.jpeg';
  if (mimeType === 'image/webp') return ext === '.webp';
  return false;
}

export async function validateImageFile(file: File): Promise<FieldError | null> {
  if (!(ITEM_IMAGE_RULES.types as readonly string[]).includes(file.type) || !extensionMatchesMime(file.name, file.type)) {
    return { key: 'itemForm.validation.imageType' };
  }
  if (file.size > ITEM_IMAGE_RULES.maxBytes) {
    return { key: 'itemForm.validation.imageSize' };
  }
  if (typeof createImageBitmap !== 'function') {
    return null;
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width < ITEM_IMAGE_RULES.minEdge || bitmap.height < ITEM_IMAGE_RULES.minEdge) {
      return { key: 'itemForm.validation.imageSmall' };
    }
    return null;
  } catch {
    return { key: 'itemForm.validation.imageType' };
  } finally {
    bitmap?.close();
  }
}

/** Local row key for form rows; never sent to the server. */
function newRowKey(): string {
  return crypto.randomUUID();
}

export function newComboComponentRow(rows: readonly ComboComponentDraft[]): ComboComponentDraft {
  return {
    key: newRowKey(),
    componentItemId: null,
    quantity: '1',
    sortOrder: nextSortOrder(rows),
  };
}

export function newOptionalProductRow(rows: readonly OptionalProductDraft[]): OptionalProductDraft {
  return {
    key: newRowKey(),
    optionalProductItemId: null,
    sortOrder: nextSortOrder(rows),
  };
}

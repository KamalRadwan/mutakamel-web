import { Component, computed, inject, input, model } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowRight,
  tablerCheck,
  tablerCircleX,
  tablerPlus,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Switch } from '../../../../shared/ui/switch/switch';
import { ApiError } from '../../shared/trade-api';
import { formatDate } from '../../shared/trade-format';
import type { Page } from '../../shared/trade-foundation.model';
import type { MappingField } from '../imports.model';
import {
  FILE_LIMITS,
  OFFERED_TRANSFORMS,
  SOURCE_COLUMN_PATTERN,
  getImportTarget,
  type ImportLookupCode,
  type ImportTransformCode,
} from '../imports.registry';

export interface TargetFieldMeta {
  code: string;
  required: boolean;
  allowedTransforms: readonly string[];
  lookupCode: string | null;
}

/** Default file header for each backend target field code (IMPORT_TARGET_FIELDS). */
const SOURCE_COLUMN_NAME_FALLBACK: Readonly<Record<string, string>> = {
  ITEM_CODE: 'ItemCode',
  CAN_SELL: 'CanSell',
  CAN_PURCHASE: 'CanPurchase',
  TRACK_INVENTORY: 'TrackInventory',
  TRACKING_MODE: 'TrackingMode',
  DEFAULT_SALES_UOM_CODE: 'DefaultSalesUnit',
  DEFAULT_PURCHASE_UOM_CODE: 'DefaultPurchaseUnit',
  TAX_CLASSIFICATION_KEY: 'TaxClassification',
  BRANCH_CODE: 'BranchCode',
  IS_ASSORTED: 'IsAssorted',
  DEFAULT_FULFILLMENT_NODE_CODE: 'DefaultFulfilmentNode',
  REPLENISHMENT_POLICY_KEY: 'ReplenishmentPolicy',
};

const INT_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const DECIMAL_FORMATTER = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TIME_24_EN = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const TIME_24_AR = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

let nextRowFieldSeq = 0;

export function getTargetFields(targetCode: string): TargetFieldMeta[] {
  return (getImportTarget(targetCode)?.fields ?? []).map((f) => ({
    code: f.code,
    required: f.required,
    allowedTransforms: f.allowedTransforms,
    lookupCode: f.lookupCode,
  }));
}

export function getOfferedTransforms(): readonly string[] {
  return OFFERED_TRANSFORMS;
}

export function offeredAllowedTransforms(meta: TargetFieldMeta | null | undefined): string[] {
  const offered = getOfferedTransforms();
  if (!meta) return [...offered];
  if (meta.allowedTransforms.length === 0) return [];
  const allowedSet = new Set(meta.allowedTransforms);
  return offered.filter((t) => allowedSet.has(t));
}

export function defaultTransformForField(meta: TargetFieldMeta | null | undefined): string {
  const choices = offeredAllowedTransforms(meta);
  if (choices.length > 0) return choices[0];
  if (meta?.allowedTransforms.length) return meta.allowedTransforms[0];
  return 'NONE';
}

export function englishSourceColumnName(code: string): string {
  if (SOURCE_COLUMN_NAME_FALLBACK[code]) {
    return SOURCE_COLUMN_NAME_FALLBACK[code];
  }
  const parts = code
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return 'Column';
  const joined = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return /^[A-Za-z]/.test(joined) ? joined : `Col${joined}`;
}

export function fieldLabel(transloco: TranslocoService, code: string | null | undefined): string {
  if (!code) return transloco.translate('imports.common.none');
  const key = `imports.fields.${code}`;
  const translated = transloco.translate(key);
  return translated && translated !== key ? translated : code;
}

export function targetLabel(transloco: TranslocoService, targetCode: string): string {
  const key = `imports.targets.${targetCode}.label`;
  const translated = transloco.translate(key);
  return translated && translated !== key ? translated : targetCode;
}

function hasTranslation(transloco: TranslocoService, key: string): string | null {
  const translated = transloco.translate(key);
  return translated && translated !== key ? translated : null;
}

export function translateImportError(transloco: TranslocoService, error: unknown): string {
  if (!(error instanceof ApiError)) {
    return (
      hasTranslation(transloco, 'tradeShared.errors.network') ??
      hasTranslation(transloco, 'settings.errors.network') ??
      'Cannot reach the server.'
    );
  }
  const reason = error.details?.['reason']?.[0];
  const normCode = error.code.replaceAll('.', '_');
  // Backend reasons are lowercase snake_case; the imports error keys use them in upper case.
  const normReason = reason ? reason.replaceAll('.', '_').toUpperCase() : null;

  const candidates: string[] = [];
  if (reason && normReason) {
    candidates.push(
      `imports.errors.${normCode}_${normReason}`,
      `automation.errors.${error.code}.${reason}`,
      `automation.errors.${normCode}_${normReason}`,
    );
  }
  candidates.push(
    `imports.errors.${normCode}`,
    `automation.errors.${error.code}`,
    `automation.errors.${normCode}`,
    `tradeShared.errors.${normCode}`,
  );

  for (const key of candidates) {
    const found = hasTranslation(transloco, key);
    if (found) return found;
  }

  return (
    hasTranslation(transloco, 'settings.errors.generic') ??
    hasTranslation(transloco, 'imports.errors.generic') ??
    'Something went wrong. Try again.'
  );
}

export function translateWorkerError(transloco: TranslocoService, code: string | null | undefined): string {
  if (code) {
    const direct = hasTranslation(transloco, `automation.workerErrors.${code}`);
    if (direct) return direct;
    const norm = hasTranslation(transloco, `automation.workerErrors.${code.replaceAll('.', '_')}`);
    if (norm) return norm;
  }
  return hasTranslation(transloco, 'imports.wizard.check.failedFallback') ?? 'The file could not be read.';
}

export function translateRowError(transloco: TranslocoService, code: string | null | undefined): string {
  if (!code) return hasTranslation(transloco, 'imports.common.none') ?? '—';
  const norm = hasTranslation(transloco, `imports.rowErrors.${code.replaceAll('.', '_')}`);
  if (norm) return norm;
  const direct = hasTranslation(transloco, `imports.rowErrors.${code}`);
  if (direct) return direct;
  return code;
}

export function normalizePage<T>(raw: unknown, page = 1, limit = 25): Page<T> {
  if (Array.isArray(raw)) {
    const items = raw as T[];
    return { items, total: items.length, page, limit };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const items = Array.isArray(obj['items']) ? (obj['items'] as T[]) : [];
    const total = typeof obj['total'] === 'number' ? obj['total'] : items.length;
    const resPage = typeof obj['page'] === 'number' ? obj['page'] : page;
    const resLimit = typeof obj['limit'] === 'number' ? obj['limit'] : limit;
    return { items, total, page: resPage, limit: resLimit };
  }
  return { items: [], total: 0, page, limit };
}

export function formatInt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? INT_FORMATTER.format(num) : String(value);
}

export function formatBytes(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const bytes = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${INT_FORMATTER.format(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${DECIMAL_FORMATTER.format(kb)} KB`;
  const mb = kb / 1024;
  return `${DECIMAL_FORMATTER.format(mb)} MB`;
}

export function formatDateTime(iso: string | null | undefined, lang: 'en' | 'ar'): string {
  if (!iso || !iso.trim()) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const datePart = formatDate(iso, lang);
  const timePart = (lang === 'ar' ? TIME_24_AR : TIME_24_EN).format(date);
  return `${datePart} ${timePart}`;
}

export function isTenantScope(scope: ScopeState): boolean {
  return !scope.company()?.id;
}

export function currentScopeTarget(scope: ScopeState): 'TENANT' | 'COMPANY' | 'BRANCH' {
  if (!scope.company()?.id) return 'TENANT';
  return scope.branch()?.id ? 'BRANCH' : 'COMPANY';
}

export function isScopeMismatchError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'TRADE.IMPORT.SCOPE_MISMATCH';
}

interface RowValidation {
  positionError: string | null;
  columnError: string | null;
  targetError: string | null;
  complete: boolean;
}

@Component({
  selector: 'app-mapping-rows',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Switch],
  providers: [
    provideIcons({
      tablerArrowRight,
      tablerCheck,
      tablerCircleX,
      tablerPlus,
      tablerTrash,
    }),
  ],
  templateUrl: './mapping-rows.html',
  host: { class: 'flex min-w-0 flex-col gap-8' },
})
export class MappingRows {
  private readonly transloco = inject(TranslocoService);
  protected readonly uid = `mapping-rows-${++nextRowFieldSeq}`;

  readonly targetCode = input.required<string>();
  readonly fields = model.required<MappingField[]>();
  readonly readonly = input(false);
  readonly showErrors = input(false);

  protected readonly maxRows = FILE_LIMITS.columns;

  protected readonly targetFields = computed(() => getTargetFields(this.targetCode()));
  protected readonly targetFieldMap = computed(() => new Map(this.targetFields().map((f) => [f.code, f])));

  protected readonly rowValidations = computed<RowValidation[]>(() => {
    const rows = this.fields();
    const posCounts = new Map<number, number>();
    const colCounts = new Map<string, number>();

    for (const row of rows) {
      const pos = Number(row.sourceOrdinal) + 1;
      if (Number.isInteger(pos) && pos >= 1 && pos <= 1000) {
        posCounts.set(pos, (posCounts.get(pos) ?? 0) + 1);
      }
      const normCol = (row.sourceColumnCode ?? '').trim().toLowerCase();
      if (normCol) {
        colCounts.set(normCol, (colCounts.get(normCol) ?? 0) + 1);
      }
    }

    return rows.map((row) => {
      const pos = Number(row.sourceOrdinal) + 1;
      let positionError: string | null = null;
      if (!Number.isInteger(pos) || pos < 1 || pos > 1000) {
        positionError = this.transloco.translate('imports.mappingRows.errors.positionRange');
      } else if ((posCounts.get(pos) ?? 0) > 1) {
        positionError = this.transloco.translate('imports.mappingRows.errors.positionDuplicate');
      }

      const rawCol = (row.sourceColumnCode ?? '').trim();
      let columnError: string | null = null;
      if (!rawCol) {
        columnError = this.transloco.translate('imports.mappingRows.errors.columnRequired');
      } else if (!SOURCE_COLUMN_PATTERN.test(rawCol)) {
        columnError = this.transloco.translate('imports.mappingRows.errors.columnPattern');
      } else if ((colCounts.get(rawCol.toLowerCase()) ?? 0) > 1) {
        columnError = this.transloco.translate('imports.mappingRows.errors.columnDuplicate');
      }

      const targetError = row.targetFieldCode
        ? null
        : this.transloco.translate('imports.mappingRows.errors.targetRequired');

      const complete = !positionError && !columnError && !targetError;
      return { positionError, columnError, targetError, complete };
    });
  });

  readonly missingRequiredLabels = computed<string[]>(() => {
    const present = new Set(this.fields().map((f) => f.targetFieldCode).filter(Boolean));
    return this.targetFields()
      .filter((f) => f.required && !present.has(f.code))
      .map((f) => fieldLabel(this.transloco, f.code));
  });

  readonly valid = computed(() => {
    const rows = this.fields();
    if (rows.length < 1 || rows.length > this.maxRows) return false;
    if (this.missingRequiredLabels().length > 0) return false;
    return this.rowValidations().every((v) => v.complete);
  });

  protected targetOptionsForRow(rowIndex: number): DropdownOption<string>[] {
    const rows = this.fields();
    const usedElsewhere = new Set(
      rows
        .filter((_, idx) => idx !== rowIndex)
        .map((r) => r.targetFieldCode)
        .filter(Boolean),
    );
    return this.targetFields().map((field) => {
      const label = fieldLabel(this.transloco, field.code);
      return {
        value: field.code,
        label: field.required ? `${label} *` : label,
        disabled: usedElsewhere.has(field.code),
      };
    });
  }

  protected transformOptionsForRow(row: MappingField): DropdownOption<string>[] {
    const meta = this.targetFieldMap().get(row.targetFieldCode);
    const allowed = offeredAllowedTransforms(meta);
    if (allowed.length === 0) {
      return [{ value: 'NONE', label: this.transloco.translate('imports.transforms.NONE') }];
    }
    return allowed.map((code) => ({
      value: code,
      label: this.transformLabel(code),
    }));
  }

  protected transformDisabled(row: MappingField): boolean {
    if (this.readonly()) return true;
    const meta = this.targetFieldMap().get(row.targetFieldCode);
    return offeredAllowedTransforms(meta).length === 0;
  }

  protected transformLabel(code: string | null | undefined): string {
    const normalized = code || 'NONE';
    const key = `imports.transforms.${normalized}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : normalized;
  }

  protected lookupLabel(code: string | null | undefined): string | null {
    if (!code) return null;
    const key = `imports.lookups.${code}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : code;
  }

  protected rowErrorMessage(index: number): string | null {
    if (!this.showErrors()) return null;
    const validation = this.rowValidations()[index];
    if (!validation) return null;
    return validation.positionError ?? validation.columnError ?? validation.targetError;
  }

  protected onOrdinalInput(index: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = raw.trim() === '' ? -1 : Number(raw);
    const nextOrdinal = Number.isFinite(parsed) ? Math.trunc(parsed) - 1 : -1;
    this.patchRow(index, { sourceOrdinal: nextOrdinal });
  }

  protected onSourceColumnInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.patchRow(index, { sourceColumnCode: value });
  }

  protected updateTargetField(index: number, targetFieldCode: string): void {
    const meta = this.targetFieldMap().get(targetFieldCode);
    const current = this.fields()[index];
    const allowed = offeredAllowedTransforms(meta);
    const keepTransform =
      current && allowed.includes(current.transformCode)
        ? current.transformCode
        : defaultTransformForField(meta);

    this.patchRow(index, {
      targetFieldCode,
      transformCode: keepTransform as ImportTransformCode,
      lookupCode: (meta?.lookupCode ?? undefined) as ImportLookupCode | undefined,
      isRequired: meta?.required ? true : (current?.isRequired ?? false),
    });
  }

  protected updateTransform(index: number, transformCode: string): void {
    this.patchRow(index, { transformCode: transformCode as ImportTransformCode });
  }

  protected updateRequired(index: number, isRequired: boolean): void {
    this.patchRow(index, { isRequired });
  }

  protected addColumn(): void {
    if (this.readonly() || this.fields().length >= this.maxRows) return;
    const rows = this.fields();
    const usedTargets = new Set(rows.map((r) => r.targetFieldCode).filter(Boolean));
    const nextTarget = this.targetFields().find((f) => !usedTargets.has(f.code));
    const maxOrd = rows.reduce((acc, row) => Math.max(acc, row.sourceOrdinal), -1);
    const newRow: MappingField = {
      sourceColumnCode: nextTarget ? englishSourceColumnName(nextTarget.code) : '',
      sourceOrdinal: maxOrd + 1,
      targetFieldCode: nextTarget?.code ?? '',
      transformCode: defaultTransformForField(nextTarget) as ImportTransformCode,
      ...(nextTarget?.lookupCode ? { lookupCode: nextTarget.lookupCode as ImportLookupCode } : {}),
      isRequired: nextTarget?.required ?? false,
    };
    this.fields.update((list) => [...list, newRow]);
  }

  protected removeColumn(index: number): void {
    if (this.readonly() || this.fields().length <= 1) return;
    this.fields.update((list) => list.filter((_, i) => i !== index));
  }

  private patchRow(index: number, patch: Partial<MappingField>): void {
    this.fields.update((list) =>
      list.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
  }
}

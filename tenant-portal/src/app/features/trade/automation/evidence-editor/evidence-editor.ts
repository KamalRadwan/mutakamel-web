import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerPlus, tablerX } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { TOWER_EVIDENCE_LIMITS, isForbiddenEvidenceKey } from '../tower.model';

const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 500;

interface EvidenceRow {
  uid: number;
  key: string;
  val: string;
  keyTouched: boolean;
  valTouched: boolean;
}

interface RowValidation {
  errorKey: string | null;
  keyInvalid: boolean;
  valInvalid: boolean;
  isComplete: boolean;
  isValid: boolean;
}

function utf8Bytes(value: unknown): number {
  const json = JSON.stringify(value) ?? '';
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return json.length;
}

@Component({
  selector: 'app-evidence-editor',
  imports: [NgIcon, TranslocoPipe, Button, Field],
  providers: [provideIcons({ tablerCircleX, tablerPlus, tablerX })],
  templateUrl: './evidence-editor.html',
  host: { class: 'block min-w-0' },
})
export class EvidenceEditor {
  private static nextEditorSeq = 0;
  private static nextRowSeq = 0;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly fallbackPrefix = `tower-evidence-${++EvidenceEditor.nextEditorSeq}`;

  readonly value = model<Record<string, string>>({});
  readonly disabled = input(false);
  readonly showErrors = input(false);
  readonly error = input<string | null>(null);
  readonly required = input(true);
  readonly idPrefix = input('');

  protected readonly maxRows = TOWER_EVIDENCE_LIMITS.maxKeys;
  protected readonly maxKeyLength = MAX_KEY_LENGTH;
  protected readonly maxValueLength = MAX_VALUE_LENGTH;

  protected readonly resolvedPrefix = computed(() => this.idPrefix().trim() || this.fallbackPrefix);
  protected readonly rows = signal<EvidenceRow[]>([this.createEmptyRow()]);
  private lastEmittedJson = JSON.stringify(this.value() ?? {});

  private readonly rowValidations = computed<RowValidation[]>(() => {
    const list = this.rows();
    const forceErrors = this.showErrors();

    const keyCounts = new Map<string, number>();
    for (const row of list) {
      const k = row.key.trim();
      if (k) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
    }

    return list.map((row) => {
      const k = row.key.trim();
      const v = row.val.trim();

      let keyError: string | null = null;
      if (k && isForbiddenEvidenceKey(k)) {
        keyError = 'tower.evidence.errors.forbiddenName';
      } else if (k.length > MAX_KEY_LENGTH) {
        keyError = 'tower.evidence.errors.keyTooLong';
      } else if (k && (keyCounts.get(k) ?? 0) > 1) {
        keyError = 'tower.evidence.errors.duplicateKey';
      } else if (!k && v && (row.keyTouched || forceErrors)) {
        keyError = 'tower.evidence.errors.keyRequired';
      }

      let valError: string | null = null;
      if (row.val.length > MAX_VALUE_LENGTH) {
        valError = 'tower.evidence.errors.valueTooLong';
      } else if (k && !v && (row.valTouched || forceErrors)) {
        valError = 'tower.evidence.errors.valueRequired';
      }

      const isComplete = k.length > 0 && v.length > 0;
      const isBlankRow = k.length === 0 && v.length === 0;
      const hasSemanticIssue =
        (k.length > 0 && isForbiddenEvidenceKey(k)) ||
        k.length > MAX_KEY_LENGTH ||
        (k.length > 0 && (keyCounts.get(k) ?? 0) > 1) ||
        row.val.length > MAX_VALUE_LENGTH ||
        (!isBlankRow && !isComplete);

      return {
        errorKey: keyError ?? valError,
        keyInvalid: keyError !== null,
        valInvalid: valError !== null,
        isComplete,
        isValid: !hasSemanticIssue,
      };
    });
  });

  protected readonly sectionError = computed<string | null>(() => {
    this.i18n();
    if (this.error()) return this.error();
    const list = this.rows();
    if (list.length > TOWER_EVIDENCE_LIMITS.maxKeys) {
      return this.transloco.translate('tower.evidence.errors.maxRows');
    }
    const payload = this.buildRecord(list);
    if (utf8Bytes(payload) > TOWER_EVIDENCE_LIMITS.maxBytes) {
      return this.transloco.translate('tower.evidence.errors.payloadTooLarge');
    }
    if (this.required() && this.showErrors()) {
      const hasComplete = this.rowValidations().some((r) => r.isComplete && r.isValid);
      if (!hasComplete) {
        return this.transloco.translate('tower.evidence.errors.required');
      }
    }
    return null;
  });

  readonly valid = computed<boolean>(() => {
    const list = this.rows();
    if (list.length > TOWER_EVIDENCE_LIMITS.maxKeys) return false;
    const validations = this.rowValidations();
    if (validations.some((v) => !v.isValid)) return false;
    const completeCount = validations.filter((v) => v.isComplete).length;
    if (this.required() && completeCount < TOWER_EVIDENCE_LIMITS.minKeys) return false;
    return utf8Bytes(this.buildRecord(list)) <= TOWER_EVIDENCE_LIMITS.maxBytes;
  });

  constructor() {
    effect(() => {
      const external = this.value() ?? {};
      const externalJson = JSON.stringify(external);
      if (externalJson === this.lastEmittedJson) return;

      this.lastEmittedJson = externalJson;
      untracked(() => {
        const entries = Object.entries(external);
        if (entries.length === 0) {
          this.rows.set([this.createEmptyRow()]);
        } else {
          this.rows.set(
            entries.map(([key, val]) => ({
              uid: ++EvidenceEditor.nextRowSeq,
              key,
              val: val ?? '',
              keyTouched: false,
              valTouched: false,
            })),
          );
        }
      });
    });
  }

  protected errorId(index: number): string {
    return `${this.resolvedPrefix()}-err-${index}`;
  }

  protected rowError(index: number): string | null {
    const errKey = this.rowValidations()[index]?.errorKey ?? null;
    return errKey ? this.transloco.translate(errKey) : null;
  }

  protected isKeyInvalid(index: number): boolean {
    return this.rowValidations()[index]?.keyInvalid ?? false;
  }

  protected isValueInvalid(index: number): boolean {
    return this.rowValidations()[index]?.valInvalid ?? false;
  }

  protected canRemoveRow(row: EvidenceRow): boolean {
    if (this.disabled()) return false;
    return this.rows().length > 1 || row.key.length > 0 || row.val.length > 0;
  }

  protected onKeyInput(index: number, event: Event): void {
    const key = (event.target as HTMLInputElement).value;
    this.updateRow(index, { key });
  }

  protected onKeyBlur(index: number): void {
    this.rows.update((list) =>
      list.map((row, idx) => (idx === index ? { ...row, keyTouched: true } : row)),
    );
  }

  protected onValueInput(index: number, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.updateRow(index, { val });
  }

  protected onValueBlur(index: number): void {
    this.rows.update((list) =>
      list.map((row, idx) => (idx === index ? { ...row, valTouched: true } : row)),
    );
  }

  protected addRow(): void {
    if (this.disabled() || this.rows().length >= TOWER_EVIDENCE_LIMITS.maxKeys) return;
    this.rows.update((list) => [...list, this.createEmptyRow()]);
  }

  protected removeRow(index: number): void {
    const list = this.rows();
    if (this.disabled()) return;
    let next: EvidenceRow[];
    if (list.length <= 1) {
      next = [this.createEmptyRow()];
    } else {
      next = list.filter((_, idx) => idx !== index);
    }
    this.rows.set(next);
    this.emitRecord(next);
  }

  private createEmptyRow(): EvidenceRow {
    return {
      uid: ++EvidenceEditor.nextRowSeq,
      key: '',
      val: '',
      keyTouched: false,
      valTouched: false,
    };
  }

  private updateRow(index: number, patch: Partial<EvidenceRow>): void {
    const next = this.rows().map((row, idx) => (idx === index ? { ...row, ...patch } : row));
    this.rows.set(next);
    this.emitRecord(next);
  }

  private buildRecord(list: readonly EvidenceRow[]): Record<string, string> {
    const record: Record<string, string> = {};
    for (const row of list) {
      const k = row.key.trim();
      if (!k) continue;
      record[k] = row.val.trim();
    }
    return record;
  }

  private emitRecord(list: readonly EvidenceRow[]): void {
    const record = this.buildRecord(list);
    this.lastEmittedJson = JSON.stringify(record);
    this.value.set(record);
  }
}

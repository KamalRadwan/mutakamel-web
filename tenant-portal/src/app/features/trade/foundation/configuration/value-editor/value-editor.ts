import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { TagOption, TagPicker } from '../../../../../shared/ui/tag-picker/tag-picker';
import type { ValueSchema } from '../configuration.model';
import {
  type EditorPlan,
  type ObjectEditorField,
  type SimpleEditorPlan,
  type ValueValidationError,
  describeSchemaLimits,
  editorPlan,
  stableJson,
} from '../value-schema';

@Component({
  selector: 'app-config-value-editor',
  imports: [TranslocoPipe, Field, Switch, Dropdown, TagPicker],
  templateUrl: './value-editor.html',
  host: { class: 'block min-w-0' },
})
export class ValueEditor {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly value = model<unknown>();
  readonly schema = input.required<ValueSchema>();
  readonly idPrefix = input('cfg-val');
  readonly errors = input<readonly ValueValidationError[]>([]);
  readonly disabled = input(false);
  readonly rootLabel = input('');
  readonly rootHint = input('');

  protected readonly plan = computed<EditorPlan>(() => editorPlan(this.schema()));
  protected readonly rootId = computed(() => `${this.idPrefix()}-root`);

  private readonly numberDrafts = signal<Record<string, string>>({});
  private readonly createdPrimitiveTags = signal<TagOption[]>([]);
  protected readonly jsonText = signal('');
  protected readonly jsonParseError = signal(false);
  private lastSerializedValue = '';

  protected readonly createPrimitiveTagFn = (name: string) => this.createPrimitiveTag(name);

  protected readonly effectiveRootLabel = computed(() => {
    this.i18n();
    return this.rootLabel() || this.transloco.translate('tradeConfig.valueEditor.rootLabel');
  });

  protected readonly effectiveRootHint = computed(() => {
    this.i18n();
    if (this.rootHint()) return this.rootHint();
    return describeSchemaLimits(this.schema(), (k, p) => this.transloco.translate(k, p)).valueHint;
  });

  protected readonly rootError = computed<string | null>(() => {
    this.i18n();
    const plan = this.plan();
    const list = this.errors();
    if (plan.kind === 'json') {
      if (this.jsonParseError()) {
        return this.transloco.translate('tradeConfig.valueError.json');
      }
      const first = list[0];
      if (!first) return null;
      const msg = this.formatError(first);
      return first.path === '$' ? msg : `${first.path}: ${msg}`;
    }

    const match = list.find((err) => err.path === '$' || err.path.startsWith('$[')) ?? list[0];
    if (!match) return null;
    const msg = this.formatError(match);
    return match.path === '$' || match.path.startsWith('$[') ? msg : `${match.path}: ${msg}`;
  });

  protected readonly rootDescribedBy = computed(() => {
    const id = this.rootId();
    return this.rootError() ? `${id}-hint ${id}-error` : `${id}-hint`;
  });

  constructor() {
    effect(() => {
      const currentPlan = this.plan();
      const val = this.value();
      if (currentPlan.kind !== 'json') {
        return;
      }
      const nextSerialized = stableJson(val);
      untracked(() => {
        if (nextSerialized !== this.lastSerializedValue) {
          this.lastSerializedValue = nextSerialized;
          this.jsonText.set(JSON.stringify(val ?? null, null, 2) ?? '');
          this.jsonParseError.set(false);
        }
      });
    });

    effect(() => {
      this.schema();
      untracked(() => {
        this.numberDrafts.set({});
        this.createdPrimitiveTags.set([]);
      });
    });
  }

  commit(): boolean {
    if (this.plan().kind !== 'json') {
      return true;
    }
    try {
      const parsed = JSON.parse(this.jsonText()) as unknown;
      this.jsonParseError.set(false);
      this.lastSerializedValue = stableJson(parsed);
      this.value.set(parsed);
      return true;
    } catch {
      this.jsonParseError.set(true);
      return false;
    }
  }

  protected objectValue(): Record<string, unknown> {
    const val = this.value();
    return typeof val === 'object' && val !== null && !Array.isArray(val)
      ? (val as Record<string, unknown>)
      : {};
  }

  protected propValue(key: string): unknown {
    return this.objectValue()[key];
  }

  protected propId(key: string): string {
    return `${this.idPrefix()}-${key}`;
  }

  protected propHint(schema: ValueSchema): string {
    this.i18n();
    return describeSchemaLimits(schema, (k, p) => this.transloco.translate(k, p)).valueHint;
  }

  protected propError(key: string): string | null {
    this.i18n();
    const prefix = `$.${key}`;
    const match = this.errors().find(
      (err) => err.path === prefix || err.path.startsWith(`${prefix}.`) || err.path.startsWith(`${prefix}[`),
    );
    if (!match) return null;
    const msg = this.formatError(match);
    if (match.path.startsWith(`${prefix}.`)) {
      return `${match.path.slice(prefix.length + 1)}: ${msg}`;
    }
    return msg;
  }

  protected propDescribedBy(key: string): string {
    const id = this.propId(key);
    return this.propError(key) ? `${id}-hint ${id}-error` : `${id}-hint`;
  }

  protected objectUnmatchedError(): string | null {
    this.i18n();
    const p = this.plan();
    if (p.kind !== 'object') return null;
    const fieldKeys = new Set(p.fields.map((f) => f.key));
    const match = this.errors().find((err) => {
      if (err.path === '$') return true;
      const seg = err.path.replace(/^\$\./, '').split('.')[0].split('[')[0];
      return !fieldKeys.has(seg);
    });
    if (!match) return null;
    const msg = this.formatError(match);
    return match.path === '$' ? msg : `${match.path}: ${msg}`;
  }

  protected enumOptions(plan: Extract<SimpleEditorPlan, { kind: 'enum' }>): DropdownOption<string>[] {
    return plan.options.map((opt) => ({ value: opt.key, label: opt.label }));
  }

  protected enumSelectedKey(val: unknown): string {
    return val === undefined ? '' : stableJson(val);
  }

  protected onEnumSelect(plan: Extract<SimpleEditorPlan, { kind: 'enum' }>, selectedKey: string, propKey?: string): void {
    const opt = plan.options.find((item) => item.key === selectedKey);
    if (!opt) return;
    this.updateValue(opt.value, propKey);
  }

  protected numberInputValue(val: unknown, draftKey: string): string {
    const drafts = this.numberDrafts();
    if (draftKey in drafts) {
      const draft = drafts[draftKey];
      const matchesVal =
        draft === val ||
        (val === undefined && draft.trim() === '') ||
        (typeof val === 'number' && Number(draft.trim()) === val);
      if (matchesVal) {
        return draft;
      }
    }
    return typeof val === 'number' && Number.isFinite(val) ? String(val) : '';
  }

  protected onNumberInput(event: Event, draftKey: string, propKey?: string): void {
    const raw = (event.target as HTMLInputElement).value;
    this.numberDrafts.update((curr) => ({ ...curr, [draftKey]: raw }));
    const trimmed = raw.trim();
    if (!trimmed) {
      this.updateValue(undefined, propKey);
      return;
    }
    const num = Number(trimmed);
    this.updateValue(Number.isFinite(num) ? num : raw, propKey);
  }

  protected stringInputValue(val: unknown): string {
    return typeof val === 'string' ? val : '';
  }

  protected stringCount(val: unknown): number {
    return typeof val === 'string' ? [...val].length : 0;
  }

  protected onTextInput(event: Event, propKey?: string): void {
    const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.updateValue(raw, propKey);
  }

  protected enumArrayTagOptions(plan: Extract<SimpleEditorPlan, { kind: 'enumArray' }>): TagOption[] {
    return plan.options.map((opt) => ({
      id: opt.key,
      name: opt.label,
      backgroundColor: null,
      textColor: null,
    }));
  }

  protected enumArraySelectedIds(plan: Extract<SimpleEditorPlan, { kind: 'enumArray' }>, val: unknown): string[] {
    if (!Array.isArray(val)) return [];
    const valid = new Set(plan.options.map((o) => o.key));
    return val.map((item) => stableJson(item)).filter((key) => valid.has(key));
  }

  protected onEnumArrayChange(
    plan: Extract<SimpleEditorPlan, { kind: 'enumArray' }>,
    ids: string[],
    propKey?: string,
  ): void {
    const byKey = new Map(plan.options.map((o) => [o.key, o.value]));
    const next = ids.map((id) => byKey.get(id)).filter((item) => item !== undefined);
    this.updateValue(next, propKey);
  }

  protected primitiveArrayTagOptions(val: unknown): TagOption[] {
    const map = new Map<string, TagOption>();
    if (Array.isArray(val)) {
      for (const item of val) {
        const text = String(item);
        map.set(text, { id: text, name: text, backgroundColor: null, textColor: null });
      }
    }
    for (const extra of this.createdPrimitiveTags()) {
      if (!map.has(extra.id)) {
        map.set(extra.id, extra);
      }
    }
    return Array.from(map.values());
  }

  protected primitiveArraySelectedIds(val: unknown): string[] {
    return Array.isArray(val) ? val.map((item) => String(item)) : [];
  }

  protected onPrimitiveArrayChange(
    plan: Extract<SimpleEditorPlan, { kind: 'primitiveArray' }>,
    ids: string[],
    propKey?: string,
  ): void {
    const next = ids.map((id) => {
      if (plan.itemType === 'integer' || plan.itemType === 'number') {
        if (/^-?\d+(?:\.\d+)?$/.test(id.trim())) {
          return Number(id);
        }
      }
      return id;
    });
    this.updateValue(next, propKey);
  }

  protected onBooleanChange(checked: boolean, propKey?: string): void {
    this.updateValue(checked, propKey);
  }

  protected onJsonInput(event: Event): void {
    const raw = (event.target as HTMLTextAreaElement).value;
    this.jsonText.set(raw);
    this.jsonParseError.set(false);
  }

  protected fieldTrack(_index: number, field: ObjectEditorField): string {
    return field.key;
  }

  private async createPrimitiveTag(name: string): Promise<TagOption> {
    const trimmed = name.trim();
    const opt: TagOption = { id: trimmed, name: trimmed, backgroundColor: null, textColor: null };
    this.createdPrimitiveTags.update((curr) => [...curr.filter((item) => item.id !== opt.id), opt]);
    return opt;
  }

  private updateValue(next: unknown, propKey?: string): void {
    if (!propKey) {
      this.value.set(next);
      return;
    }
    const base = { ...this.objectValue() };
    if (next === undefined) {
      delete base[propKey];
    } else {
      base[propKey] = next;
    }
    this.value.set(base);
  }

  private formatError(err: ValueValidationError): string {
    if (err.messageKey) {
      return this.transloco.translate(err.messageKey);
    }
    return this.transloco.translate(`tradeConfig.valueError.${err.rule}`, {
      min: err.min,
      max: err.max,
      key: err.key,
    });
  }
}

import { Component, computed, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../shared/ui/field/field';
import type { WebhookEventDefinition, WebhookEventSelection } from '../webhooks.model';

export type EventSelection = WebhookEventSelection;

const MAX_EVENTS = 30;

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readEventType(def: WebhookEventDefinition): string {
  const rec = readRecord(def);
  const raw = rec?.['eventType'] ?? rec?.['type'] ?? rec?.['code'];
  return typeof raw === 'string' ? raw : '';
}

function readEventVersion(def: WebhookEventDefinition): number {
  const rec = readRecord(def);
  const raw = rec?.['eventVersion'] ?? rec?.['version'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 1;
}

function readEventFields(def: WebhookEventDefinition): readonly string[] {
  const rec = readRecord(def);
  const raw = rec?.['fields'] ?? rec?.['allowedFields'] ?? rec?.['availableFields'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

function readFallbackLabel(def: WebhookEventDefinition, lang: 'en' | 'ar'): string {
  const rec = readRecord(def);
  const label = readRecord(rec?.['label'] ?? rec?.['localizedNames']);
  if (label) {
    const byLang = label[lang] ?? label['en'] ?? label['ar'];
    if (typeof byLang === 'string' && byLang.trim()) return byLang;
  }
  const direct = lang === 'ar' ? rec?.['labelAr'] : rec?.['labelEn'];
  if (typeof direct === 'string' && direct.trim()) return direct;
  return readEventType(def);
}

let nextEventPickerId = 0;

@Component({
  selector: 'app-event-picker',
  imports: [Checkbox, Field, TranslocoPipe],
  templateUrl: './event-picker.html',
  host: { class: 'flex flex-col gap-8' },
})
export class EventPicker {
  protected readonly uid = `event-picker-${++nextEventPickerId}`;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  readonly catalogue = input.required<readonly WebhookEventDefinition[]>();
  readonly readonly = input(false);
  readonly error = input<string | null>(null);

  readonly value = model<EventSelection[]>([]);

  protected readonly maxEvents = MAX_EVENTS;
  protected readonly selectedCount = computed(() => this.value().length);
  protected readonly atMax = computed(() => this.value().length >= MAX_EVENTS);

  protected readonly selectionMap = computed(() => {
    const map = new Map<string, EventSelection>();
    for (const item of this.value()) {
      map.set(`${item.eventType}::${item.eventVersion}`, item);
    }
    return map;
  });

  protected trackDef(def: WebhookEventDefinition): string {
    return `${readEventType(def)}::${readEventVersion(def)}`;
  }

  protected eventCode(def: WebhookEventDefinition): string {
    const type = readEventType(def);
    const ver = readEventVersion(def);
    return /\.v\d+$/.test(type) ? type : `${type}.v${ver}`;
  }

  protected eventFields(def: WebhookEventDefinition): readonly string[] {
    return readEventFields(def);
  }

  protected eventLabel(def: WebhookEventDefinition): string {
    this.i18n();
    const lang = this.language();
    const type = readEventType(def);
    const fullCode = this.eventCode(def);
    const fullKey = `webhooks.events.${fullCode}`;
    const fullTranslated = this.transloco.translate(fullKey);
    if (fullTranslated !== fullKey) return fullTranslated;

    const bareKey = `webhooks.events.${type}`;
    const bareTranslated = this.transloco.translate(bareKey);
    if (bareTranslated !== bareKey) return bareTranslated;

    return readFallbackLabel(def, lang);
  }

  protected selectionFor(def: WebhookEventDefinition): EventSelection | undefined {
    const key = `${readEventType(def)}::${readEventVersion(def)}`;
    const exact = this.selectionMap().get(key);
    if (exact) return exact;
    const type = readEventType(def);
    return this.value().find((item) => item.eventType === type);
  }

  protected isChecked(def: WebhookEventDefinition): boolean {
    return this.selectionFor(def) !== undefined;
  }

  protected isFieldIncluded(def: WebhookEventDefinition, field: string): boolean {
    const selected = this.selectionFor(def);
    if (!selected) return false;
    return selected.fields.includes(field);
  }

  protected isLastSelectedField(def: WebhookEventDefinition, field: string): boolean {
    const selected = this.selectionFor(def);
    if (!selected) return false;
    return selected.fields.length <= 1 && selected.fields.includes(field);
  }

  protected onToggleEvent(def: WebhookEventDefinition, nextChecked: boolean): void {
    if (this.readonly()) return;
    const type = readEventType(def);
    const version = readEventVersion(def);
    const allFields = [...readEventFields(def)];

    if (nextChecked) {
      if (this.isChecked(def) || this.atMax()) return;
      this.value.update((current) => [
        ...current,
        {
          eventType: type,
          eventVersion: version,
          fields: allFields,
        },
      ]);
      return;
    }

    this.value.update((current) => current.filter((item) => item.eventType !== type));
  }

  protected onToggleField(def: WebhookEventDefinition, field: string): void {
    if (this.readonly()) return;
    const currentSelection = this.selectionFor(def);
    if (!currentSelection) return;

    const alreadyIncluded = currentSelection.fields.includes(field);
    if (alreadyIncluded && currentSelection.fields.length <= 1) {
      return;
    }

    const allFields = readEventFields(def);
    const nextFieldSet = new Set(currentSelection.fields);
    if (alreadyIncluded) {
      nextFieldSet.delete(field);
    } else {
      nextFieldSet.add(field);
    }

    const orderedFields = allFields.filter((f) => nextFieldSet.has(f));
    for (const extra of nextFieldSet) {
      if (!orderedFields.includes(extra)) {
        orderedFields.push(extra);
      }
    }

    const type = readEventType(def);
    this.value.update((list) =>
      list.map((item) => (item.eventType === type ? { ...item, fields: orderedFields } : item)),
    );
  }
}

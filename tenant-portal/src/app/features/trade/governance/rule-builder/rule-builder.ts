import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerChevronDown,
  tablerChevronUp,
  tablerGavel,
  tablerInfoCircle,
  tablerPlus,
  tablerRepeat,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import type { PolicyCondition, PolicyContent, PolicyRule } from '../policy.model';
import {
  FACTS,
  FACTS_BY_KIND,
  OUTCOMES,
  isDecimalString,
  isMoneyFact,
  type PolicyFactDefinition,
  type PolicyKind,
  type PolicyOutcome,
  REASON_CODE,
  RULE_CODE,
} from '../policy.registry';
import { RuleCondition } from '../rule-condition/rule-condition';

const MAX_RULES = 200;
const MAX_CONDITIONS = 20;
const MAX_SELECTED_VALUE = 120;

const OUTCOME_CHIP_CLASSES: Readonly<Record<PolicyOutcome, string>> = {
  ALLOW: 'bg-success-soft text-on-success-soft',
  DENY: 'bg-danger-soft text-on-danger-soft',
  REQUIRE_APPROVAL: 'bg-brand-soft text-on-brand-soft',
  SELECT: 'bg-neutral-soft text-on-neutral-soft',
};

export function validatePolicyContentClient(content: PolicyContent): Record<string, string> {
  const errors: Record<string, string> = {};
  const rules = content.rules ?? [];

  const codeCounts = new Map<string, number>();
  const priorityCounts = new Map<number, number>();
  for (const r of rules) {
    const code = r.code.trim();
    if (code) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    if (Number.isInteger(r.priority)) {
      priorityCounts.set(r.priority, (priorityCounts.get(r.priority) ?? 0) + 1);
    }
  }

  rules.forEach((rule, i) => {
    const code = rule.code.trim();
    if (!RULE_CODE.test(code)) {
      errors[`rules[${i}].code`] = 'policy.rules.ruleCodeError';
    } else if ((codeCounts.get(code) ?? 0) > 1) {
      errors[`rules[${i}].code`] = 'policy.rules.ruleCodeDuplicate';
    }

    if (!Number.isInteger(rule.priority) || rule.priority < 0 || rule.priority > 100_000) {
      errors[`rules[${i}].priority`] = 'policy.rules.priorityRangeError';
    } else if ((priorityCounts.get(rule.priority) ?? 0) > 1) {
      errors[`rules[${i}].priority`] = 'policy.rules.priorityDuplicateError';
    }

    if (!REASON_CODE.test(rule.reasonCode.trim())) {
      errors[`rules[${i}].reasonCode`] = 'policy.rules.reasonCodeError';
    }

    if (rule.outcome === 'SELECT') {
      const sv = rule.selectedValue?.trim() ?? '';
      if (!sv || sv.length > MAX_SELECTED_VALUE) {
        errors[`rules[${i}].selectedValue`] = 'policy.rules.selectedValueRequired';
      }
    }

    rule.all.forEach((cond, j) => {
      if (cond.operator === 'IN') {
        if (!Array.isArray(cond.value) || cond.value.length < 1 || cond.value.length > 100) {
          errors[`rules[${i}].all[${j}].value`] = 'policy.rules.validation.genericInvalid';
        }
      } else {
        const factDef = FACTS.find((f) => f.key === cond.fact);
        if (factDef && isMoneyFact(factDef.key)) {
          if (!isDecimalString(cond.value) && typeof cond.value !== 'number') {
            errors[`rules[${i}].all[${j}].value`] = 'policy.rules.validation.genericInvalid';
          } else if (typeof cond.value === 'number' && !Number.isFinite(cond.value)) {
            errors[`rules[${i}].all[${j}].value`] = 'policy.rules.validation.genericInvalid';
          }
        } else if (factDef?.type === 'number') {
          const n = typeof cond.value === 'number' ? cond.value : Number(cond.value);
          if (cond.value === '' || cond.value === null || cond.value === undefined || !Number.isFinite(n)) {
            errors[`rules[${i}].all[${j}].value`] = 'policy.rules.validation.genericInvalid';
          }
        } else if (factDef?.type === 'string') {
          if (typeof cond.value !== 'string' || !cond.value.trim()) {
            errors[`rules[${i}].all[${j}].value`] = 'policy.rules.validation.genericInvalid';
          }
        }
      }
    });
  });

  if (content.defaultOutcome === 'SELECT') {
    const dsv = content.defaultSelectedValue?.trim() ?? '';
    if (!dsv || dsv.length > MAX_SELECTED_VALUE) {
      errors['defaultSelectedValue'] = 'policy.rules.selectedValueRequired';
    }
  }

  return errors;
}

@Component({
  selector: 'app-rule-builder',
  imports: [NgIcon, TranslocoPipe, Button, Field, Segmented, RuleCondition],
  providers: [
    provideIcons({
      tablerArrowDown,
      tablerArrowUp,
      tablerChevronDown,
      tablerChevronUp,
      tablerGavel,
      tablerInfoCircle,
      tablerPlus,
      tablerRepeat,
      tablerTrash,
    }),
  ],
  templateUrl: './rule-builder.html',
  host: { class: 'flex flex-col gap-10 min-w-0' },
})
export class RuleBuilder {
  private static nextId = 0;
  protected readonly uid = `pol-rules-${++RuleBuilder.nextId}`;
  protected readonly maxRules = MAX_RULES;
  protected readonly maxConditions = MAX_CONDITIONS;
  protected readonly maxSelectedValue = MAX_SELECTED_VALUE;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;

  readonly content = model.required<PolicyContent>();
  readonly readonly = input(false);
  readonly readonlyNotice = input<string | null>(null);
  readonly kind = input.required<string>();
  readonly facts = input<readonly PolicyFactDefinition[]>(FACTS);
  readonly factsByKind = input<Readonly<Record<string, readonly string[]>>>(FACTS_BY_KIND);
  readonly diagnostics = input<Readonly<Record<string, string>>>({});
  readonly showErrors = input(false);
  readonly expandRequest = input<{ index: number; seq: number } | null>(null);

  protected readonly expandedIndex = signal<number | null>(0);
  private lastExpandSeq = -1;

  protected readonly supportedFactKeys = computed<readonly string[]>(() => {
    const map = this.factsByKind();
    return map[this.kind()] ?? map[this.kind() as PolicyKind] ?? [];
  });

  private readonly factMap = computed(() => new Map(this.facts().map((f) => [f.key, f])));

  protected readonly outcomeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return OUTCOMES.map((value) => ({
      value,
      label: this.transloco.translate(`policy.outcomes.${value}`),
    }));
  });

  protected readonly clientErrors = computed<Record<string, string>>(() => {
    this.i18n();
    const c = this.content();
    const raw = validatePolicyContentClient(c);
    const out: Record<string, string> = {};

    const showAll = this.showErrors();
    for (const [path, key] of Object.entries(raw)) {
      if (showAll || path.endsWith('.priority')) {
        out[path] = this.transloco.translate(key);
      }
    }
    return out;
  });

  protected readonly mergedErrors = computed<Record<string, string>>(() => ({
    ...this.clientErrors(),
    ...this.diagnostics(),
  }));

  protected readonly factsReceivedText = computed(() => {
    this.i18n();
    const keys = this.supportedFactKeys();
    if (keys.length === 0) return '—';
    const sep = this.lang() === 'ar' ? '، ' : ', ';
    return keys.map((key) => this.transloco.translate(`policy.facts.${key}`)).join(sep);
  });

  constructor() {
    effect(() => {
      const req = this.expandRequest();
      if (!req || req.seq === this.lastExpandSeq) return;
      this.lastExpandSeq = req.seq;
      untracked(() => {
        const count = this.content().rules.length;
        if (req.index >= 0 && req.index < count) {
          this.expandedIndex.set(req.index);
        }
      });
    });
  }

  protected errorAt(path: string): string | null {
    return this.mergedErrors()[path] ?? null;
  }

  protected outcomeChipClass(outcome: PolicyOutcome): string {
    return OUTCOME_CHIP_CLASSES[outcome] ?? 'bg-neutral-soft text-on-neutral-soft';
  }

  protected isRuleExpanded(index: number): boolean {
    return !this.readonly() && this.expandedIndex() === index;
  }

  protected toggleRule(index: number): void {
    if (this.readonly()) return;
    this.expandedIndex.update((curr) => (curr === index ? null : index));
  }

  protected conditionSummary(cond: PolicyCondition): string {
    this.i18n();
    const factLabel = this.factMap().has(cond.fact)
      ? this.transloco.translate(`policy.facts.${cond.fact}`)
      : cond.fact;
    const opLabel = this.transloco.translate(`policy.operatorSymbols.${cond.operator}`);
    const valLabel = this.formatConditionValue(cond);
    return this.transloco.translate('policy.rules.summaryIf', {
      fact: factLabel,
      op: opLabel,
      value: valLabel,
    });
  }

  protected extraConditionsCount(rule: PolicyRule): number {
    return Math.max(0, rule.all.length - 1);
  }

  protected moveRule(index: number, delta: -1 | 1): void {
    if (this.readonly()) return;
    const target = index + delta;
    const rules = this.content().rules;
    if (target < 0 || target >= rules.length) return;

    const next = [...rules];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);

    this.expandedIndex.update((curr) => {
      if (curr === index) return target;
      if (curr === target) return index;
      return curr;
    });
    this.content.update((c) => ({ ...c, rules: next }));
  }

  protected removeRule(index: number): void {
    if (this.readonly()) return;
    this.content.update((c) => ({
      ...c,
      rules: c.rules.filter((_, i) => i !== index),
    }));
    this.expandedIndex.update((curr) => {
      if (curr === null) return null;
      if (curr === index) {
        const len = this.content().rules.length;
        return len > 0 ? Math.min(index, len - 1) : null;
      }
      if (curr > index) return curr - 1;
      return curr;
    });
  }

  protected addRule(): void {
    if (this.readonly()) return;
    const rules = this.content().rules;
    if (rules.length >= MAX_RULES) return;

    const usedCodes = new Set(rules.map((r) => r.code));
    let n = rules.length + 1;
    while (usedCodes.has(`RULE_${n}`)) {
      n += 1;
    }

    const usedPriorities = new Set(rules.map((r) => r.priority));
    const maxP = rules.reduce((acc, r) => (Number.isFinite(r.priority) ? Math.max(acc, r.priority) : acc), 0);
    let nextPriority = Math.min(100_000, maxP + 10);
    while (usedPriorities.has(nextPriority) && nextPriority < 100_000) {
      nextPriority += 1;
    }

    const firstFactKey = this.supportedFactKeys()[0] ?? this.facts()[0]?.key ?? 'documentKind';
    const firstFactDef = this.factMap().get(firstFactKey);
    const initialValue = firstFactDef?.type === 'boolean' ? false : isMoneyFact(firstFactKey) ? '0' : firstFactDef?.type === 'number' ? 0 : '';

    const newRule: PolicyRule = {
      code: `RULE_${n}`,
      priority: nextPriority,
      all: [{ fact: firstFactKey, operator: 'EQ', value: initialValue }],
      outcome: 'ALLOW',
      reasonCode: 'RULE_MATCHED',
    };

    const nextIndex = rules.length;
    this.content.update((c) => ({ ...c, rules: [...c.rules, newRule] }));
    this.expandedIndex.set(nextIndex);
  }

  protected onRuleCodeInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.patchRule(index, { code: value });
  }

  protected onRulePriorityInput(index: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = raw.trim() === '' ? -1 : Number(raw);
    this.patchRule(index, { priority: Number.isFinite(parsed) ? parsed : -1 });
  }

  protected onRuleReasonCodeInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.patchRule(index, { reasonCode: value });
  }

  protected onRuleOutcomeChange(index: number, value: string | null): void {
    if (!OUTCOMES.includes(value as PolicyOutcome)) return;
    const outcome = value as PolicyOutcome;
    this.patchRule(index, {
      outcome,
      selectedValue: outcome === 'SELECT' ? (this.content().rules[index]?.selectedValue ?? '') : null,
    });
  }

  protected onRuleSelectedValueInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.patchRule(index, { selectedValue: value });
  }

  protected addCondition(ruleIndex: number): void {
    if (this.readonly()) return;
    const rule = this.content().rules[ruleIndex];
    if (!rule || rule.all.length >= MAX_CONDITIONS) return;

    const firstFactKey = this.supportedFactKeys()[0] ?? this.facts()[0]?.key ?? 'documentKind';
    const firstFactDef = this.factMap().get(firstFactKey);
    const initialValue = firstFactDef?.type === 'boolean' ? false : isMoneyFact(firstFactKey) ? '0' : firstFactDef?.type === 'number' ? 0 : '';

    this.patchRule(ruleIndex, {
      all: [...rule.all, { fact: firstFactKey, operator: 'EQ', value: initialValue }],
    });
  }

  protected updateCondition(ruleIndex: number, condIndex: number, next: PolicyCondition): void {
    const rule = this.content().rules[ruleIndex];
    if (!rule) return;
    const nextAll = rule.all.map((c, idx) => (idx === condIndex ? next : c));
    this.patchRule(ruleIndex, { all: nextAll });
  }

  protected removeCondition(ruleIndex: number, condIndex: number): void {
    const rule = this.content().rules[ruleIndex];
    if (!rule || rule.all.length <= 1) return;
    this.patchRule(ruleIndex, {
      all: rule.all.filter((_, idx) => idx !== condIndex),
    });
  }

  protected onDefaultOutcomeChange(value: string | null): void {
    if (!OUTCOMES.includes(value as PolicyOutcome)) return;
    const outcome = value as PolicyOutcome;
    this.content.update((c) => ({
      ...c,
      defaultOutcome: outcome,
      defaultSelectedValue: outcome === 'SELECT' ? (c.defaultSelectedValue ?? '') : null,
    }));
  }

  protected onDefaultSelectedValueInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.content.update((c) => ({ ...c, defaultSelectedValue: value }));
  }

  private patchRule(index: number, patch: Partial<PolicyRule>): void {
    this.content.update((c) => ({
      ...c,
      rules: c.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  }

  private formatConditionValue(cond: PolicyCondition): string {
    if (Array.isArray(cond.value)) {
      return cond.value.join(', ') || '—';
    }
    if (typeof cond.value === 'boolean') {
      return this.transloco.translate(cond.value ? 'policy.rules.yes' : 'policy.rules.no');
    }
    if (cond.value === '' || cond.value === null || cond.value === undefined) {
      return '—';
    }
    return String(cond.value);
  }
}

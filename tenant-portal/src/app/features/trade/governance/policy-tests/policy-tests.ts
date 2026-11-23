import { Component, computed, inject, input, model, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFlask, tablerPlus } from '@ng-icons/tabler-icons';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { PolicyTestModal } from '../policy-test-modal/policy-test-modal';
import type { PolicyRule, PolicyTestCase, PolicyTestCaseResult, PolicyTestResult } from '../policy.model';
import {
  type PolicyFactDefinition,
  type PolicyOutcome,
  factLabel,
} from '../policy.registry';

const MAX_TESTS = 100;

const OUTCOME_CLASSES: Readonly<Record<PolicyOutcome, string>> = {
  ALLOW: 'bg-success-soft text-on-success-soft',
  DENY: 'bg-danger-soft text-on-danger-soft',
  REQUIRE_APPROVAL: 'bg-brand-soft text-on-brand-soft',
  SELECT: 'bg-neutral-soft text-on-neutral-soft',
};

interface FactChip {
  key: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-policy-tests',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, PolicyTestModal],
  providers: [provideIcons({ tablerFlask, tablerPlus })],
  templateUrl: './policy-tests.html',
  host: { class: 'flex flex-col gap-10 min-w-0' },
})
export class PolicyTests {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly testModal = viewChild.required(PolicyTestModal);

  readonly testCases = model.required<PolicyTestCase[]>();
  readonly lastResult = input<PolicyTestResult | null>(null);
  readonly testError = input<string | null>(null);
  readonly readonly = input(false);
  readonly kind = input('');
  readonly rules = input<readonly PolicyRule[]>([]);
  readonly facts = input<readonly PolicyFactDefinition[]>([]);
  readonly factsByKind = input<Readonly<Record<string, readonly string[]>>>({});

  protected readonly maxTests = MAX_TESTS;

  protected readonly existingCodes = computed(() => this.testCases().map((t) => t.code));

  protected readonly resultMap = computed<ReadonlyMap<string, PolicyTestCaseResult>>(() => {
    const res = this.lastResult();
    const map = new Map<string, PolicyTestCaseResult>();
    if (!res) return map;
    for (const c of res.cases) {
      map.set(c.code, c);
    }
    return map;
  });

  protected readonly summary = computed<{ passed: number; total: number } | null>(() => {
    const res = this.lastResult();
    if (!res) return null;
    const total = res.cases.length;
    const passed = res.cases.filter((c) => c.passed).length;
    return { passed, total };
  });

  protected readonly hasResults = computed(() => this.lastResult() !== null);

  protected readonly gridColumns = computed(() => {
    const showResults = this.hasResults();
    const showActions = !this.readonly();
    if (showResults) {
      return showActions
        ? 'grid-cols-trade-policy-test-result-row-actions'
        : 'grid-cols-trade-policy-test-result-row';
    }
    return showActions
      ? 'grid-cols-trade-policy-test-row-actions'
      : 'grid-cols-trade-policy-test-row';
  });

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'edit',
        title: this.transloco.translate('policy.tests.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-blue',
      },
      {
        id: 'delete',
        title: this.transloco.translate('policy.tests.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  });

  protected outcomeClass(outcome: PolicyOutcome): string {
    return OUTCOME_CLASSES[outcome];
  }

  protected factChipsFor(testCase: PolicyTestCase): { visible: FactChip[]; extra: number } {
    this.i18n();
    const entries = Object.entries(testCase.facts ?? {});
    const visible = entries.slice(0, 3).map(([key, raw]) => {
      const label = factLabel((k) => this.transloco.translate(k), key);
      const value =
        typeof raw === 'boolean'
          ? this.transloco.translate(raw ? 'policy.rules.yes' : 'policy.rules.no')
          : String(raw);
      return { key, label, value };
    });
    return {
      visible,
      extra: Math.max(0, entries.length - 3),
    };
  }

  protected openCreate(): void {
    if (this.readonly() || this.testCases().length >= MAX_TESTS) return;
    this.testModal().openCreate();
  }

  protected openEdit(index: number, testCase: PolicyTestCase): void {
    if (this.readonly()) return;
    this.testModal().openEdit(index, testCase);
  }

  protected onRowAction(index: number, testCase: PolicyTestCase, selection: ActionSelection): void {
    if (this.readonly()) return;
    if (selection.id === 'edit') {
      this.openEdit(index, testCase);
    } else if (selection.id === 'delete') {
      this.testCases.update((list) => list.filter((_, i) => i !== index));
    }
  }

  protected onTestSaved(event: { index: number | null; testCase: PolicyTestCase }): void {
    this.testCases.update((list) => {
      if (event.index === null) {
        return [...list, event.testCase];
      }
      return list.map((item, i) => (i === event.index ? event.testCase : item));
    });
  }
}

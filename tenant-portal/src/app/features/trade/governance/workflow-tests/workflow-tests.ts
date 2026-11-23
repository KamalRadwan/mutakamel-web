import { Component, computed, inject, input, model, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerFlask, tablerPlus } from '@ng-icons/tabler-icons';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { WorkflowTestModal } from '../workflow-test-modal/workflow-test-modal';
import type { WorkflowTestCase, WorkflowTestCaseResult, WorkflowTestResult } from '../policy.model';
import type { WorkflowAction } from '../policy.registry';

const MAX_TESTS = 100;

@Component({
  selector: 'app-workflow-tests',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, WorkflowTestModal],
  providers: [provideIcons({ tablerArrowRight, tablerFlask, tablerPlus })],
  templateUrl: './workflow-tests.html',
  host: { class: 'flex flex-col gap-10 min-w-0' },
})
export class WorkflowTests {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly testModal = viewChild.required(WorkflowTestModal);

  readonly testCases = model.required<WorkflowTestCase[]>();
  readonly states = input<readonly string[]>([]);
  readonly initialState = input('');
  readonly lastResult = input<WorkflowTestResult | null>(null);
  readonly testError = input<string | null>(null);
  readonly readonly = input(false);

  protected readonly maxTests = MAX_TESTS;

  protected readonly existingCodes = computed(() => this.testCases().map((t) => t.code));

  protected readonly resultMap = computed<ReadonlyMap<string, WorkflowTestCaseResult>>(() => {
    const res = this.lastResult();
    const map = new Map<string, WorkflowTestCaseResult>();
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
        ? 'grid-cols-trade-workflow-test-result-row-actions'
        : 'grid-cols-trade-workflow-test-result-row';
    }
    return showActions
      ? 'grid-cols-trade-workflow-test-row-actions'
      : 'grid-cols-trade-workflow-test-row';
  });

  protected readonly rowActions = computed<ActionItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'edit',
        title: this.transloco.translate('workflows.tests.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-blue',
      },
      {
        id: 'delete',
        title: this.transloco.translate('workflows.tests.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  });

  protected actionChipClass(action: WorkflowAction): string {
    if (action === 'APPROVE') return 'bg-success-soft text-on-success-soft';
    if (action === 'REJECT') return 'bg-danger-soft text-on-danger-soft';
    return 'bg-neutral-soft text-on-neutral-soft';
  }

  protected openCreate(): void {
    if (this.readonly() || this.testCases().length >= MAX_TESTS) return;
    this.testModal().openCreate();
  }

  protected openEdit(index: number, testCase: WorkflowTestCase): void {
    if (this.readonly()) return;
    this.testModal().openEdit(index, testCase);
  }

  protected onRowAction(index: number, testCase: WorkflowTestCase, selection: ActionSelection): void {
    if (this.readonly()) return;
    if (selection.id === 'edit') {
      this.openEdit(index, testCase);
    } else if (selection.id === 'delete') {
      this.testCases.update((list) => list.filter((_, i) => i !== index));
    }
  }

  protected onTestSaved(event: { index: number | null; testCase: WorkflowTestCase }): void {
    this.testCases.update((list) => {
      if (event.index === null) {
        return [...list, event.testCase];
      }
      return list.map((item, i) => (i === event.index ? event.testCase : item));
    });
  }
}

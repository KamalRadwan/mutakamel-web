import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowRight,
  tablerChevronLeft,
  tablerChevronRight,
  tablerFlask,
  tablerPlus,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import type { WorkflowTestCase } from '../policy.model';
import { RULE_CODE, WORKFLOW_ACTIONS, type WorkflowAction } from '../policy.registry';

const MAX_ACTIONS = 20;

@Component({
  selector: 'app-workflow-test-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal],
  providers: [
    provideIcons({
      tablerArrowRight,
      tablerChevronLeft,
      tablerChevronRight,
      tablerFlask,
      tablerPlus,
      tablerX,
    }),
  ],
  templateUrl: './workflow-test-modal.html',
})
export class WorkflowTestModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly states = input<readonly string[]>([]);
  readonly initialState = input('');
  readonly existingCodes = input<readonly string[]>([]);

  readonly saved = output<{ index: number | null; testCase: WorkflowTestCase }>();

  protected readonly editingIndex = signal<number | null>(null);
  protected readonly code = signal('');
  protected readonly startState = signal('');
  protected readonly expectedState = signal('');
  protected readonly actions = signal<WorkflowAction[]>([]);
  protected readonly actionToAdd = signal<WorkflowAction>(WORKFLOW_ACTIONS[0]);
  protected readonly submitted = signal(false);

  protected readonly maxActions = MAX_ACTIONS;

  private readonly isOpen = signal(false);
  private readonly initialSnapshot = signal('');
  private allowClose = false;
  private reopening = false;

  protected readonly modalTitle = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.editingIndex() === null ? 'workflows.tests.modal.createTitle' : 'workflows.tests.modal.editTitle',
    );
  });

  protected readonly startStateOptions = computed<DropdownOption<string>[]>(() => {
    const base = this.states();
    const current = this.startState();
    const list = current && !base.includes(current) ? [current, ...base] : [...base];
    return list.map((state) => ({ value: state, label: state }));
  });

  protected readonly expectedStateOptions = computed<DropdownOption<string>[]>(() => {
    const base = this.states();
    const current = this.expectedState();
    const list = current && !base.includes(current) ? [current, ...base] : [...base];
    return list.map((state) => ({ value: state, label: state }));
  });

  protected readonly actionOptions = computed<DropdownOption<WorkflowAction>[]>(() => {
    this.i18n();
    return WORKFLOW_ACTIONS.map((action) => ({
      value: action,
      label: this.transloco.translate(`workflows.actions.${action}`),
    }));
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    const trimmed = this.code().trim();
    if (!RULE_CODE.test(trimmed)) {
      return this.transloco.translate('workflows.tests.modal.codeError');
    }
    const editingIdx = this.editingIndex();
    const duplicate = this.existingCodes().some((c, i) => i !== editingIdx && c.trim() === trimmed);
    if (duplicate) {
      return this.transloco.translate('workflows.tests.modal.codeDuplicate');
    }
    return null;
  });

  protected readonly startStateError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (!this.startState().trim()) {
      return this.transloco.translate('workflows.tests.modal.startStateError');
    }
    return null;
  });

  protected readonly expectedStateError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (!this.expectedState().trim()) {
      return this.transloco.translate('workflows.tests.modal.expectedStateError');
    }
    return null;
  });

  protected readonly actionsError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (this.actions().length > MAX_ACTIONS) {
      return this.transloco.translate('workflows.tests.modal.actionsMaxError');
    }
    return null;
  });

  protected readonly dirty = computed(() => {
    if (!this.isOpen()) return false;
    return this.snapshotCurrent() !== this.initialSnapshot();
  });

  openCreate(): void {
    const all = this.states();
    const init = this.initialState();
    const defaultStart = init && all.includes(init) ? init : (all[0] ?? '');
    const defaultExpected = all.find((s) => s !== defaultStart) ?? defaultStart;

    this.editingIndex.set(null);
    this.code.set('');
    this.startState.set(defaultStart);
    this.expectedState.set(defaultExpected);
    this.actions.set([]);
    this.actionToAdd.set(WORKFLOW_ACTIONS[0]);
    this.submitted.set(false);
    this.initialSnapshot.set(this.snapshotCurrent());
    this.allowClose = false;
    this.isOpen.set(true);
    this.modal().open();
  }

  openEdit(index: number, testCase: WorkflowTestCase): void {
    this.editingIndex.set(index);
    this.code.set(testCase.code);
    this.startState.set(testCase.startState);
    this.expectedState.set(testCase.expectedState);
    this.actions.set([...(testCase.actions ?? [])]);
    this.actionToAdd.set(WORKFLOW_ACTIONS[0]);
    this.submitted.set(false);
    this.initialSnapshot.set(this.snapshotCurrent());
    this.allowClose = false;
    this.isOpen.set(true);
    this.modal().open();
  }

  protected actionChipClasses(action: WorkflowAction): string {
    if (action === 'APPROVE') return 'bg-success-soft text-on-success-soft';
    if (action === 'REJECT') return 'bg-danger-soft text-on-danger-soft';
    return 'bg-neutral-soft text-on-neutral-soft';
  }

  protected onCodeInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      const pos = inputEl.selectionStart;
      inputEl.value = upper;
      if (pos !== null) inputEl.setSelectionRange(pos, pos);
    }
    this.code.set(upper);
  }

  protected addAction(): void {
    if (this.actions().length >= MAX_ACTIONS) return;
    const next = this.actionToAdd();
    this.actions.update((list) => [...list, next]);
  }

  protected moveAction(index: number, delta: -1 | 1): void {
    const target = index + delta;
    const list = this.actions();
    if (target < 0 || target >= list.length) return;
    const copy = [...list];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    this.actions.set(copy);
  }

  protected removeAction(index: number): void {
    this.actions.update((list) => list.filter((_, i) => i !== index));
  }

  protected save(): void {
    this.submitted.set(true);
    if (
      this.codeError() ||
      this.startStateError() ||
      this.expectedStateError() ||
      this.actionsError()
    ) {
      return;
    }

    const testCase: WorkflowTestCase = {
      code: this.code().trim(),
      startState: this.startState().trim(),
      actions: [...this.actions()],
      expectedState: this.expectedState().trim(),
    };

    this.allowClose = true;
    this.isOpen.set(false);
    this.saved.emit({ index: this.editingIndex(), testCase });
    this.modal().close();
  }

  protected async requestClose(): Promise<void> {
    if (!this.dirty()) {
      this.allowClose = true;
      this.isOpen.set(false);
      this.modal().close();
      return;
    }
    const ok = await this.discardDialog().open();
    if (ok) {
      this.allowClose = true;
      this.isOpen.set(false);
      this.modal().close();
    }
  }

  protected onModalClosed(): void {
    if (this.reopening) return;
    if (this.allowClose) {
      this.allowClose = false;
      this.isOpen.set(false);
      return;
    }
    if (this.dirty()) {
      void this.confirmDiscardAfterClose();
    } else {
      this.isOpen.set(false);
    }
  }

  private async confirmDiscardAfterClose(): Promise<void> {
    const ok = await this.discardDialog().open();
    if (ok) {
      this.isOpen.set(false);
      return;
    }
    this.reopening = true;
    this.modal().open();
    queueMicrotask(() => {
      this.reopening = false;
    });
  }

  private snapshotCurrent(): string {
    return JSON.stringify({
      code: this.code(),
      startState: this.startState(),
      expectedState: this.expectedState(),
      actions: this.actions(),
    });
  }
}

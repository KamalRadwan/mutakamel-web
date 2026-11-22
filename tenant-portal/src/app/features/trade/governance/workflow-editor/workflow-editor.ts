import { Component, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowBackUp,
  tablerCircleCheck,
  tablerCircleOff,
  tablerCircleX,
  tablerEdit,
  tablerFlag3,
  tablerLock,
  tablerPlus,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Switch } from '../../../../shared/ui/switch/switch';
import type { WorkflowContent, WorkflowTransition } from '../policy.model';
import {
  PURCHASE_ORDER_WORKFLOW_SHAPE,
  RULE_CODE,
  WORKFLOW_ACTIONS,
  type WorkflowAction,
} from '../policy.registry';

const MIN_STATES = 2;
const MAX_STATES = 50;
const MIN_TRANSITIONS = 1;
const MAX_TRANSITIONS = 200;

export function findUnreachableStates(content: WorkflowContent): string[] {
  const states = content.states ?? [];
  if (states.length === 0) return [];
  const stateSet = new Set(states);
  if (!stateSet.has(content.initialState)) {
    return [...states];
  }
  const visited = new Set<string>([content.initialState]);
  const queue: string[] = [content.initialState];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const tr of content.transitions ?? []) {
      if (tr.from === current && stateSet.has(tr.to) && !visited.has(tr.to)) {
        visited.add(tr.to);
        queue.push(tr.to);
      }
    }
  }
  return states.filter((s) => !visited.has(s));
}

export function matchesPurchaseOrderShape(content: WorkflowContent): boolean {
  const states = content.states ?? [];
  const terminals = content.terminalStates ?? [];
  const transitions = content.transitions ?? [];

  if (content.initialState !== PURCHASE_ORDER_WORKFLOW_SHAPE.initialState) {
    return false;
  }

  const expectedStates = new Set(PURCHASE_ORDER_WORKFLOW_SHAPE.states);
  const actualStates = new Set(states);
  if (states.length !== expectedStates.size || actualStates.size !== expectedStates.size) {
    return false;
  }
  for (const s of expectedStates) {
    if (!actualStates.has(s)) return false;
  }

  const expectedTerminals = new Set(PURCHASE_ORDER_WORKFLOW_SHAPE.terminalStates);
  const actualTerminals = new Set(terminals);
  if (terminals.length !== expectedTerminals.size || actualTerminals.size !== expectedTerminals.size) {
    return false;
  }
  for (const s of expectedTerminals) {
    if (!actualTerminals.has(s)) return false;
  }

  if (transitions.length !== PURCHASE_ORDER_WORKFLOW_SHAPE.transitions.length) {
    return false;
  }
  const expectedTriples = new Set(
    PURCHASE_ORDER_WORKFLOW_SHAPE.transitions.map((t) => `${t.from}::${t.action}::${t.to}`),
  );
  const actualTriples = new Set(transitions.map((t) => `${t.from}::${t.action}::${t.to}`));
  if (actualTriples.size !== expectedTriples.size) {
    return false;
  }
  for (const key of expectedTriples) {
    if (!actualTriples.has(key)) return false;
  }

  return true;
}

export function validateWorkflowContentClient(content: WorkflowContent): Record<string, string> {
  const errors: Record<string, string> = {};
  const states = content.states ?? [];
  const terminalStates = content.terminalStates ?? [];
  const transitions = content.transitions ?? [];

  if (states.length < MIN_STATES) {
    errors['states'] = 'workflows.editor.validation.minStates';
  } else if (states.length > MAX_STATES) {
    errors['states'] = 'workflows.editor.validation.maxStates';
  }

  const stateSet = new Set<string>();
  for (const s of states) {
    if (!RULE_CODE.test(s) || stateSet.has(s)) {
      errors['states'] = 'workflows.editor.validation.stateCodeInvalid';
      break;
    }
    stateSet.add(s);
  }

  const terminalSet = new Set(terminalStates);
  if (terminalSet.size === 0 || terminalStates.some((s) => !stateSet.has(s))) {
    errors['terminalStates'] = 'workflows.editor.validation.needTerminal';
  }

  if (!stateSet.has(content.initialState) || terminalSet.has(content.initialState)) {
    errors['initialState'] = 'workflows.editor.validation.invalidInitial';
  }

  if (transitions.length < MIN_TRANSITIONS) {
    errors['transitions'] = 'workflows.editor.validation.minTransitions';
  } else if (transitions.length > MAX_TRANSITIONS) {
    errors['transitions'] = 'workflows.editor.validation.maxTransitions';
  }

  const codeCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  for (const tr of transitions) {
    const code = tr.code.trim();
    if (code) {
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }
    if (tr.from && tr.action) {
      const pairKey = `${tr.from}::${tr.action}`;
      pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
    }
  }

  transitions.forEach((tr, i) => {
    const code = tr.code.trim();
    if (!RULE_CODE.test(code)) {
      errors[`transitions[${i}].code`] = 'workflows.editor.validation.transitionCodeInvalid';
    } else if ((codeCounts.get(code) ?? 0) > 1) {
      errors[`transitions[${i}].code`] = 'workflows.editor.validation.transitionCodeDuplicate';
    }

    if (!stateSet.has(tr.from) || terminalSet.has(tr.from)) {
      errors[`transitions[${i}].from`] = 'workflows.editor.validation.fromInvalid';
    }

    if (!stateSet.has(tr.to)) {
      errors[`transitions[${i}].to`] = 'workflows.editor.validation.toInvalid';
    }

    if (!WORKFLOW_ACTIONS.includes(tr.action)) {
      errors[`transitions[${i}].action`] = 'workflows.editor.validation.actionInvalid';
    } else if ((pairCounts.get(`${tr.from}::${tr.action}`) ?? 0) > 1) {
      errors[`transitions[${i}].action`] = 'workflows.editor.validation.duplicateFromAction';
    }
  });

  if (findUnreachableStates(content).length > 0 && !errors['states']) {
    errors['states.unreachable'] = 'workflows.editor.unreachableCaption';
  }

  return errors;
}

let nextWorkflowEditorId = 0;

@Component({
  selector: 'app-workflow-editor',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Switch,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerArrowBackUp,
      tablerCircleCheck,
      tablerCircleOff,
      tablerCircleX,
      tablerEdit,
      tablerFlag3,
      tablerLock,
      tablerPlus,
      tablerTrash,
    }),
  ],
  templateUrl: './workflow-editor.html',
  host: { class: 'flex flex-col gap-10 min-w-0' },
})
export class WorkflowEditor {
  protected readonly uid = `workflow-editor-${++nextWorkflowEditorId}`;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly renameModal = viewChild<Modal>('renameModal');
  private readonly standardShapeConfirm = viewChild<ConfirmDialog>('standardShapeConfirm');

  readonly content = model.required<WorkflowContent>();
  readonly readonly = input(false);
  readonly kind = input('');
  readonly readonlyNotice = input<string | null>(null);
  readonly diagnostics = input<Readonly<Record<string, string>>>({});
  readonly showErrors = input(false);

  protected readonly newStateInput = signal('');
  protected readonly addStateSubmitted = signal(false);

  protected readonly renameTarget = signal<string | null>(null);
  protected readonly renameValue = signal('');
  protected readonly renameSubmitted = signal(false);

  protected readonly maxStates = MAX_STATES;
  protected readonly maxTransitions = MAX_TRANSITIONS;

  protected readonly terminalSet = computed(() => new Set(this.content().terminalStates ?? []));

  protected readonly nonTerminalStates = computed(() => {
    const terms = this.terminalSet();
    return (this.content().states ?? []).filter((s) => !terms.has(s));
  });

  protected readonly unreachableStates = computed(() => findUnreachableStates(this.content()));
  protected readonly unreachableSet = computed(() => new Set(this.unreachableStates()));

  protected readonly poShapeMatches = computed(
    () => this.kind() === 'PURCHASE_ORDER' && matchesPurchaseOrderShape(this.content()),
  );

  protected readonly clientErrors = computed(() => validateWorkflowContentClient(this.content()));

  protected readonly addStateError = computed<string | null>(() => {
    this.i18n();
    const raw = this.newStateInput().trim();
    if (!this.addStateSubmitted() && !raw) return null;
    if (this.content().states.length >= MAX_STATES && this.addStateSubmitted()) {
      return this.transloco.translate('workflows.editor.validation.maxStates');
    }
    if (!this.addStateSubmitted()) return null;
    if (!RULE_CODE.test(raw)) {
      return this.transloco.translate('workflows.editor.validation.stateCodeInvalid');
    }
    if (this.content().states.includes(raw)) {
      return this.transloco.translate('workflows.editor.validation.stateDuplicate');
    }
    return null;
  });

  protected readonly renameError = computed<string | null>(() => {
    this.i18n();
    if (!this.renameSubmitted()) return null;
    const raw = this.renameValue().trim();
    const target = this.renameTarget();
    if (!RULE_CODE.test(raw)) {
      return this.transloco.translate('workflows.editor.validation.stateCodeInvalid');
    }
    if (raw !== target && this.content().states.includes(raw)) {
      return this.transloco.translate('workflows.editor.validation.stateDuplicate');
    }
    return null;
  });

  protected readonly statesLevelError = computed<string | null>(() => {
    this.i18n();
    const diag = this.diagnostics();
    if (diag['states']) return diag['states'];
    if (diag['terminalStates']) return diag['terminalStates'];
    if (diag['initialState']) return diag['initialState'];
    if (!this.showErrors()) return null;
    const client = this.clientErrors();
    const key = client['states'] ?? client['terminalStates'] ?? client['initialState'];
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly transitionsLevelError = computed<string | null>(() => {
    this.i18n();
    const diag = this.diagnostics();
    if (diag['transitions']) return diag['transitions'];
    if (!this.showErrors()) return null;
    const key = this.clientErrors()['transitions'];
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly fromStateOptions = computed<DropdownOption<string>[]>(() =>
    this.nonTerminalStates().map((state) => ({ value: state, label: state })),
  );

  protected readonly allStateOptions = computed<DropdownOption<string>[]>(() =>
    (this.content().states ?? []).map((state) => ({ value: state, label: state })),
  );

  protected readonly actionOptions = computed<DropdownOption<WorkflowAction>[]>(() => {
    this.i18n();
    return WORKFLOW_ACTIONS.map((action) => ({
      value: action,
      label: this.transloco.translate(`workflows.actions.${action}`),
    }));
  });

  protected readonly duplicatePairs = computed<ReadonlySet<string>>(() => {
    const counts = new Map<string, number>();
    for (const tr of this.content().transitions ?? []) {
      if (tr.from && tr.action) {
        const key = `${tr.from}::${tr.action}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const dups = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) dups.add(key);
    }
    return dups;
  });

  protected readonly transitionGridColumns = computed(() =>
    this.readonly()
      ? 'grid-cols-trade-workflow-transition-row'
      : 'grid-cols-trade-workflow-transition-row-actions',
  );

  protected terminalIconFor(state: string): string {
    const upper = state.toUpperCase();
    if (
      upper.includes('REJECT') ||
      upper.includes('CANCEL') ||
      upper.includes('FAIL') ||
      upper.includes('DENY') ||
      upper.includes('EXPIRE')
    ) {
      return 'tablerCircleX';
    }
    if (upper.includes('WITHDRAW') || upper.includes('RETURN') || upper.includes('REVERT')) {
      return 'tablerArrowBackUp';
    }
    return 'tablerCircleCheck';
  }

  protected actionBadgeClasses(action: WorkflowAction): string {
    if (action === 'APPROVE') return 'bg-success text-on-success';
    if (action === 'REJECT') return 'bg-danger text-on-danger';
    return 'bg-neutral-soft text-on-neutral-soft';
  }

  protected stateChipClasses(state: string): string {
    if (this.unreachableSet().has(state)) {
      return 'border border-danger-border bg-danger-soft text-on-danger-soft';
    }
    if (state === this.content().initialState) {
      return 'bg-brand-soft text-on-brand-soft';
    }
    return 'bg-neutral-soft text-on-neutral-soft';
  }

  protected stateActionsFor(state: string): ActionItem[] {
    this.i18n();
    const c = this.content();
    const isStart = c.initialState === state;
    const isEnd = this.terminalSet().has(state);
    const hasOutgoing = c.transitions.some((tr) => tr.from === state);
    const usedInTransitions = c.transitions.some((tr) => tr.from === state || tr.to === state);

    let makeStartDisabled = false;
    let makeStartReason: string | undefined;
    if (isStart) {
      makeStartDisabled = true;
      makeStartReason = this.transloco.translate('workflows.editor.stateDisabled.alreadyStart');
    } else if (isEnd && c.terminalStates.length <= 1) {
      makeStartDisabled = true;
      makeStartReason = this.transloco.translate('workflows.editor.stateDisabled.cannotStartOnlyEnd');
    }

    let toggleEndDisabled = false;
    let toggleEndReason: string | undefined;
    if (isEnd) {
      if (c.terminalStates.length <= 1) {
        toggleEndDisabled = true;
        toggleEndReason = this.transloco.translate('workflows.editor.stateDisabled.minEndsRequired');
      }
    } else {
      if (isStart) {
        toggleEndDisabled = true;
        toggleEndReason = this.transloco.translate('workflows.editor.stateDisabled.cannotEndStart');
      } else if (hasOutgoing) {
        toggleEndDisabled = true;
        toggleEndReason = this.transloco.translate('workflows.editor.stateDisabled.hasOutgoingTransitions');
      }
    }

    let removeDisabled = false;
    let removeReason: string | undefined;
    if (usedInTransitions) {
      removeDisabled = true;
      removeReason = this.transloco.translate('workflows.editor.stateDisabled.stateUsedByTransitions');
    } else if (c.states.length <= MIN_STATES) {
      removeDisabled = true;
      removeReason = this.transloco.translate('workflows.editor.stateDisabled.minStatesRequired');
    } else if (isStart) {
      removeDisabled = true;
      removeReason = this.transloco.translate('workflows.editor.stateDisabled.cannotRemoveStart');
    } else if (isEnd && c.terminalStates.length <= 1) {
      removeDisabled = true;
      removeReason = this.transloco.translate('workflows.editor.stateDisabled.cannotRemoveOnlyEnd');
    }

    return [
      {
        id: 'makeStart',
        title: this.transloco.translate('workflows.editor.stateMenu.makeStart'),
        icon: 'tablerFlag3',
        tile: 'bg-icon-blue',
        disabled: makeStartDisabled,
        reason: makeStartReason,
      },
      {
        id: isEnd ? 'unmarkEnd' : 'markEnd',
        title: this.transloco.translate(
          isEnd ? 'workflows.editor.stateMenu.unmarkEnd' : 'workflows.editor.stateMenu.markEnd',
        ),
        icon: isEnd ? 'tablerCircleOff' : 'tablerCircleCheck',
        tile: 'bg-icon-teal',
        disabled: toggleEndDisabled,
        reason: toggleEndReason,
      },
      {
        id: 'rename',
        title: this.transloco.translate('workflows.editor.stateMenu.rename'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'remove',
        title: this.transloco.translate('workflows.editor.stateMenu.remove'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        disabled: removeDisabled,
        reason: removeReason,
      },
    ];
  }

  protected onStateMenuAction(state: string, selection: ActionSelection): void {
    if (this.readonly()) return;
    if (selection.id === 'makeStart') {
      this.content.update((c) => ({
        ...c,
        initialState: state,
        terminalStates: c.terminalStates.filter((s) => s !== state),
      }));
    } else if (selection.id === 'markEnd') {
      this.content.update((c) => ({
        ...c,
        terminalStates: c.terminalStates.includes(state)
          ? c.terminalStates
          : [...c.terminalStates, state],
      }));
    } else if (selection.id === 'unmarkEnd') {
      this.content.update((c) => ({
        ...c,
        terminalStates: c.terminalStates.filter((s) => s !== state),
      }));
    } else if (selection.id === 'rename') {
      this.openRenameModal(state);
    } else if (selection.id === 'remove') {
      this.removeState(state);
    }
  }

  protected onNewStateInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      const pos = inputEl.selectionStart;
      inputEl.value = upper;
      if (pos !== null) inputEl.setSelectionRange(pos, pos);
    }
    this.newStateInput.set(upper);
    if (this.addStateSubmitted()) {
      this.addStateSubmitted.set(false);
    }
  }

  protected addState(): void {
    if (this.readonly()) return;
    this.addStateSubmitted.set(true);
    const code = this.newStateInput().trim();
    const c = this.content();
    if (c.states.length >= MAX_STATES || !RULE_CODE.test(code) || c.states.includes(code)) {
      return;
    }
    this.content.update((prev) => ({
      ...prev,
      states: [...prev.states, code],
    }));
    this.newStateInput.set('');
    this.addStateSubmitted.set(false);
  }

  protected onRenameInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      const pos = inputEl.selectionStart;
      inputEl.value = upper;
      if (pos !== null) inputEl.setSelectionRange(pos, pos);
    }
    this.renameValue.set(upper);
  }

  protected confirmRename(): void {
    const oldCode = this.renameTarget();
    if (!oldCode) return;
    this.renameSubmitted.set(true);
    if (this.renameError()) return;

    const nextCode = this.renameValue().trim();
    if (nextCode === oldCode) {
      this.renameModal()?.close();
      return;
    }

    this.content.update((c) => ({
      ...c,
      states: c.states.map((s) => (s === oldCode ? nextCode : s)),
      initialState: c.initialState === oldCode ? nextCode : c.initialState,
      terminalStates: c.terminalStates.map((s) => (s === oldCode ? nextCode : s)),
      transitions: c.transitions.map((tr) => ({
        ...tr,
        from: tr.from === oldCode ? nextCode : tr.from,
        to: tr.to === oldCode ? nextCode : tr.to,
      })),
    }));
    this.renameTarget.set(null);
    this.renameModal()?.close();
  }

  protected closeRenameModal(): void {
    this.renameTarget.set(null);
    this.renameModal()?.close();
  }

  protected fromOptionsForRow(currentFrom: string): DropdownOption<string>[] {
    const base = this.fromStateOptions();
    if (currentFrom && !base.some((o) => o.value === currentFrom)) {
      return [{ value: currentFrom, label: currentFrom }, ...base];
    }
    return base;
  }

  protected toOptionsForRow(currentTo: string): DropdownOption<string>[] {
    const base = this.allStateOptions();
    if (currentTo && !base.some((o) => o.value === currentTo)) {
      return [{ value: currentTo, label: currentTo }, ...base];
    }
    return base;
  }

  protected fieldError(path: string, idx?: number, tr?: WorkflowTransition): string | null {
    this.i18n();
    const diag = this.diagnostics();
    if (diag[path]) return diag[path];

    if (idx !== undefined && tr && path === `transitions[${idx}].action`) {
      if (tr.from && tr.action && this.duplicatePairs().has(`${tr.from}::${tr.action}`)) {
        return this.transloco.translate('workflows.editor.validation.duplicateFromAction');
      }
    }

    if (!this.showErrors()) return null;
    const key = this.clientErrors()[path];
    return key ? this.transloco.translate(key) : null;
  }

  protected onTransitionCodeInput(idx: number, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      const pos = inputEl.selectionStart;
      inputEl.value = upper;
      if (pos !== null) inputEl.setSelectionRange(pos, pos);
    }
    this.patchTransition(idx, { code: upper });
  }

  protected onTransitionFromChange(idx: number, from: string): void {
    this.patchTransition(idx, { from });
  }

  protected onTransitionActionChange(idx: number, action: WorkflowAction): void {
    this.patchTransition(idx, { action });
  }

  protected onTransitionToChange(idx: number, to: string): void {
    this.patchTransition(idx, { to });
  }

  protected onTransitionApprovalChange(idx: number, requiresApproval: boolean): void {
    this.patchTransition(idx, { requiresApproval });
  }

  protected addTransition(): void {
    if (this.readonly()) return;
    const c = this.content();
    if (c.transitions.length >= MAX_TRANSITIONS) return;

    const from = this.nonTerminalStates()[0] ?? c.initialState ?? c.states[0] ?? '';
    const to = c.terminalStates[0] ?? c.states.find((s) => s !== from) ?? c.states[0] ?? '';
    const usedActions = new Set(c.transitions.filter((t) => t.from === from).map((t) => t.action));
    const action = WORKFLOW_ACTIONS.find((a) => !usedActions.has(a)) ?? WORKFLOW_ACTIONS[0];

    const usedCodes = new Set(c.transitions.map((t) => t.code));
    let seq = c.transitions.length + 1;
    let code = `TRANSITION_${seq}`;
    while (usedCodes.has(code)) {
      seq += 1;
      code = `TRANSITION_${seq}`;
    }

    const nextTransition: WorkflowTransition = {
      code,
      from,
      to,
      action,
      requiresApproval: false,
    };

    this.content.update((prev) => ({
      ...prev,
      transitions: [...prev.transitions, nextTransition],
    }));
  }

  protected removeTransition(idx: number): void {
    if (this.readonly() || this.content().transitions.length <= MIN_TRANSITIONS) return;
    this.content.update((prev) => ({
      ...prev,
      transitions: prev.transitions.filter((_, i) => i !== idx),
    }));
  }

  protected async requestStandardShape(): Promise<void> {
    if (this.readonly()) return;
    const confirmed = await this.standardShapeConfirm()?.open();
    if (!confirmed) return;
    this.content.set({
      states: [...PURCHASE_ORDER_WORKFLOW_SHAPE.states],
      initialState: PURCHASE_ORDER_WORKFLOW_SHAPE.initialState,
      terminalStates: [...PURCHASE_ORDER_WORKFLOW_SHAPE.terminalStates],
      transitions: PURCHASE_ORDER_WORKFLOW_SHAPE.transitions.map((t) => ({ ...t })),
    });
  }

  private openRenameModal(state: string): void {
    this.renameTarget.set(state);
    this.renameValue.set(state);
    this.renameSubmitted.set(false);
    this.renameModal()?.open();
  }

  private removeState(state: string): void {
    const c = this.content();
    if (c.states.length <= MIN_STATES) return;
    if (c.initialState === state) return;
    if (c.transitions.some((tr) => tr.from === state || tr.to === state)) return;
    const isEnd = this.terminalSet().has(state);
    if (isEnd && c.terminalStates.length <= 1) return;

    this.content.update((prev) => ({
      ...prev,
      states: prev.states.filter((s) => s !== state),
      terminalStates: prev.terminalStates.filter((s) => s !== state),
    }));
  }

  private patchTransition(idx: number, patch: Partial<WorkflowTransition>): void {
    this.content.update((prev) => ({
      ...prev,
      transitions: prev.transitions.map((tr, i) => (i === idx ? { ...tr, ...patch } : tr)),
    }));
  }
}

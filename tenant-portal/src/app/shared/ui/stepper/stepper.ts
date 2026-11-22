import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerExclamationMark } from '@ng-icons/tabler-icons';

export type StepState = 'todo' | 'current' | 'done' | 'error';

export interface StepItem {
  id: string;
  label: string;
  state: StepState;
}

export type StepStateLabels = Record<'done' | 'error' | 'current', string>;

const CIRCLE_CLASSES: Record<StepState, string> = {
  todo: 'border border-border-field bg-surface text-text-muted',
  current: 'bg-brand text-on-brand',
  done: 'bg-success text-on-success',
  error: 'bg-danger text-on-danger',
};

@Component({
  selector: 'ui-stepper',
  imports: [NgIcon],
  providers: [provideIcons({ tablerCheck, tablerExclamationMark })],
  templateUrl: './stepper.html',
  host: { class: 'block min-w-0' },
})
export class Stepper {
  readonly steps = input.required<readonly StepItem[]>();
  readonly clickable = input(false);
  readonly label = input('');
  readonly stateLabels = input<StepStateLabels>({ done: '', error: '', current: '' });

  readonly stepSelected = output<string>();

  protected circleClass(state: StepState): string {
    return CIRCLE_CLASSES[state];
  }

  protected labelClass(state: StepState, interactive: boolean): string {
    if (state === 'current') return 'font-medium text-text';
    if (state === 'error') return 'text-danger-text';
    return interactive ? 'text-text-muted group-hover:text-text' : 'text-text-muted';
  }

  protected stateText(state: StepState): string {
    if (state === 'todo') return '';
    return this.stateLabels()[state] ?? '';
  }

  protected connectorActive(index: number): boolean {
    const items = this.steps();
    return items[index]?.state === 'done' || items[index + 1]?.state === 'done';
  }

  protected select(step: StepItem): void {
    if (this.clickable()) {
      this.stepSelected.emit(step.id);
    }
  }
}

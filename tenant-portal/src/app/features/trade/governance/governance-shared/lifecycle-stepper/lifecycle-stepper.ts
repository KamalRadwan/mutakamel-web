import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import {
  Stepper,
  type StepItem,
  type StepState,
  type StepStateLabels,
} from '../../../../../shared/ui/stepper/stepper';

export interface LifecycleStep {
  key: string;
  label: string;
}

const DEFAULT_STATE_LABELS: StepStateLabels = {
  done: '',
  error: '',
  current: '',
};

@Component({
  selector: 'app-lifecycle-stepper',
  imports: [Stepper],
  templateUrl: './lifecycle-stepper.html',
  host: { class: 'block min-w-0' },
})
export class LifecycleStepper {
  private readonly transloco = inject(TranslocoService);
  private readonly translatedStateLabels = toSignal(
    this.transloco.selectTranslateObject<StepStateLabels>('governance.stepper'),
    { initialValue: DEFAULT_STATE_LABELS },
  );

  readonly steps = input.required<readonly LifecycleStep[]>();
  readonly current = input.required<string>();
  readonly failedKey = input<string | null>(null);
  readonly label = input('');

  protected readonly stateLabels = computed<StepStateLabels>(
    () => this.translatedStateLabels() ?? DEFAULT_STATE_LABELS,
  );

  protected readonly stepItems = computed<StepItem[]>(() => {
    const list = this.steps();
    const failed = this.failedKey();
    const failedIndex = failed ? list.findIndex((s) => s.key === failed) : -1;
    const currentIndex = list.findIndex((s) => s.key === this.current());
    const activeIndex = failedIndex >= 0 ? failedIndex : currentIndex;

    return list.map((step, index) => {
      let state: StepState = 'todo';
      if (activeIndex >= 0) {
        if (index < activeIndex) {
          state = 'done';
        } else if (index === activeIndex) {
          state = failedIndex >= 0 ? 'error' : 'current';
        }
      }
      return {
        id: step.key,
        label: step.label,
        state,
      };
    });
  });
}

import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerDeviceFloppy, tablerRefresh } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { Button } from '../../../../../shared/ui/button/button';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Stepper, type StepItem, type StepStateLabels } from '../../../../../shared/ui/stepper/stepper';
import { BuilderPreview } from './builder-preview/builder-preview';
import { validateStepWithZod } from './builder-schemas';
import { BuilderState, STEP_ORDER, type ConflictChoice, type StepId } from './builder-state';
import { StepCompare } from './step-compare/step-compare';
import { StepData } from './step-data/step-data';
import { StepMetrics } from './step-metrics/step-metrics';
import { StepPresentation } from './step-presentation/step-presentation';
import { StepReview } from './step-review/step-review';
import { StepScope } from './step-scope/step-scope';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';
import { UsageTab } from '../widget-page/usage-tab/usage-tab';
import { RequestModal } from '../../access/request-modal/request-modal';

const FOCUSABLE_SELECTOR =
  'input:not([disabled]):not([readonly]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]';

@Component({
  selector: 'app-widget-builder',
  imports: [
    TranslocoPipe,
    NgIcon,
    Button,
    Stepper,
    ConflictDialog,
    FullState,
    BuilderPreview,
    StepData,
    StepMetrics,
    StepScope,
    StepCompare,
    StepPresentation,
    StepReview,
    UsageTab,
    RequestModal,
  ],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder', alias: 'builder' },
      { scope: 'crm-widget-page', alias: 'widgetPage' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  providers: [
    BuilderState,
    provideIcons({ tablerDeviceFloppy, tablerRefresh }),
  ],
  templateUrl: './widget-builder.html',
  host: { class: 'flex min-h-0 min-w-0 flex-1 flex-col gap-8' },
})
export class WidgetBuilder {
  protected readonly state = inject(BuilderState);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly i18n = translationEvents(this.transloco);
  private readonly builderScope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder', 'builder'));

  private readonly formPane = viewChild<ElementRef<HTMLElement>>('formPane');
  private readonly requestModal = viewChild(RequestModal);

  readonly widgetId = input<string | null>(null);
  readonly saved = output<string>();
  readonly published = output<void>();
  readonly dirty = this.state.dirty;
  readonly draftName = computed(() => this.state.draft().name);

  protected readonly skeletonLines = [0, 1, 2, 3] as const;
  protected readonly conflictOpen = signal(false);
  private conflictSettle: ((choice: ConflictChoice) => void) | null = null;

  protected readonly canSave = this.state.canSave;
  protected readonly canOpenReadiness = computed(() => can('crm.analytics.readiness.view'));

  protected readonly isFirstStep = computed(() => this.state.step() === STEP_ORDER[0]);

  protected readonly stepperClickable = computed(
    () => this.state.isEditing() || this.state.visited().size > 1,
  );

  protected readonly stepStateLabels = computed<StepStateLabels>(() => {
    this.i18n();
    this.builderScope();
    return {
      done: this.transloco.translate('builder.stepState.done'),
      error: this.transloco.translate('builder.stepState.error'),
      current: this.transloco.translate('builder.stepState.current'),
    };
  });

  protected readonly stepItems = computed<readonly StepItem[]>(() => {
    this.i18n();
    this.builderScope();
    const current = this.state.step();
    const errors = this.state.errors();
    const visited = this.state.visited();
    const draft = this.state.draft();
    const catalog = this.state.catalog();

    return STEP_ORDER.map((id) => {
      const stepErrors = errors[id];
      const hasError = Boolean(stepErrors && Object.keys(stepErrors).length > 0);
      let stepState: StepItem['state'] = 'todo';

      if (id === current) {
        stepState = 'current';
      } else if (hasError) {
        stepState = 'error';
      } else if (visited.has(id) && validateStepWithZod(id, draft, catalog).length === 0) {
        stepState = 'done';
      }

      return {
        id,
        label: this.transloco.translate(`builder.steps.${id}`),
        state: stepState,
      };
    });
  });

  protected readonly fullStateTitle = computed(() => {
    this.i18n();
    this.builderScope();
    switch (this.state.loadError()) {
      case 'not-found':
        return this.transloco.translate('builder.loadError.notFoundTitle');
      case 'forbidden':
        return this.transloco.translate('builder.loadError.forbiddenTitle');
      case 'provisioning':
        return this.transloco.translate('builder.loadError.provisioningTitle');
      default:
        return this.transloco.translate('builder.loadError.failedTitle');
    }
  });

  protected readonly fullStateText = computed(() => {
    this.i18n();
    this.builderScope();
    const failure = this.state.readFailure();
    if (failure) return failure.message + (failure.correlationId
      ? ' ' + this.transloco.translate('builder.requests.correlation', { id: failure.correlationId }) : '');
    switch (this.state.loadError()) {
      case 'not-found':
        return this.transloco.translate('builder.loadError.notFoundText');
      case 'forbidden':
        return this.transloco.translate('builder.loadError.forbiddenText');
      default:
        return this.transloco.translate('builder.loadError.failedText');
    }
  });

  constructor() {
    this.state.registerConflictResolver(() => this.askConflict());
    this.state.registerOnCreated((id) => this.saved.emit(id));
    this.state.registerOnPublished(() => this.published.emit());
    inject(DestroyRef).onDestroy(() => this.settleConflict('dismiss'));

    effect(() => {
      const id = this.widgetId();
      if (id !== null && id === this.state.widgetId() && this.state.draftState() !== null) {
        return;
      }
      void this.state.load(id);
    });
  }

  /** Re-reads server revisions after share, transfer or archive, keeping unsaved edits. */
  refreshRevisions(): Promise<void> {
    return this.state.refreshRevisions();
  }

  protected onConflictChoice(choice: 'reload' | 'keep'): void {
    this.settleConflict(choice);
  }

  protected onConflictOpenChange(open: boolean): void {
    this.conflictOpen.set(open);
    // Esc or any other way of closing the dialog is a dismissal, never "keep mine".
    if (!open) this.settleConflict('dismiss');
  }

  private askConflict(): Promise<ConflictChoice> {
    this.settleConflict('dismiss');
    this.conflictOpen.set(true);
    return new Promise<ConflictChoice>((resolve) => {
      this.conflictSettle = resolve;
    });
  }

  private settleConflict(choice: ConflictChoice): void {
    const settle = this.conflictSettle;
    this.conflictSettle = null;
    settle?.(choice);
  }

  async save(): Promise<boolean> {
    const firstInvalid = this.state.validateAll();
    if (firstInvalid) {
      this.state.goToStep(firstInvalid.step);
      this.focusFirstInvalid(firstInvalid.field);
      return false;
    }
    const ok = await this.state.saveDraft();
    if (!ok) {
      const serverStep = this.state.lastServerErrorStep();
      if (serverStep) {
        const errField = Object.keys(this.state.errors()[serverStep] ?? {})[0];
        this.focusFirstInvalid(errField);
      }
    }
    return ok;
  }

  protected onStepSelect(id: string): void {
    const stepId = id as StepId;
    if (!STEP_ORDER.includes(stepId)) return;
    if (!this.state.isEditing() && !this.state.visited().has(stepId)) return;
    this.state.goToStep(stepId);
  }

  protected onNext(): void {
    const current = this.state.step();
    const ok = this.state.validateStep(current);
    if (!ok) {
      const firstField = Object.keys(this.state.errors()[current] ?? {})[0];
      this.focusFirstInvalid(firstField);
      return;
    }
    const idx = STEP_ORDER.indexOf(current);
    const nextStep = STEP_ORDER[idx + 1];
    if (nextStep) {
      this.state.goToStep(nextStep);
    }
  }

  protected onPrevious(): void {
    const idx = STEP_ORDER.indexOf(this.state.step());
    const prevStep = STEP_ORDER[idx - 1];
    if (prevStep) {
      this.state.goToStep(prevStep);
    }
  }

  protected async onSaveDraft(): Promise<void> {
    const firstInvalid = this.state.validateUpTo(this.state.step());
    if (firstInvalid) {
      this.state.goToStep(firstInvalid.step);
      this.focusFirstInvalid(firstInvalid.field);
      return;
    }
    const ok = await this.state.saveDraft();
    if (!ok) {
      const serverStep = this.state.lastServerErrorStep();
      if (serverStep) {
        const errField = Object.keys(this.state.errors()[serverStep] ?? {})[0];
        this.focusFirstInvalid(errField);
      }
    }
  }

  protected retryLoad(): void {
    if (this.state.loadError() === 'provisioning' && this.canOpenReadiness()) {
      void this.router.navigateByUrl('/crm/settings/data-readiness');
      return;
    }
    if (this.state.readFailure()?.requestAccess && this.widgetId()) {
      this.requestModal()?.open('WIDGET', this.widgetId()!);
      return;
    }
    void this.state.reload();
  }

  private focusFirstInvalid(fieldPath?: string): void {
    afterNextRender(
      () => {
        const pane = this.formPane()?.nativeElement;
        if (!pane) return;

        if (fieldPath) {
          const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(fieldPath) : fieldPath;
          const wrapper = pane.querySelector<HTMLElement>(`[data-field="${escaped}"]`);
          const target = wrapper?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          if (target) {
            target.focus();
            return;
          }
        }

        const fallback = pane.querySelector<HTMLElement>(
          `[aria-invalid="true"], .border-danger-border ${FOCUSABLE_SELECTOR}`,
        );
        fallback?.focus();
      },
      { injector: this.injector },
    );
  }
}

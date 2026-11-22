import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerLayoutDashboard,
  tablerPlus,
  tablerTarget,
  tablerTemplate,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { formatMoneyNumber } from '../../../../../shared/ui/money/money-format';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_BRANCHES } from '../../../../../shared/widgets/dashboard/fake/fake-org';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { adoptBlueprint, createDashboard, listBlueprints } from '../dashboards.api';
import type { BlueprintItem } from '../dashboards.model';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

interface StartOption {
  key: string | null;
  name: string;
  widgetCount: number;
  blueprint: BlueprintItem | null;
}

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

@Component({
  selector: 'app-create-dashboard-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal, Dropdown],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-library', alias: 'dashLibrary' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerPlus, tablerLayoutDashboard, tablerTemplate, tablerTarget }),
  ],
  templateUrl: './create-dashboard-modal.html',
  host: { class: 'contents' },
})
export class CreateDashboardModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly libraryScope = toSignal(selectScopeTranslation(this.transloco, 'crm-dash-library', 'dashLibrary'));
  protected readonly language = inject(LanguageState).current;

  private readonly createModal = viewChild.required<Modal>('createModal');
  private readonly targetsModal = viewChild.required<Modal>('targetsModal');
  private readonly sourceTiles = viewChildren<ElementRef<HTMLButtonElement>>('sourceTile');

  readonly lastCreatedKind = signal<'blank' | 'blueprint' | null>(null);

  private createResolver: ((id: string | null) => void) | null = null;
  private targetsResolver: ((confirmed: boolean) => void) | null = null;
  private loadSeq = 0;

  protected readonly nameMax = NAME_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly selectedSource = signal<string | null>(null);
  protected readonly selectedBranchId = signal<string>(FAKE_BRANCHES[0]?.id ?? '');
  protected readonly blueprints = signal<BlueprintItem[]>([]);
  protected readonly loadingBlueprints = signal(false);
  protected readonly submitting = signal(false);

  protected readonly nameError = signal<string | null>(null);
  protected readonly descriptionError = signal<string | null>(null);
  protected readonly sourceError = signal<string | null>(null);
  protected readonly pendingTargetsBlueprint = signal<BlueprintItem | null>(null);

  protected readonly startOptions = computed<StartOption[]>(() => {
    this.i18n();
    this.libraryScope();
    const lang = this.language();
    const blank: StartOption = {
      key: null,
      name: this.transloco.translate('dashLibrary.createModal.blank'),
      widgetCount: 0,
      blueprint: null,
    };
    const available = this.blueprints()
      .filter((bp) => bp.adoption.state !== 'ADOPTED')
      .map<StartOption>((bp) => ({
        key: bp.key,
        name: lang === 'ar' ? (bp.nameAr ?? bp.name) : bp.name,
        widgetCount: bp.widgetCount,
        blueprint: bp,
      }));
    return [blank, ...available];
  });

  protected readonly selectedBlueprint = computed<BlueprintItem | null>(() => {
    const key = this.selectedSource();
    if (!key) return null;
    return this.blueprints().find((bp) => bp.key === key) ?? null;
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return FAKE_BRANCHES.map((branch) => ({
      value: branch.id,
      label: lang === 'ar' ? branch.name.ar : branch.name.en,
    }));
  });

  protected readonly sourceDescribedBy = computed(() =>
    this.sourceError() ? 'create-dash-source-hint create-dash-source-error' : 'create-dash-source-hint',
  );

  protected readonly canSubmit = computed(() => {
    const trimmedName = this.name().trim();
    const descLen = this.description().trim().length;
    return trimmedName.length >= 1 && trimmedName.length <= NAME_MAX && descLen <= DESCRIPTION_MAX;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.settleTargets(false);
      this.settleCreate(null);
    });
  }

  open(): Promise<string | null> {
    this.settleTargets(false);
    this.settleCreate(null);
    this.resetForm();
    this.createModal().open();
    void this.loadBlueprints();
    return new Promise<string | null>((resolve) => {
      this.createResolver = resolve;
    });
  }

  protected onNameInput(value: string): void {
    this.name.set(value);
    this.nameError.set(null);
  }

  protected onDescriptionInput(value: string): void {
    this.description.set(value);
    this.descriptionError.set(null);
  }

  protected selectSource(key: string | null): void {
    this.selectedSource.set(key);
    this.sourceError.set(null);
  }

  protected onSourceKeydown(event: KeyboardEvent, index: number): void {
    const options = this.startOptions();
    if (options.length === 0) return;

    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex = -1;
    if (event.key === nextKey || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % options.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = options.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextOption = options[targetIndex];
    if (!nextOption) return;
    this.selectSource(nextOption.key);
    this.sourceTiles()[targetIndex]?.nativeElement.focus();
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.settleCreate(null);
    this.createModal().close();
  }

  protected onCreateModalClosed(): void {
    this.loadSeq++;
    this.settleTargets(false);
    this.settleCreate(null);
  }

  protected confirmTargetsAction(): void {
    this.settleTargets(true);
    this.targetsModal().close();
  }

  protected cancelTargetsAction(): void {
    this.settleTargets(false);
    this.targetsModal().close();
  }

  protected onTargetsModalClosed(): void {
    this.settleTargets(false);
  }

  /** Blueprint targets are JSON numbers (`comparison.target`); shown with the money display rule. */
  protected formatTargetValue(value: number): string {
    return formatMoneyNumber(String(value)) ?? String(value);
  }

  protected async submit(): Promise<void> {
    if (this.submitting() || !this.validateForm()) return;

    const trimmedName = this.name().trim();
    const trimmedDesc = this.description().trim();
    const bp = this.selectedBlueprint();

    if (!bp) {
      this.submitting.set(true);
      try {
        const created = await createDashboard(
          { name: trimmedName, description: trimmedDesc || null },
          newIdempotencyKey(),
        );
        this.lastCreatedKind.set('blank');
        this.notify.success(this.transloco.translate('dashLibrary.toast.created'));
        this.settleCreate(created.id);
        this.createModal().close();
      } catch (error) {
        this.handleSubmitError(error);
      } finally {
        this.submitting.set(false);
      }
      return;
    }

    if (bp.targets.length > 0) {
      const confirmed = await this.requestTargetConfirmation(bp);
      if (!confirmed) return;
    }

    this.submitting.set(true);
    try {
      const result = await adoptBlueprint(
        bp.key,
        {
          definitionRevision: bp.definitionRevision,
          name: trimmedName,
          ...(bp.branchSelectionRequired ? { branchId: this.selectedBranchId() } : {}),
          ...(bp.targets.length > 0 ? { confirmTargets: true as const } : {}),
        },
        newIdempotencyKey(),
      );
      this.lastCreatedKind.set('blueprint');
      this.notify.success(this.transloco.translate('dashLibrary.toast.adopted'));
      this.settleCreate(result.dashboardId);
      this.createModal().close();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'CRM_DASHBOARD_BLUEPRINT_REVISION_CHANGED') {
        void this.loadBlueprints();
      }
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private validateForm(): boolean {
    const trimmedName = this.name().trim();
    let valid = true;

    if (!trimmedName) {
      this.nameError.set(this.transloco.translate('dashLibrary.createModal.nameRequired'));
      valid = false;
    } else if (trimmedName.length > NAME_MAX) {
      this.nameError.set(this.transloco.translate('dashLibrary.createModal.nameTooLong'));
      valid = false;
    } else {
      this.nameError.set(null);
    }

    if (this.description().trim().length > DESCRIPTION_MAX) {
      this.descriptionError.set(this.transloco.translate('dashLibrary.createModal.descriptionTooLong'));
      valid = false;
    } else {
      this.descriptionError.set(null);
    }

    return valid;
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    if (error instanceof ApiError) {
      if (error.status === 409 || code === 'CRM_DASHBOARD_NAME_CONFLICT') {
        this.nameError.set(this.translateError(code));
        return;
      }
      if (error.status === 400 && error.details) {
        if (this.applyBadRequestDetails(error.details)) {
          return;
        }
      }
    }
    this.notify.error(this.translateError(code));
  }

  private applyBadRequestDetails(details: Record<string, unknown>): boolean {
    let applied = false;
    const rawFields = details['fields'];
    const fields =
      rawFields && typeof rawFields === 'object' ? (rawFields as Record<string, unknown>) : null;

    const nameMsg = readFieldDetail(details['name']) ?? readFieldDetail(fields?.['name']);
    if (nameMsg) {
      this.nameError.set(nameMsg);
      applied = true;
    }

    const descMsg = readFieldDetail(details['description']) ?? readFieldDetail(fields?.['description']);
    if (descMsg) {
      this.descriptionError.set(descMsg);
      applied = true;
    }

    const fieldName = details['field'];
    const msg = readFieldDetail(details['message']);
    if (!applied && typeof fieldName === 'string' && msg) {
      if (fieldName === 'name') {
        this.nameError.set(msg);
        applied = true;
      } else if (fieldName === 'description') {
        this.descriptionError.set(msg);
        applied = true;
      }
    }

    return applied;
  }

  private requestTargetConfirmation(blueprint: BlueprintItem): Promise<boolean> {
    this.settleTargets(false);
    this.pendingTargetsBlueprint.set(blueprint);
    this.targetsModal().open();
    return new Promise<boolean>((resolve) => {
      this.targetsResolver = resolve;
    });
  }

  private async loadBlueprints(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loadingBlueprints.set(true);
    try {
      const res = await listBlueprints();
      if (seq !== this.loadSeq) return;
      this.blueprints.set(res.items);
      const selected = this.selectedSource();
      if (
        selected !== null &&
        !res.items.some((bp) => bp.key === selected && bp.adoption.state !== 'ADOPTED')
      ) {
        this.selectedSource.set(null);
      }
    } catch {
      if (seq !== this.loadSeq) return;
      this.blueprints.set([]);
    } finally {
      if (seq === this.loadSeq) {
        this.loadingBlueprints.set(false);
      }
    }
  }

  private resetForm(): void {
    this.name.set('');
    this.description.set('');
    this.selectedSource.set(null);
    this.selectedBranchId.set(FAKE_BRANCHES[0]?.id ?? '');
    this.nameError.set(null);
    this.descriptionError.set(null);
    this.sourceError.set(null);
    this.submitting.set(false);
    this.pendingTargetsBlueprint.set(null);
  }

  private settleCreate(id: string | null): void {
    const resolve = this.createResolver;
    this.createResolver = null;
    resolve?.(id);
  }

  private settleTargets(confirmed: boolean): void {
    const resolve = this.targetsResolver;
    this.targetsResolver = null;
    this.pendingTargetsBlueprint.set(null);
    resolve?.(confirmed);
  }

  private isRtl(): boolean {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }

  private translateError(code: string | null): string {
    return this.transloco.translate(errorKey(code));
  }
}

function readFieldDetail(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0];
  return null;
}

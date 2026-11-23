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
  tablerAlertTriangle,
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
import { ApiError, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { OrgApi, type OrgBranch } from '../../../../../shared/widgets/dashboard/org.api';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { RouterLink } from '@angular/router';
import { libraryFailure, libraryWriteIntent, keepLibraryWriteIntent, type LibraryWriteIntent } from '../dashboards-page/library-write';
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
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal, Dropdown, FullState, ConflictDialog, RouterLink],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-library', alias: 'dashLibrary' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerPlus, tablerLayoutDashboard, tablerTemplate, tablerTarget, tablerAlertTriangle }),
  ],
  templateUrl: './create-dashboard-modal.html',
  host: { class: 'contents' },
})
export class CreateDashboardModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(TenantScopeState);
  private readonly org = inject(OrgApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly libraryScope = toSignal(selectScopeTranslation(this.transloco, 'crm-dash-library', 'dashLibrary'));
  protected readonly language = inject(LanguageState).current;

  private readonly createModal = viewChild.required<Modal>('createModal');
  private readonly targetsModal = viewChild.required<Modal>('targetsModal');
  private readonly ownerLimitModal = viewChild.required<Modal>('ownerLimitModal');
  private readonly sourceTiles = viewChildren<ElementRef<HTMLButtonElement>>('sourceTile');

  readonly lastCreatedKind = signal<'blank' | 'blueprint' | null>(null);

  private createResolver: ((id: string | null) => void) | null = null;
  private targetsResolver: ((confirmed: boolean) => void) | null = null;
  private loadSeq = 0;
  private pendingWrite: LibraryWriteIntent | null = null;
  protected readonly canCreate = can('crm.dashboards.create');
  protected readonly canUseTemplates = this.canCreate && can('crm.widgets.create');
  protected readonly canViewReadiness = can('crm.analytics.readiness.view');
  protected readonly readOnly = signal(false);
  protected readonly reloadRequired = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly branches = signal<readonly OrgBranch[]>([]);
  protected readonly branchError = signal<string | null>(null);
  protected readonly blueprintsFailure = signal<ReturnType<typeof libraryFailure> | null>(null);
  protected readonly ownerLimitMessage = signal('');

  protected readonly nameMax = NAME_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly selectedSource = signal<string | null>(null);
  protected readonly selectedBranchId = signal<string>('');
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
    const available = (this.canUseTemplates ? this.blueprints() : [])
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
    this.i18n();
    this.libraryScope();
    const lang = this.language();
    const options = this.branches().map((branch) => ({
      value: branch.id,
      label: lang === 'ar' ? branch.name.ar : branch.name.en,
    }));
    const current = this.scope.selection()?.branchId;
    if (current && !options.some((option) => option.value === current)) {
      options.unshift({ value: current, label: this.transloco.translate('dashLibrary.currentBranch') });
    }
    return options;
  });

  protected readonly sourceDescribedBy = computed(() =>
    this.sourceError() ? 'create-dash-source-hint create-dash-source-error' : 'create-dash-source-hint',
  );

  protected readonly canSubmit = computed(() => {
    const trimmedName = this.name().trim();
    const descLen = this.selectedBlueprint() ? 0 : this.description().trim().length;
    return this.canCreate && !this.readOnly() && !this.reloadRequired() && !this.conflictOpen()
      && trimmedName.length >= 1 && trimmedName.length <= NAME_MAX && descLen <= DESCRIPTION_MAX
      && (!this.selectedSource() || this.selectedBlueprint() !== null && this.selectedBlueprint()?.adoption.state !== 'ADOPTED')
      && (!this.selectedBlueprint()?.branchSelectionRequired || this.branchOptions().some((b) => b.value === this.selectedBranchId()));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.loadSeq++;
      this.settleTargets(false);
      this.settleCreate(null);
    });
  }

  open(): Promise<string | null> {
    this.settleTargets(false);
    this.settleCreate(null);
    if (!this.canCreate) return Promise.resolve(null);
    this.resetForm();
    this.createModal().open();
    void this.loadBlueprints();
    void this.loadBranches();
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
    if (this.submitting() || this.readOnly() || key && !this.canUseTemplates) return;
    this.selectedSource.set(key);
    this.sourceError.set(null);
    this.branchError.set(null);
    this.descriptionError.set(null);
  }

  protected onBranchChange(value: string): void {
    this.selectedBranchId.set(value);
    this.branchError.set(null);
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
    if (this.submitting() || this.pendingTargetsBlueprint() || !this.canSubmit() || !this.validateForm()) return;
    const bp = this.selectedBlueprint();
    if (bp?.targets.length && !await this.requestTargetConfirmation(bp)) return;

    const adoptionBody = bp ? {
      definitionRevision: bp.definitionRevision,
      name: this.name().trim(),
      ...(bp.branchSelectionRequired ? { branchId: this.selectedBranchId() } : {}),
      ...(bp.targets.length ? { confirmTargets: true as const } : {}),
    } : null;
    const createBody = { name: this.name().trim(), description: this.description().trim() || null };
    this.pendingWrite = libraryWriteIntent({ blueprintKey: bp?.key ?? null, body: adoptionBody ?? createBody }, this.pendingWrite);
    this.submitting.set(true);
    try {
      const result = bp && adoptionBody
        ? await adoptBlueprint(bp.key, adoptionBody, this.pendingWrite.key)
        : await createDashboard(createBody, this.pendingWrite.key);
      this.pendingWrite = null;
      this.lastCreatedKind.set(bp ? 'blueprint' : 'blank');
      this.notify.success(this.transloco.translate(bp ? 'dashLibrary.toast.adopted' : 'dashLibrary.toast.created'));
      this.settleCreate('dashboardId' in result ? result.dashboardId : result.id);
      this.createModal().close();
    } catch (error) {
      if (!keepLibraryWriteIntent(error)) this.pendingWrite = null;
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async reloadAfterConflict(keepChanges: boolean): Promise<void> {
    this.conflictOpen.set(false);
    if (!keepChanges) this.resetForm();
    this.pendingWrite = null;
    await this.loadBlueprints();
  }

  protected async reloadPicker(): Promise<void> {
    const reset = this.reloadRequired();
    await this.loadBlueprints();
    await this.loadBranches();
    if (this.blueprintsFailure()) return;
    if (reset) this.resetForm();
    this.reloadRequired.set(false);
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

    if (!this.selectedBlueprint() && this.description().trim().length > DESCRIPTION_MAX) {
      this.descriptionError.set(this.transloco.translate('dashLibrary.createModal.descriptionTooLong'));
      valid = false;
    } else {
      this.descriptionError.set(null);
    }

    return valid;
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    const failure = libraryFailure(this.transloco, error, true);
    if (failure.readOnly) this.readOnly.set(true);
    if (failure.reloadRequired) this.reloadRequired.set(true);
    if (code === 'CRM_DASHBOARD_NAME_CONFLICT') {
      this.nameError.set(failure.message);
      return;
    }
    if (code === 'CRM_DASHBOARD_OWNER_LIMIT') {
      this.ownerLimitMessage.set(failure.message);
      this.ownerLimitModal().open();
      return;
    }
    if (code === 'CRM_DASHBOARD_BLUEPRINT_REVISION_CHANGED' || error instanceof ApiError && error.status === 409
      && /_(STALE|CONFLICT)$/.test(error.code)) {
      this.conflictOpen.set(true);
      return;
    }
    if (failure.kind === 'provisioning') {
      this.blueprintsFailure.set(failure);
      return;
    }
    if (isValidationError(error)) {
      const fields = fieldErrorsOf(error);
      this.nameError.set(fields['name']?.[0] ?? null);
      this.descriptionError.set(fields['description']?.[0] ?? null);
      this.branchError.set(fields['branchId']?.[0] ?? null);
      this.sourceError.set(fields['definitionRevision']?.[0] ?? fields['templateKey']?.[0] ?? null);
      if (Object.keys(fields).some((key) => ['name', 'description', 'branchId', 'definitionRevision', 'templateKey'].includes(key))) return;
    }
    if (code === 'CRM_DASHBOARD_BLUEPRINT_BRANCH_REQUIRED') {
      this.branchError.set(this.transloco.translate('dashLibrary.branchRequired'));
      return;
    }
    this.notify.error(failure.message, failure.correlationId ?? '');
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
    if (!this.canUseTemplates) {
      this.loadingBlueprints.set(false);
      return;
    }
    this.loadingBlueprints.set(true);
    this.blueprintsFailure.set(null);
    try {
      const res = await listBlueprints(this.scope.selection()?.branchId ?? undefined);
      if (seq !== this.loadSeq) return;
      this.blueprints.set(res.items);
      const selected = this.selectedSource();
      if (selected !== null && !res.items.some((bp) => bp.key === selected && bp.adoption.state !== 'ADOPTED')) {
        this.sourceError.set(this.transloco.translate('dashLibrary.createModal.sourceUnavailable'));
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.blueprints.set([]);
      this.blueprintsFailure.set(libraryFailure(this.transloco, error));
    } finally {
      if (seq === this.loadSeq) {
        this.loadingBlueprints.set(false);
      }
    }
  }

  private async loadBranches(): Promise<void> {
    const seq = this.loadSeq;
    try {
      const branches = await this.org.listGrantedBranches();
      if (seq !== this.loadSeq) return;
      this.branches.set(branches);
      if (!this.selectedBranchId()) this.selectedBranchId.set(this.branchOptions()[0]?.value ?? '');
    } catch (error) {
      if (seq === this.loadSeq) this.notify.error(libraryFailure(this.transloco, error).message);
    }
  }

  private resetForm(): void {
    this.name.set('');
    this.description.set('');
    this.selectedSource.set(null);
    this.selectedBranchId.set(this.scope.selection()?.branchId ?? '');
    this.lastCreatedKind.set(null);
    this.pendingWrite = null;
    this.readOnly.set(false);
    this.reloadRequired.set(false);
    this.branchError.set(null);
    this.blueprintsFailure.set(null);
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
}

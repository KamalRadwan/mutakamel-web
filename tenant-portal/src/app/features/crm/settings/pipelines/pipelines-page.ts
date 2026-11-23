import { Component, Injector, computed, inject, runInInjectionContext, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCheck,
  tablerEdit,
  tablerEye,
  tablerEyeOff,
  tablerLock,
  tablerStar,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../shared/ui/modal/modal';
import { listOpportunityStages } from '../opportunity-stages/opportunity-stages.api';
import { OpportunityStage } from '../opportunity-stages/opportunity-stages.model';
import { crmSettingsError, errorCodeOf, newIdempotencyKey } from '../shared/settings-api';
import { tenantWide } from '../shared/settings-access';
import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { pipelineErrorTranslator, pipelineWriteMessage } from './pipelines-errors';
import { PipelineModal } from './pipeline-modal/pipeline-modal';
import {
  deletePipeline,
  listPipelinesConfiguration,
  setDefaultPipeline,
  updatePipeline,
} from './pipelines.api';
import { PIPELINE_MAX_COUNT, Pipeline, nameIn } from './pipelines.model';

@Component({
  selector: 'app-pipelines-page',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, ConfirmDialog, Modal, SettingsFrame, PipelineModal, FullState],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-pipelines', alias: 'pipelines' }),
    provideIcons({
      tablerStar,
      tablerLock,
      tablerEye,
      tablerEdit,
      tablerEyeOff,
      tablerCheck,
      tablerTrash,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './pipelines-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class PipelinesPage {
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly translateError = pipelineErrorTranslator(this.transloco);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly pipelineModal = viewChild.required(PipelineModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');
  private readonly inUseModal = viewChild.required<Modal>('inUseModal');

  private readonly injector = inject(Injector);
  private readonly hasAccess = computed(() => runInInjectionContext(this.injector, () => tenantWide('crm.pipelines.manage')));
  protected readonly readOnly = signal(false);
  protected readonly canManage = computed(() => this.hasAccess() && !this.readOnly());
  protected readonly loadError = signal<unknown>(null);
  protected readonly loadState = computed(() => {
    this.i18n();
    return crmSettingsError(this.translateError, this.loadError(), 'pipelines');
  });
  protected readonly maxCount = PIPELINE_MAX_COUNT;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly search = signal('');
  protected readonly pipelines = signal<Pipeline[]>([]);
  protected readonly catalogue = signal<OpportunityStage[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly deletingName = signal('');
  protected readonly inUsePipeline = signal<Pipeline | null>(null);

  private loadSeq = 0;
  private pendingKey: { body: string; key: string } | null = null;

  protected readonly filteredPipelines = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.pipelines();
    if (!term) return list;
    return list.filter(
      (item) =>
        item.nameAr.toLowerCase().includes(term) ||
        item.nameEn.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term),
    );
  });

  protected readonly atLimit = computed(() => this.pipelines().length >= this.maxCount);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    this.loadError.set(null);
    try {
      if (!this.hasAccess()) throw new ApiError(403, 'CRM_PERMISSION_DENIED');
      const [pipelines, stages] = await Promise.all([listPipelinesConfiguration(), listOpportunityStages()]);
      if (seq !== this.loadSeq) return;
      this.pipelines.set(pipelines);
      this.catalogue.set(stages);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
      this.loadError.set(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected primaryName(pipeline: Pipeline): string {
    return nameIn(pipeline, this.language());
  }

  protected secondaryName(pipeline: Pipeline): string {
    return this.language() === 'ar' ? pipeline.nameEn : pipeline.nameAr;
  }

  protected openCreate(): void {
    if (!this.canManage() || this.atLimit()) return;
    this.pipelineModal().openCreate(this.catalogue());
  }

  protected openDetail(pipeline: Pipeline): void {
    void this.router.navigate(['/crm/settings/pipelines', pipeline.id]);
  }

  protected onSaved(): void {
    void this.load();
  }

  protected actionsFor(pipeline: Pipeline): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('pipelines.list.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('pipelines.list.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
    ];

    if (!pipeline.isDefault) {
      const canDefault = pipeline.isActive && pipeline.accessMode === 'ALL';
      const defaultReason = canDefault
        ? undefined
        : this.transloco.translate(
            !pipeline.isActive
              ? 'pipelines.list.actions.makeDefaultInactiveDesc'
              : 'pipelines.list.actions.makeDefaultRestrictedDesc',
          );
      items.push({
        id: 'makeDefault',
        title: this.transloco.translate('pipelines.list.actions.makeDefault'),
        icon: 'tablerStar',
        tile: canDefault ? 'bg-icon-violet' : 'bg-icon-gray',
        disabled: !canDefault,
        reason: defaultReason,
      });

      items.push({
        id: 'toggleActive',
        title: this.transloco.translate(
          pipeline.isActive ? 'pipelines.list.actions.deactivate' : 'pipelines.list.actions.activate',
        ),
        icon: pipeline.isActive ? 'tablerEyeOff' : 'tablerCheck',
        tile: pipeline.isActive ? 'bg-icon-gray' : 'bg-icon-green',
      });

      items.push({
        id: 'delete',
        title: this.transloco.translate('pipelines.list.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  }

  protected act(pipeline: Pipeline, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openDetail(pipeline);
        break;
      case 'edit':
        this.pipelineModal().openEdit(pipeline);
        break;
      case 'makeDefault':
        void this.makeDefault(pipeline);
        break;
      case 'toggleActive':
        void this.toggleActive(pipeline);
        break;
      case 'delete':
        void this.confirmDelete(pipeline);
        break;
    }
  }

  protected async deactivateInUse(): Promise<void> {
    const pipeline = this.inUsePipeline();
    if (!pipeline || this.busy()) return;
    this.inUseModal().close();
    if (!pipeline.isActive) return;
    await this.toggleActive(pipeline);
  }

  protected closeInUseModal(): void {
    this.inUseModal().close();
  }

  private async makeDefault(pipeline: Pipeline): Promise<void> {
    if (!this.canManage() || this.busy() || pipeline.isDefault) return;
    if (!pipeline.isActive) {
      this.notify.warning(this.transloco.translate('pipelines.errors.PIPELINE_DEFAULT_INACTIVE'));
      return;
    }
    if (pipeline.accessMode === 'RESTRICTED') {
      this.notify.warning(this.transloco.translate('pipelines.errors.PIPELINE_DEFAULT_RESTRICTED'));
      return;
    }
    const key = this.idempotencyKeyFor({ action: 'setDefault', id: pipeline.id });
    this.busy.set(true);
    try {
      await setDefaultPipeline(pipeline.id, key);
      this.pendingKey = null;
      this.notify.success(this.transloco.translate('pipelines.toasts.madeDefault'));
      await this.load();
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.busy.set(false);
    }
  }

  private async toggleActive(pipeline: Pipeline): Promise<void> {
    if (!this.canManage() || this.busy() || pipeline.isDefault) return;
    const nextActive = !pipeline.isActive;
    this.busy.set(true);
    try {
      await updatePipeline(pipeline.id, { isActive: nextActive });
      this.notify.success(
        this.transloco.translate(nextActive ? 'pipelines.toasts.activated' : 'pipelines.toasts.deactivated'),
      );
      await this.load();
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmDelete(pipeline: Pipeline): Promise<void> {
    if (!this.canManage() || this.busy() || pipeline.isDefault) return;
    this.deletingName.set(this.primaryName(pipeline));
    if (!(await this.deleteDialog().open())) return;

    this.busy.set(true);
    try {
      await deletePipeline(pipeline.id);
      this.notify.success(this.transloco.translate('pipelines.toasts.deleted'));
      await this.load();
    } catch (error) {
      if (errorCodeOf(error) === 'PIPELINE_IN_USE') {
        this.inUsePipeline.set(pipeline);
        this.inUseModal().open();
        return;
      }
      this.showErrorToast(error);
    } finally {
      this.busy.set(false);
    }
  }

  private idempotencyKeyFor(payload: unknown): string {
    const body = JSON.stringify(payload);
    if (this.pendingKey?.body === body) return this.pendingKey.key;
    const key = newIdempotencyKey();
    this.pendingKey = { body, key };
    return key;
  }

  private showErrorToast(error: unknown): void {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pendingKey = null;
    const state = crmSettingsError(this.translateError, error, 'pipelines');
    if (state.readOnly) this.readOnly.set(true);
    this.notify.error(pipelineWriteMessage(error, this.translateError));
    if (error instanceof ApiError && error.status === 404) void this.load();
  }
}

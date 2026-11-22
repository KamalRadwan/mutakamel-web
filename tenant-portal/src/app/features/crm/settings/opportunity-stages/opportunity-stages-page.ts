import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCheck,
  tablerEyeOff,
  tablerLink,
  tablerLock,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../shared/ui/modal/modal';
import { errorCodeOf } from '../shared/settings-api';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { OpportunityStageModal } from './opportunity-stage-modal/opportunity-stage-modal';
import {
  deleteOpportunityStage,
  listOpportunityStages,
  stageUsage,
  updateOpportunityStage,
} from './opportunity-stages.api';
import { OpportunityStage, OpportunityStageFlag, StageCategory, StageUsagePipeline } from './opportunity-stages.model';

const CAN_MANAGE = true; // later from the session permissions
const MAX_STAGES = 500;
const SKELETON_ROWS = [1, 2, 3, 4, 5];

const CATEGORY_BADGE: Record<StageCategory, string> = {
  OPEN: 'bg-brand-soft text-on-brand-soft',
  IN_PROGRESS: 'bg-neutral-soft text-on-neutral-soft',
  POSITIVE: 'bg-success-soft text-on-success-soft',
  NEGATIVE: 'bg-danger-soft text-on-danger-soft',
};

const CANONICAL_SYSTEM_FLAG_ORDER: Partial<Record<OpportunityStageFlag, number>> = {
  NEW: 0,
  QUALIFICATION: 1,
  PROPOSAL: 2,
  NEGOTIATION: 3,
  WON: 4,
  LOST: 5,
};

@Component({
  selector: 'app-opportunity-stages-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Modal,
    SettingsFrame,
    SettingsNotice,
    OpportunityStageModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-opportunity-stages', alias: 'opportunityStages' }),
    provideIcons({
      tablerAlertTriangle,
      tablerCheck,
      tablerEyeOff,
      tablerLink,
      tablerLock,
      tablerTrash,
    }),
  ],
  templateUrl: './opportunity-stages-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col p-12' },
})
export class OpportunityStagesPage {
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly stageModal = viewChild.required(OpportunityStageModal);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly inUseModal = viewChild.required<Modal>('inUseModal');

  protected readonly canManage = CAN_MANAGE;
  protected readonly maxStages = MAX_STAGES;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly gridColumnsClass = CAN_MANAGE
    ? 'grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_var(--table-head-h)]'
    : 'grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.5fr)]';

  protected readonly search = signal('');
  protected readonly stages = signal<OpportunityStage[]>([]);
  protected readonly usage = signal<Record<string, StageUsagePipeline[]>>({});
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly deletingStage = signal<OpportunityStage | null>(null);
  protected readonly inUsePipelines = signal<StageUsagePipeline[]>([]);

  private loadSeq = 0;

  protected readonly atLimit = computed(() => this.stages().length >= MAX_STAGES);

  protected readonly sortedStages = computed(() => {
    const lang = this.language();
    return this.stages()
      .slice()
      .sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        if (a.isSystem) {
          const rankA = CANONICAL_SYSTEM_FLAG_ORDER[a.flag] ?? 99;
          const rankB = CANONICAL_SYSTEM_FLAG_ORDER[b.flag] ?? 99;
          if (rankA !== rankB) return rankA - rankB;
        }
        const nameA = lang === 'ar' ? a.nameAr : a.nameEn;
        const nameB = lang === 'ar' ? b.nameAr : b.nameEn;
        return nameA.localeCompare(nameB, lang, { sensitivity: 'base' });
      });
  });

  protected readonly filteredStages = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = this.sortedStages();
    if (!query) return list;
    return list.filter(
      (stage) => stage.nameAr.toLowerCase().includes(query) || stage.nameEn.toLowerCase().includes(query),
    );
  });

  protected readonly deletingName = computed(() => {
    const stage = this.deletingStage();
    if (!stage) return '';
    return this.language() === 'ar' ? stage.nameAr : stage.nameEn;
  });

  protected readonly inUsePipelineNames = computed(() => {
    const lang = this.language();
    const sep = lang === 'ar' ? '، ' : ', ';
    return this.inUsePipelines()
      .map((pipeline) => (lang === 'ar' ? pipeline.nameAr : pipeline.nameEn))
      .join(sep);
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [stages, usage] = await Promise.all([listOpportunityStages(), stageUsage()]);
      if (seq !== this.loadSeq) return;
      this.stages.set(stages);
      this.usage.set(usage);
    } catch {
      if (seq === this.loadSeq) {
        this.failed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected pipelinesFor(stageId: string): StageUsagePipeline[] {
    return this.usage()[stageId] ?? [];
  }

  protected usedInText(stage: OpportunityStage): string {
    const lang = this.language();
    const sep = lang === 'ar' ? '، ' : ', ';
    return this.pipelinesFor(stage.id)
      .map((pipeline) => (lang === 'ar' ? pipeline.nameAr : pipeline.nameEn))
      .join(sep);
  }

  protected categoryClass(category: StageCategory): string {
    return CATEGORY_BADGE[category];
  }

  protected openCreate(): void {
    if (!this.canManage || this.atLimit()) return;
    this.stageModal().openCreate();
  }

  protected openEdit(stage: OpportunityStage): void {
    this.stageModal().openEdit(stage, this.pipelinesFor(stage.id));
  }

  protected onSaved(saved: OpportunityStage): void {
    this.stages.update((current) => {
      const index = current.findIndex((item) => item.id === saved.id);
      if (index < 0) return [...current, saved];
      return current.map((item) => (item.id === saved.id ? saved : item));
    });
  }

  protected async onSaveFailed({ stage, error }: { stage: OpportunityStage; error: unknown }): Promise<void> {
    const code = errorCodeOf(error);
    if (code === 'OPPORTUNITY_STAGE_IN_USE') {
      await this.openInUseWarning(stage.id, error);
      this.stageModal().refreshUsage(this.pipelinesFor(stage.id));
    } else if (code === 'OPPORTUNITY_STAGE_NOT_FOUND') {
      this.stageModal().close();
      this.showErrorToast(error);
      void this.load();
    }
  }

  protected actions(stage: OpportunityStage): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const pipelines = this.pipelinesFor(stage.id);
    const items: ActionItem[] = [
      {
        id: 'open',
        title: t('opportunityStages.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: t('opportunityStages.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
    ];

    if (pipelines.length > 0) {
      items.push({
        id: 'openPipelines',
        title: t('opportunityStages.actions.openPipelines'),
        icon: 'tablerLink',
        tile: 'bg-icon-violet',
      });
    }

    if (stage.isSystem) {
      items.push({
        id: 'toggleActive',
        title: t('opportunityStages.actions.deactivate'),
        icon: 'tablerLock',
        tile: 'bg-icon-gray',
        disabled: true,
        reason: t('opportunityStages.actions.systemLockedDesc'),
      });
    } else if (stage.isActive && pipelines.length > 0) {
      items.push({
        id: 'toggleActive',
        title: t('opportunityStages.actions.deactivate'),
        icon: 'tablerLock',
        tile: 'bg-icon-gray',
        disabled: true,
        reason: t('opportunityStages.actions.usedDeactivateDesc'),
      });
    } else if (stage.isActive) {
      items.push({
        id: 'toggleActive',
        title: t('opportunityStages.actions.deactivate'),
        icon: 'tablerEyeOff',
        tile: 'bg-icon-orange',
      });
    } else {
      items.push({
        id: 'toggleActive',
        title: t('opportunityStages.actions.activate'),
        icon: 'tablerCheck',
        tile: 'bg-icon-green',
      });
    }

    if (!stage.isSystem) {
      items.push(
        pipelines.length > 0
          ? {
              id: 'delete',
              title: t('settings.common.delete'),
              icon: 'tablerTrash',
              tile: 'bg-icon-gray',
              danger: true,
              disabled: true,
              reason: t('opportunityStages.actions.usedDeleteDesc'),
            }
          : {
              id: 'delete',
              title: t('settings.common.delete'),
              icon: 'tablerTrash',
              tile: 'bg-icon-red',
              danger: true,
            },
      );
    }

    return items;
  }

  protected act(stage: OpportunityStage, selection: ActionSelection): void {
    const pipelines = this.pipelinesFor(stage.id);
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(stage);
        break;
      case 'openPipelines':
        if (pipelines.length > 0) {
          void this.router.navigate(['/crm/settings/pipelines', pipelines[0].id]);
        }
        break;
      case 'toggleActive':
        if (stage.isSystem || (stage.isActive && pipelines.length > 0)) return;
        void this.toggleActive(stage);
        break;
      case 'delete':
        if (stage.isSystem || pipelines.length > 0) return;
        void this.confirmDelete(stage);
        break;
    }
  }

  protected async confirmDelete(stage: OpportunityStage): Promise<void> {
    if (!this.canManage || stage.isSystem) return;
    this.deletingStage.set(stage);
    if (!(await this.confirmDialog().open())) return;

    try {
      await deleteOpportunityStage(stage.id);
      this.stages.update((current) => current.filter((item) => item.id !== stage.id));
    } catch (error) {
      if (errorCodeOf(error) === 'OPPORTUNITY_STAGE_IN_USE') {
        await this.openInUseWarning(stage.id, error);
        return;
      }
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'OPPORTUNITY_STAGE_NOT_FOUND') {
        void this.load();
      }
    }
  }

  protected openInUsePipelines(): void {
    const first = this.inUsePipelines()[0];
    this.inUseModal().close();
    if (first) {
      void this.router.navigate(['/crm/settings/pipelines', first.id]);
    } else {
      void this.router.navigate(['/crm/settings/pipelines']);
    }
  }

  private async toggleActive(stage: OpportunityStage): Promise<void> {
    try {
      const updated = await updateOpportunityStage(stage.id, { isActive: !stage.isActive });
      this.onSaved(updated);
    } catch (error) {
      if (errorCodeOf(error) === 'OPPORTUNITY_STAGE_IN_USE') {
        await this.openInUseWarning(stage.id, error);
        return;
      }
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'OPPORTUNITY_STAGE_NOT_FOUND') {
        void this.load();
      }
    }
  }

  /** The 409 OPPORTUNITY_STAGE_IN_USE carries no details, so the pipelines come from a fresh usage read. */
  private async openInUseWarning(stageId: string, _error?: unknown): Promise<void> {
    let pipelines: StageUsagePipeline[] = this.pipelinesFor(stageId);
    try {
      const freshUsage = await stageUsage();
      this.usage.set(freshUsage);
      pipelines = freshUsage[stageId] ?? pipelines;
    } catch {
      // Keep the usage already loaded.
    }
    this.inUsePipelines.set(pipelines);
    this.inUseModal().open();
  }

  private showErrorToast(error: unknown): void {
    const code = errorCodeOf(error);
    const key = code ? `opportunityStages.errors.${code}` : 'settings.errors.generic';
    const message = this.transloco.translate(key);
    this.notify.error(message !== key ? message : this.transloco.translate('settings.errors.generic'));
  }
}

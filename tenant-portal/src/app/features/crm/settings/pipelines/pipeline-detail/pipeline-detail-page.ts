import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router, RouterLink } from '@angular/router';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowDown,
  tablerArrowLeft,
  tablerArrowUp,
  tablerCheck,
  tablerEdit,
  tablerGripVertical,
  tablerLock,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerStar,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { listOpportunityStages } from '../../opportunity-stages/opportunity-stages.api';
import { OpportunityStage, OpportunityStageFlag, StageCategory } from '../../opportunity-stages/opportunity-stages.model';
import { errorCodeOf, newIdempotencyKey } from '../../shared/settings-api';
import { PipelineModal } from '../pipeline-modal/pipeline-modal';
import {
  addPipelineStage,
  assignmentOptions,
  deletePipeline,
  getPipelineConfiguration,
  removePipelineStage,
  reorderPipelineStages,
  replaceAssignments,
  resetPipeline,
  updatePipeline,
} from '../pipelines.api';
import {
  AssignmentTeamOption,
  AssignmentUserOption,
  PIPELINE_SEARCH_MAX,
  Pipeline,
  PipelineAccessMode,
  PipelineStage,
  nameIn,
} from '../pipelines.model';

const CAN_MANAGE = true; // later from the session permissions
const REQUIRED_FLAGS = new Set<OpportunityStageFlag>(['NEW', 'WON', 'LOST']);

const CATEGORY_BADGE: Record<StageCategory, string> = {
  OPEN: 'bg-brand-soft text-on-brand-soft',
  IN_PROGRESS: 'bg-neutral-soft text-on-neutral-soft',
  POSITIVE: 'bg-success-soft text-on-success-soft',
  NEGATIVE: 'bg-danger-soft text-on-danger-soft',
};

interface DraggedStage {
  membershipId: string;
}

function isDraggedStage(data: Record<string | symbol, unknown>): data is Record<string | symbol, unknown> & DraggedStage {
  return typeof data['membershipId'] === 'string';
}

interface DiffGroup {
  added: string[];
  removed: string[];
  unchangedCount: number;
}

@Directive({
  selector: '[stageDrag]',
  host: { '[class.opacity-drag-source]': 'dragging()' },
})
export class StageDrag {
  readonly stageDrag = input.required<string>();
  readonly dragDisabled = input(false);

  protected readonly dragging = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    effect(() => {
      element.draggable = !this.dragDisabled();
    });

    afterNextRender(() => {
      let pressed: Element | null = null;
      const restore = () => {
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        element.draggable = !this.dragDisabled();
      };
      const onPointerDown = (event: PointerEvent) => {
        pressed =
          event.target instanceof Element
            ? event.target
            : event.target instanceof Node
              ? event.target.parentElement
              : null;
        if (!this.dragDisabled() && !pressed?.closest('button, a, [data-no-drag]')) return;
        element.draggable = false;
        document.addEventListener('pointerup', restore, { once: true });
        document.addEventListener('pointercancel', restore, { once: true });
      };
      element.addEventListener('pointerdown', onPointerDown, true);

      const cleanup = draggable({
        element,
        canDrag: () => !this.dragDisabled() && !pressed?.closest('button, a, [data-no-drag]'),
        getInitialData: () => ({ membershipId: this.stageDrag() }),
        onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
          const offset = preserveOffsetOnSource({ element: source.element, input: location.current.input });
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: offset,
            render: ({ container }) => {
              const copy = element.cloneNode(true) as HTMLElement;
              copy.style.width = `${element.offsetWidth}px`;
              copy.classList.add('shadow-drag');
              container.append(copy);
            },
          });
        },
        onDragStart: () => this.dragging.set(true),
        onDrop: () => this.dragging.set(false),
      });

      destroyRef.onDestroy(() => {
        element.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        cleanup();
      });
    });
  }
}

@Directive({
  selector: '[stageDrop]',
  exportAs: 'stageDrop',
})
export class StageDrop {
  readonly stageDrop = input.required<string>();
  readonly dropDisabled = input(false);
  readonly dropped = output<string>();

  readonly over = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const cleanup = dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          !this.dropDisabled() && isDraggedStage(source.data) && source.data.membershipId !== this.stageDrop(),
        getData: () => ({ membershipId: this.stageDrop() }),
        onDragEnter: ({ source }) => {
          if (!this.dropDisabled() && isDraggedStage(source.data) && source.data.membershipId !== this.stageDrop()) {
            this.over.set(true);
          }
        },
        onDragLeave: () => this.over.set(false),
        onDrop: ({ source }) => {
          this.over.set(false);
          if (!this.dropDisabled() && isDraggedStage(source.data) && source.data.membershipId !== this.stageDrop()) {
            this.dropped.emit(source.data.membershipId);
          }
        },
      });
      destroyRef.onDestroy(cleanup);
    });
  }
}

@Component({
  selector: 'app-pipeline-detail-page',
  imports: [
    NgIcon,
    RouterLink,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Segmented,
    PipelineModal,
    StageDrag,
    StageDrop,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-pipelines', alias: 'pipelines' }),
    provideIcons({
      tablerArrowLeft,
      tablerEdit,
      tablerRefresh,
      tablerLock,
      tablerStar,
      tablerGripVertical,
      tablerArrowUp,
      tablerArrowDown,
      tablerTrash,
      tablerPlus,
      tablerAlertTriangle,
      tablerSearch,
      tablerCheck,
      tablerX,
    }),
  ],
  templateUrl: './pipeline-detail-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-10 p-12' },
})
export class PipelineDetailPage {
  private static nextId = 0;
  protected readonly uid = `pipeline-detail-${++PipelineDetailPage.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly pipelineModal = viewChild.required(PipelineModal);
  private readonly resetDialog = viewChild.required<ConfirmDialog>('resetDialog');
  private readonly deletePipelineDialog = viewChild.required<ConfirmDialog>('deletePipelineDialog');
  private readonly removeStageDialog = viewChild.required<ConfirmDialog>('removeStageDialog');
  private readonly stageInUseModal = viewChild.required<Modal>('stageInUseModal');
  private readonly resetBlockedModal = viewChild.required<Modal>('resetBlockedModal');
  private readonly pipelineInUseModal = viewChild.required<Modal>('pipelineInUseModal');
  private readonly assignConfirmModal = viewChild.required<Modal>('assignConfirmModal');

  readonly id = input.required<string>();

  protected readonly canManage = CAN_MANAGE;
  protected readonly searchMax = PIPELINE_SEARCH_MAX;

  protected readonly pipeline = signal<Pipeline | null>(null);
  protected readonly catalogue = signal<OpportunityStage[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly failed = signal(false);

  protected readonly stageBusy = signal(false);
  protected readonly resetting = signal(false);
  protected readonly deletingPipeline = signal(false);
  protected readonly selectedAddStageId = signal('');
  protected readonly removingStageName = signal('');

  protected readonly accessSearch = signal('');
  protected readonly userOptions = signal<AssignmentUserOption[]>([]);
  protected readonly teamOptions = signal<AssignmentTeamOption[]>([]);
  protected readonly searchingAccess = signal(false);
  protected readonly savingAssignments = signal(false);

  protected readonly draftAccessMode = signal<PipelineAccessMode>('ALL');
  protected readonly draftUserIds = signal<string[]>([]);
  protected readonly draftTeamIds = signal<string[]>([]);

  private readonly knownUsers = signal<Map<string, AssignmentUserOption>>(new Map());
  private readonly knownTeams = signal<Map<string, AssignmentTeamOption>>(new Map());

  private loadSeq = 0;
  private optionsSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingKey: { body: string; key: string } | null = null;

  protected readonly availableStages = computed<OpportunityStage[]>(() => {
    const current = this.pipeline();
    const attached = new Set(current?.stages.map((item) => item.opportunityStageId) ?? []);
    return this.catalogue().filter((stage) => stage.isActive && !attached.has(stage.id));
  });

  protected readonly existingRequiredFlags = computed<Set<OpportunityStageFlag>>(() => {
    const flags = new Set<OpportunityStageFlag>();
    for (const stage of this.pipeline()?.stages ?? []) {
      if (REQUIRED_FLAGS.has(stage.flag)) flags.add(stage.flag);
    }
    return flags;
  });

  protected readonly addStageOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const usedFlags = this.existingRequiredFlags();
    const items = this.availableStages().map((stage) => {
      const base = nameIn(stage, lang);
      if (usedFlags.has(stage.flag)) {
        const flagLabel = this.transloco.translate(`pipelines.flags.${stage.flag}`);
        return {
          value: stage.id,
          label: `${base} (${this.transloco.translate('pipelines.detail.alreadyHasFlag', { flag: flagLabel })})`,
          disabled: true,
        };
      }
      return { value: stage.id, label: base, disabled: false };
    });
    return [{ value: '', label: this.transloco.translate('pipelines.detail.addStagePlaceholder') }, ...items];
  });

  protected readonly accessOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const isDefault = this.pipeline()?.isDefault ?? false;
    return [
      { value: 'ALL', label: this.transloco.translate('pipelines.access.ALL'), disabled: !this.canManage },
      {
        value: 'RESTRICTED',
        label: this.transloco.translate('pipelines.access.RESTRICTED'),
        disabled: !this.canManage || isDefault,
      },
    ];
  });

  protected readonly selectedUsers = computed<AssignmentUserOption[]>(() => {
    const map = this.knownUsers();
    return this.draftUserIds().map((userId) => map.get(userId) ?? { id: userId, label: userId, status: 'ACTIVE' });
  });

  protected readonly selectedTeams = computed<AssignmentTeamOption[]>(() => {
    const map = this.knownTeams();
    return this.draftTeamIds().map(
      (teamId) => map.get(teamId) ?? { id: teamId, label: teamId, code: teamId, status: 'ACTIVE' },
    );
  });

  protected readonly restrictedWithoutTargets = computed(
    () =>
      this.draftAccessMode() === 'RESTRICTED' &&
      this.draftUserIds().length === 0 &&
      this.draftTeamIds().length === 0,
  );

  protected readonly assignmentsDirty = computed(() => {
    const current = this.pipeline();
    if (!current) return false;
    if (this.draftAccessMode() !== current.assignments.accessMode) return true;
    if (this.draftAccessMode() === 'ALL') return false;
    return (
      !sameIdSet(this.draftUserIds(), current.assignments.userIds) ||
      !sameIdSet(this.draftTeamIds(), current.assignments.teamIds)
    );
  });

  protected readonly userDiff = computed<DiffGroup>(() => {
    const current = this.pipeline();
    if (!current) return { added: [], removed: [], unchangedCount: 0 };
    const nextIds = this.draftAccessMode() === 'ALL' ? [] : this.draftUserIds();
    const map = this.knownUsers();
    return computeDiff(current.assignments.userIds, nextIds, (id) => map.get(id)?.label ?? id);
  });

  protected readonly teamDiff = computed<DiffGroup>(() => {
    const current = this.pipeline();
    if (!current) return { added: [], removed: [], unchangedCount: 0 };
    const nextIds = this.draftAccessMode() === 'ALL' ? [] : this.draftTeamIds();
    const map = this.knownTeams();
    return computeDiff(current.assignments.teamIds, nextIds, (id) => {
      const team = map.get(id);
      return team ? `${team.label} (${team.code})` : id;
    });
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
    effect(() => {
      const pipelineId = this.id();
      if (pipelineId) {
        untracked(() => {
          void this.load(pipelineId);
        });
      }
    });
  }

  protected async load(pipelineId = this.id()): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.notFound.set(false);
    this.failed.set(false);

    try {
      const [pipeline, stages, options] = await Promise.all([
        getPipelineConfiguration(pipelineId),
        listOpportunityStages(),
        assignmentOptions(this.accessSearch()),
      ]);
      if (seq !== this.loadSeq) return;
      this.pipeline.set(pipeline);
      this.catalogue.set(stages);
      this.applyAssignmentOptions(options);
      this.syncDraftAssignments(pipeline);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (errorCodeOf(error) === 'PIPELINE_NOT_FOUND') {
        this.pipeline.set(null);
        this.notFound.set(true);
      } else {
        this.failed.set(true);
        this.showErrorToast(error);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected primaryName(item: { nameAr: string; nameEn: string }): string {
    return nameIn(item, this.language());
  }

  protected secondaryName(item: { nameAr: string; nameEn: string }): string {
    return this.language() === 'ar' ? item.nameEn : item.nameAr;
  }

  protected isRequiredStage(stage: PipelineStage): boolean {
    return REQUIRED_FLAGS.has(stage.flag);
  }

  protected categoryClass(category: StageCategory): string {
    return CATEGORY_BADGE[category];
  }

  protected joinLabels(labels: readonly string[]): string {
    return labels.join(this.language() === 'ar' ? '، ' : ', ');
  }

  protected openEdit(): void {
    const current = this.pipeline();
    if (!current || !this.canManage) return;
    this.pipelineModal().openEdit(current);
  }

  protected onPipelineSaved(updated: Pipeline): void {
    const dirty = this.assignmentsDirty();
    this.pipeline.set(updated);
    if (!dirty) {
      this.syncDraftAssignments(updated);
    }
  }

  protected async onDeleteFromModal(pipeline: Pipeline): Promise<void> {
    if (!this.canManage || this.deletingPipeline() || pipeline.isDefault) return;
    if (!(await this.deletePipelineDialog().open())) return;

    this.deletingPipeline.set(true);
    try {
      await deletePipeline(pipeline.id);
      this.notify.success(this.transloco.translate('pipelines.toasts.deleted'));
      void this.router.navigate(['/crm/settings/pipelines']);
    } catch (error) {
      if (errorCodeOf(error) === 'PIPELINE_IN_USE') {
        this.pipelineInUseModal().open();
        return;
      }
      this.showErrorToast(error);
    } finally {
      this.deletingPipeline.set(false);
    }
  }

  protected async deactivateInUsePipeline(): Promise<void> {
    const current = this.pipeline();
    if (!current || this.deletingPipeline() || !current.isActive) return;
    this.pipelineInUseModal().close();
    this.deletingPipeline.set(true);
    try {
      const updated = await updatePipeline(current.id, { isActive: false });
      this.pipeline.set(updated);
      this.notify.success(this.transloco.translate('pipelines.toasts.deactivated'));
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.deletingPipeline.set(false);
    }
  }

  protected closePipelineInUseModal(): void {
    this.pipelineInUseModal().close();
  }

  protected async confirmReset(): Promise<void> {
    const current = this.pipeline();
    if (!current || !current.isDefault || !this.canManage || this.resetting()) return;
    if (!(await this.resetDialog().open())) return;

    this.resetting.set(true);
    try {
      const [reset, stages] = await Promise.all([resetPipeline(current.id), listOpportunityStages()]);
      this.pipeline.set(reset);
      this.catalogue.set(stages);
      this.syncDraftAssignments(reset);
      this.selectedAddStageId.set('');
      this.notify.success(this.transloco.translate('pipelines.toasts.reset'));
    } catch (error) {
      if (errorCodeOf(error) === 'PIPELINE_RESET_BLOCKED') {
        this.resetBlockedModal().open();
        return;
      }
      this.showErrorToast(error);
    } finally {
      this.resetting.set(false);
    }
  }

  protected closeResetBlockedModal(): void {
    this.resetBlockedModal().close();
  }

  protected async addStage(): Promise<void> {
    const current = this.pipeline();
    const stageId = this.selectedAddStageId();
    if (!current || !stageId || !this.canManage || this.stageBusy()) return;

    this.stageBusy.set(true);
    try {
      const added = await addPipelineStage(current.id, stageId);
      this.pipeline.update((item) => (item ? { ...item, stages: [...item.stages, added] } : item));
      this.selectedAddStageId.set('');
      this.notify.success(this.transloco.translate('pipelines.toasts.stageAdded'));
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.stageBusy.set(false);
    }
  }

  protected moveStageStep(index: number, delta: -1 | 1): void {
    const current = this.pipeline();
    if (!current || !this.canManage || this.stageBusy()) return;
    const target = index + delta;
    if (index === 0 || target <= 0 || target >= current.stages.length) return;

    const next = current.stages.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    void this.commitStageOrder(current, next);
  }

  protected onStageDropped(draggedId: string, targetId: string): void {
    const current = this.pipeline();
    if (!current || !this.canManage || this.stageBusy()) return;

    const fromIndex = current.stages.findIndex((item) => item.id === draggedId);
    const toIndex = current.stages.findIndex((item) => item.id === targetId);
    if (fromIndex <= 0 || toIndex <= 0 || fromIndex === toIndex) return;

    const next = current.stages.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    void this.commitStageOrder(current, next);
  }

  protected async removeStage(stage: PipelineStage): Promise<void> {
    const current = this.pipeline();
    if (!current || !this.canManage || this.stageBusy() || this.isRequiredStage(stage)) return;

    this.removingStageName.set(this.primaryName(stage));
    if (!(await this.removeStageDialog().open())) return;

    this.stageBusy.set(true);
    try {
      await removePipelineStage(current.id, stage.id);
      this.pipeline.update((item) =>
        item
          ? {
              ...item,
              stages: item.stages
                .filter((s) => s.id !== stage.id)
                .map((s, idx) => ({ ...s, rank: idx + 1 })),
            }
          : item,
      );
      this.notify.success(this.transloco.translate('pipelines.toasts.stageRemoved'));
    } catch (error) {
      if (errorCodeOf(error) === 'PIPELINE_STAGE_IN_USE') {
        this.stageInUseModal().open();
        return;
      }
      this.showErrorToast(error);
    } finally {
      this.stageBusy.set(false);
    }
  }

  protected closeStageInUseModal(): void {
    this.stageInUseModal().close();
  }

  protected setAccessMode(mode: string | null): void {
    const current = this.pipeline();
    if (!current || !this.canManage || current.isDefault) return;
    if (mode !== 'ALL' && mode !== 'RESTRICTED') return;
    this.draftAccessMode.set(mode);
  }

  protected onAccessSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, this.searchMax);
    this.accessSearch.set(value);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.refreshAssignmentOptions(value);
    }, 250);
  }

  protected isUserSelected(id: string): boolean {
    return this.draftUserIds().includes(id);
  }

  protected isTeamSelected(id: string): boolean {
    return this.draftTeamIds().includes(id);
  }

  protected toggleUser(id: string): void {
    if (!this.canManage) return;
    this.draftUserIds.update((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  }

  protected toggleTeam(id: string): void {
    if (!this.canManage) return;
    this.draftTeamIds.update((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  }

  protected undoAssignments(): void {
    const current = this.pipeline();
    if (!current) return;
    this.syncDraftAssignments(current);
  }

  protected openAssignConfirm(): void {
    if (!this.canManage || !this.assignmentsDirty() || this.restrictedWithoutTargets() || this.savingAssignments()) {
      return;
    }
    this.assignConfirmModal().open();
  }

  protected closeAssignConfirm(): void {
    if (this.savingAssignments()) return;
    this.assignConfirmModal().close();
  }

  protected async confirmSaveAssignments(): Promise<void> {
    const current = this.pipeline();
    if (!current || !this.canManage || this.savingAssignments()) return;

    const mode = this.draftAccessMode();
    const input = {
      accessMode: mode,
      userIds: mode === 'ALL' ? [] : this.draftUserIds(),
      teamIds: mode === 'ALL' ? [] : this.draftTeamIds(),
    };
    const key = this.idempotencyKeyFor({ action: 'replaceAssignments', id: current.id, input });

    this.savingAssignments.set(true);
    try {
      // The route answers the assignments view only; fold it into the loaded pipeline.
      const assignments = await replaceAssignments(current.id, input, key);
      this.pendingKey = null;
      const updated: Pipeline = { ...current, accessMode: assignments.accessMode, assignments };
      this.pipeline.set(updated);
      this.syncDraftAssignments(updated);
      this.assignConfirmModal().close();
      this.notify.success(this.transloco.translate('pipelines.toasts.assignmentsSaved'));
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.savingAssignments.set(false);
    }
  }

  private async commitStageOrder(before: Pipeline, nextStages: PipelineStage[]): Promise<void> {
    const optimistic = nextStages.map((stage, index) => ({ ...stage, rank: index + 1 }));
    const orderedIds = optimistic.map((stage) => stage.id);
    const key = this.idempotencyKeyFor({ action: 'reorderStages', id: before.id, orderedIds });
    this.pipeline.set({ ...before, stages: optimistic });
    this.stageBusy.set(true);
    try {
      const savedStages = await reorderPipelineStages(before.id, orderedIds, key);
      this.pendingKey = null;
      this.pipeline.update((item) => (item ? { ...item, stages: savedStages } : item));
      this.notify.success(this.transloco.translate('pipelines.toasts.stageReordered'));
    } catch (error) {
      this.pipeline.set(before);
      this.showErrorToast(error);
    } finally {
      this.stageBusy.set(false);
    }
  }

  private idempotencyKeyFor(payload: unknown): string {
    const body = JSON.stringify(payload);
    if (this.pendingKey?.body === body) return this.pendingKey.key;
    const key = newIdempotencyKey();
    this.pendingKey = { body, key };
    return key;
  }

  private async refreshAssignmentOptions(search: string): Promise<void> {
    const seq = ++this.optionsSeq;
    this.searchingAccess.set(true);
    try {
      const options = await assignmentOptions(search);
      if (seq !== this.optionsSeq) return;
      this.applyAssignmentOptions(options);
    } catch (error) {
      if (seq === this.optionsSeq) this.showErrorToast(error);
    } finally {
      if (seq === this.optionsSeq) this.searchingAccess.set(false);
    }
  }

  private applyAssignmentOptions(options: { users: AssignmentUserOption[]; teams: AssignmentTeamOption[] }): void {
    this.userOptions.set(options.users);
    this.teamOptions.set(options.teams);
    this.knownUsers.update((prev) => {
      const next = new Map(prev);
      for (const user of options.users) next.set(user.id, user);
      return next;
    });
    this.knownTeams.update((prev) => {
      const next = new Map(prev);
      for (const team of options.teams) next.set(team.id, team);
      return next;
    });
  }

  private syncDraftAssignments(pipeline: Pipeline): void {
    this.draftAccessMode.set(pipeline.assignments.accessMode);
    this.draftUserIds.set([...pipeline.assignments.userIds]);
    this.draftTeamIds.set([...pipeline.assignments.teamIds]);
  }

  private showErrorToast(error: unknown): void {
    const code = errorCodeOf(error);
    if (code) {
      const key = `pipelines.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated !== key) {
        this.notify.error(translated);
        return;
      }
      const sharedKey = `settings.errors.${code}`;
      const shared = this.transloco.translate(sharedKey);
      if (shared !== sharedKey) {
        this.notify.error(shared);
        return;
      }
    }
    this.notify.error(this.transloco.translate('settings.errors.generic'));
  }
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  if (setA.size !== b.length) return false;
  return b.every((id) => setA.has(id));
}

function computeDiff(
  beforeIds: readonly string[],
  afterIds: readonly string[],
  labelOf: (id: string) => string,
): DiffGroup {
  const before = new Set(beforeIds);
  const after = new Set(afterIds);
  const added = afterIds.filter((id) => !before.has(id)).map(labelOf);
  const removed = beforeIds.filter((id) => !after.has(id)).map(labelOf);
  const unchangedCount = afterIds.filter((id) => before.has(id)).length;
  return { added, removed, unchangedCount };
}

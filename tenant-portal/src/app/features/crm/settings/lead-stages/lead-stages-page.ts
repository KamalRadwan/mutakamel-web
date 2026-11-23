import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  runInInjectionContext,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowsRightLeft,
  tablerGripVertical,
  tablerListNumbers,
  tablerLock,
  tablerStar,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Router } from '@angular/router';
import { ApiError } from '../../../../core/api/api-errors';
import { Notify } from '../../../../core/notify/notify';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { crmSettingsError, errorCodeOf, newIdempotencyKey } from '../shared/settings-api';
import { tenantWide } from '../shared/settings-access';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { LeadStageModal } from './lead-stage-modal/lead-stage-modal';
import {
  deleteLeadStage,
  LEAD_STAGE_SETTINGS_READER,
  listLeadStages,
  reorderLeadStages,
  loadQualifiedConversionRequirement,
  setDefaultLeadStage,
  updateLeadStage,
} from './lead-stages.api';
import {
  LEAD_STAGE_LIMIT,
  LeadStage,
  STAGE_CATEGORY_BADGE,
  isProtectedStage,
  isTerminalStage,
  stageErrorMessage,
  stageErrorTranslator,
  stageNameIn,
} from './lead-stages.model';

interface DraggedStage {
  stageId: string;
}

export interface StageDropEvent {
  sourceId: string;
  targetId: string;
  edge: 'before' | 'after';
}

function isDraggedStage(
  data: Record<string | symbol, unknown>,
): data is Record<string | symbol, unknown> & DraggedStage {
  return typeof data['stageId'] === 'string';
}

/** Makes a custom lead-stage row draggable from its grip handle. */
@Directive({
  selector: '[stageRowDrag]',
  host: { '[class.opacity-drag-source]': 'dragging()' },
})
export class StageRowDrag {
  readonly stageRowDrag = input.required<string>();
  readonly dragDisabled = input(false);

  protected readonly dragging = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const dragHandle = element.querySelector<HTMLElement>('[data-drag-handle]') ?? undefined;
      const cleanup = draggable({
        element,
        dragHandle,
        canDrag: () => !this.dragDisabled(),
        getInitialData: () => ({ stageId: this.stageRowDrag() }),
        onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
          const offset = preserveOffsetOnSource({
            element: source.element,
            input: location.current.input,
          });
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
      destroyRef.onDestroy(cleanup);
    });
  }
}

/** Marks a custom lead-stage row as a drop target between NEW and DISQUALIFIED. */
@Directive({
  selector: '[stageRowDrop]',
  exportAs: 'stageRowDrop',
})
export class StageRowDrop {
  readonly stageRowDrop = input.required<string>();
  readonly dropDisabled = input(false);
  readonly dropped = output<StageDropEvent>();

  readonly edge = signal<'before' | 'after' | null>(null);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const edgeFor = (clientY: number): 'before' | 'after' => {
        const rect = element.getBoundingClientRect();
        return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      };

      const cleanup = dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          !this.dropDisabled() &&
          isDraggedStage(source.data) &&
          source.data.stageId !== this.stageRowDrop(),
        getData: () => ({ stageId: this.stageRowDrop() }),
        onDragEnter: ({ source, location }) => {
          if (isDraggedStage(source.data) && source.data.stageId !== this.stageRowDrop()) {
            this.edge.set(edgeFor(location.current.input.clientY));
          }
        },
        onDrag: ({ source, location }) => {
          if (isDraggedStage(source.data) && source.data.stageId !== this.stageRowDrop()) {
            this.edge.set(edgeFor(location.current.input.clientY));
          }
        },
        onDragLeave: () => this.edge.set(null),
        onDrop: ({ source, location }) => {
          const dropEdge = edgeFor(location.current.input.clientY);
          this.edge.set(null);
          if (
            !this.dropDisabled() &&
            isDraggedStage(source.data) &&
            source.data.stageId !== this.stageRowDrop()
          ) {
            this.dropped.emit({
              sourceId: source.data.stageId,
              targetId: this.stageRowDrop(),
              edge: dropEdge,
            });
          }
        },
      });
      destroyRef.onDestroy(cleanup);
    });
  }
}

@Component({
  selector: 'app-lead-stages-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    FullState,
    LeadStageModal,
    Modal,
    SettingsFrame,
    SettingsNotice,
    StageRowDrag,
    StageRowDrop,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-lead-stages', alias: 'leadStages' }),
    provideIcons({
      tablerGripVertical,
      tablerLock,
      tablerStar,
      tablerListNumbers,
      tablerArrowsRightLeft,
      tablerTrash,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './lead-stages-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class LeadStagesPage {
  private static nextId = 0;
  protected readonly uid = `lead-stages-page-${++LeadStagesPage.nextId}`;

  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly translateError = stageErrorTranslator(this.transloco);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly stageModal = viewChild.required(LeadStageModal);
  private readonly confirmDelete = viewChild.required<ConfirmDialog>('confirmDelete');
  private readonly inUseModal = viewChild.required<Modal>('inUseModal');
  private readonly moveModal = viewChild.required<Modal>('moveModal');

  private readonly injector = inject(Injector);
  private readonly readSettings = inject(LEAD_STAGE_SETTINGS_READER);
  protected readonly readOnly = signal(false);
  protected readonly canManage = computed(
    () =>
      !this.readOnly() &&
      runInInjectionContext(this.injector, () => tenantWide('crm.lead_stages.manage')),
  );
  private readonly canRead = computed(() =>
    runInInjectionContext(this.injector, () => tenantWide('crm.lead_stages.read')),
  );
  private readonly canReadSettings = computed(() =>
    runInInjectionContext(this.injector, () => tenantWide('crm.settings.read')),
  );
  protected readonly stageLimit = LEAD_STAGE_LIMIT;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly categoryBadges = STAGE_CATEGORY_BADGE;
  protected readonly isProtectedStage = isProtectedStage;
  protected readonly isTerminalStage = isTerminalStage;

  protected readonly stages = signal<LeadStage[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  private readonly loadFailure = signal<unknown>(null);
  protected readonly loadError = computed(() => {
    this.i18n();
    const error = this.loadFailure();
    return error ? crmSettingsError(this.translateError, error, 'leadStages') : null;
  });
  protected readonly loadErrorText = computed(() => {
    const error = this.loadError();
    if (!error) return '';
    return [
      error.message,
      error.correlationId
        ? this.transloco.translate('settings.common.correlationId', { id: error.correlationId })
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });
  protected readonly search = signal('');
  protected readonly busy = signal(false);
  protected readonly deletingName = signal('');
  protected readonly inUseStage = signal<LeadStage | null>(null);
  protected readonly deactivating = signal(false);
  protected readonly movingStage = signal<LeadStage | null>(null);
  protected readonly moveTargetPosition = signal(2);
  protected readonly savingMove = signal(false);

  private readonly conversionRequiresQualified = signal(false);
  private loadSeq = 0;

  protected readonly gridColumns = computed(() =>
    this.canManage()
      ? 'grid-cols-[var(--table-head-h)_var(--select-col-w)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_var(--table-head-h)]'
      : 'grid-cols-[var(--table-head-h)_var(--select-col-w)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)]',
  );

  protected readonly isSearching = computed(() => this.search().trim().length > 0);
  protected readonly atLimit = computed(() => this.stages().length >= this.stageLimit);
  protected readonly customStagesCount = computed(
    () => this.stages().filter((s) => !isProtectedStage(s)).length,
  );

  protected readonly filteredStages = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.stages();
    if (!term) return list;
    return list.filter(
      (stage) =>
        stage.nameAr.toLowerCase().includes(term) || stage.nameEn.toLowerCase().includes(term),
    );
  });

  protected readonly showMissingQualifiedWarning = computed(() => {
    if (
      !this.canReadSettings() ||
      !this.conversionRequiresQualified() ||
      this.loading() ||
      this.loadFailed()
    )
      return false;
    return !this.stages().some((stage) => stage.isActive && stage.flag === 'QUALIFIED');
  });

  protected readonly positionOptions = computed<DropdownOption<number>[]>(() => {
    const total = this.stages().length;
    if (total <= 3) return [];
    const options: DropdownOption<number>[] = [];
    for (let pos = 2; pos <= total - 2; pos++) {
      options.push({ value: pos, label: String(pos) });
    }
    return options;
  });

  constructor() {
    void this.load();
    void this.loadWarning();
  }

  protected reload(): void {
    void this.load();
    void this.loadWarning();
  }

  protected onLoadAction(): void {
    if (this.loadError()?.kind === 'forbidden') void this.router.navigateByUrl('/');
    else this.reload();
  }

  protected openCreate(): void {
    if (!this.canManage() || this.atLimit()) return;
    this.stageModal().openCreate();
  }

  protected openEdit(stage: LeadStage): void {
    this.stageModal().openEdit(stage);
  }

  protected onRowClick(stage: LeadStage, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, [data-row-action], [data-drag-handle]')) return;
    this.openEdit(stage);
  }

  protected onStageSaved(): void {
    void this.load();
  }

  protected canRowDrag(stage: LeadStage): boolean {
    return (
      this.canManage() &&
      !this.isSearching() &&
      !this.busy() &&
      !isProtectedStage(stage) &&
      this.customStagesCount() > 1
    );
  }

  protected canRowDrop(stage: LeadStage): boolean {
    return this.canManage() && !this.isSearching() && !this.busy() && !isProtectedStage(stage);
  }

  protected canSetDefault(stage: LeadStage): boolean {
    return this.canManage() && !stage.isDefault && stage.isActive && !isTerminalStage(stage);
  }

  protected rowActions(stage: LeadStage): ActionItem[] {
    this.i18n();
    if (!this.canManage()) return [];
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('leadStages.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('leadStages.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
    ];

    if (!stage.isDefault) {
      let reason: string | undefined;
      if (!stage.isActive) {
        reason = this.transloco.translate('leadStages.actions.setDefaultInactiveReason');
      } else if (isTerminalStage(stage)) {
        reason = this.transloco.translate('leadStages.actions.setDefaultTerminalReason');
      }
      items.push({
        id: 'setDefault',
        title: this.transloco.translate('leadStages.actions.setDefault'),
        icon: 'tablerStar',
        tile: reason ? 'bg-icon-gray' : 'bg-icon-orange',
        disabled: Boolean(reason),
        reason,
      });
    }

    let moveReason: string | undefined;
    if (isProtectedStage(stage)) {
      moveReason = this.transloco.translate('leadStages.actions.moveProtectedReason');
    } else if (this.isSearching()) {
      moveReason = this.transloco.translate('leadStages.actions.moveSearchingReason');
    } else if (this.customStagesCount() <= 1) {
      moveReason = this.transloco.translate('leadStages.actions.moveOnlyCustomReason');
    }
    items.push({
      id: 'movePosition',
      title: this.transloco.translate('leadStages.actions.movePosition'),
      icon: 'tablerArrowsRightLeft',
      tile: moveReason ? 'bg-icon-gray' : 'bg-icon-teal',
      disabled: Boolean(moveReason),
      reason: moveReason,
    });

    let deleteReason: string | undefined;
    if (isProtectedStage(stage)) {
      deleteReason = this.transloco.translate('leadStages.actions.deleteProtectedReason');
    } else if (stage.isDefault) {
      deleteReason = this.transloco.translate('leadStages.actions.deleteDefaultReason');
    }
    items.push({
      id: 'delete',
      title: this.transloco.translate('settings.common.delete'),
      icon: 'tablerTrash',
      tile: deleteReason ? 'bg-icon-gray' : 'bg-icon-red',
      danger: true,
      disabled: Boolean(deleteReason),
      reason: deleteReason,
    });

    return items;
  }

  protected onRowAction(stage: LeadStage, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(stage);
        break;
      case 'setDefault':
        void this.makeDefault(stage);
        break;
      case 'movePosition':
        this.openMoveModal(stage);
        break;
      case 'delete':
        void this.requestDelete(stage);
        break;
    }
  }

  protected makeDefault(stage: LeadStage): Promise<void> {
    return this.runSetDefault(stage);
  }

  protected onRowDrop(event: StageDropEvent): void {
    if (!this.canManage() || this.isSearching() || this.busy()) return;
    const current = this.stages();
    const custom = current.filter((item) => !isProtectedStage(item));
    const sourceIndex = custom.findIndex((item) => item.id === event.sourceId);
    const targetIndex = custom.findIndex((item) => item.id === event.targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const beforeIds = custom.map((item) => item.id);
    const [moved] = custom.splice(sourceIndex, 1);
    const adjustedTarget = custom.findIndex((item) => item.id === event.targetId);
    const insertAt = event.edge === 'before' ? adjustedTarget : adjustedTarget + 1;
    custom.splice(insertAt, 0, moved);
    if (custom.every((item, index) => item.id === beforeIds[index])) return;

    const next = this.buildOrderedStages(current, custom);
    void this.commitReorder(current, next);
  }

  protected openMoveModal(stage: LeadStage): void {
    if (!this.canRowDrag(stage)) return;
    this.movingStage.set(stage);
    this.moveTargetPosition.set(stage.sortOrder);
    this.moveModal().open();
  }

  protected closeMoveModal(): void {
    this.moveModal().close();
    this.movingStage.set(null);
  }

  protected async saveMovePosition(): Promise<void> {
    const stage = this.movingStage();
    if (!this.canManage() || !stage || this.savingMove() || this.busy()) return;
    const targetPos = this.moveTargetPosition();
    if (targetPos === stage.sortOrder) {
      this.closeMoveModal();
      return;
    }

    const current = this.stages();
    const custom = current.filter((item) => !isProtectedStage(item));
    const fromIndex = custom.findIndex((item) => item.id === stage.id);
    const toIndex = Math.max(0, Math.min(custom.length - 1, targetPos - 2));
    if (fromIndex < 0 || fromIndex === toIndex) {
      this.closeMoveModal();
      return;
    }

    const [moved] = custom.splice(fromIndex, 1);
    custom.splice(toIndex, 0, moved);
    const next = this.buildOrderedStages(current, custom);

    this.savingMove.set(true);
    try {
      const saved = await this.commitReorder(current, next);
      if (saved) {
        this.closeMoveModal();
      }
    } finally {
      this.savingMove.set(false);
    }
  }

  protected async requestDelete(stage: LeadStage): Promise<void> {
    if (!this.canManage() || this.busy()) return;
    this.deletingName.set(stageNameIn(stage, this.language()));
    if (!(await this.confirmDelete().open())) return;

    this.busy.set(true);
    try {
      await deleteLeadStage(stage.id);
      this.stageModal().close();
      this.notify.success(this.transloco.translate('leadStages.toasts.deleted'));
      await this.load();
    } catch (error) {
      if (errorCodeOf(error) === 'LEAD_STAGE_IN_USE') {
        this.onStageInUse(stage);
        return;
      }
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'LEAD_STAGE_NOT_FOUND') {
        this.stageModal().close();
        void this.load();
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected closeInUseModal(): void {
    this.inUseModal().close();
    this.inUseStage.set(null);
  }

  protected onStageInUse(stage: LeadStage): void {
    this.stageModal().close();
    this.inUseStage.set(stage);
    this.inUseModal().open();
  }

  protected async deactivateInUseStage(): Promise<void> {
    const stage = this.inUseStage();
    if (!this.canManage() || !stage || this.deactivating()) return;

    this.deactivating.set(true);
    try {
      await updateLeadStage(stage.id, { isActive: false });
      this.notify.success(this.transloco.translate('leadStages.toasts.deactivated'));
      this.closeInUseModal();
      await this.load();
    } catch (error) {
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'LEAD_STAGE_NOT_FOUND') {
        this.closeInUseModal();
        void this.load();
      }
    } finally {
      this.deactivating.set(false);
    }
  }

  private async runSetDefault(stage: LeadStage): Promise<void> {
    if (!this.canManage() || this.busy()) return;
    this.busy.set(true);
    try {
      await setDefaultLeadStage(stage.id);
      this.notify.success(this.transloco.translate('leadStages.toasts.defaultSet'));
      await this.load();
    } catch (error) {
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'LEAD_STAGE_NOT_FOUND') void this.load();
    } finally {
      this.busy.set(false);
    }
  }

  private buildOrderedStages(
    current: readonly LeadStage[],
    reorderedCustom: readonly LeadStage[],
  ): LeadStage[] {
    const first = current.filter((item) => item.flag === 'NEW');
    const disqualified = current.filter((item) => item.flag === 'DISQUALIFIED');
    const converted = current.filter((item) => item.flag === 'CONVERTED');
    return [...first, ...reorderedCustom, ...disqualified, ...converted].map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
  }

  private async commitReorder(before: LeadStage[], optimistic: LeadStage[]): Promise<boolean> {
    this.stages.set(optimistic);
    this.busy.set(true);
    // One x-idempotency-key per reorder (each drag or move is its own user action).
    const idempotencyKey = newIdempotencyKey();
    try {
      const saved = await reorderLeadStages(
        optimistic.map((item) => item.id),
        idempotencyKey,
      );
      this.stages.set(saved);
      this.notify.success(this.transloco.translate('leadStages.toasts.reordered'));
      return true;
    } catch (error) {
      this.stages.set(before);
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'LEAD_STAGE_REORDER_INVALID') await this.load();
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.loadFailure.set(null);
    if (!this.canRead()) {
      this.loadFailed.set(true);
      this.loadFailure.set(new ApiError(403, 'CRM_PERMISSION_DENIED'));
      this.loading.set(false);
      return;
    }
    try {
      const items = await listLeadStages();
      if (seq !== this.loadSeq) return;
      this.stages.set(items);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.loadFailure.set(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private showErrorToast(error: unknown): void {
    if (crmSettingsError(this.translateError, error, 'leadStages').readOnly)
      this.readOnly.set(true);
    this.notify.error(stageErrorMessage(error, this.translateError));
  }

  private async loadWarning(): Promise<void> {
    if (!this.canReadSettings() || !this.canRead()) return;
    this.conversionRequiresQualified.set(
      await loadQualifiedConversionRequirement(this.readSettings),
    );
  }
}

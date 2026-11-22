import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerArrowsRightLeft, tablerGripVertical, tablerTrendingUp } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { errorCodeOf } from '../shared/settings-api';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { LeadSourceModal } from './lead-source-modal/lead-source-modal';
import { deleteLeadSource, listLeadSources, reorderLeadSources, updateLeadSource } from './lead-sources.api';
import { LEAD_SOURCE_LIMIT, LeadSource, nameIn, translateSourceError } from './lead-sources.model';

const CAN_MANAGE = true; // later from the session permissions

interface DraggedSource {
  sourceId: string;
}

function isDraggedSource(data: Record<string | symbol, unknown>): data is Record<string | symbol, unknown> & DraggedSource {
  return typeof data['sourceId'] === 'string';
}

@Directive({
  selector: '[sourceRowDrag]',
  host: { '[class.opacity-drag-source]': 'dragging()' },
})
class SourceRowDrag {
  readonly sourceRowDrag = input.required<string>();
  readonly dragDisabled = input(false);

  protected readonly dragging = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const handle = element.querySelector<HTMLElement>('[data-drag-handle]') ?? undefined;
      const cleanup = draggable({
        element,
        dragHandle: handle,
        canDrag: () => !this.dragDisabled(),
        getInitialData: () => ({ sourceId: this.sourceRowDrag() }),
        onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
          const offset = preserveOffsetOnSource({ element: source.element, input: location.current.input });
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: (args) => {
              const { x, y } = offset(args);
              const frame = parseFloat(getComputedStyle(args.container.firstElementChild!).paddingTop);
              return { x: x + frame, y: y + frame };
            },
            render: ({ container }) => {
              const frame = document.createElement('div');
              frame.className = 'drag-preview-frame';
              const copy = element.cloneNode(true) as HTMLElement;
              copy.style.width = element.offsetWidth + 'px';
              copy.classList.add('shadow-drag', 'rounded-10');
              frame.append(copy);
              container.append(frame);
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

@Directive({
  selector: '[sourceRowDrop]',
  exportAs: 'sourceRowDrop',
})
class SourceRowDrop {
  readonly sourceRowDrop = input.required<string>();
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
          !this.dropDisabled() && isDraggedSource(source.data) && source.data.sourceId !== this.sourceRowDrop(),
        getData: () => ({ targetId: this.sourceRowDrop() }),
        onDragEnter: ({ source }) => {
          if (isDraggedSource(source.data) && source.data.sourceId !== this.sourceRowDrop()) {
            this.over.set(true);
          }
        },
        onDragLeave: () => this.over.set(false),
        onDrop: ({ source }) => {
          this.over.set(false);
          if (!this.dropDisabled() && isDraggedSource(source.data) && source.data.sourceId !== this.sourceRowDrop()) {
            this.dropped.emit(source.data.sourceId);
          }
        },
      });
      destroyRef.onDestroy(cleanup);
    });
  }
}

@Component({
  selector: 'app-lead-sources-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    Button,
    ActionsMenu,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    SettingsFrame,
    SettingsNotice,
    LeadSourceModal,
    SourceRowDrag,
    SourceRowDrop,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-lead-sources', alias: 'leadSources' }),
    provideIcons({ tablerTrendingUp, tablerGripVertical, tablerArrowsRightLeft, tablerAlertTriangle }),
  ],
  templateUrl: './lead-sources-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class LeadSourcesPage {
  private static nextId = 0;
  protected readonly uid = `lead-sources-page-${++LeadSourcesPage.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly sourceModal = viewChild.required(LeadSourceModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly moveModal = viewChild.required<Modal>('moveModal');
  private readonly inUseModal = viewChild.required<Modal>('inUseModal');

  protected readonly canManage = CAN_MANAGE;
  protected readonly maxSources = LEAD_SOURCE_LIMIT;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  // Uses --table-head-h (36px) for grip/actions columns and reuses --time-dd-w (44px) for the # order column.
  protected readonly gridColumnsClass = CAN_MANAGE
    ? 'grid-cols-crm-lead-source-row-manage'
    : 'grid-cols-crm-lead-source-row';

  protected readonly search = signal('');
  protected readonly reordering = signal(false);
  protected readonly makingInactive = signal(false);
  protected readonly togglingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly deletingSource = signal<LeadSource | null>(null);
  protected readonly movingSource = signal<LeadSource | null>(null);
  protected readonly targetPosition = signal(1);
  protected readonly inUseSource = signal<LeadSource | null>(null);

  private readonly loaded = resource({ loader: () => listLeadSources() });
  private readonly localSources = signal<LeadSource[] | null>(null);

  protected readonly sources = computed(() =>
    this.localSources() ?? (this.loaded.hasValue() ? this.loaded.value() : []),
  );
  protected readonly loading = this.loaded.isLoading;
  protected readonly loadFailed = computed(() => !this.loading() && !!this.loaded.error());
  protected readonly isSearching = computed(() => this.search().trim().length > 0);
  protected readonly atLimit = computed(() => this.sources().length >= LEAD_SOURCE_LIMIT);

  protected readonly visibleSources = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.sources();
    if (!term) return list;
    return list.filter(
      (item) => item.nameAr.toLowerCase().includes(term) || item.nameEn.toLowerCase().includes(term),
    );
  });

  protected readonly positionOptions = computed<DropdownOption<number>[]>(() =>
    this.sources().map((_, index) => ({
      value: index + 1,
      label: String(index + 1),
    })),
  );

  protected reload(): void {
    this.localSources.set(null);
    this.loaded.reload();
  }

  protected displayName(source: LeadSource): string {
    return nameIn(source, this.language());
  }

  protected openCreate(): void {
    if (!this.canManage || this.atLimit()) return;
    this.sourceModal().openCreate();
  }

  protected openEdit(source: LeadSource, focusIcon = false): void {
    this.sourceModal().openEdit(source, { focusIcon });
  }

  protected onRowClick(source: LeadSource, event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-no-drag], [data-drag-handle]')) return;
    this.openEdit(source);
  }

  protected onModalSaved(event: { source: LeadSource; isNew: boolean }): void {
    const current = this.sources();
    if (event.isNew) {
      this.localSources.set([...current, event.source]);
      return;
    }
    this.localSources.set(current.map((item) => (item.id === event.source.id ? event.source : item)));
  }

  protected onIconUpdated(updated: LeadSource): void {
    this.localSources.set(this.sources().map((item) => (item.id === updated.id ? updated : item)));
  }

  protected actionsFor(source: LeadSource): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    let moveReason: string | undefined;
    if (this.isSearching()) {
      moveReason = t('settings.common.searching');
    } else if (this.reordering()) {
      moveReason = t('leadSources.actions.moveReorderingReason');
    } else if (this.sources().length <= 1) {
      moveReason = t('leadSources.actions.moveSingleReason');
    }
    const moveDisabled = Boolean(moveReason);
    const toggleDisabled = this.togglingIds().has(source.id);
    return [
      {
        id: 'open',
        title: t('leadSources.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: t('leadSources.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'changeIcon',
        title: t('leadSources.actions.changeIcon'),
        icon: 'tablerUpload',
        tile: 'bg-icon-teal',
      },
      {
        id: 'moveToPosition',
        title: t('settings.common.moveToPosition'),
        icon: 'tablerArrowsRightLeft',
        tile: moveDisabled ? 'bg-icon-gray' : 'bg-icon-blue',
        disabled: moveDisabled,
        reason: moveReason,
      },
      {
        id: 'toggleActive',
        title: t(source.isActive ? 'leadSources.actions.deactivate' : 'leadSources.actions.activate'),
        icon: source.isActive ? 'tablerCircleOff' : 'tablerCheck',
        tile: toggleDisabled ? 'bg-icon-gray' : source.isActive ? 'bg-icon-orange' : 'bg-icon-green',
        disabled: toggleDisabled,
      },
      {
        id: 'delete',
        title: t('settings.common.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  }

  protected onAction(source: LeadSource, selection: ActionSelection): void {
    if (!this.canManage) return;
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(source);
        break;
      case 'changeIcon':
        this.openEdit(source, true);
        break;
      case 'moveToPosition':
        this.openMoveModal(source);
        break;
      case 'toggleActive':
        void this.toggleActive(source);
        break;
      case 'delete':
        void this.requestDelete(source);
        break;
    }
  }

  protected async dropOnRow(fromId: string, toId: string): Promise<void> {
    if (!this.canManage || this.isSearching() || this.reordering() || fromId === toId) return;
    const list = this.sources();
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const reordered = list.slice();
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    await this.applyReorder(reordered);
  }

  protected openMoveModal(source: LeadSource): void {
    if (this.isSearching() || this.reordering() || this.sources().length <= 1) return;
    this.movingSource.set(source);
    this.targetPosition.set(source.sortOrder);
    this.moveModal().open();
  }

  protected async confirmMove(): Promise<void> {
    const source = this.movingSource();
    if (!source || this.isSearching() || this.reordering() || this.sources().length <= 1) return;
    const list = this.sources();
    const fromIndex = list.findIndex((item) => item.id === source.id);
    const toIndex = Math.max(0, Math.min(list.length - 1, this.targetPosition() - 1));
    if (fromIndex < 0 || fromIndex === toIndex) {
      this.moveModal().close();
      return;
    }

    const reordered = list.slice();
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    this.moveModal().close();
    await this.applyReorder(reordered);
  }

  protected async requestDelete(source: LeadSource): Promise<void> {
    if (!this.canManage) return;
    this.deletingSource.set(source);
    if (!(await this.deleteConfirm().open())) return;

    try {
      await deleteLeadSource(source.id);
      this.sourceModal().closeImmediate();
      const remaining = this.sources()
        .filter((item) => item.id !== source.id)
        .map((item, index) => ({ ...item, sortOrder: index + 1 }));
      this.localSources.set(remaining);
      this.notify.success(this.transloco.translate('leadSources.toasts.deleted'));
    } catch (error) {
      if (errorCodeOf(error) === 'CRM_ACQUISITION_SOURCE_IN_USE') {
        this.sourceModal().closeImmediate();
        this.inUseSource.set(source);
        this.inUseModal().open();
        return;
      }
      this.notify.error(translateSourceError(error, this.transloco));
    }
  }

  protected async makeInUseInactive(): Promise<void> {
    const source = this.inUseSource();
    if (!source || this.makingInactive()) return;
    this.makingInactive.set(true);
    try {
      const updated = await updateLeadSource(source.id, { isActive: false });
      this.localSources.set(this.sources().map((item) => (item.id === updated.id ? updated : item)));
      this.inUseSource.set(updated);
      this.inUseModal().close();
      this.notify.success(this.transloco.translate('leadSources.toasts.deactivated'));
    } catch (error) {
      this.notify.error(translateSourceError(error, this.transloco));
    } finally {
      this.makingInactive.set(false);
    }
  }

  private async toggleActive(source: LeadSource): Promise<void> {
    if (this.togglingIds().has(source.id)) return;
    this.togglingIds.update((ids) => {
      const next = new Set(ids);
      next.add(source.id);
      return next;
    });
    const nextActive = !source.isActive;
    try {
      const updated = await updateLeadSource(source.id, { isActive: nextActive });
      this.localSources.set(this.sources().map((item) => (item.id === updated.id ? updated : item)));
      this.notify.success(
        this.transloco.translate(nextActive ? 'leadSources.toasts.activated' : 'leadSources.toasts.deactivated'),
      );
    } catch (error) {
      this.notify.error(translateSourceError(error, this.transloco));
    } finally {
      this.togglingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(source.id);
        return next;
      });
    }
  }

  private async applyReorder(reordered: LeadSource[]): Promise<void> {
    const before = this.sources();
    const optimistic = reordered.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    this.localSources.set(optimistic);
    this.reordering.set(true);
    try {
      const saved = await reorderLeadSources(
        optimistic.map((item) => item.id),
        newIdempotencyKey(),
      );
      this.localSources.set(saved);
      this.notify.success(this.transloco.translate('leadSources.toasts.reordered'));
    } catch (error) {
      this.localSources.set(before);
      this.notify.error(translateSourceError(error, this.transloco));
    } finally {
      this.reordering.set(false);
    }
  }
}

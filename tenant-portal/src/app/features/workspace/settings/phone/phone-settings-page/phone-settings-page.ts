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
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerClock,
  tablerCloudOff,
  tablerExclamationCircle,
  tablerEye,
  tablerGripVertical,
  tablerLoader2,
  tablerPhone,
  tablerPlus,
  tablerRefresh,
  tablerServer,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import {
  createPhoneServer,
  deletePhoneServer,
  getPhoneConfig,
  getPhoneSeats,
  listPhoneServers,
  reorderPhoneServers,
  updatePhoneServer,
} from '../phone-servers.api';
import {
  PHONE_SERVER_LIMIT,
  PhoneConfig,
  PhoneSeats,
  PhoneServer,
  protocolOfUrl,
} from '../phone-servers.model';
import { ServerModal } from '../server-modal/server-modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';

const CAN_MANAGE = true; // later from session permissions (webphone.settings.update)
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

type PageFullState = 'notPurchased' | 'provisioning' | 'loadFailed' | null;

interface DraggedServer {
  serverId: string;
}

export interface ServerDropEvent {
  sourceId: string;
  targetId: string;
  edge: 'before' | 'after';
}

function isDraggedServer(data: Record<string | symbol, unknown>): data is Record<string | symbol, unknown> & DraggedServer {
  return typeof data['serverId'] === 'string';
}

/** Makes a phone server row draggable from its grip handle. */
@Directive({
  selector: '[phoneServerDrag]',
  host: { '[class.opacity-drag-source]': 'dragging()' },
})
export class PhoneServerDrag {
  readonly phoneServerDrag = input.required<string>();
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
        getInitialData: () => ({ serverId: this.phoneServerDrag() }),
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
      destroyRef.onDestroy(cleanup);
    });
  }
}

/** Marks a phone server row as a drop target for reordering. */
@Directive({
  selector: '[phoneServerDrop]',
  exportAs: 'phoneServerDrop',
})
export class PhoneServerDrop {
  readonly phoneServerDrop = input.required<string>();
  readonly dropDisabled = input(false);
  readonly dropped = output<ServerDropEvent>();

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
          !this.dropDisabled() && isDraggedServer(source.data) && source.data.serverId !== this.phoneServerDrop(),
        getData: () => ({ serverId: this.phoneServerDrop() }),
        onDragEnter: ({ source, location }) => {
          if (isDraggedServer(source.data) && source.data.serverId !== this.phoneServerDrop()) {
            this.edge.set(edgeFor(location.current.input.clientY));
          }
        },
        onDrag: ({ source, location }) => {
          if (isDraggedServer(source.data) && source.data.serverId !== this.phoneServerDrop()) {
            this.edge.set(edgeFor(location.current.input.clientY));
          }
        },
        onDragLeave: () => this.edge.set(null),
        onDrop: ({ source, location }) => {
          const dropEdge = edgeFor(location.current.input.clientY);
          this.edge.set(null);
          if (
            !this.dropDisabled() &&
            isDraggedServer(source.data) &&
            source.data.serverId !== this.phoneServerDrop()
          ) {
            this.dropped.emit({
              sourceId: source.data.serverId,
              targetId: this.phoneServerDrop(),
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
  selector: 'app-phone-settings-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    PhoneServerDrag,
    PhoneServerDrop,
    ServerModal,
    Switch,
  ],
  providers: [
    provideTranslocoScope({ scope: 'ws-phone', alias: 'wsPhone' }),
    provideIcons({
      tablerGripVertical,
      tablerServer,
      tablerPlus,
      tablerRefresh,
      tablerLoader2,
      tablerPhone,
      tablerClock,
      tablerCloudOff,
      tablerEye,
      tablerExclamationCircle,
      tablerArrowUp,
      tablerArrowDown,
      tablerTrash,
    }),
  ],
  templateUrl: './phone-settings-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class PhoneSettingsPage {
  private static nextId = 0;
  protected readonly uid = `phone-settings-page-${++PhoneSettingsPage.nextId}`;

  /** One "!" hint per column header; every row's control points at it with aria-describedby. */
  protected readonly colTip = signal<string | null>(null);
  protected readonly colTipPlace = signal({ top: 0, start: 0 });

  protected showColTip(key: string, trigger: HTMLElement, tip: HTMLElement): void {
    const rect = rectInPage(trigger);
    const box = rectInPage(tip);
    const { width } = viewport();
    const rtl = getComputedStyle(trigger).direction === 'rtl';
    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + box.width > width - 8) {
      const alt = (rtl ? width - rect.right : rect.left) - 6 - box.width;
      start = alt >= 8 ? alt : Math.max(8, width - 8 - box.width);
    }
    this.colTipPlace.set({ top: Math.max(8, rect.bottom - box.height), start });
    this.colTip.set(key);
  }

  protected hideColTip(): void {
    this.colTip.set(null);
  }

  // WCAG 1.4.13: Escape dismisses an open hint without closing the surrounding page or modal.
  protected onColTipEscape(event: Event): void {
    if (this.colTip() === null) return;
    event.stopPropagation();
    this.colTip.set(null);
  }

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly serverModal = viewChild.required(ServerModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  protected readonly canManage = CAN_MANAGE;
  protected readonly serverLimit = PHONE_SERVER_LIMIT;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly servers = signal<PhoneServer[]>([]);
  protected readonly config = signal<PhoneConfig>({ enabled: false });
  protected readonly seats = signal<PhoneSeats | null>(null);
  protected readonly loading = signal(true);
  protected readonly fullState = signal<PageFullState>(null);
  protected readonly adding = signal(false);
  protected readonly reordering = signal(false);
  protected readonly deleting = signal(false);
  protected readonly togglingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingDeleteServer = signal<PhoneServer | null>(null);

  private loadSeq = 0;

  protected readonly atLimit = computed(() => this.servers().length >= PHONE_SERVER_LIMIT);

  protected readonly tableColumns = computed(() =>
    this.canManage
      ? 'grid-cols-phone-server-row-manage'
      : 'grid-cols-phone-server-row',
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.fullState.set(null);
    try {
      const [config, seats, servers] = await Promise.all([
        getPhoneConfig(),
        getPhoneSeats(),
        listPhoneServers(),
      ]);
      if (seq !== this.loadSeq) return;
      this.config.set(config);
      this.seats.set(seats);
      this.servers.set(servers);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const code = errorCodeOf(error);
      if (code === 'WEBPHONE_MODULE_NOT_PURCHASED') {
        this.fullState.set('notPurchased');
      } else if (code === 'WEBPHONE_PROVISIONING_PENDING') {
        this.fullState.set('provisioning');
      } else {
        this.fullState.set('loadFailed');
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected protocolOf(server: PhoneServer): 'wss' | 'ws' {
    return protocolOfUrl(server.websocketUrl);
  }

  protected isToggling(id: string): boolean {
    return this.togglingIds().has(id);
  }

  protected canRowDrag(): boolean {
    return this.canManage && !this.reordering() && this.servers().length > 1;
  }

  protected openServer(server: PhoneServer): void {
    this.serverModal().open(server);
  }

  protected onRowClick(server: PhoneServer, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, [role="switch"], [data-row-action], [data-drag-handle]')) return;
    this.openServer(server);
  }

  protected async addServer(): Promise<void> {
    if (!this.canManage || this.atLimit() || this.adding() || this.loading()) return;

    this.adding.set(true);
    try {
      const placeholderName = this.transloco.translate('wsPhone.placeholder.name');
      const created = await createPhoneServer(
        {
          name: placeholderName,
          sipDomain: 'example.invalid',
          websocketUrl: 'wss://example.invalid/ws',
          enabled: false,
        },
        newIdempotencyKey(),
      );
      await this.refreshQuiet();
      const fresh = this.servers().find((s) => s.id === created.id) ?? created;
      this.serverModal().open(fresh);
    } catch (error) {
      this.handleActionError(error);
    } finally {
      this.adding.set(false);
    }
  }

  protected async toggleEnabled(server: PhoneServer, next: boolean): Promise<void> {
    if (!this.canManage || this.isToggling(server.id)) return;
    if (next === server.enabled) return;

    const prevServers = this.servers();
    const prevConfig = this.config();

    const optimisticServers = prevServers.map((item) =>
      item.id === server.id ? { ...item, enabled: next } : item,
    );
    this.servers.set(optimisticServers);
    this.config.set({ enabled: this.computeEnabled(optimisticServers) });
    this.setToggling(server.id, true);

    try {
      await updatePhoneServer(server.id, { enabled: next }, newIdempotencyKey());
      await this.refreshQuiet();
      this.notify.success(
        this.transloco.translate(next ? 'wsPhone.toasts.enabled' : 'wsPhone.toasts.disabled'),
      );
    } catch (error) {
      this.servers.set(prevServers);
      this.config.set(prevConfig);
      this.handleActionError(error);
    } finally {
      this.setToggling(server.id, false);
    }
  }

  protected rowActions(server: PhoneServer, index: number, total: number): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('wsPhone.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.canManage) {
      items.push(
        {
          id: 'moveUp',
          title: this.transloco.translate('wsPhone.actions.moveUp'),
          icon: 'tablerArrowUp',
          tile: index > 0 && !this.reordering() ? 'bg-icon-teal' : 'bg-icon-gray',
          disabled: index === 0 || this.reordering(),
        },
        {
          id: 'moveDown',
          title: this.transloco.translate('wsPhone.actions.moveDown'),
          icon: 'tablerArrowDown',
          tile: index < total - 1 && !this.reordering() ? 'bg-icon-teal' : 'bg-icon-gray',
          disabled: index >= total - 1 || this.reordering(),
        },
        {
          id: 'delete',
          title: this.transloco.translate('wsPhone.actions.delete'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
        },
      );
    }

    return items;
  }

  protected onRowAction(server: PhoneServer, index: number, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openServer(server);
        break;
      case 'moveUp':
        void this.moveStep(index, -1);
        break;
      case 'moveDown':
        void this.moveStep(index, 1);
        break;
      case 'delete':
        void this.requestDelete(server);
        break;
    }
  }

  protected onRowDrop(event: ServerDropEvent): void {
    if (!this.canManage || this.reordering()) return;
    const current = this.servers().slice();
    const sourceIdx = current.findIndex((item) => item.id === event.sourceId);
    const targetIdx = current.findIndex((item) => item.id === event.targetId);
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return;

    const beforeIds = current.map((item) => item.id);
    const [moved] = current.splice(sourceIdx, 1);
    const adjustedTarget = current.findIndex((item) => item.id === event.targetId);
    const insertAt = event.edge === 'before' ? adjustedTarget : adjustedTarget + 1;
    current.splice(insertAt, 0, moved);
    if (current.every((item, idx) => item.id === beforeIds[idx])) return;

    void this.commitReorder(this.servers(), current);
  }

  protected onModalSaved(): void {
    void this.refreshQuiet();
  }

  protected onServerPatched(updated: PhoneServer): void {
    this.servers.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
    this.config.set({ enabled: this.computeEnabled(this.servers()) });
  }

  protected onServerDeletedRemotely(): void {
    void this.refreshQuiet();
  }

  protected async requestDelete(server: PhoneServer): Promise<void> {
    if (!this.canManage || this.deleting()) return;
    this.pendingDeleteServer.set(server);
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) {
      this.pendingDeleteServer.set(null);
      return;
    }

    this.deleting.set(true);
    try {
      await deletePhoneServer(server.id, newIdempotencyKey());
      if (this.serverModal().editingId() === server.id) {
        this.serverModal().close();
      }
      this.notify.success(this.transloco.translate('wsPhone.toasts.deleted'));
      await this.refreshQuiet();
    } catch (error) {
      if (errorCodeOf(error) === 'WEBPHONE_SERVER_NOT_FOUND' && this.serverModal().editingId() === server.id) {
        this.serverModal().close();
      }
      this.handleActionError(error);
    } finally {
      this.deleting.set(false);
      this.pendingDeleteServer.set(null);
    }
  }

  private async moveStep(index: number, delta: -1 | 1): Promise<void> {
    if (!this.canManage || this.reordering()) return;
    const current = this.servers();
    const target = index + delta;
    if (index < 0 || target < 0 || target >= current.length) return;

    const next = current.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await this.commitReorder(current, next);
  }

  private async commitReorder(before: PhoneServer[], next: PhoneServer[]): Promise<void> {
    const optimistic = next.map((server, idx) => ({ ...server, priority: idx + 1 }));
    const ids = optimistic.map((server) => server.id);

    this.servers.set(optimistic);
    this.reordering.set(true);
    try {
      await reorderPhoneServers(ids, newIdempotencyKey());
      await this.refreshQuiet();
      this.notify.success(this.transloco.translate('wsPhone.toasts.reordered'));
    } catch (error) {
      this.servers.set(before);
      this.handleActionError(error);
    } finally {
      this.reordering.set(false);
    }
  }

  private async refreshQuiet(): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const [config, seats, servers] = await Promise.all([
        getPhoneConfig(),
        getPhoneSeats(),
        listPhoneServers(),
      ]);
      if (seq !== this.loadSeq) return;
      this.config.set(config);
      this.seats.set(seats);
      this.servers.set(servers);
      this.fullState.set(null);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.handleActionError(error);
    }
  }

  private handleActionError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'WEBPHONE_MODULE_NOT_PURCHASED') {
      this.fullState.set('notPurchased');
      return;
    }
    if (code === 'WEBPHONE_PROVISIONING_PENDING') {
      this.fullState.set('provisioning');
      return;
    }
    if (code === 'WEBPHONE_SERVER_NOT_FOUND' || code === 'WEBPHONE_SERVER_ORDER_INVALID') {
      this.notify.error(this.resolveError(error));
      void this.refreshQuiet();
      return;
    }
    this.notify.error(this.resolveError(error));
  }

  private computeEnabled(servers: readonly PhoneServer[]): boolean {
    return servers.some(
      (s) => s.enabled && s.sipDomain.trim().length > 0 && s.websocketUrl.trim().length > 0,
    );
  }

  private setToggling(id: string, active: boolean): void {
    this.togglingIds.update((current) => {
      const next = new Set(current);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private resolveError(error: unknown): string {
    const code = errorCodeOf(error);
    if (code) {
      const key = `wsPhone.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
    }
    return this.transloco.translate('wsPhone.errors.generic');
  }
}

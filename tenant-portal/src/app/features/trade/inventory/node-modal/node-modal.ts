import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuildingStore,
  tablerBuildingWarehouse,
  tablerCheck,
  tablerChevronDown,
  tablerCloud,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Switch } from '../../../../shared/ui/switch/switch';
import { TagPicker, type TagOption } from '../../../../shared/ui/tag-picker/tag-picker';
import { ApiError, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { createNode, getCompanyNode, updateNode } from '../inventory.api';
import {
  INVENTORY_LIMITS,
  type CompanyNode,
  type FulfillmentNode,
  type NodeStatus,
  type NodeType,
  type UpdateNodePatch,
} from '../inventory.model';
import { errorKey, isForbiddenError } from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';
import { InventoryConflict } from '../inventory-shared/inventory-conflict/inventory-conflict';

type NodeField = 'code' | 'name' | 'timezone' | 'branches';

interface TzListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const NODE_CODE_CHARS_RE = /^[A-Za-z0-9_.-]+$/;
const MAX_NODE_BRANCHES = 100;
const FALLBACK_TIMEZONES: readonly string[] = [
  'UTC',
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Amman',
  'Asia/Beirut',
  'Africa/Casablanca',
  'Africa/Tunis',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
];

const NODE_TYPE_OPTIONS: readonly { value: NodeType; icon: string }[] = [
  { value: 'WAREHOUSE', icon: 'tablerBuildingWarehouse' },
  { value: 'STORE', icon: 'tablerBuildingStore' },
  { value: 'VIRTUAL', icon: 'tablerCloud' },
];

const TYPE_ICON_MAP: Readonly<Record<NodeType, string>> = {
  WAREHOUSE: 'tablerBuildingWarehouse',
  STORE: 'tablerBuildingStore',
  VIRTUAL: 'tablerCloud',
};

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
  } catch {
    return 'Africa/Cairo';
  }
}

function supportedTimezones(): string[] {
  try {
    const intlApi = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    const values = intlApi.supportedValuesOf?.('timeZone');
    if (Array.isArray(values) && values.length > 0) {
      return values.includes('UTC') ? [...values] : ['UTC', ...values];
    }
  } catch {
    // Fallback below
  }
  return [...FALLBACK_TIMEZONES];
}

function activeBranchIdsOf(node: CompanyNode): string[] {
  return node.branches.filter((b) => b.isActive).map((b) => b.branchId);
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

@Component({
  selector: 'app-node-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Field,
    Modal,
    Switch,
    TagPicker,
    InventoryBadge,
    InventoryConflict,
  ],
  providers: [
    provideIcons({
      tablerBuildingWarehouse,
      tablerBuildingStore,
      tablerCloud,
      tablerAlertTriangle,
      tablerCheck,
      tablerChevronDown,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './node-modal.html',
  host: {
    '(document:click)': 'closeTzIfOutside($event)',
    '(window:resize)': 'closeTzMenu()',
  },
})
export class NodeModal {
  private static nextId = 0;
  protected readonly uid = `node-modal-${++NodeModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('nodeModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly conflictDialog = viewChild.required<InventoryConflict>('conflictDialog');
  private readonly inUseAlert = viewChild.required<Modal>('inUseAlert');
  private readonly typeButtons = viewChildren<ElementRef<HTMLButtonElement>>('typeBtn');
  private readonly tzContainer = viewChild<ElementRef<HTMLElement>>('tzContainer');
  private readonly tzTrigger = viewChild<ElementRef<HTMLButtonElement>>('tzTrigger');
  private readonly tzPopover = viewChild<ElementRef<HTMLElement>>('tzPopover');
  private readonly tzSearchInput = viewChild<ElementRef<HTMLInputElement>>('tzSearchInput');
  private readonly tzOptionButtons = viewChildren<ElementRef<HTMLButtonElement>>('tzOptionBtn');

  readonly canManage = input(true);
  readonly saved = output<{ node: FulfillmentNode; isNew: boolean }>();
  readonly closed = output<void>();
  readonly forbidden = output<void>();

  protected readonly limits = INVENTORY_LIMITS;
  protected readonly maxBranches = MAX_NODE_BRANCHES;
  protected readonly nodeTypes = NODE_TYPE_OPTIONS;
  protected readonly skeletonRows = [0, 1, 2] as const;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadedNode = signal<CompanyNode | null>(null);

  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly nodeType = signal<NodeType>('WAREHOUSE');
  protected readonly timezone = signal(detectBrowserTimezone());
  protected readonly status = signal<NodeStatus>('ACTIVE');
  protected readonly branchIds = signal<string[]>([]);

  protected readonly touched = signal<Partial<Record<NodeField, boolean>>>({});
  protected readonly submitted = signal(false);
  protected readonly serverErrors = signal<Partial<Record<NodeField, string>>>({});

  protected readonly tzOpen = signal(false);
  protected readonly tzPlaced = signal(false);
  protected readonly tzSearch = signal('');
  protected readonly tzPlace = signal<TzListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private initialCreateTimezone = detectBrowserTimezone();
  private allowClose = false;
  private confirmingDiscard = false;
  private loadSeq = 0;
  private tzSeq = 0;
  private formIdempotencyKey = newIdempotencyKey();
  private readonly allSupportedZones = supportedTimezones();

  protected readonly isCreateEditable = computed(
    () => this.mode() === 'create' && this.canManage(),
  );
  protected readonly isReadOnly = computed(() => !this.canManage());

  protected readonly dirty = computed(() => {
    if (this.isReadOnly()) return false;
    if (this.mode() === 'create') {
      return Boolean(
        this.code().trim() ||
          this.name().trim() ||
          this.nodeType() !== 'WAREHOUSE' ||
          this.timezone() !== this.initialCreateTimezone ||
          this.branchIds().length > 0,
      );
    }
    const base = this.loadedNode();
    if (!base) return false;
    return (
      this.name().trim() !== base.name ||
      this.timezone().trim() !== base.timezone ||
      this.status() !== base.status ||
      !sameStringSet(this.branchIds(), activeBranchIdsOf(base))
    );
  });

  protected readonly timezoneList = computed<readonly string[]>(() => {
    const current = this.timezone().trim();
    const browser = this.initialCreateTimezone;
    const extras: string[] = [];
    if (current && !this.allSupportedZones.includes(current)) extras.push(current);
    if (browser && browser !== current && !this.allSupportedZones.includes(browser)) {
      extras.push(browser);
    }
    return extras.length ? [...extras, ...this.allSupportedZones] : this.allSupportedZones;
  });

  protected readonly filteredTimezones = computed<readonly string[]>(() => {
    const needle = this.tzSearch().trim().toLowerCase();
    const zones = this.timezoneList();
    if (!needle) return zones;
    return zones.filter((zone) => zone.toLowerCase().includes(needle));
  });

  protected readonly branchTagOptions = computed<TagOption[]>(() => {
    const lang = this.language();
    const branches = this.scope.branches();
    const options: TagOption[] = branches.map((b) => ({
      id: b.id,
      name: lang === 'ar' ? b.nameAr : b.nameEn,
      backgroundColor: null,
      textColor: null,
    }));
    const knownIds = new Set(options.map((o) => o.id));
    for (const id of this.branchIds()) {
      if (!knownIds.has(id)) {
        knownIds.add(id);
        options.push({ id, name: id, backgroundColor: null, textColor: null });
      }
    }
    return options;
  });

  protected readonly validationErrors = computed<Partial<Record<NodeField, string>>>(() => {
    this.i18n();
    const errs: Partial<Record<NodeField, string>> = {};

    if (this.mode() === 'create') {
      const code = this.code().trim();
      if (!code) {
        errs.code = this.transloco.translate('invSetup.common.required');
      } else if (code.length > INVENTORY_LIMITS.nodeCode) {
        errs.code = this.transloco.translate('invSetup.nodeModal.errors.maxLength', {
          max: INVENTORY_LIMITS.nodeCode,
        });
      } else if (!NODE_CODE_CHARS_RE.test(code)) {
        errs.code = this.transloco.translate('invSetup.nodeModal.errors.codePattern');
      }
    }

    const name = this.name().trim();
    if (!name) {
      errs.name = this.transloco.translate('invSetup.common.required');
    } else if (name.length > INVENTORY_LIMITS.nodeName) {
      errs.name = this.transloco.translate('invSetup.nodeModal.errors.maxLength', {
        max: INVENTORY_LIMITS.nodeName,
      });
    }

    if (!this.timezone().trim()) {
      errs.timezone = this.transloco.translate('invSetup.common.required');
    }

    const branches = this.branchIds();
    if (branches.length === 0) {
      errs.branches = this.transloco.translate('invSetup.nodeModal.errors.branchesRequired');
    } else if (branches.length > MAX_NODE_BRANCHES) {
      errs.branches = this.transloco.translate('invSetup.nodeModal.errors.branchesMax');
    }

    return errs;
  });

  protected readonly isValid = computed(() => Object.keys(this.validationErrors()).length === 0);

  protected readonly codeError = computed(() => this.resolveFieldError('code'));
  protected readonly nameError = computed(() => this.resolveFieldError('name'));
  protected readonly timezoneError = computed(() => this.resolveFieldError('timezone'));
  protected readonly branchesError = computed(() => this.resolveFieldError('branches'));

  protected readonly activeTypeIndex = computed(() => {
    const current = this.nodeType();
    const idx = this.nodeTypes.findIndex((item) => item.value === current);
    return idx >= 0 ? idx : 0;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.tzOpen()) return;
      const target = event.target;
      const pop = this.tzPopover()?.nativeElement;
      if (target instanceof Node && pop?.contains(target)) return;
      this.closeTzMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      this.loadSeq++;
    });
  }

  openCreate(): void {
    this.loadSeq++;
    this.mode.set('create');
    this.loading.set(false);
    this.saving.set(false);
    this.loadedNode.set(null);

    const browserTz = detectBrowserTimezone();
    this.initialCreateTimezone = browserTz;
    this.code.set('');
    this.name.set('');
    this.nodeType.set('WAREHOUSE');
    this.timezone.set(browserTz);
    this.status.set('ACTIVE');
    this.branchIds.set([]);

    this.resetValidation();
    this.closeTzMenu();
    this.formIdempotencyKey = newIdempotencyKey();
    this.allowClose = false;
    this.modal().open();
  }

  openNode(id: string): void {
    const seq = ++this.loadSeq;
    this.mode.set('edit');
    this.loading.set(true);
    this.saving.set(false);
    this.loadedNode.set(null);
    this.resetValidation();
    this.closeTzMenu();
    this.formIdempotencyKey = newIdempotencyKey();
    this.allowClose = false;
    this.modal().open();

    void this.fetchNode(id, seq);
  }

  close(): void {
    this.closeTzMenu();
    this.allowClose = true;
    this.modal().close();
  }

  protected typeIcon(type: NodeType): string {
    return TYPE_ICON_MAP[type];
  }

  protected onCodeInput(event: Event): void {
    if (!this.isCreateEditable() || this.saving()) return;
    this.code.set((event.target as HTMLInputElement).value);
    this.clearServerError('code');
  }

  protected onCodeBlur(): void {
    this.markTouched('code');
    if (!this.isCreateEditable()) return;
    const upper = this.code().trim().toUpperCase();
    if (upper !== this.code()) {
      this.code.set(upper);
    }
  }

  protected onNameInput(event: Event): void {
    if (this.isReadOnly() || this.saving()) return;
    this.name.set((event.target as HTMLInputElement).value);
    this.clearServerError('name');
  }

  protected selectType(type: NodeType): void {
    if (!this.isCreateEditable() || this.saving()) return;
    this.nodeType.set(type);
  }

  protected onTypeKeydown(event: KeyboardEvent, index: number): void {
    if (!this.isCreateEditable() || this.saving()) return;
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const len = this.nodeTypes.length;
    let target = -1;

    if (event.key === nextKey || event.key === 'ArrowDown') {
      target = (index + 1) % len;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      target = (index - 1 + len) % len;
    } else if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = len - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.nodeType.set(this.nodeTypes[target].value);
    this.typeButtons()[target]?.nativeElement.focus();
  }

  protected onStatusChange(active: boolean): void {
    if (this.isReadOnly() || this.mode() !== 'edit' || this.saving()) return;
    this.status.set(active ? 'ACTIVE' : 'INACTIVE');
  }

  protected onBranchesChange(next: string[]): void {
    if (this.isReadOnly() || this.saving()) return;
    this.branchIds.set(next);
    this.markTouched('branches');
    this.clearServerError('branches');
  }

  protected markTouched(field: NodeField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected toggleTzMenu(): void {
    if (this.isReadOnly() || this.saving()) return;
    if (this.tzOpen()) {
      this.closeTzMenu();
      return;
    }
    const seq = ++this.tzSeq;
    this.tzSearch.set('');
    this.tzPlaced.set(false);
    this.tzPlace.set(this.initialTzPlace());
    this.tzOpen.set(true);
    queueMicrotask(() => this.placeTzPopover(seq));
    afterNextRender(
      () => {
        this.placeTzPopover(seq);
        this.tzSearchInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected closeTzMenu(): void {
    this.tzSeq++;
    this.tzOpen.set(false);
    this.tzPlaced.set(false);
    this.tzSearch.set('');
  }

  protected closeTzIfOutside(event: Event): void {
    if (!this.tzOpen()) return;
    const container = this.tzContainer()?.nativeElement;
    if (!container || !container.contains(event.target as Node)) {
      this.closeTzMenu();
    }
  }

  protected onTzEscape(event: Event): void {
    if (!this.tzOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeTzMenu();
    this.tzTrigger()?.nativeElement.focus();
  }

  protected onTzSearchInput(event: Event): void {
    this.tzSearch.set((event.target as HTMLInputElement).value);
  }

  protected clearTzSearch(): void {
    this.tzSearch.set('');
    this.tzSearchInput()?.nativeElement.focus();
  }

  protected onTzSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.tzOptionButtons()[0]?.nativeElement.focus();
    } else if (event.key === 'Enter') {
      const first = this.filteredTimezones()[0];
      if (first) {
        event.preventDefault();
        this.selectTimezone(first);
      }
    } else if (event.key === 'Tab') {
      this.closeTzMenu();
    }
  }

  protected onTzOptionKeydown(event: KeyboardEvent, index: number): void {
    const buttons = this.tzOptionButtons();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0) {
        this.tzSearchInput()?.nativeElement.focus();
      } else {
        buttons[index - 1]?.nativeElement.focus();
      }
    } else if (event.key === 'Tab') {
      this.closeTzMenu();
    }
  }

  protected selectTimezone(zone: string): void {
    if (this.isReadOnly() || this.saving()) return;
    this.timezone.set(zone);
    this.markTouched('timezone');
    this.clearServerError('timezone');
    this.closeTzMenu();
    this.tzTrigger()?.nativeElement.focus();
  }

  protected undo(): void {
    if (this.saving()) return;
    this.closeTzMenu();
    if (this.mode() === 'create') {
      this.code.set('');
      this.name.set('');
      this.nodeType.set('WAREHOUSE');
      this.timezone.set(this.initialCreateTimezone);
      this.status.set('ACTIVE');
      this.branchIds.set([]);
    } else {
      const base = this.loadedNode();
      if (base) this.applyLoadedNode(base);
    }
    this.resetValidation();
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (this.dirty() && !this.isReadOnly()) {
      void this.confirmDiscardAndClose();
      return;
    }
    this.close();
  }

  protected onModalClosed(): void {
    this.closeTzMenu();
    if (this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty() && !this.isReadOnly()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.closed.emit();
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.saving() || this.loading() || this.isReadOnly()) return;

    this.submitted.set(true);
    this.serverErrors.set({});
    if (!this.isValid()) return;

    if (this.mode() === 'create') {
      await this.submitCreate();
      return;
    }
    if (!this.dirty()) return;
    await this.submitUpdate();
  }

  protected async reloadNode(): Promise<void> {
    const base = this.loadedNode();
    if (!base) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.formIdempotencyKey = newIdempotencyKey();
    await this.fetchNode(base.id, seq);
  }

  protected closeInUseAlert(): void {
    this.inUseAlert().close();
  }

  private async fetchNode(id: string, seq: number): Promise<void> {
    try {
      const node = await getCompanyNode(id, tradeContext(this.scope, 'COMPANY'));
      if (seq !== this.loadSeq) return;
      this.applyLoadedNode(node);
      this.resetValidation();
      this.loading.set(false);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.close();
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
      this.close();
    }
  }

  private applyLoadedNode(node: CompanyNode): void {
    this.loadedNode.set(node);
    this.code.set(node.code);
    this.name.set(node.name);
    this.nodeType.set(node.nodeType);
    this.timezone.set(node.timezone);
    this.status.set(node.status);
    this.branchIds.set(activeBranchIdsOf(node));
  }

  private async submitCreate(): Promise<void> {
    const normalizedCode = this.code().trim().toUpperCase();
    this.code.set(normalizedCode);

    this.saving.set(true);
    try {
      const created = await createNode(
        {
          code: normalizedCode,
          name: this.name().trim(),
          nodeType: this.nodeType(),
          timezone: this.timezone().trim(),
          branchIds: [...this.branchIds()],
        },
        this.formIdempotencyKey,
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('invSetup.nodes.toast.created'));
      this.saved.emit({ node: created, isNew: true });
      this.close();
    } catch (error) {
      this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private async submitUpdate(): Promise<void> {
    const base = this.loadedNode();
    if (!base) return;

    const patch: UpdateNodePatch = {};
    const trimmedName = this.name().trim();
    const trimmedTz = this.timezone().trim();
    const nextStatus = this.status();
    const nextBranches = this.branchIds();

    if (trimmedName !== base.name) patch.name = trimmedName;
    if (trimmedTz !== base.timezone) patch.timezone = trimmedTz;
    if (nextStatus !== base.status) patch.status = nextStatus;
    if (!sameStringSet(nextBranches, activeBranchIdsOf(base))) {
      patch.branchIds = [...nextBranches];
    }

    if (Object.keys(patch).length === 0) return;

    this.saving.set(true);
    try {
      const updated = await updateNode(
        base.id,
        base.version,
        patch,
        this.formIdempotencyKey,
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('invSetup.nodes.toast.saved'));
      this.saved.emit({ node: updated, isNew: false });
      this.close();
    } catch (error) {
      this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private handleSaveError(error: unknown): void {
    if (isForbiddenError(error)) {
      this.close();
      this.forbidden.emit();
      return;
    }
    if (error instanceof ApiError) {
      if (error.code === 'TRADE.INVENTORY.NODE_CONFLICT') {
        this.serverErrors.update((prev) => ({
          ...prev,
          code: this.transloco.translate('invSetup.nodeModal.errors.codeConflict'),
        }));
        return;
      }
      if (error.code === 'TRADE.INVENTORY.SCOPE_INVALID') {
        this.serverErrors.update((prev) => ({
          ...prev,
          branches: this.transloco.translate(errorKey(error)),
        }));
        return;
      }
      if (error.code === 'TRADE.INVENTORY.NODE_IN_USE') {
        this.inUseAlert().open();
        return;
      }
      if (error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return;
      }
    }
    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private resolveFieldError(field: NodeField): string | null {
    this.i18n();
    const server = this.serverErrors()[field];
    if (server) return server;
    const show = this.submitted() || Boolean(this.touched()[field]);
    if (!show) return null;
    return this.validationErrors()[field] ?? null;
  }

  private clearServerError(field: NodeField): void {
    if (!this.serverErrors()[field]) return;
    this.serverErrors.update((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  private resetValidation(): void {
    this.touched.set({});
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private initialTzPlace(): TzListPlace {
    const triggerEl = this.tzTrigger()?.nativeElement;
    if (!triggerEl) return { top: 0, start: 0, width: 0, maxHeight: null };
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeTzPopover(seq: number): void {
    if (seq !== this.tzSeq || !this.tzOpen() || this.tzPlaced()) return;
    const triggerEl = this.tzTrigger()?.nativeElement;
    const popEl = this.tzPopover()?.nativeElement;
    if (!triggerEl || !popEl) return;

    const rect = rectInPage(triggerEl);
    const popRect = rectInPage(popEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = popRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = popRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? popRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + popRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - popRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - popRect.width));

    this.tzPlace.set({ top, start, width: rect.width, maxHeight });
    this.tzPlaced.set(true);

    popEl.style.top = `${top}px`;
    popEl.style.insetInlineStart = `${start}px`;
    popEl.style.minWidth = `${rect.width}px`;
    popEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    popEl.classList.remove('invisible');
  }
}

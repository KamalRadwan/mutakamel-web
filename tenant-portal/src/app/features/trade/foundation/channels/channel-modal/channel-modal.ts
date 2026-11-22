import {
  Component,
  ElementRef,
  Injector,
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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBriefcase,
  tablerBroadcast,
  tablerBuildingSkyscraper,
  tablerBuildingStore,
  tablerCashRegister,
  tablerFileSearch,
  tablerMapPin,
  tablerPlugConnected,
  tablerRefresh,
  tablerShoppingCart,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext } from '../../../shared/trade-api';
import type {
  Channel,
  ChannelStatus,
  ChannelType,
} from '../../../shared/trade-foundation.model';
import { CHANNEL_TYPE_KEY, CHANNEL_TYPE_TILE, type TileSpec } from '../../../shared/trade-labels';
import { ChannelBranches } from '../channel-branches/channel-branches';
import {
  channelErrorKey,
  createChannel,
  getChannel,
  patchChannel,
  setChannelBranches,
} from '../channels.api';
import {
  CHANNEL_CODE_PATTERN,
  CHANNEL_LIMITS,
  CHANNEL_TYPES,
  type ChannelBranchInput,
  type ChannelBranchLink,
  type ChannelDetail,
  type ChannelPatchBody,
} from '../channels.model';

interface PreviewParts {
  before: string;
  hasCode: boolean;
  after: string;
}

const CODE_PLACEHOLDER = '__CHANNEL_CODE__';

@Component({
  selector: 'app-channel-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Switch,
    UnsavedDialog,
    ChannelBranches,
  ],
  providers: [
    provideIcons({
      tablerBriefcase,
      tablerCashRegister,
      tablerShoppingCart,
      tablerBuildingSkyscraper,
      tablerBuildingStore,
      tablerMapPin,
      tablerPlugConnected,
      tablerBroadcast,
      tablerFileSearch,
      tablerRefresh,
    }),
  ],
  templateUrl: './channel-modal.html',
})
export class ChannelModal {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');
  private readonly deactivateDialog = viewChild.required<ConfirmDialog>('deactivateDialog');

  protected readonly uid = `channel-modal-${++ChannelModal.nextId}`;
  protected readonly limits = CHANNEL_LIMITS;

  readonly channelId = input<string | null>(null);
  readonly canManage = input(true);

  readonly closed = output<void>();
  readonly saved = output<Channel>();

  protected readonly detail = signal<ChannelDetail | null>(null);
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly channelType = signal<ChannelType>('INTERNAL_SALES');
  protected readonly status = signal<ChannelStatus>('ACTIVE');

  private readonly baseName = signal('');
  private readonly baseStatus = signal<ChannelStatus>('ACTIVE');
  private readonly baseBranchActive = signal<Readonly<Record<string, boolean>>>({});
  protected readonly draftBranchActive = signal<Readonly<Record<string, boolean>>>({});

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly guardBusy = signal(false);

  private readonly attemptedSubmit = signal(false);
  private readonly serverCodeError = signal<string | null>(null);

  private allowClose = false;
  private initializedForKey: string | null | undefined = undefined;
  private lastBranchId: string | null = null;
  private loadSeq = 0;
  private readonly idempotencyByOp = new Map<string, { fingerprint: string; key: string }>();

  protected readonly isCreate = computed(
    () => this.channelId() === null && this.detail() === null,
  );

  protected readonly canEdit = computed(
    () => this.canManage() && (this.isCreate() || this.detail() !== null),
  );

  protected readonly changedBranchLinks = computed<ChannelBranchInput[]>(() => {
    if (!this.detail()) return [];
    const base = this.baseBranchActive();
    const draft = this.draftBranchActive();
    const changes: ChannelBranchInput[] = [];
    for (const branch of this.scope.branches()) {
      const nextActive = draft[branch.id] ?? false;
      const prevActive = base[branch.id] ?? false;
      if (nextActive !== prevActive) {
        changes.push({ branchId: branch.id, isActive: nextActive });
      }
    }
    return changes;
  });

  protected readonly dirty = computed(() => {
    if (this.isCreate()) {
      return (
        this.code() !== '' ||
        this.name() !== '' ||
        this.channelType() !== 'INTERNAL_SALES'
      );
    }
    if (!this.detail()) return false;
    return (
      this.name().trim() !== this.baseName() ||
      this.status() !== this.baseStatus() ||
      this.changedBranchLinks().length > 0
    );
  });

  protected readonly typeOptions = computed<DropdownOption<ChannelType>[]>(() => {
    this.i18n();
    this.language();
    return CHANNEL_TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(CHANNEL_TYPE_KEY[type]),
    }));
  });

  protected readonly selectedTypeTile = computed<TileSpec>(
    () => CHANNEL_TYPE_TILE[this.channelType()],
  );

  protected readonly selectedTypeLabel = computed(() => {
    this.i18n();
    this.language();
    return this.transloco.translate(CHANNEL_TYPE_KEY[this.channelType()]);
  });

  protected readonly modalTitle = computed(() => {
    this.i18n();
    this.language();
    if (this.isCreate()) {
      return this.transloco.translate('tradeChannels.modal.newTitle');
    }
    return this.detail()?.name ?? this.transloco.translate('tradeChannels.modal.newTitle');
  });

  protected readonly modalSubtitle = computed(() => {
    this.i18n();
    this.language();
    if (this.loading() || this.notFound() || this.loadFailed()) return '';
    return this.selectedTypeLabel();
  });

  protected readonly modalIcon = computed(() => {
    if (this.loading() || this.notFound() || this.loadFailed()) return 'tablerBroadcast';
    return this.selectedTypeTile().icon;
  });

  protected readonly modalTile = computed(() => {
    if (this.loading() || this.notFound() || this.loadFailed()) return 'bg-icon-violet';
    return this.selectedTypeTile().tile;
  });

  protected readonly codePreview = computed(() => this.code().trim().toUpperCase());

  protected readonly codePreviewParts = computed<PreviewParts>(() => {
    this.i18n();
    this.language();
    const raw = this.transloco.translate('tradeChannels.fields.code.preview', {
      code: CODE_PLACEHOLDER,
    });
    const idx = raw.indexOf(CODE_PLACEHOLDER);
    if (idx < 0) {
      return { before: raw, hasCode: false, after: '' };
    }
    return {
      before: raw.slice(0, idx),
      hasCode: true,
      after: raw.slice(idx + CODE_PLACEHOLDER.length),
    };
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    this.language();
    const serverErr = this.serverCodeError();
    if (serverErr) return this.transloco.translate(serverErr);
    if (!this.isCreate() || !this.attemptedSubmit()) return null;

    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('tradeChannels.errors.required');
    if (trimmed.length > CHANNEL_LIMITS.code) {
      return this.transloco.translate('tradeChannels.errors.maxLength', {
        max: CHANNEL_LIMITS.code,
      });
    }
    if (!CHANNEL_CODE_PATTERN.test(trimmed)) {
      return this.transloco.translate('tradeChannels.errors.codePattern');
    }
    return null;
  });

  protected readonly nameError = computed<string | null>(() => {
    this.i18n();
    this.language();
    if (!this.attemptedSubmit()) return null;

    const trimmed = this.name().trim();
    if (!trimmed) return this.transloco.translate('tradeChannels.errors.required');
    if (trimmed.length > CHANNEL_LIMITS.name) {
      return this.transloco.translate('tradeChannels.errors.maxLength', {
        max: CHANNEL_LIMITS.name,
      });
    }
    return null;
  });

  protected readonly deactivateTargetName = computed(
    () => this.name().trim() || this.detail()?.name || '',
  );

  constructor() {
    afterNextRender(() => {
      this.modal().open();
    });

    effect(() => {
      const id = this.channelId();
      const currentDetailId = untracked(() => this.detail()?.id ?? null);

      if (id === null) {
        if (this.initializedForKey === null && currentDetailId !== null) {
          return;
        }
        this.initializedForKey = null;
        untracked(() => this.resetForCreate());
        return;
      }

      this.initializedForKey = id;
      if (currentDetailId === id) return;
      untracked(() => {
        void this.loadChannel(id);
      });
    });

    effect(() => {
      const branchId = this.scope.branch()?.id ?? null;
      if (this.lastBranchId === null) {
        this.lastBranchId = branchId;
        return;
      }
      if (branchId === this.lastBranchId) return;
      this.lastBranchId = branchId;

      const current = untracked(() => this.detail());
      const currentCompanyId = untracked(() => this.scope.company().id);
      if (!current || current.companyId !== currentCompanyId) return;

      untracked(() => {
        void this.refreshLinksOnBranchChange(current.id);
      });
    });
  }

  isDirty(): boolean {
    return this.dirty();
  }

  forceClose(): void {
    this.allowClose = true;
    this.modal().close();
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving() || this.guardBusy()) return false;
    return this.confirmLeave();
  }

  protected onCodeInput(value: string): void {
    if (!this.isCreate() || !this.canManage()) return;
    this.code.set(value);
    this.serverCodeError.set(null);
  }

  protected onNameInput(value: string): void {
    if (!this.canEdit()) return;
    this.name.set(value);
  }

  protected onTypeChange(value: ChannelType): void {
    if (!this.isCreate() || !this.canManage()) return;
    this.channelType.set(value);
  }

  protected onActiveChange(checked: boolean): void {
    if (this.isCreate() || !this.canEdit()) return;
    this.status.set(checked ? 'ACTIVE' : 'INACTIVE');
  }

  protected onBranchToggle(change: { branchId: string; isActive: boolean }): void {
    if (this.isCreate() || !this.canEdit()) return;
    this.draftBranchActive.update((prev) => ({
      ...prev,
      [change.branchId]: change.isActive,
    }));
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  protected async submit(): Promise<boolean> {
    if (this.saving() || this.loading() || this.notFound() || this.loadFailed() || !this.canEdit()) {
      return false;
    }

    this.attemptedSubmit.set(true);
    this.serverCodeError.set(null);

    if (this.codeError() || this.nameError()) {
      this.focusFirstError();
      return false;
    }

    if (this.isCreate()) {
      return this.submitCreate();
    }
    return this.submitEdit();
  }

  protected undo(): void {
    if (this.isCreate() || this.saving()) return;
    this.name.set(this.baseName());
    this.status.set(this.baseStatus());
    this.draftBranchActive.set({ ...this.baseBranchActive() });
    this.attemptedSubmit.set(false);
    this.serverCodeError.set(null);
  }

  protected retryLoad(): void {
    const id = this.channelId() ?? this.detail()?.id ?? null;
    if (!id) return;
    void this.loadChannel(id);
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.guardBusy()) return;
    if (!(await this.confirmLeave())) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && (this.guardBusy() || this.saving())) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
    this.loadSeq++;
    this.closed.emit();
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal().close();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    if (this.guardBusy()) return false;

    this.guardBusy.set(true);
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    try {
      choice = await this.unsavedDialog().open();
    } finally {
      this.guardBusy.set(false);
    }

    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      this.discardChanges();
      return true;
    }
    return this.submit();
  }

  private discardChanges(): void {
    if (this.isCreate()) {
      this.resetForCreate();
    } else {
      this.name.set(this.baseName());
      this.status.set(this.baseStatus());
      this.draftBranchActive.set({ ...this.baseBranchActive() });
      this.attemptedSubmit.set(false);
      this.serverCodeError.set(null);
    }
  }

  private resetForCreate(): void {
    this.loadSeq++;
    this.detail.set(null);
    this.code.set('');
    this.name.set('');
    this.channelType.set('INTERNAL_SALES');
    this.status.set('ACTIVE');
    this.baseName.set('');
    this.baseStatus.set('ACTIVE');
    this.baseBranchActive.set({});
    this.draftBranchActive.set({});
    this.loading.set(false);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.saving.set(false);
    this.attemptedSubmit.set(false);
    this.serverCodeError.set(null);
    this.clearAllIdempotency();

    afterNextRender(() => this.focusCode(), { injector: this.injector });
  }

  private async loadChannel(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    const ctx = tradeContext(this.scope, 'COMPANY');
    this.loading.set(true);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.attemptedSubmit.set(false);
    this.serverCodeError.set(null);
    this.clearAllIdempotency();

    try {
      const loaded = await getChannel(ctx, id);
      if (seq !== this.loadSeq) return;
      this.applyLoaded(loaded);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loading.set(false);
      if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
    }
  }

  private async refreshLinksOnBranchChange(id: string): Promise<void> {
    const ctx = tradeContext(this.scope, 'COMPANY');
    try {
      const fresh = await getChannel(ctx, id);
      const current = this.detail();
      if (!current || current.id !== id) return;
      const prevBase = this.baseBranchActive();
      const prevDraft = this.draftBranchActive();
      const freshBase = this.buildBranchActiveMap(fresh.branches);
      const nextDraft: Record<string, boolean> = { ...freshBase };
      for (const branch of this.scope.branches()) {
        if ((prevDraft[branch.id] ?? false) !== (prevBase[branch.id] ?? false)) {
          nextDraft[branch.id] = prevDraft[branch.id] ?? false;
        }
      }
      this.detail.set({ ...current, branches: fresh.branches });
      this.baseBranchActive.set(freshBase);
      this.draftBranchActive.set(nextDraft);
    } catch {
      // Keep current state if branch link refresh fails.
    }
  }

  private buildBranchActiveMap(links: readonly ChannelBranchLink[]): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const branch of this.scope.branches()) {
      map[branch.id] = false;
    }
    for (const link of links) {
      map[link.branchId] = link.isActive;
    }
    return map;
  }

  private applyLoaded(loaded: ChannelDetail): void {
    const branchMap = this.buildBranchActiveMap(loaded.branches);
    this.detail.set(loaded);
    this.code.set(loaded.code);
    this.name.set(loaded.name);
    this.channelType.set(loaded.channelType);
    this.status.set(loaded.status);
    this.baseName.set(loaded.name);
    this.baseStatus.set(loaded.status);
    this.baseBranchActive.set(branchMap);
    this.draftBranchActive.set({ ...branchMap });
    this.loading.set(false);
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.attemptedSubmit.set(false);
    this.serverCodeError.set(null);
  }

  private async submitCreate(): Promise<boolean> {
    const ctx = tradeContext(this.scope, 'COMPANY');
    const body = {
      code: this.code().trim().toUpperCase(),
      name: this.name().trim(),
      channelType: this.channelType(),
    };
    const key = this.keyForBody('create', 'new', body);

    this.saving.set(true);
    try {
      const created = await createChannel(ctx, body, key);
      this.clearIdempotency('create');
      const loadedDetail: ChannelDetail = { ...created, branches: [] };
      this.applyLoaded(loadedDetail);
      this.notify.success(this.transloco.translate('tradeChannels.toast.created'));
      this.saved.emit(created);
      return true;
    } catch (error) {
      const errCode = errorCodeOf(error);
      if (errCode === 'TRADE.CATALOG.CODE_TAKEN') {
        this.clearIdempotency('create');
        this.serverCodeError.set('tradeChannels.errors.codeTaken');
        this.focusCode();
        return false;
      }
      if (
        error instanceof ApiError &&
        error.status === 422 &&
        (errCode === 'TRADE.CATALOG.ITEM_IDENTITY_INVALID' || errCode === 'ITEM_IDENTITY_INVALID') &&
        error.details?.['field']?.includes('code')
      ) {
        this.clearIdempotency('create');
        this.serverCodeError.set('tradeChannels.errors.codePattern');
        this.focusCode();
        return false;
      }
      if (
        errCode === 'TRADE.VALIDATION_FAILED' &&
        (!(error instanceof ApiError) ||
          !error.details ||
          'code' in error.details ||
          error.details['field']?.includes('code'))
      ) {
        this.clearIdempotency('create');
        this.serverCodeError.set('tradeChannels.errors.codePattern');
        this.focusCode();
        return false;
      }
      this.notify.error(this.transloco.translate(channelErrorKey(error)));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async submitEdit(): Promise<boolean> {
    const current = this.detail();
    if (!current || !this.dirty()) return true;

    if (this.baseStatus() === 'ACTIVE' && this.status() === 'INACTIVE') {
      if (this.guardBusy()) return false;
      this.guardBusy.set(true);
      let confirmed = false;
      try {
        confirmed = await this.deactivateDialog().open();
      } finally {
        this.guardBusy.set(false);
      }
      if (!confirmed) return false;
    }

    const patchBody: ChannelPatchBody = {};
    const trimmedName = this.name().trim();
    if (trimmedName !== this.baseName()) {
      patchBody.name = trimmedName;
    }
    if (this.status() !== this.baseStatus()) {
      patchBody.status = this.status();
    }

    const hasFieldChanges = patchBody.name !== undefined || patchBody.status !== undefined;
    const branchLinks = this.changedBranchLinks();
    const hasBranchChanges = branchLinks.length > 0;
    if (!hasFieldChanges && !hasBranchChanges) return true;

    const ctx = tradeContext(this.scope, 'COMPANY');
    let activeChannel: Channel = current;
    let patchedChannel = false;

    this.saving.set(true);
    try {
      if (hasFieldChanges) {
        const patchKey = this.keyForBody('patch', `${current.id}:${current.version}`, patchBody);
        const updated = await patchChannel(ctx, current.id, current.version, patchBody, patchKey);
        this.clearIdempotency('patch');
        activeChannel = updated;
        patchedChannel = true;

        this.detail.set({ ...updated, branches: current.branches });
        this.baseName.set(updated.name);
        this.baseStatus.set(updated.status);
        this.name.set(updated.name);
        this.status.set(updated.status);
      }

      let finalDetail: ChannelDetail;
      if (hasBranchChanges) {
        const branchesKey = this.keyForBody(
          'branches',
          `${activeChannel.id}:${activeChannel.version}`,
          branchLinks,
        );
        finalDetail = await setChannelBranches(
          ctx,
          activeChannel.id,
          activeChannel.version,
          branchLinks,
          branchesKey,
        );
        this.clearIdempotency('branches');
      } else {
        finalDetail = { ...activeChannel, branches: current.branches };
      }

      this.applyLoaded(finalDetail);
      this.notify.success(this.transloco.translate('tradeChannels.toast.saved'));
      this.saved.emit(finalDetail);
      return true;
    } catch (error) {
      if (patchedChannel) {
        this.saved.emit(activeChannel);
      }
      this.saving.set(false);
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION'
      ) {
        this.clearAllIdempotency();
        return this.handleEditConflict(
          current.id,
          trimmedName,
          this.status(),
          { ...this.draftBranchActive() },
        );
      }
      this.notify.error(this.transloco.translate(channelErrorKey(error)));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleEditConflict(
    channelId: string,
    draftName: string,
    draftStatus: ChannelStatus,
    draftBranches: Readonly<Record<string, boolean>>,
  ): Promise<boolean> {
    if (this.guardBusy()) return false;
    this.guardBusy.set(true);
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    try {
      choice = await this.conflictDialog().open();
    } finally {
      this.guardBusy.set(false);
    }

    if (choice === 'cancel') return false;

    if (choice === 'save') {
      await this.loadChannel(channelId);
      return false;
    }

    const ctx = tradeContext(this.scope, 'COMPANY');
    this.saving.set(true);
    let patchedInRetry = false;
    let activeChannel: Channel | null = null;
    try {
      const fresh = await getChannel(ctx, channelId);
      const nextName = draftName !== this.baseName() ? draftName : fresh.name;
      const nextStatus = draftStatus !== this.baseStatus() ? draftStatus : fresh.status;

      const prevBaseBranches = this.baseBranchActive();
      const freshBaseBranches = this.buildBranchActiveMap(fresh.branches);
      const mergedBranches: Record<string, boolean> = { ...freshBaseBranches };
      const branchLinksToSave: ChannelBranchInput[] = [];

      for (const branch of this.scope.branches()) {
        const draftVal = draftBranches[branch.id] ?? false;
        const prevVal = prevBaseBranches[branch.id] ?? false;
        const targetVal = draftVal !== prevVal ? draftVal : (freshBaseBranches[branch.id] ?? false);
        mergedBranches[branch.id] = targetVal;
        if (targetVal !== (freshBaseBranches[branch.id] ?? false)) {
          branchLinksToSave.push({ branchId: branch.id, isActive: targetVal });
        }
      }

      this.detail.set(fresh);
      this.baseName.set(fresh.name);
      this.baseStatus.set(fresh.status);
      this.baseBranchActive.set(freshBaseBranches);
      this.name.set(nextName);
      this.status.set(nextStatus);
      this.draftBranchActive.set(mergedBranches);

      const retryBody: ChannelPatchBody = {};
      if (nextName !== fresh.name) retryBody.name = nextName;
      if (nextStatus !== fresh.status) retryBody.status = nextStatus;

      const hasFieldChanges = retryBody.name !== undefined || retryBody.status !== undefined;
      const hasBranchChanges = branchLinksToSave.length > 0;

      if (!hasFieldChanges && !hasBranchChanges) {
        this.applyLoaded(fresh);
        this.notify.success(this.transloco.translate('tradeChannels.toast.saved'));
        this.saved.emit(fresh);
        return true;
      }

      activeChannel = fresh;
      if (hasFieldChanges) {
        const updated = await patchChannel(
          ctx,
          fresh.id,
          fresh.version,
          retryBody,
          newIdempotencyKey(),
        );
        activeChannel = updated;
        patchedInRetry = true;
        this.detail.set({ ...updated, branches: fresh.branches });
        this.baseName.set(updated.name);
        this.baseStatus.set(updated.status);
        this.name.set(updated.name);
        this.status.set(updated.status);
      }

      const finalDetail = hasBranchChanges
        ? await setChannelBranches(
            ctx,
            activeChannel.id,
            activeChannel.version,
            branchLinksToSave,
            newIdempotencyKey(),
          )
        : { ...activeChannel, branches: fresh.branches };

      this.applyLoaded(finalDetail);
      this.notify.success(this.transloco.translate('tradeChannels.toast.saved'));
      this.saved.emit(finalDetail);
      return true;
    } catch (error) {
      if (patchedInRetry && activeChannel) {
        this.saved.emit(activeChannel);
      }
      this.notify.error(this.transloco.translate(channelErrorKey(error)));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private keyForBody(op: string, scopeKey: string, body: unknown): string {
    const fingerprint = `${scopeKey}:${JSON.stringify(body)}`;
    const existing = this.idempotencyByOp.get(op);
    if (!existing || existing.fingerprint !== fingerprint) {
      const entry = { fingerprint, key: newIdempotencyKey() };
      this.idempotencyByOp.set(op, entry);
      return entry.key;
    }
    return existing.key;
  }

  private clearIdempotency(op: string): void {
    this.idempotencyByOp.delete(op);
  }

  private clearAllIdempotency(): void {
    this.idempotencyByOp.clear();
  }

  private focusCode(): void {
    this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-code`)?.focus();
  }

  private focusFirstError(): void {
    if (this.codeError()) {
      this.focusCode();
      return;
    }
    if (this.nameError()) {
      this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.uid}-name`)?.focus();
    }
  }
}

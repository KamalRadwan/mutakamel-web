import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsMaximize,
  tablerBan,
  tablerBox,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCloudOff,
  tablerFileSearch,
  tablerPackages,
  tablerRefresh,
  tablerTool,
  tablerX,
} from '@ng-icons/tabler-icons';
import { ApiError as CoreApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { TradeReasonPicker, type ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import { tenantWide } from '../../../shared/trade-access';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext } from '../../../shared/trade-api';
import { itemName, listUoms } from '../../../shared/trade-foundation.api';
import type {
  ItemDetail,
  ItemKind,
  ItemRow,
  ItemStatus,
  Owner,
  Uom,
} from '../../../shared/trade-foundation.model';
import { ALLOWED_ITEM_STATUS_MOVES, ITEM_KIND_TILE } from '../../../shared/trade-labels';
import {
  createItem,
  deleteItemImage,
  getItemDetail,
  getReferenceData,
  itemErrorKey,
  moveItemStatus,
  patchItem,
  putItemImage,
} from '../items.api';
import { actionKey, fileSignature } from '../../action-keys';
import type { ItemStatusReason } from '../items.model';
import {
  draftFromDetail,
  draftsEqual,
  emptyDraft,
  mapItemServerError,
  rebaseItemDraft,
  toCreateBody,
  toPatchBody,
  validateDraft,
  type DraftErrors,
  type FieldError,
  type ItemDraft,
} from '../item-form/item-draft';
import { ItemDraftStore } from '../item-form/item-draft-store';
import { ItemForm } from '../item-form/item-form';

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

function toItemRow(detail: ItemDetail): ItemRow {
  const {
    companyProfile: _cp,
    branchProfile: _bp,
    comboComponents: _cc,
    optionalProducts: _op,
    ...row
  } = detail;
  return { ...row, eligibility: null };
}

@Component({
  selector: 'app-item-modal',
  imports: [NgIcon, TranslocoPipe, Button, FullState, Modal, UnsavedDialog, TradeReasonPicker, ItemForm],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-item-form', alias: 'itemForm' },
      { scope: 'trade-items', alias: 'tradeItems' },
      { scope: 'trade-shared', alias: 'tradeShared' },
    ),
    provideIcons({
      tablerArrowsMaximize,
      tablerBan,
      tablerBox,
      tablerChevronLeft,
      tablerChevronRight,
      tablerCloudOff,
      tablerFileSearch,
      tablerPackages,
      tablerRefresh,
      tablerTool,
      tablerX,
    }),
  ],
  templateUrl: './item-modal.html',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class ItemModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly draftStore = inject(ItemDraftStore);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('mainModal');
  private readonly itemForm = viewChild(ItemForm);
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');
  private readonly discontinueModal = viewChild.required<Modal>('discontinueModal');
  protected readonly discontinueReasonPicker = viewChild<TradeReasonPicker>('discontinueReasonPicker');

  readonly itemId = input<string | null>(null);
  readonly listIds = input<string[]>([]);
  readonly initialKind = input<ItemKind | undefined>(undefined);

  readonly closed = output<void>();
  readonly saved = output<ItemRow>();
  readonly openFull = output<string>();
  readonly forbidden = output<void>();

  protected readonly forbiddenState = signal(false);
  protected readonly canManage = computed(() =>
    !this.forbiddenState() && runInInjectionContext(this.injector, () => tenantWide('trade.catalog_master.manage')),
  );

  protected readonly activeId = signal<string | null>(null);
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly base = signal<ItemDraft>(emptyDraft());
  protected readonly draft = signal<ItemDraft>(emptyDraft());
  protected readonly detail = signal<ItemDetail | null>(null);
  protected readonly itemVersion = signal(1);
  protected readonly pendingImageFile = signal<File | null>(null);

  protected readonly owners = signal<readonly Owner[]>([]);
  protected readonly uoms = signal<readonly Uom[]>([]);

  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploadingImage = signal(false);
  protected readonly updatingStatus = signal(false);
  protected readonly attemptedSubmit = signal(false);
  protected readonly serverErrors = signal<DraftErrors>({});
  protected readonly guardBusy = signal(false);
  protected readonly formDialogBusy = signal(false);
  protected readonly discontinueOpen = signal(false);
  protected readonly discontinueSubmitted = signal(false);
  protected readonly discontinueReason = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });

  private discontinueResolver: ((reason: ItemStatusReason | null) => void) | null = null;
  private initialized = false;
  private allowClose = false;
  private suppressClosedEmit = false;
  private skippingLeaveForFullPage = false;
  private loadSeq = 0;
  private lastBodyFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;
  private lastImageKey: string | null = null;
  private lastImageFile: File | null = null;

  protected readonly isDirty = computed(
    () => !draftsEqual(this.base(), this.draft()) || this.pendingImageFile() !== null,
  );

  protected readonly isReadonly = computed(
    () => !this.canManage() || this.loading() || this.loadFailed() || this.notFound() || this.forbiddenState(),
  );

  protected readonly canDiscontinue = computed(() => {
    if (!this.canManage() || this.mode() !== 'edit') return false;
    const status = this.detail()?.status;
    return Boolean(status && ALLOWED_ITEM_STATUS_MOVES[status].includes('DISCONTINUED'));
  });

  protected readonly kindTile = computed(() => ITEM_KIND_TILE[this.draft().itemKind]);

  protected readonly subtitleName = computed(() => {
    if (this.mode() !== 'edit') return '';
    const lang = this.language();
    const d = this.draft();
    const local = lang === 'ar' ? d.nameAr.trim() || d.nameEn.trim() : d.nameEn.trim() || d.nameAr.trim();
    if (local) return local;
    const loaded = this.detail();
    return loaded ? itemName(loaded, lang) : '';
  });

  protected readonly baseUom = computed<Uom | null>(() => {
    const id = this.draft().baseUomId;
    if (!id) return null;
    return this.uoms().find((u) => u.id === id) ?? null;
  });

  protected readonly categoryLabel = computed(() => {
    const summary = this.detail()?.categorySummary;
    if (!summary || summary.path.length === 0) return '';
    return summary.path.map((part) => part.name).join(' › ');
  });

  protected readonly navPosition = computed<{ index: number; total: number } | null>(() => {
    if (this.mode() !== 'edit') return null;
    const id = this.activeId();
    const ids = this.listIds();
    if (!id || ids.length === 0) return null;
    const index = ids.indexOf(id);
    if (index < 0) return null;
    return { index: index + 1, total: ids.length };
  });

  protected readonly errors = computed<DraftErrors>(() => {
    const server = this.serverErrors();
    if (!this.attemptedSubmit()) return server;
    const client = validateDraft(this.draft(), this.mode(), this.activeId());
    return { ...server, ...client };
  });

  protected readonly modalAriaLabel = computed(() => {
    this.i18n();
    if (this.mode() === 'create') {
      return this.transloco.translate('itemForm.modal.newTitle');
    }
    return this.subtitleName() || this.transloco.translate('itemForm.modal.title');
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.settleDiscontinue(null));

    void this.loadLookups();

    effect(() => {
      const incoming = this.itemId();
      if (this.initialized && incoming === untracked(() => this.activeId())) {
        return;
      }
      this.initialized = true;
      untracked(() => this.syncToItemId(incoming));
    });

    afterNextRender(
      () => {
        this.capDialogHeight();
        this.modal().open();
      },
      { injector: this.injector },
    );
  }

  async confirmLeave(): Promise<boolean> {
    if (this.skippingLeaveForFullPage) return true;
    if (this.forbiddenState() || !this.canManage() || !this.isDirty()) return true;
    if (this.loading() || this.loadFailed() || this.notFound()) return true;
    if (this.saving() || this.uploadingImage() || this.updatingStatus()) return false;
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
      this.draft.set(structuredClone(this.base()));
      this.pendingImageFile.set(null);
      this.attemptedSubmit.set(false);
      this.serverErrors.set({});
      return true;
    }
    return this.save(false, false);
  }

  protected onDraftChange(next: ItemDraft): void {
    this.draft.set(next);
    if (Object.keys(this.serverErrors()).length > 0) {
      this.serverErrors.set({});
    }
  }

  protected onImageClientError(err: FieldError | null): void {
    this.serverErrors.update((prev) => {
      const next = { ...prev };
      if (err) {
        next['image'] = err;
      } else {
        delete next['image'];
      }
      return next;
    });
  }

  protected async onImagePicked(file: File): Promise<void> {
    if (!this.canManage()) return;
    if (this.mode() === 'create') {
      this.pendingImageFile.set(file);
      this.onImageClientError(null);
      return;
    }

    const id = this.activeId();
    if (!id || this.uploadingImage() || this.saving()) return;
    await this.uploadImageEdit(id, file);
  }

  protected async onImageRemove(): Promise<void> {
    if (!this.canManage()) return;
    if (this.mode() === 'create') {
      this.pendingImageFile.set(null);
      this.onImageClientError(null);
      return;
    }

    const id = this.activeId();
    if (!id || this.uploadingImage() || this.saving()) return;
    await this.removeImageEdit(id);
  }

  protected async onStatusChange(targetStatus: ItemStatus): Promise<void> {
    if (!this.canManage() || this.mode() !== 'edit') return;
    const current = this.detail();
    const id = this.activeId();
    if (!current || !id || this.updatingStatus() || this.saving() || this.uploadingImage()) return;
    if (!ALLOWED_ITEM_STATUS_MOVES[current.status].includes(targetStatus)) return;

    let reason: ItemStatusReason | undefined;
    if (targetStatus === 'DISCONTINUED') {
      if (this.guardBusy()) return;
      this.guardBusy.set(true);
      try {
        const picked = await this.promptDiscontinueReason();
        if (!picked) return;
        reason = picked;
      } finally {
        this.guardBusy.set(false);
      }
    }

    if (current.itemKind === 'COMBO' && targetStatus === 'ACTIVE') {
      const components = this.draft().comboComponents;
      const valid = await this.checkComboComponentsActive(
        components.map((row) => row.componentItemId).filter((cid): cid is string => Boolean(cid)),
        components.length,
      );
      if (!valid) {
        this.serverErrors.update((prev) => ({
          ...prev,
          status: { key: 'itemForm.validation.comboInactive' },
        }));
        return;
      }
    }

    await this.executeStatusMove(id, targetStatus, reason);
  }

  protected undoChanges(): void {
    if (!this.isDirty() || this.saving() || this.uploadingImage()) return;
    this.draft.set(structuredClone(this.base()));
    this.pendingImageFile.set(null);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
  }

  protected async save(addAnother: boolean, updateUrl = true): Promise<boolean> {
    if (
      !this.canManage() ||
      this.saving() ||
      this.uploadingImage() ||
      this.updatingStatus() ||
      this.loading() ||
      this.loadFailed() ||
      this.notFound() ||
      this.forbiddenState()
    ) {
      return false;
    }

    this.attemptedSubmit.set(true);
    this.serverErrors.set({});
    const validation = validateDraft(this.draft(), this.mode(), this.activeId());
    if (Object.keys(validation).length > 0) {
      afterNextRender(() => this.itemForm()?.focusFirstError(), { injector: this.injector });
      return false;
    }

    if (this.mode() === 'create') {
      return this.submitCreate(addAnother, updateUrl);
    }
    return this.submitEdit();
  }

  protected async continueInFullPage(): Promise<void> {
    if (this.saving() || this.uploadingImage() || this.loading() || this.loadFailed() || this.notFound()) return;
    if (this.mode() === 'create') {
      this.draftStore.put(this.draft(), this.pendingImageFile());
      this.skippingLeaveForFullPage = true;
      this.suppressClosedEmit = true;
      this.allowClose = true;
      this.modal().close();
      this.openFull.emit('new');
      return;
    }

    const id = this.activeId();
    if (!id) return;
    if (this.isDirty()) {
      const ok = await this.confirmLeave();
      if (!ok) return;
    }
    this.skippingLeaveForFullPage = true;
    this.suppressClosedEmit = true;
    this.allowClose = true;
    this.modal().close();
    this.openFull.emit(id);
  }

  protected async goPrev(): Promise<void> {
    await this.stepNav(-1);
  }

  protected async goNext(): Promise<void> {
    await this.stepNav(1);
  }

  protected retryLoad(): void {
    const id = this.activeId();
    if (!id) return;
    void this.loadItem(id);
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.uploadingImage() || this.updatingStatus()) return;
    if (!(await this.confirmLeave())) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (
      !this.allowClose &&
      (this.guardBusy() || this.formDialogBusy() || this.saving() || this.uploadingImage() || this.updatingStatus())
    ) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.canManage() && this.isDirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
    const emitClosed = !this.suppressClosedEmit;
    this.suppressClosedEmit = false;
    if (emitClosed) {
      this.closed.emit();
    }
  }

  protected confirmDiscontinue(): void {
    this.discontinueSubmitted.set(true);
    if (!this.discontinueReasonPicker()?.valid()) return;
    const val = this.discontinueReason();
    if (!val.reasonCodeId) return;
    const note = val.note.trim();
    this.settleDiscontinue({
      reasonCodeId: val.reasonCodeId,
      ...(note ? { reasonNote: note } : {}),
    });
    this.discontinueModal().close();
  }

  protected cancelDiscontinue(): void {
    this.settleDiscontinue(null);
    this.discontinueModal().close();
  }

  protected onDiscontinueClosed(): void {
    this.discontinueOpen.set(false);
    this.settleDiscontinue(null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (
      this.loading() ||
      this.saving() ||
      this.uploadingImage() ||
      this.updatingStatus() ||
      this.guardBusy() ||
      this.formDialogBusy()
    ) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter') {
      if (event.defaultPrevented || !this.canManage()) return;
      event.preventDefault();
      void this.save(false);
      return;
    }
    if (this.mode() !== 'edit') return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const isPrev = rtl ? event.key === 'ArrowRight' : event.key === 'ArrowLeft';
    event.preventDefault();
    if (isPrev) {
      void this.goPrev();
    } else {
      void this.goNext();
    }
  }

  private promptDiscontinueReason(): Promise<ItemStatusReason | null> {
    this.settleDiscontinue(null);
    this.discontinueReason.set({ reasonCodeId: null, note: '' });
    this.discontinueSubmitted.set(false);
    this.discontinueOpen.set(true);
    this.discontinueModal().open();
    return new Promise<ItemStatusReason | null>((resolve) => {
      this.discontinueResolver = resolve;
    });
  }

  private settleDiscontinue(result: ItemStatusReason | null): void {
    const resolve = this.discontinueResolver;
    this.discontinueResolver = null;
    resolve?.(result);
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal().close();
    }
  }

  private syncToItemId(id: string | null): void {
    this.lastBodyFingerprint = null;
    this.lastIdempotencyKey = null;
    this.lastImageKey = null;
    this.lastImageFile = null;
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.forbiddenState.set(false);
    this.pendingImageFile.set(null);

    if (!id) {
      this.loadSeq += 1;
      const fresh = emptyDraft({ itemKind: this.initialKind() ?? 'PRODUCT' });
      this.activeId.set(null);
      this.mode.set('create');
      this.detail.set(null);
      this.itemVersion.set(1);
      this.loading.set(false);
      this.notFound.set(false);
      this.loadFailed.set(false);
      this.base.set(fresh);
      this.draft.set(structuredClone(fresh));
      afterNextRender(() => this.itemForm()?.focusPrimary(), { injector: this.injector });
      return;
    }

    this.activeId.set(id);
    this.mode.set('edit');
    void this.loadItem(id);
  }

  private async stepNav(dir: -1 | 1): Promise<void> {
    const pos = this.navPosition();
    if (!pos || this.loading() || this.saving() || this.uploadingImage() || this.updatingStatus()) return;
    const targetIdx = pos.index - 1 + dir;
    const ids = this.listIds();
    if (targetIdx < 0 || targetIdx >= ids.length) return;

    if (!(await this.confirmLeave())) return;

    const targetId = ids[targetIdx];
    if (!targetId || targetId === this.activeId()) return;
    this.syncToItemId(targetId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: targetId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async loadLookups(): Promise<void> {
    const companyCtx = tradeContext(this.scopeState, 'COMPANY');
    const [refRes, uomRes] = await Promise.allSettled([getReferenceData(companyCtx), listUoms()]);
    if (refRes.status === 'fulfilled') {
      this.owners.set(refRes.value.owners);
    }
    if (uomRes.status === 'fulfilled') {
      this.uoms.set(uomRes.value);
    }
  }

  private async loadItem(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.notFound.set(false);
    this.loadFailed.set(false);
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    this.pendingImageFile.set(null);

    try {
      const loaded = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
      if (seq !== this.loadSeq) return;
      const mapped = draftFromDetail(loaded);
      this.detail.set(loaded);
      this.itemVersion.set(loaded.version);
      this.base.set(mapped);
      this.draft.set(structuredClone(mapped));
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.forbiddenState.set(true);
        this.forbidden.emit();
      } else if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async submitCreate(addAnother: boolean, updateUrl = true): Promise<boolean> {
    const currentDraft = this.draft();
    const body = toCreateBody(currentDraft);
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastBodyFingerprint || !this.lastIdempotencyKey) {
      this.lastBodyFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    const pendingFile = this.pendingImageFile();
    if (pendingFile !== this.lastImageFile || !this.lastImageKey) {
      this.lastImageFile = pendingFile;
      this.lastImageKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createItem(body, this.lastIdempotencyKey);
      this.lastBodyFingerprint = null;
      this.lastIdempotencyKey = null;

      let imageFailed = false;
      if (pendingFile) {
        try {
          await putItemImage(created.id, created.version, pendingFile, this.lastImageKey);
          this.pendingImageFile.set(null);
          this.lastImageFile = null;
          this.lastImageKey = null;
        } catch {
          imageFailed = true;
        }
      }

      const fullDetail = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), created.id);
      this.saved.emit(toItemRow(fullDetail));

      if (imageFailed) {
        this.notify.warning(this.transloco.translate('itemForm.toast.imageFailed'));
        this.enterEditAfterCreate(fullDetail, updateUrl);
        return true;
      }

      this.notify.success(this.transloco.translate('itemForm.toast.created'));
      if (addAnother) {
        const next = emptyDraft({
          itemKind: currentDraft.itemKind,
          categoryId: currentDraft.categoryId,
          baseUomId: currentDraft.baseUomId,
        });
        this.base.set(next);
        this.draft.set(structuredClone(next));
        this.pendingImageFile.set(null);
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        afterNextRender(() => this.itemForm()?.focusPrimary(), { injector: this.injector });
      } else {
        this.enterEditAfterCreate(fullDetail, updateUrl);
      }
      return true;
    } catch (error) {
      this.handleWriteError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private enterEditAfterCreate(fullDetail: ItemDetail, updateUrl = true): void {
    const mapped = draftFromDetail(fullDetail);
    this.activeId.set(fullDetail.id);
    this.mode.set('edit');
    this.detail.set(fullDetail);
    this.itemVersion.set(fullDetail.version);
    this.base.set(mapped);
    this.draft.set(structuredClone(mapped));
    this.attemptedSubmit.set(false);
    this.serverErrors.set({});
    if (updateUrl) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { item: fullDetail.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private async submitEdit(): Promise<boolean> {
    const id = this.activeId();
    if (!id) return false;
    if (!this.isDirty()) return true;

    const body = toPatchBody(this.base(), this.draft());
    const fingerprint = JSON.stringify({ id, version: this.itemVersion(), body });
    if (fingerprint !== this.lastBodyFingerprint || !this.lastIdempotencyKey) {
      this.lastBodyFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      await patchItem(id, this.itemVersion(), body, this.lastIdempotencyKey);
      this.lastBodyFingerprint = null;
      this.lastIdempotencyKey = null;

      const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
      const mapped = draftFromDetail(fresh);
      this.detail.set(fresh);
      this.itemVersion.set(fresh.version);
      this.base.set(mapped);
      this.draft.set(structuredClone(mapped));
      this.attemptedSubmit.set(false);
      this.serverErrors.set({});
      this.notify.success(this.transloco.translate('itemForm.toast.saved'));
      this.saved.emit(toItemRow(fresh));
      return true;
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.saving.set(false);
        return this.handleEditConflict(id);
      }
      this.handleWriteError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleEditConflict(id: string): Promise<boolean> {
    const choice = await this.openConflictDialog();
    if (choice === 'cancel') return false;

    try {
      const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
      const freshDraft = draftFromDetail(fresh);
      if (choice === 'save') {
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        this.base.set(freshDraft);
        this.draft.set(structuredClone(freshDraft));
        this.attemptedSubmit.set(false);
        this.serverErrors.set({});
        this.saved.emit(toItemRow(fresh));
        return false;
      }

      const rebased = rebaseItemDraft(this.base(), freshDraft, this.draft());
      this.detail.set(fresh);
      this.itemVersion.set(fresh.version);
      this.base.set(freshDraft);
      this.draft.set(rebased);
      this.lastBodyFingerprint = null;
      this.lastIdempotencyKey = null;

      if (draftsEqual(freshDraft, rebased)) {
        this.attemptedSubmit.set(false);
        this.notify.success(this.transloco.translate('itemForm.toast.saved'));
        this.saved.emit(toItemRow(fresh));
        return true;
      }
      return this.save(false);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbiddenState.set(true);
        this.forbidden.emit();
        return false;
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
      return false;
    }
  }

  private async executeStatusMove(
    id: string,
    targetStatus: ItemStatus,
    reason?: ItemStatusReason,
  ): Promise<void> {
    this.updatingStatus.set(true);
    try {
      const action = actionKey('status', id, this.itemVersion(), targetStatus, reason);
      const saved = await moveItemStatus(id, this.itemVersion(), targetStatus, action.key, reason);
      action.done();
      this.itemVersion.set(saved.version);
      this.base.update((b) => ({ ...b, status: saved.status }));
      this.draft.update((d) => ({ ...d, status: saved.status }));
      this.serverErrors.update((prev) => {
        const next = { ...prev };
        delete next['status'];
        return next;
      });
      const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
      this.detail.set(fresh);
      this.itemVersion.set(fresh.version);
      this.notify.success(this.transloco.translate('itemForm.toast.statusChanged'));
      this.saved.emit(toItemRow(fresh));
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.updatingStatus.set(false);
        const choice = await this.openConflictDialog();
        if (choice === 'cancel') return;
        const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
        if (choice === 'save') {
          const freshDraft = draftFromDetail(fresh);
          this.detail.set(fresh);
          this.itemVersion.set(fresh.version);
          this.base.set(freshDraft);
          this.draft.set(structuredClone(freshDraft));
          return;
        }
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        await this.executeStatusMove(id, targetStatus, reason);
        return;
      }
      this.handleWriteError(error);
    } finally {
      this.updatingStatus.set(false);
    }
  }

  private async uploadImageEdit(id: string, file: File): Promise<void> {
    this.uploadingImage.set(true);
    try {
      const action = actionKey('image', id, this.itemVersion(), fileSignature(file));
      const receipt = await putItemImage(id, this.itemVersion(), file, action.key);
      action.done();
      this.itemVersion.set(receipt.itemVersion);
      this.onImageClientError(null);
      const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
      this.detail.set(fresh);
      this.itemVersion.set(fresh.version);
      this.notify.success(this.transloco.translate('itemForm.toast.imageSaved'));
      this.saved.emit(toItemRow(fresh));
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.uploadingImage.set(false);
        const choice = await this.openConflictDialog();
        if (choice === 'cancel') return;
        const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        if (choice === 'discard') {
          await this.uploadImageEdit(id, file);
        } else {
          const freshDraft = draftFromDetail(fresh);
          this.base.set(freshDraft);
          this.draft.set(structuredClone(freshDraft));
        }
        return;
      }
      this.handleWriteError(error);
    } finally {
      this.uploadingImage.set(false);
    }
  }

  private async removeImageEdit(id: string): Promise<void> {
    this.uploadingImage.set(true);
    try {
      const action = actionKey('image-remove', id, this.itemVersion());
      const removed = await deleteItemImage(id, this.itemVersion(), action.key);
      action.done();
      this.itemVersion.set(removed.itemVersion);
      this.onImageClientError(null);
      const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
      this.detail.set(fresh);
      this.itemVersion.set(fresh.version);
      this.notify.success(this.transloco.translate('itemForm.toast.imageRemoved'));
      this.saved.emit(toItemRow(fresh));
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.uploadingImage.set(false);
        const choice = await this.openConflictDialog();
        if (choice === 'cancel') return;
        const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        if (choice === 'discard') {
          await this.removeImageEdit(id);
        } else {
          const freshDraft = draftFromDetail(fresh);
          this.base.set(freshDraft);
          this.draft.set(structuredClone(freshDraft));
        }
        return;
      }
      this.handleWriteError(error);
    } finally {
      this.uploadingImage.set(false);
    }
  }

  private async openConflictDialog(): Promise<'save' | 'discard' | 'cancel'> {
    if (this.guardBusy()) return 'cancel';
    this.guardBusy.set(true);
    try {
      return await this.conflictDialog().open();
    } finally {
      this.guardBusy.set(false);
    }
  }

  private handleWriteError(error: unknown): void {
    if (isForbiddenError(error)) {
      this.forbiddenState.set(true);
      this.forbidden.emit();
      return;
    }
    const mapped = mapItemServerError(error);
    if (mapped) {
      this.serverErrors.set(mapped);
      afterNextRender(() => this.itemForm()?.focusFirstError(), { injector: this.injector });
    }
    this.notify.error(this.transloco.translate(itemErrorKey(error)));
  }

  private async checkComboComponentsActive(ids: readonly string[], expectedCount: number): Promise<boolean> {
    if (expectedCount < 1 || ids.length !== expectedCount) return false;
    try {
      const details = await Promise.all(ids.map((cid) => getItemDetail({}, cid)));
      return details.every((item) => item.itemKind === 'PRODUCT' && item.status === 'ACTIVE');
    } catch {
      return false;
    }
  }

  private capDialogHeight(): void {
    const dialog = this.host.nativeElement.querySelector<HTMLDialogElement>('ui-modal[data-main-modal] > dialog');
    if (!dialog) return;
    const cap = 'min(var(--modal-record-h), calc(100% - 2 * var(--space-16)), calc(100dvh - 2 * var(--space-16)))';
    dialog.style.height = cap;
    dialog.style.maxHeight = cap;
    dialog.style.overflow = 'hidden';
    const frame = dialog.firstElementChild as HTMLElement | null;
    if (frame) {
      frame.style.height = '100%';
      frame.style.maxHeight = '100%';
      frame.style.minHeight = '0';
      frame.style.overflow = 'hidden';
    }
  }
}

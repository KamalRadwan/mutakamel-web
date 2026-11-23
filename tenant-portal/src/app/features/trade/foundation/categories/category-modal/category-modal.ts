import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCategory, tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ApiError, errorCodeOf, errorKey, newIdempotencyKey } from '../../../shared/trade-api';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { createCategory, getCategory, renameCategory } from '../categories.api';
import {
  CATEGORY_CODE_MAX,
  CATEGORY_CODE_PATTERN,
  CATEGORY_CONTROL_BIDI_PATTERN,
  CATEGORY_NAME_MAX,
  type CategoryConflictStale,
  type CategoryDetail,
  type CategoryReceipt,
  type CategorySummary,
  type CreateCategoryBody,
  type RenameCategoryBody,
  categoryDepthTile,
  categoryNodeTile,
  deleteBlockerKey,
  formatCategoryPathText,
  inactiveAncestorName,
  normalizeClientText,
  staleKindOf,
} from '../categories.model';

type CategoryFormField = 'code' | 'displayName' | 'nameEn' | 'nameAr';

interface CategoryFormValue {
  code: string;
  displayName: string;
  nameEn: string;
  nameAr: string;
}

export type CategoryModalConflict =
  | { kind: 'create'; body: CreateCategoryBody; stale: CategoryConflictStale }
  | { kind: 'rename'; id: string; parentId: string | null; stale: CategoryConflictStale };

export interface CategoryModalSavedEvent {
  kind: 'create' | 'rename';
  id: string;
  parentId: string | null;
  receipt: CategoryReceipt;
}

function emptyForm(): CategoryFormValue {
  return { code: '', displayName: '', nameEn: '', nameAr: '' };
}

function detailToForm(detail: CategoryDetail): CategoryFormValue {
  return {
    code: detail.code,
    displayName: detail.displayName,
    nameEn: detail.localizedNames['en'] ?? '',
    nameAr: detail.localizedNames['ar'] ?? '',
  };
}

@Component({
  selector: 'app-category-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal],
  providers: [provideIcons({ tablerCategory, tablerLock })],
  templateUrl: './category-modal.html',
})
export class CategoryModal {
  private static nextId = 0;
  protected readonly uid = `category-modal-${++CategoryModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canManage = input(true);
  readonly treeVersion = input.required<number>();

  readonly saved = output<CategoryModalSavedEvent>();
  readonly treeVersionSeen = output<number>();
  readonly statusRequested = output<CategoryDetail>();
  readonly deleteRequested = output<CategoryDetail>();
  readonly conflict = output<CategoryModalConflict>();

  protected readonly codeMax = CATEGORY_CODE_MAX;
  protected readonly nameMax = CATEGORY_NAME_MAX;
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly createParent = signal<CategorySummary | null>(null);
  protected readonly detail = signal<CategoryDetail | null>(null);
  protected readonly form = signal<CategoryFormValue>(emptyForm());
  protected readonly loadingDetail = signal(false);
  protected readonly saving = signal(false);

  private readonly touched = signal<Partial<Record<CategoryFormField, boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private readonly serverFieldErrors = signal<Partial<Record<CategoryFormField, string>>>({});

  private loadSeq = 0;
  private allowClose = false;
  private confirmingDiscard = false;
  private pendingIdempotency: { bodyJson: string; key: string } | null = null;

  protected readonly headerTile = computed(() => {
    if (this.mode() === 'create') {
      const parentDepth = this.createParent()?.depth ?? 0;
      return categoryDepthTile(parentDepth + 1);
    }
    const current = this.detail();
    return current ? categoryNodeTile(current) : 'bg-icon-navy';
  });

  protected readonly modalTitle = computed(() => {
    this.i18n();
    if (this.mode() === 'create') {
      return this.transloco.translate('tradeCategories.modal.newTitle');
    }
    const current = this.detail();
    return current ? current.name : this.transloco.translate('tradeCategories.type');
  });

  protected readonly parentPathText = computed(() => {
    this.i18n();
    const rtl = this.language() === 'ar';
    if (this.mode() === 'create') {
      const parent = this.createParent();
      return parent ? formatCategoryPathText(parent.path, rtl) : this.transloco.translate('tradeCategories.modal.topLevel');
    }
    const current = this.detail();
    if (!current) return '';
    const parentSteps = current.path.slice(0, -1);
    return parentSteps.length > 0
      ? formatCategoryPathText(parentSteps, rtl)
      : this.transloco.translate('tradeCategories.modal.topLevel');
  });

  protected readonly validationErrors = computed<Partial<Record<CategoryFormField, string>>>(() => {
    this.i18n();
    const value = this.form();
    const errors: Partial<Record<CategoryFormField, string>> = {};

    if (this.mode() === 'create') {
      const code = value.code.trim().toUpperCase();
      if (!code) {
        errors.code = this.transloco.translate('tradeShared.common.required');
      } else if (!CATEGORY_CODE_PATTERN.test(code)) {
        errors.code = this.transloco.translate('tradeCategories.modal.codePattern');
      }
    }

    const displayErr = this.validateLocalizedText(value.displayName);
    if (displayErr) errors.displayName = displayErr;

    const enErr = this.validateLocalizedText(value.nameEn);
    if (enErr) errors.nameEn = enErr;

    const arErr = this.validateLocalizedText(value.nameAr);
    if (arErr) errors.nameAr = arErr;

    return errors;
  });

  protected readonly isValid = computed(() => Object.keys(this.validationErrors()).length === 0);

  protected readonly dirty = computed(() => {
    const value = this.form();
    if (this.mode() === 'create') {
      return Boolean(
        value.code.trim() ||
          value.displayName.trim() ||
          value.nameEn.trim() ||
          value.nameAr.trim(),
      );
    }
    const base = this.detail();
    if (!base) return false;
    return (
      normalizeClientText(value.displayName) !== base.displayName ||
      normalizeClientText(value.nameEn) !== (base.localizedNames['en'] ?? '') ||
      normalizeClientText(value.nameAr) !== (base.localizedNames['ar'] ?? '')
    );
  });

  protected readonly activateBlocked = computed(() => {
    const current = this.detail();
    return Boolean(current && current.status === 'INACTIVE' && current.inactiveAncestorId !== null);
  });

  protected readonly activateBlockedTitle = computed(() => {
    this.i18n();
    const current = this.detail();
    if (!current || !this.activateBlocked()) return null;
    return this.transloco.translate('tradeCategories.reason.activateParentFirst', {
      parent: inactiveAncestorName(current),
    });
  });

  protected readonly deleteBlockedTitle = computed(() => {
    this.i18n();
    const current = this.detail();
    if (!current || current.usage.canDelete) return null;
    return current.usage.deleteBlockers
      .map((blocker) => this.transloco.translate(deleteBlockerKey(blocker)))
      .join(' · ');
  });

  openCreate(parent: CategorySummary | null): void {
    this.loadSeq += 1;
    this.mode.set('create');
    this.createParent.set(parent);
    this.detail.set(null);
    this.form.set(emptyForm());
    this.loadingDetail.set(false);
    this.saving.set(false);
    this.pendingIdempotency = null;
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(id: string): void {
    this.mode.set('edit');
    this.createParent.set(null);
    this.detail.set(null);
    this.form.set(emptyForm());
    this.saving.set(false);
    this.pendingIdempotency = null;
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
    void this.fetchDetail(id, true);
  }

  refreshDetail(): void {
    const current = this.detail();
    if (this.mode() === 'edit' && current) {
      void this.fetchDetail(current.id, false);
    }
  }

  applyConflictReload(fresh: CategoryDetail): void {
    this.detail.set(fresh);
    this.form.set(detailToForm(fresh));
    this.pendingIdempotency = null;
    this.resetValidation();
  }

  applyConflictKeepMine(fresh: CategoryDetail): void {
    this.detail.set(fresh);
    this.pendingIdempotency = null;
  }

  forceClose(): void {
    this.allowClose = true;
    this.modal().close();
  }

  isOpenFor(id: string): boolean {
    return this.mode() === 'edit' && this.detail()?.id === id;
  }

  protected errorText(field: CategoryFormField): string | null {
    const serverErr = this.serverFieldErrors()[field];
    if (serverErr) {
      return serverErr;
    }
    const err = this.validationErrors()[field];
    if (!err) return null;
    if (!this.revealAllErrors() && !this.touched()[field]) return null;
    return err;
  }

  protected onCodeInput(event: Event): void {
    if (!this.canManage() || this.mode() === 'edit') return;
    const target = event.target as HTMLInputElement;
    const upper = target.value.toUpperCase();
    if (target.value !== upper) {
      target.value = upper;
    }
    this.form.update((curr) => ({ ...curr, code: upper }));
    this.clearServerFieldError('code');
  }

  protected onFieldInput(field: 'displayName' | 'nameEn' | 'nameAr', event: Event): void {
    if (!this.canManage()) return;
    const value = (event.target as HTMLInputElement).value;
    this.form.update((curr) => ({ ...curr, [field]: value }));
    this.clearServerFieldError(field);
  }

  protected markTouched(field: CategoryFormField): void {
    this.touched.update((curr) => (curr[field] ? curr : { ...curr, [field]: true }));
  }

  protected undo(): void {
    if (this.saving()) return;
    const base = this.detail();
    this.form.set(this.mode() === 'edit' && base ? detailToForm(base) : emptyForm());
    this.pendingIdempotency = null;
    this.resetValidation();
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (!this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    void this.confirmDiscard();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscard();
      return;
    }
    this.allowClose = false;
  }

  protected async save(): Promise<void> {
    if (!this.canManage() || this.saving() || !this.dirty()) return;

    this.revealAllErrors.set(true);
    if (!this.isValid()) return;

    const value = this.form();
    const displayName = normalizeClientText(value.displayName);
    const nameEn = normalizeClientText(value.nameEn);
    const nameAr = normalizeClientText(value.nameAr);

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const parentId = this.createParent()?.id ?? null;
        const body: CreateCategoryBody = {
          expectedTreeVersion: this.treeVersion(),
          code: value.code.trim().toUpperCase(),
          displayName,
          localizedNames: { en: nameEn, ar: nameAr },
          parentId,
          beforeId: null,
        };
        const key = this.idempotencyKeyFor({ kind: 'create', body });
        const receipt = await createCategory(body, key);
        this.pendingIdempotency = null;
        this.treeVersionSeen.emit(receipt.treeVersion);
        this.saved.emit({ kind: 'create', id: receipt.id, parentId, receipt });
        this.allowClose = true;
        this.modal().close();
        return;
      }

      const base = this.detail();
      if (!base) return;

      const patch: RenameCategoryBody = {};
      if (displayName !== base.displayName) {
        patch.displayName = displayName;
      }
      if (nameEn !== (base.localizedNames['en'] ?? '') || nameAr !== (base.localizedNames['ar'] ?? '')) {
        patch.localizedNames = { ...base.localizedNames, en: nameEn, ar: nameAr };
      }

      if (Object.keys(patch).length === 0) return;

      const key = this.idempotencyKeyFor({ kind: 'rename', id: base.id, version: base.version, patch });
      const receipt = await renameCategory(base.id, patch, base.version, key);
      this.pendingIdempotency = null;
      this.treeVersionSeen.emit(receipt.treeVersion);
      this.saved.emit({ kind: 'rename', id: base.id, parentId: base.parentId, receipt });
      this.allowClose = true;
      this.modal().close();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
        this.pendingIdempotency = null;
      }
      if (error instanceof ApiError && code === 'TRADE.VALIDATION_FAILED' && error.details) {
        const mapped: Partial<Record<CategoryFormField, string>> = {};
        if (error.details['code']?.[0]) mapped.code = error.details['code'][0];
        if (error.details['displayName']?.[0]) mapped.displayName = error.details['displayName'][0];
        if (error.details['localizedNames.en']?.[0]) mapped.nameEn = error.details['localizedNames.en'][0];
        if (error.details['localizedNames.ar']?.[0]) mapped.nameAr = error.details['localizedNames.ar'][0];
        if (Object.keys(mapped).length > 0) {
          this.serverFieldErrors.update((curr) => ({ ...curr, ...mapped }));
          return;
        }
      }
      if (code === 'TRADE.CATALOG.CATEGORY_CODE_TAKEN') {
        this.serverFieldErrors.update((curr) => ({
          ...curr,
          code: this.transloco.translate('tradeCategories.modal.codeTaken'),
        }));
        return;
      }
      if (code === 'TRADE.CATALOG.CATEGORY_NAME_TAKEN') {
        this.serverFieldErrors.update((curr) => ({
          ...curr,
          displayName: this.transloco.translate('tradeCategories.modal.nameTaken'),
        }));
        return;
      }
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const stale = staleKindOf(error);
        if (this.mode() === 'create') {
          this.conflict.emit({
            kind: 'create',
            body: {
              expectedTreeVersion: this.treeVersion(),
              code: value.code.trim().toUpperCase(),
              displayName,
              localizedNames: { en: nameEn, ar: nameAr },
              parentId: this.createParent()?.id ?? null,
              beforeId: null,
            },
            stale,
          });
        } else {
          const base = this.detail();
          if (base) {
            this.conflict.emit({ kind: 'rename', id: base.id, parentId: base.parentId, stale });
          }
        }
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      this.saving.set(false);
    }
  }

  private async fetchDetail(id: string, resetForm: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    if (resetForm) {
      this.loadingDetail.set(true);
    }
    try {
      const loaded = await getCategory(id);
      if (seq !== this.loadSeq) return;
      this.treeVersionSeen.emit(loaded.treeVersion);
      const keepDirtyDraft = !resetForm && this.dirty();
      this.detail.set(loaded);
      if (!keepDirtyDraft) {
        this.form.set(detailToForm(loaded));
        this.resetValidation();
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(this.transloco.translate(errorKey(error)));
      if (resetForm) {
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      if (seq === this.loadSeq && resetForm) {
        this.loadingDetail.set(false);
      }
    }
  }

  private validateLocalizedText(raw: string): string | null {
    if (CATEGORY_CONTROL_BIDI_PATTERN.test(raw)) {
      return this.transloco.translate('tradeShared.errors.TRADE_CATALOG_CATEGORY_INVALID');
    }
    const normalized = normalizeClientText(raw);
    if (!normalized) {
      return this.transloco.translate('tradeShared.common.required');
    }
    if (normalized.length > CATEGORY_NAME_MAX) {
      return this.transloco.translate('tradeShared.errors.TRADE_CATALOG_CATEGORY_INVALID');
    }
    return null;
  }

  private idempotencyKeyFor(payload: unknown): string {
    const bodyJson = JSON.stringify(payload);
    if (this.pendingIdempotency?.bodyJson === bodyJson) {
      return this.pendingIdempotency.key;
    }
    const key = newIdempotencyKey();
    this.pendingIdempotency = { bodyJson, key };
    return key;
  }

  private clearServerFieldError(field: CategoryFormField): void {
    if (!this.serverFieldErrors()[field]) return;
    this.serverFieldErrors.update((curr) => ({ ...curr, [field]: undefined }));
  }

  private resetValidation(): void {
    this.touched.set({});
    this.revealAllErrors.set(false);
    this.serverFieldErrors.set({});
  }

  private async confirmDiscard(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }
}

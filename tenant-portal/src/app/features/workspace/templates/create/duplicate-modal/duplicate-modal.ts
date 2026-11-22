import {
  Component,
  ElementRef,
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
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowsExchange, tablerCloudOff, tablerCopy, tablerLock } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { templateLayoutMeta } from '../../shared/template-family';
import { TemplatePageService } from '../../template-page/template-page.service';
import {
  CreateTemplateResponse,
  DuplicateTemplateDto,
  DuplicateTemplateSource,
  TemplateApiError,
  TemplateConvertibleLayoutMode,
  TemplateCreationScope,
  TemplateDefinitionDetail,
  TemplateDefinitionScope,
  TemplateVersionItem,
  duplicateTemplate,
  getCreationScopes,
  getTemplate,
  listVersions,
  newTemplateIdempotencyKey,
} from '../../templates.api';

export interface DuplicateTemplateModalOptions {
  templateId: string;
  sourceKind?: 'CURRENT_DRAFT' | 'VERSION';
  versionId?: string;
  convertLayout?: boolean;
  targetLayoutMode?: TemplateConvertibleLayoutMode;
  draftDirty?: boolean;
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,99}$/;
const CONVERTIBLE_MODES: readonly TemplateConvertibleLayoutMode[] = [
  'HYBRID_DOCUMENT',
  'FLOW_DOCUMENT',
  'FIXED_CANVAS',
];

function scopeKeyOf(scope: TemplateDefinitionScope): string {
  return scope.type === 'COMPANY' ? `COMPANY:${scope.companyId}` : 'TENANT';
}

function parseScopeKey(key: string): TemplateDefinitionScope {
  if (key.startsWith('COMPANY:')) {
    return { type: 'COMPANY', companyId: key.slice('COMPANY:'.length) };
  }
  return { type: 'TENANT' };
}

function makeDefaultCopyCode(sourceCode: string): string {
  const sanitized = sourceCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-');
  const candidate = `${sanitized || 'TPL'}-COPY`.slice(0, 100);
  return CODE_PATTERN.test(candidate) ? candidate : 'TPL-COPY';
}

function extractApiErrorCode(error: unknown): string | null {
  if (error instanceof TemplateApiError) return error.code;
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return null;
}

@Component({
  selector: 'app-template-duplicate-modal, app-duplicate-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal, UnsavedDialog],
  providers: [
    provideTranslocoScope(
      { scope: 'templates-create', alias: 'tplCreate' },
      { scope: 'templates', alias: 'templates' },
    ),
    provideIcons({ tablerArrowsExchange, tablerCloudOff, tablerCopy, tablerLock }),
  ],
  templateUrl: './duplicate-modal.html',
})
export class TemplateDuplicateModal {
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly pageService = inject(TemplatePageService, { optional: true });

  private readonly modal = viewChild.required<Modal>('dupModal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  readonly templateId = input<string | null>(null);
  readonly sourceKind = input<'CURRENT_DRAFT' | 'VERSION'>('CURRENT_DRAFT');
  readonly versionId = input<string | null>(null);
  readonly convertLayout = input(false);
  readonly navigateOnSuccess = input(true);
  readonly draftDirty = input(false);
  /** Supports optional declarative `[open]="..."` alongside imperative `.open(options)`. */
  readonly openInput = input<boolean | null>(null, { alias: 'open' });

  readonly duplicated = output<CreateTemplateResponse>();
  readonly closed = output<void>();

  constructor() {
    effect(() => {
      const attr = this.openInput();
      if (attr === null) return;
      if (attr && !untracked(() => this.isOpen())) {
        const id = this.templateId();
        if (id) {
          untracked(() =>
            this.open({
              templateId: id,
              sourceKind: this.sourceKind(),
              versionId: this.versionId() ?? undefined,
              convertLayout: this.convertLayout(),
            }),
          );
        }
      } else if (!attr && untracked(() => this.isOpen()) && !untracked(() => this.saving())) {
        untracked(() => this.closeImmediately());
      }
    });
  }

  protected readonly isOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly guardBusy = signal(false);
  protected readonly attempted = signal(false);
  private readonly optionDraftDirty = signal(false);

  protected readonly isDraftDirty = computed(
    () => this.draftDirty() || this.optionDraftDirty() || (this.pageService?.dirty() ?? false),
  );

  protected readonly activeTemplateId = signal<string | null>(null);
  protected readonly convertMode = signal(false);
  protected readonly templateDetail = signal<TemplateDefinitionDetail | null>(null);
  protected readonly versions = signal<TemplateVersionItem[]>([]);
  protected readonly creationScopes = signal<TemplateCreationScope[]>([]);

  protected readonly sourceKey = signal('DRAFT');
  protected readonly scopeKey = signal('');
  protected readonly targetLayout = signal<TemplateConvertibleLayoutMode>('FLOW_DOCUMENT');
  protected readonly name = signal('');
  protected readonly code = signal('');
  protected readonly description = signal('');
  protected readonly codeConflictError = signal<string | null>(null);

  private baseSnapshot = '';
  private allowClose = false;
  private loadSeq = 0;
  private pendingIdempotencyKey: string | null = null;
  private pendingSignature = '';
  private lastOpenOptions: DuplicateTemplateModalOptions | null = null;

  protected readonly modalTitleKey = computed(() =>
    this.convertMode() ? 'tplCreate.duplicate.titleConvert' : 'tplCreate.duplicate.titleDuplicate',
  );

  protected readonly modalSubtitle = computed(() => {
    this.i18n();
    const detail = this.templateDetail();
    return detail ? this.transloco.translate('tplCreate.duplicate.subtitle', { name: detail.name }) : '';
  });

  protected readonly isConvertiblePrint = computed(
    () => this.convertMode() && this.templateDetail()?.outputChannel === 'PRINT',
  );

  protected readonly sourceOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const detail = this.templateDetail();
    if (!detail) return [];

    const options: DropdownOption<string>[] = [];
    if (detail.capabilities.update.state !== 'HIDDEN') {
      const dirty = this.isDraftDirty();
      const baseLabel = this.transloco.translate('tplCreate.duplicate.sourceDraft', {
        revision: detail.currentDraft.revision,
      });
      options.push({
        value: 'DRAFT',
        label: dirty ? `${baseLabel} (${this.transloco.translate('tplCreate.duplicate.saveFirst')})` : baseLabel,
        disabled: dirty,
      });
    }

    for (const ver of this.versions()) {
      const key =
        ver.lifecycleStatus === 'RETIRED'
          ? 'tplCreate.duplicate.sourceVersionRetired'
          : 'tplCreate.duplicate.sourceVersionPublished';
      options.push({
        value: `VERSION:${ver.templateVersionId}`,
        label: this.transloco.translate(key, { version: ver.versionNumber }),
      });
    }

    return options;
  });

  protected readonly scopeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.creationScopes().map((item) =>
      item.type === 'TENANT'
        ? { value: 'TENANT', label: this.transloco.translate('tplCreate.details.tenantScope') }
        : { value: `COMPANY:${item.companyId}`, label: item.label },
    );
  });

  protected readonly targetLayoutOptions = computed<DropdownOption<TemplateConvertibleLayoutMode>[]>(() => {
    this.i18n();
    const currentLayout = this.templateDetail()?.layoutMode;
    return CONVERTIBLE_MODES.map((mode) => ({
      value: mode,
      label: this.transloco.translate(templateLayoutMeta(mode).labelKey),
      disabled: mode === currentLayout,
    }));
  });

  protected readonly sourceError = computed<string | null>(() => {
    this.i18n();
    if (!this.attempted()) return null;
    if (this.sourceKey() === 'DRAFT' && this.isDraftDirty()) {
      return this.transloco.translate('tplCreate.duplicate.saveFirst');
    }
    if (!this.sourceKey() || this.sourceOptions().length === 0) {
      return this.transloco.translate('tplCreate.duplicate.errors.sourceRequired');
    }
    return null;
  });

  protected readonly scopeError = computed<string | null>(() => {
    this.i18n();
    if (!this.attempted()) return null;
    if (!this.scopeKey() || this.creationScopes().length === 0) {
      return this.transloco.translate('tplCreate.details.errors.scopeRequired');
    }
    return null;
  });

  protected readonly targetLayoutError = computed<string | null>(() => {
    this.i18n();
    if (!this.attempted() || !this.isConvertiblePrint()) return null;
    if (this.targetLayout() === this.templateDetail()?.layoutMode) {
      return this.transloco.translate('tplCreate.duplicate.errors.targetLayoutRequired');
    }
    return null;
  });

  protected readonly nameError = computed<string | null>(() => {
    this.i18n();
    if (!this.attempted()) return null;
    const trimmed = this.name().trim();
    if (!trimmed) return this.transloco.translate('tplCreate.details.errors.nameRequired');
    if (trimmed.length > 200) return this.transloco.translate('tplCreate.details.errors.nameTooLong');
    return null;
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    if (this.codeConflictError()) return this.codeConflictError();
    if (!this.attempted()) return null;
    const normalized = this.code().trim().toUpperCase();
    if (!normalized) return this.transloco.translate('tplCreate.details.errors.codeRequired');
    if (normalized.length > 100) return this.transloco.translate('tplCreate.details.errors.codeTooLong');
    if (!CODE_PATTERN.test(normalized)) return this.transloco.translate('tplCreate.details.errors.codePattern');
    return null;
  });

  protected readonly descriptionError = computed<string | null>(() => {
    this.i18n();
    if (!this.attempted()) return null;
    if (this.description().trim().length > 1000) {
      return this.transloco.translate('tplCreate.details.errors.descriptionTooLong');
    }
    return null;
  });

  protected readonly formValid = computed(() => {
    const trimmedName = this.name().trim();
    const normalizedCode = this.code().trim().toUpperCase();
    const layoutOk = !this.isConvertiblePrint() || this.targetLayout() !== this.templateDetail()?.layoutMode;
    return (
      Boolean(this.sourceKey()) &&
      !(this.sourceKey() === 'DRAFT' && this.isDraftDirty()) &&
      this.sourceOptions().length > 0 &&
      Boolean(this.scopeKey()) &&
      this.creationScopes().length > 0 &&
      layoutOk &&
      trimmedName.length >= 1 &&
      trimmedName.length <= 200 &&
      normalizedCode.length >= 1 &&
      normalizedCode.length <= 100 &&
      CODE_PATTERN.test(normalizedCode) &&
      this.description().trim().length <= 1000 &&
      !this.codeConflictError()
    );
  });

  protected readonly dirty = computed(() => {
    if (this.loading() || this.loadFailed() || !this.isOpen() || !this.templateDetail()) return false;
    return this.computeSnapshot() !== this.baseSnapshot;
  });

  open(target: string | DuplicateTemplateModalOptions): void {
    const options: DuplicateTemplateModalOptions = typeof target === 'string' ? { templateId: target } : target;
    this.lastOpenOptions = options;
    this.allowClose = false;
    this.guardBusy.set(false);
    this.saving.set(false);
    this.attempted.set(false);
    this.codeConflictError.set(null);
    this.activeTemplateId.set(options.templateId);
    this.convertMode.set(Boolean(options.convertLayout));
    this.optionDraftDirty.set(Boolean(options.draftDirty));
    this.pendingIdempotencyKey = null;
    this.pendingSignature = '';

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }

    void this.load(options);
  }

  protected retryLoad(): void {
    if (this.lastOpenOptions) {
      void this.load(this.lastOpenOptions);
    }
  }

  protected requestCancel(): void {
    if (this.saving() || this.guardBusy()) return;
    if (!this.dirty()) {
      this.closeImmediately();
      return;
    }
    void this.confirmModalClose();
  }

  protected onCodeInput(raw: string): void {
    this.codeConflictError.set(null);
    this.code.set(raw.toUpperCase());
    this.invalidateIdempotency();
  }

  protected onNameInput(raw: string): void {
    this.name.set(raw);
    this.invalidateIdempotency();
  }

  protected onDescriptionInput(raw: string): void {
    this.description.set(raw);
    this.invalidateIdempotency();
  }

  protected onSourceChange(next: string): void {
    this.sourceKey.set(next);
    this.invalidateIdempotency();
  }

  protected onScopeChange(next: string): void {
    this.scopeKey.set(next);
    this.invalidateIdempotency();
  }

  protected onTargetLayoutChange(next: TemplateConvertibleLayoutMode): void {
    this.targetLayout.set(next);
    this.invalidateIdempotency();
  }

  protected async submit(): Promise<void> {
    const id = this.activeTemplateId();
    const detail = this.templateDetail();
    if (!id || !detail || this.saving() || this.loading() || this.loadFailed()) return;

    if (!this.formValid()) {
      this.attempted.set(true);
      return;
    }

    const dto = this.buildDto(detail);
    const signature = JSON.stringify(dto);
    if (!this.pendingIdempotencyKey || this.pendingSignature !== signature) {
      this.pendingIdempotencyKey = newTemplateIdempotencyKey();
      this.pendingSignature = signature;
    }

    this.saving.set(true);
    try {
      const response = await duplicateTemplate(id, dto, this.pendingIdempotencyKey);
      this.pendingIdempotencyKey = null;
      this.pendingSignature = '';
      this.notify.success(
        this.transloco.translate(
          this.isConvertiblePrint() ? 'tplCreate.duplicate.convertedTitle' : 'tplCreate.duplicate.duplicatedTitle',
        ),
        this.transloco.translate(
          this.isConvertiblePrint() ? 'tplCreate.duplicate.convertedText' : 'tplCreate.duplicate.duplicatedText',
          { name: response.definition.name },
        ),
      );
      this.duplicated.emit(response);
      this.closeImmediately();
      if (this.navigateOnSuccess()) {
        await this.router.navigate(['/workspace/operations/template-platform', response.definition.templateId, 'design']);
      }
    } catch (error) {
      const errCode = extractApiErrorCode(error);
      if (errCode === 'CORE.TEMPLATE.CODE.CONFLICT') {
        this.pendingIdempotencyKey = null;
        this.pendingSignature = '';
        this.codeConflictError.set(this.translateErrorMessage(error));
        this.attempted.set(true);
        queueMicrotask(() => this.codeInput()?.nativeElement.focus());
      } else {
        this.notify.error(this.translateErrorMessage(error));
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.guardBusy()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.resetStateOnClose();
  }

  private async load(options: DuplicateTemplateModalOptions): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.loadCorrelationId.set(null);

    try {
      const [detail, versionsRes, scopesRes] = await Promise.all([
        getTemplate(options.templateId),
        listVersions(options.templateId, { limit: 100 }),
        getCreationScopes(),
      ]);
      if (seq !== this.loadSeq) return;

      this.templateDetail.set(detail);
      this.versions.set(versionsRes.items);
      this.creationScopes.set(scopesRes.scopes);

      let initialSource = 'DRAFT';
      if (options.versionId && versionsRes.items.some((v) => v.templateVersionId === options.versionId)) {
        initialSource = `VERSION:${options.versionId}`;
      } else if (options.sourceKind === 'VERSION' && versionsRes.items.length > 0) {
        const preferred = detail.currentPublishedVersion?.templateVersionId;
        const match = preferred && versionsRes.items.some((v) => v.templateVersionId === preferred);
        initialSource = `VERSION:${match ? preferred : versionsRes.items[0].templateVersionId}`;
      } else if ((detail.capabilities.update.state === 'HIDDEN' || this.isDraftDirty()) && versionsRes.items.length > 0) {
        const preferred = detail.currentPublishedVersion?.templateVersionId;
        const match = preferred && versionsRes.items.some((v) => v.templateVersionId === preferred);
        initialSource = `VERSION:${match ? preferred : versionsRes.items[0].templateVersionId}`;
      } else if (this.isDraftDirty()) {
        initialSource = '';
      }
      this.sourceKey.set(initialSource);

      const availableScopes = scopesRes.scopes;
      const sourceScopeKey = scopeKeyOf(detail.scope);
      const matchedScope = availableScopes.some((s) => scopeKeyOf(s) === sourceScopeKey);
      const fallbackScope = availableScopes[0] ? scopeKeyOf(availableScopes[0]) : '';
      this.scopeKey.set(matchedScope ? sourceScopeKey : fallbackScope);

      const defaultLayout =
        options.targetLayoutMode && options.targetLayoutMode !== detail.layoutMode
          ? options.targetLayoutMode
          : CONVERTIBLE_MODES.find((m) => m !== detail.layoutMode) ?? 'FLOW_DOCUMENT';
      this.targetLayout.set(defaultLayout);

      const suffix = this.transloco.translate('tplCreate.duplicate.copySuffix');
      this.name.set(`${detail.name}${suffix}`.slice(0, 200));
      this.code.set(makeDefaultCopyCode(detail.code));
      this.description.set(detail.description ?? '');

      this.baseSnapshot = this.computeSnapshot();
      this.loading.set(false);
    } catch (error: unknown) {
      if (seq !== this.loadSeq) return;
      this.loading.set(false);
      this.loadCorrelationId.set(error instanceof TemplateApiError ? error.correlationId : null);
      this.loadFailed.set(true);
    }
  }

  private buildDto(detail: TemplateDefinitionDetail): DuplicateTemplateDto {
    const key = this.sourceKey();
    const source: DuplicateTemplateSource = key.startsWith('VERSION:')
      ? { kind: 'VERSION', versionId: key.slice('VERSION:'.length) }
      : { kind: 'CURRENT_DRAFT', expectedDraftRevision: detail.currentDraft.revision };

    const trimmedDesc = this.description().trim();
    return {
      source,
      code: this.code().trim().toUpperCase(),
      name: this.name().trim(),
      description: trimmedDesc || null,
      scope: parseScopeKey(this.scopeKey()),
      copyAssignments: false,
      ...(this.isConvertiblePrint() ? { conversion: { layoutMode: this.targetLayout() } } : {}),
    };
  }

  private async confirmModalClose(): Promise<void> {
    const choice = await this.openGuarded(() => this.unsavedDialog().open());
    if (choice === 'discard') {
      this.closeImmediately();
      return;
    }
    if (choice === 'save') {
      await this.submit();
    }
  }

  private async openGuarded<T>(fn: () => Promise<T>): Promise<T> {
    this.guardBusy.set(true);
    try {
      return await fn();
    } finally {
      this.guardBusy.set(false);
    }
  }

  private closeImmediately(): void {
    this.allowClose = true;
    this.modal().close();
    this.resetStateOnClose();
  }

  private resetStateOnClose(): void {
    this.allowClose = false;
    this.loadSeq++;
    this.isOpen.set(false);
    this.guardBusy.set(false);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.loadCorrelationId.set(null);
    this.optionDraftDirty.set(false);
    this.saving.set(false);
    this.attempted.set(false);
    this.codeConflictError.set(null);
    this.templateDetail.set(null);
    this.versions.set([]);
    this.creationScopes.set([]);
    this.baseSnapshot = '';
    this.invalidateIdempotency();
    this.closed.emit();
  }

  private invalidateIdempotency(): void {
    this.pendingIdempotencyKey = null;
    this.pendingSignature = '';
  }

  private computeSnapshot(): string {
    return JSON.stringify({
      sourceKey: this.sourceKey(),
      scopeKey: this.scopeKey(),
      targetLayout: this.targetLayout(),
      name: this.name(),
      code: this.code(),
      description: this.description(),
    });
  }

  private translateErrorMessage(error: unknown): string {
    const code = extractApiErrorCode(error);
    if (code) {
      const localKey = `tplCreate.errors.${code}`;
      const localMsg = this.transloco.translate(localKey);
      if (localMsg && localMsg !== localKey) return localMsg;

      const sharedKey = `templates.errors.${code}`;
      const sharedMsg = this.transloco.translate(sharedKey);
      if (sharedMsg && sharedMsg !== sharedKey) return sharedMsg;
    }
    if (error instanceof TemplateApiError && error.status === 0) {
      return this.transloco.translate('templates.errors.network');
    }
    return this.transloco.translate('templates.errors.generic');
  }
}

export { TemplateDuplicateModal as DuplicateModal };

import {
  Component,
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
import { FormField, disabled, form, readonly, required, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerLock,
  tablerRoute,
  tablerX,
} from '@ng-icons/tabler-icons';
import { ApiError, errorCodeOf, fieldErrorsOf, isRetryableWriteError, isValidationError, writeErrorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { AssignmentsApi } from '../assignments.api';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import {
  TemplateAssignmentDto,
  TemplateDataSourceKey,
  TemplateDefinitionDetail,
  TemplateDocumentType,
  TemplateListRow,
  TemplateLocale,
  TemplateOutputChannel,
  TemplateVersionItem,
  TemplatesApi,
} from '../../templates.api';
import type { AssignmentScopeOption } from '../assignments.model';
import {
  dateInputToEndIso,
  dateInputToStartIso,
  describeAssignmentScope,
  canManageAssignment,
  isProductionAssignableDocument,
  isoToDateInput,
  isoToEndDateInput,
  scopeKeyOf,
  todayDateInput,
  translateAssignmentError,
} from '../assignments.service';

interface AssignmentDraft {
  templateId: string;
  versionId: string;
  localeChoice: 'DEFAULT' | TemplateLocale;
  scopeKey: string;
  priority: string;
  isDefault: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

function emptyCreateDraft(defaultScopeKey: string): AssignmentDraft {
  return {
    templateId: '',
    versionId: '',
    localeChoice: 'DEFAULT',
    scopeKey: defaultScopeKey,
    priority: '100',
    isDefault: true,
    effectiveFrom: todayDateInput(),
    effectiveTo: null,
  };
}

function draftFromAssignment(row: TemplateAssignmentDto): AssignmentDraft {
  return {
    templateId: row.definitionId,
    versionId: row.versionId,
    localeChoice: row.locale ?? 'DEFAULT',
    scopeKey: scopeKeyOf(row.scope),
    priority: String(row.priority),
    isDefault: row.isDefault,
    effectiveFrom: isoToDateInput(row.effectiveFrom),
    effectiveTo: isoToEndDateInput(row.effectiveTo),
  };
}

function draftsEqual(a: AssignmentDraft, b: AssignmentDraft): boolean {
  return (
    a.templateId === b.templateId &&
    a.versionId === b.versionId &&
    a.localeChoice === b.localeChoice &&
    a.scopeKey === b.scopeKey &&
    a.priority.trim() === b.priority.trim() &&
    a.isDefault === b.isDefault &&
    a.effectiveFrom === b.effectiveFrom &&
    a.effectiveTo === b.effectiveTo
  );
}

@Component({
  selector: 'app-assignment-modal',
  imports: [
    FormField,
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    ConflictDialog,
    DateField,
    Dropdown,
    Field,
    Modal,
    Switch,
    UnsavedDialog,
  ],
  viewProviders: [provideTranslocoScope('templates', { scope: 'templates-assignments', alias: 'assignments' })],
  providers: [provideIcons({ tablerAlertTriangle, tablerLock, tablerRoute, tablerX })],
  templateUrl: './assignment-modal.html',
})
export class AssignmentModal {
  private static nextId = 0;
  protected readonly uid = `assignment-modal-${++AssignmentModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('assignmentModal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly deactivateConfirm = viewChild.required<ConfirmDialog>('deactivateConfirm');

  readonly definitions = input.required<readonly TemplateListRow[]>();
  readonly scopeOptions = input.required<readonly AssignmentScopeOption[]>();
  private readonly api = inject(AssignmentsApi);
  private readonly templatesApi = inject(TemplatesApi);
  private readonly tenantScope = inject(TenantScopeState);
  readonly canManage = computed(() => {
    const scope = this.mode() === 'edit' ? this.baseAssignment()?.scope
      : this.scopeOptions().find((opt) => opt.key === this.draft().scopeKey)?.scope;
    return !!scope && canManageAssignment(this.tenantScope.me(), scope);
  });
  protected readonly pickerDefinitions = signal<readonly TemplateListRow[]>([]);
  protected readonly definitionsLoading = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});
  private definitionsSeq = 0;
  private deactivateAction: { key: string; bodyJson: string } | null = null;

  readonly saved = output<{ assignment: TemplateAssignmentDto; isNew: boolean }>();
  readonly deactivated = output<string>();

  protected readonly isOpen = signal(false);
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly loading = signal(false);
  protected readonly versionsLoading = signal(false);
  protected readonly deactivating = signal(false);
  protected readonly guardBusy = signal(false);
  protected readonly conflictOpen = signal(false);

  protected readonly baseAssignment = signal<TemplateAssignmentDto | null>(null);
  protected readonly selectedDefinition = signal<TemplateDefinitionDetail | null>(null);
  protected readonly versions = signal<readonly TemplateVersionItem[]>([]);
  protected readonly baseDraft = signal<AssignmentDraft>(emptyCreateDraft('TENANT'));
  protected readonly draft = signal<AssignmentDraft>(emptyCreateDraft('TENANT'));
  private readonly draftScopeKey = computed(() => this.draft().scopeKey);

  protected readonly assignmentForm = form(this.draft, (path) => {
    disabled(path.templateId, { when: () => this.mode() !== 'create' || !this.canManage() || this.saving() || this.definitionsLoading() });
    disabled(path.versionId, { when: () => !this.canManage() || this.saving() || this.versionsLoading() });
    disabled(path.localeChoice, { when: () => this.mode() !== 'create' || !this.canManage() || this.saving() });
    disabled(path.scopeKey, { when: () => this.mode() !== 'create' || !this.canManage() || this.saving() });
    readonly(path.priority, { when: () => !this.canManage() || this.saving() });
    disabled(path.effectiveFrom, { when: () => !this.canManage() || this.saving() });
    disabled(path.effectiveTo, { when: () => !this.canManage() || this.saving() });
    disabled(path.isDefault, { when: () => !this.canManage() || this.saving() });

    required(path.templateId, { when: () => this.mode() === 'create' });
    required(path.versionId);
    validate(path.priority, ({ value }) => {
      const raw = value().trim();
      if (!/^\d+$/.test(raw)) return { kind: 'priorityRange' };
      const num = Number(raw);
      return Number.isSafeInteger(num) && num >= 0 && num <= 1000 ? undefined : { kind: 'priorityRange' };
    });
    required(path.effectiveFrom);
    validate(path.effectiveTo, ({ value, valueOf }) => {
      const from = valueOf(path.effectiveFrom);
      const to = value();
      if (from && to && to < from) return { kind: 'dateRange' };
      return undefined;
    });
  });

  protected readonly saving = computed(() => this.assignmentForm().submitting());

  private allowClose = false;
  private loadSeq = 0;
  private templateLoadSeq = 0;
  private lastLoadedTemplateId = '';
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  protected readonly eligibleDefinitions = computed<readonly TemplateListRow[]>(() =>
    this.pickerDefinitions().filter(
      (def) =>
        def.actions.manageAssignments.state === 'ENABLED' &&
        def.currentPublishedVersion !== null,
    ),
  );

  /** Published templates whose owner runtime is not available: shown disabled with the reason. */
  private readonly ownerUnavailableDefinitions = computed<readonly TemplateListRow[]>(() =>
    this.eligibleDefinitions().filter((def) => !isProductionAssignableDocument(def.documentType)),
  );

  protected readonly templateOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const unavailable = new Set(this.ownerUnavailableDefinitions().map((def) => def.templateId));
    const list = this.eligibleDefinitions().filter((def) => !unavailable.has(def.templateId));
    const reason = this.transloco.translate('assignments.disabledReasons.OWNER_RUNTIME_UNAVAILABLE');
    const disabledRows = this.ownerUnavailableDefinitions().map((def) => ({
      value: def.templateId,
      label: `${def.name} (${def.code}) (${reason})`,
      disabled: true,
      title: reason,
    }));
    if (list.length === 0) {
      return [
        { value: '', label: this.transloco.translate('assignments.modal.noEligibleTemplates'), disabled: true },
        ...disabledRows,
      ];
    }
    return [
      { value: '', label: this.transloco.translate('assignments.modal.selectTemplate'), disabled: true },
      ...list.map((def) => ({
        value: def.templateId,
        label: `${def.name} (${def.code})`,
      })),
      ...disabledRows,
    ];
  });

  protected readonly versionOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.versions();
    if (list.length === 0) {
      return [{ value: '', label: this.transloco.translate('assignments.modal.noPublishedVersions'), disabled: true }];
    }
    return list.map((ver) => ({
      value: ver.templateVersionId,
      label: this.transloco.translate('assignments.modal.versionOption', { number: ver.versionNumber }),
    }));
  });

  protected readonly languageOptions = computed<DropdownOption<'DEFAULT' | TemplateLocale>[]>(() => {
    this.i18n();
    const defLocale = this.selectedDefinition()?.locale ?? this.baseAssignment()?.locale ?? null;
    const opts: DropdownOption<'DEFAULT' | TemplateLocale>[] = [
      { value: 'DEFAULT', label: this.transloco.translate('assignments.locales.all') },
    ];
    if (defLocale) {
      opts.unshift({
        value: defLocale,
        label: this.transloco.translate(`assignments.locales.${defLocale}`),
      });
    }
    return opts;
  });

  protected readonly scopeDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.scopeOptions().map((opt) => ({ value: opt.key, label: opt.label })),
  );

  protected readonly dirty = computed(() => {
    if (!this.canManage() || this.loading()) return false;
    return !draftsEqual(this.baseDraft(), this.draft());
  });

  protected readonly isEditReadonly = computed(() => !this.canManage() || this.loading());

  protected readonly lockedTemplateLabel = computed(() => {
    this.i18n();
    const def = this.selectedDefinition();
    if (def) return `${def.name} (${def.code})`;
    const base = this.baseAssignment();
    if (base) {
      const fromList = this.definitions().find((d) => d.templateId === base.definitionId);
      if (fromList) return `${fromList.name} (${fromList.code})`;
    }
    return base?.definitionId ?? '';
  });

  protected readonly derivedDocumentTypeLabel = computed(() => {
    this.i18n();
    const docType =
      this.mode() === 'edit'
        ? this.baseAssignment()?.documentType
        : (this.selectedDefinition()?.documentType ?? this.versions()[0]?.documentType);
    return docType ? this.transloco.translate(`assignments.documents.${docType}`) : '—';
  });

  protected readonly derivedAdapterLabel = computed(() => {
    this.i18n();
    const adapter =
      this.mode() === 'edit'
        ? this.baseAssignment()?.adapterKey
        : (this.selectedDefinition()?.dataSourceKey ?? this.versions()[0]?.dataSourceKey);
    return adapter ? this.transloco.translate(`assignments.adapters.${adapter}`) : '—';
  });

  protected readonly lockedLanguageLabel = computed(() => {
    this.i18n();
    const locale = this.baseAssignment()?.locale;
    return locale
      ? this.transloco.translate(`assignments.locales.${locale}`)
      : this.transloco.translate('assignments.locales.all');
  });

  protected readonly lockedScopeLabel = computed(() => {
    this.i18n();
    const scope = this.baseAssignment()?.scope;
    if (!scope) return '—';
    return describeAssignmentScope(scope, this.scopeOptions(), (k) => this.transloco.translate(k)).label;
  });

  protected readonly deactivateTargetName = computed(() => {
    this.i18n();
    const base = this.baseAssignment();
    if (!base) return '';
    const def = this.selectedDefinition() ?? this.definitions().find((d) => d.templateId === base.definitionId);
    return def?.name ?? base.definitionId;
  });

  protected readonly deactivateTargetVersion = computed(() => {
    const base = this.baseAssignment();
    return base ? `v${base.versionNumber}` : '';
  });

  protected readonly templateError = computed(() => {
    this.i18n();
    if (this.serverErrors()['templateId']) return this.serverErrors()['templateId'];
    if (this.mode() !== 'create') return null;
    const state = this.assignmentForm.templateId();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('assignments.modal.templateRequired');
  });

  protected readonly versionError = computed(() => {
    this.i18n();
    if (this.serverErrors()['versionId']) return this.serverErrors()['versionId'];
    const state = this.assignmentForm.versionId();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('assignments.modal.versionRequired');
  });

  protected readonly priorityError = computed(() => {
    this.i18n();
    if (this.serverErrors()['priority']) return this.serverErrors()['priority'];
    const state = this.assignmentForm.priority();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('assignments.modal.priorityError');
  });

  protected readonly effectiveFromError = computed(() => {
    this.i18n();
    const serverErr = this.serverErrors()['effectiveFrom'];
    if (serverErr) return serverErr;
    const state = this.assignmentForm.effectiveFrom();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('assignments.modal.effectiveFromRequired');
  });

  protected readonly effectiveToError = computed(() => {
    this.i18n();
    if (this.serverErrors()['effectiveTo']) return this.serverErrors()['effectiveTo'];
    const state = this.assignmentForm.effectiveTo();
    if (!state.touched() || !state.errors().length) return null;
    return this.transloco.translate('assignments.modal.effectiveToRangeError');
  });

  constructor() {
    effect(() => {
      const isOpen = this.isOpen();
      const mode = this.mode();
      const templateId = this.draft().templateId;
      if (!isOpen || mode !== 'create' || !templateId) {
        this.lastLoadedTemplateId = templateId || '';
        return;
      }
      if (templateId !== this.lastLoadedTemplateId) {
        this.lastLoadedTemplateId = templateId;
        untracked(() => void this.onTemplateSelected(templateId));
      }
    });

    effect(() => {
      const open = this.isOpen();
      const scopeKey = this.draftScopeKey();
      if (open && this.mode() === 'create') untracked(() => void this.loadDefinitions(scopeKey));
    });

    effect(() => {
      this.draft();
      untracked(() => {
        this.serverErrors.set({});
      });
    });
  }

  openCreate(defaultScopeKey: string): void {
    this.loadSeq++;
    this.templateLoadSeq++;
    this.definitionsSeq++;
    this.deactivateAction = null;
    this.lastLoadedTemplateId = '';
    this.allowClose = false;
    this.guardBusy.set(false);
    this.conflictOpen.set(false);
    this.deactivating.set(false);
    this.loading.set(false);
    this.versionsLoading.set(false);
    this.serverErrors.set({});
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;

    this.mode.set('create');
    this.baseAssignment.set(null);
    this.selectedDefinition.set(null);
    this.versions.set([]);

    const resolvedScopeKey = this.scopeOptions().some((opt) => opt.key === defaultScopeKey)
      ? defaultScopeKey
      : (this.scopeOptions()[0]?.key ?? 'TENANT');

    const initial = emptyCreateDraft(resolvedScopeKey);
    this.baseDraft.set({ ...initial });
    this.assignmentForm().reset({ ...initial });

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }
  }

  openEdit(row: TemplateAssignmentDto): void {
    this.definitionsSeq++;
    this.templateLoadSeq++;
    this.deactivateAction = null;
    this.selectedDefinition.set(null);
    this.versions.set([]);
    this.lastLoadedTemplateId = '';
    this.allowClose = false;
    this.guardBusy.set(false);
    this.conflictOpen.set(false);
    this.deactivating.set(false);
    this.serverErrors.set({});
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;

    this.mode.set('edit');
    this.baseAssignment.set(row);
    const initial = draftFromAssignment(row);
    this.baseDraft.set({ ...initial });
    this.assignmentForm().reset({ ...initial });

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }

    void this.loadEditRecord(row.assignmentId, row.definitionId);
  }

  protected onDateFieldChange(field: 'effectiveFrom' | 'effectiveTo', value: string | null): void {
    if (this.isEditReadonly() || this.saving()) return;
    this.assignmentForm[field]().value.set(value);
    this.assignmentForm[field]().markAsTouched();
    this.assignmentForm[field]().markAsDirty();
  }

  protected clearEffectiveTo(): void {
    this.onDateFieldChange('effectiveTo', null);
  }

  protected undoChanges(): void {
    if (!this.dirty() || this.saving() || this.deactivating()) return;
    this.serverErrors.set({});
    this.assignmentForm().reset({ ...this.baseDraft() });
  }

  protected async save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    if (!this.canManage() || this.loading() || this.saving() || this.deactivating()) return false;

    this.serverErrors.set({});
    let succeeded = false;

    await submit(this.assignmentForm, async () => {
      const d = this.draft();
      const priority = Number(d.priority.trim());
      const effectiveFromIso = dateInputToStartIso(d.effectiveFrom!);
      const effectiveToIso = d.effectiveTo ? dateInputToEndIso(d.effectiveTo) : null;

      succeeded =
        this.mode() === 'create'
          ? await this.submitCreate(d, priority, effectiveFromIso, effectiveToIso)
          : await this.submitEdit(d, priority, effectiveFromIso, effectiveToIso);
      return undefined;
    });

    return succeeded;
  }

  protected async requestDeactivate(): Promise<void> {
    const base = this.baseAssignment();
    if (!this.canManage() || !base || base.status !== 'ACTIVE' || this.saving() || this.deactivating() || this.guardBusy()) {
      return;
    }

    this.guardBusy.set(true);
    let confirmed = false;
    try {
      confirmed = await this.deactivateConfirm().open();
    } finally {
      this.guardBusy.set(false);
    }
    if (!confirmed) return;

    this.deactivating.set(true);
    try {
      const bodyJson = JSON.stringify([base.assignmentId, base.etag]);
      if (this.deactivateAction?.bodyJson !== bodyJson) this.deactivateAction = { key: newIdempotencyKey(), bodyJson };
      await this.api.deactivateAssignment(base.assignmentId, base.etag, this.deactivateAction!.key);
      this.deactivateAction = null;
      this.notify.success(this.transloco.translate('assignments.toasts.deactivated'));
      this.deactivated.emit(base.assignmentId);
      this.closeImmediate();
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.deactivateAction = null;
      this.handleWriteError(error);
    } finally {
      this.deactivating.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.deactivating() || this.guardBusy() || this.conflictOpen()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && (this.saving() || this.deactivating() || this.guardBusy() || this.conflictOpen())) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmLeaveAndClose();
      return;
    }
    this.resetOnClose();
  }

  protected async reloadFromConflict(): Promise<void> {
    const base = this.baseAssignment();
    this.conflictOpen.set(false);
    if (!base) return;
    await this.loadEditRecord(base.assignmentId, base.definitionId);
  }

  protected async keepChangesAfterConflict(): Promise<void> {
    this.conflictOpen.set(false);
    const base = this.baseAssignment();
    if (!base) return;
    this.loading.set(true);
    try {
      const latest = await this.api.getAssignment(base.assignmentId);
      this.baseAssignment.update((current) => current ? { ...current, revision: latest.revision, etag: latest.etag } : current);
      this.lastFingerprint = null;
      this.lastIdempotencyKey = null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) this.closeGone();
      this.notify.error(translateAssignmentError(error, (k, p) => this.transloco.translate(k, p)));
    } finally { this.loading.set(false); }
  }

  private async loadDefinitions(scopeKey: string): Promise<void> {
    const seq = ++this.definitionsSeq;
    const scope = this.scopeOptions().find((opt) => opt.key === scopeKey)?.scope;
    if (!scope) return;
    this.pickerDefinitions.set([]);
    this.templateLoadSeq++;
    this.lastLoadedTemplateId = '';
    this.assignmentForm.templateId().value.set('');
    this.assignmentForm.versionId().value.set('');
    this.selectedDefinition.set(null);
    this.versions.set([]);
    this.definitionsLoading.set(true);
    try {
      const items: TemplateListRow[] = [];
      let cursor: string | null = null;
      do {
        const page = await this.templatesApi.listTemplates({
          assignmentScopeType: scope.type,
          assignmentCompanyId: scope.type !== 'TENANT' ? scope.companyId : undefined,
          assignmentBranchId: scope.type === 'BRANCH' ? scope.branchId : undefined,
          cursor: cursor ?? undefined, limit: 100,
        });
        if (seq !== this.definitionsSeq || !this.isOpen()) return;
        items.push(...page.items);
        cursor = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
      } while (cursor);
      this.pickerDefinitions.set(items);
    } catch (error) {
      if (seq === this.definitionsSeq) this.notify.error(translateAssignmentError(error, (k, p) => this.transloco.translate(k, p)));
    } finally { if (seq === this.definitionsSeq) this.definitionsLoading.set(false); }
  }

  private async loadVersions(id: string): Promise<TemplateVersionItem[]> {
    const items: TemplateVersionItem[] = [];
    let cursor: string | null = null;
    do {
      const page = await this.templatesApi.listVersions(id, { lifecycleStatus: 'PUBLISHED', limit: 100, cursor: cursor ?? undefined });
      items.push(...page.items);
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
    } while (cursor);
    return items;
  }

  private async onTemplateSelected(templateId: string): Promise<void> {
    if (this.mode() !== 'create' || !templateId) return;
    this.serverErrors.set({});
    this.assignmentForm.versionId().value.set('');
    this.selectedDefinition.set(null);
    this.versions.set([]);
    const seq = ++this.templateLoadSeq;
    this.versionsLoading.set(true);

    try {
      const [detail, verPage] = await Promise.all([
        this.templatesApi.getTemplate(templateId),
        this.loadVersions(templateId),
      ]);
      if (seq !== this.templateLoadSeq || this.mode() !== 'create') return;

      this.selectedDefinition.set(detail);
      this.versions.set(verPage);
      const defaultVersionId =
        detail.currentPublishedVersion?.templateVersionId ??
        verPage[0]?.templateVersionId ??
        '';
      this.assignmentForm.versionId().value.set(defaultVersionId);
      this.assignmentForm.localeChoice().value.set(detail.locale);
    } catch (error) {
      if (seq !== this.templateLoadSeq) return;
      this.notify.error(translateAssignmentError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      if (seq === this.templateLoadSeq) {
        this.versionsLoading.set(false);
      }
    }
  }

  private async submitCreate(
    d: AssignmentDraft,
    priority: number,
    effectiveFromIso: string,
    effectiveToIso: string | null,
  ): Promise<boolean> {
    const def = this.selectedDefinition();
    const version = this.versions().find((v) => v.templateVersionId === d.versionId);
    const scopeOpt = this.scopeOptions().find((opt) => opt.key === d.scopeKey);
    if (!def || !version || !scopeOpt) return false;

    const adapterKey: TemplateDataSourceKey = def.dataSourceKey;
    const documentType: TemplateDocumentType = def.documentType;
    const outputChannel: TemplateOutputChannel = def.outputChannel;
    const locale: TemplateLocale | null = d.localeChoice === 'DEFAULT' ? null : d.localeChoice;

    const body = {
      versionId: d.versionId,
      adapterKey,
      documentType,
      outputChannel,
      locale,
      scope: scopeOpt.scope,
      priority,
      isDefault: d.isDefault,
      effectiveFrom: effectiveFromIso,
      effectiveTo: effectiveToIso,
    };

    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    try {
      const res = await this.api.createAssignment(body, this.lastIdempotencyKey);
      this.lastFingerprint = null;
      this.lastIdempotencyKey = null;
      this.notify.success(this.transloco.translate('assignments.toasts.created'), this.transloco.translate(res.impact.effectiveNow ? 'assignments.toasts.impactNow' : 'assignments.toasts.impactLater', { count: res.impact.affectedSelectors.length }));
      this.saved.emit({ assignment: res.assignment, isNew: true });
      this.closeImmediate();
      return true;
    } catch (error) {
      this.handleWriteError(error);
      return false;
    }
  }

  private async submitEdit(
    d: AssignmentDraft,
    priority: number,
    effectiveFromIso: string,
    effectiveToIso: string | null,
  ): Promise<boolean> {
    const base = this.baseAssignment();
    const baseD = this.baseDraft();
    if (!base) return false;

    const patch: {
      versionId?: string;
      priority?: number;
      isDefault?: boolean;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    } = {};

    if (d.versionId !== baseD.versionId) patch.versionId = d.versionId;
    if (priority !== Number(baseD.priority)) patch.priority = priority;
    if (d.isDefault !== baseD.isDefault) patch.isDefault = d.isDefault;
    if (d.effectiveFrom !== baseD.effectiveFrom) patch.effectiveFrom = effectiveFromIso;
    if (d.effectiveTo !== baseD.effectiveTo) patch.effectiveTo = effectiveToIso;

    if (Object.keys(patch).length === 0) return true;

    const fingerprint = JSON.stringify({ id: base.assignmentId, rev: base.etag, patch });
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    try {
      const res = await this.api.patchAssignment(base.assignmentId, patch, base.etag, this.lastIdempotencyKey);
      this.lastFingerprint = null;
      this.lastIdempotencyKey = null;
      this.baseAssignment.set(res.assignment);
      const nextDraft = draftFromAssignment(res.assignment);
      this.baseDraft.set({ ...nextDraft });
      this.assignmentForm().reset({ ...nextDraft });
      this.notify.success(this.transloco.translate('assignments.toasts.saved'));
      this.saved.emit({ assignment: res.assignment, isNew: false });
      this.closeImmediate();
      return true;
    } catch (error) {
      this.handleWriteError(error);
      return false;
    }
  }

  private closeGone(): void {
    const base = this.baseAssignment();
    if (base) this.deactivated.emit(base.assignmentId);
    this.closeImmediate();
  }

  private handleWriteError(error: unknown): void {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
      this.lastFingerprint = null;
      this.lastIdempotencyKey = null;
    }
    const code = errorCodeOf(error);
    const message = writeErrorMessage(error, 'assignments', (k, p) => this.transloco.translate(k, p));
    if (error instanceof ApiError) {
      if (error.status === 404 && this.mode() === 'edit') { this.closeGone(); return; }
      if (error.status === 409 && code?.endsWith('STALE_REVISION')) { this.conflictOpen.set(true); return; }
      if (code?.endsWith('ASSIGNMENT.CONFLICT')) {
        this.serverErrors.set(error.status === 422
          ? { effectiveTo: this.transloco.translate('assignments.modal.effectiveToRangeError') }
          : { effectiveFrom: this.transloco.translate('assignments.modal.overlapError') });
        return;
      }
      if (error.status === 422) {
        const field = code?.endsWith('VERSION_INCOMPATIBLE') ? 'versionId'
          : code?.endsWith('SCOPE_INVALID') ? 'scopeKey'
          : code?.endsWith('OWNER_RUNTIME_UNAVAILABLE') ? 'templateId' : null;
        if (field) { this.serverErrors.set({ [field]: message }); return; }
      }
      if (isValidationError(error) || (error.status === 400 && code?.endsWith('SCHEMA.INVALID'))) {
        const fields = fieldErrorsOf(isValidationError(error) ? error : new ApiError(error.status, 'VALIDATION_ERROR', error.details));
        const errors: Record<string, string> = {};
        for (const path of Object.keys(fields)) {
          const field = path.startsWith('scope') ? 'scopeKey' : path === 'locale' ? 'localeChoice'
            : ['adapterKey', 'documentType', 'outputChannel'].includes(path) ? 'templateId' : path;
          if (field in this.draft()) errors[field] = this.transloco.translate('assignments.modal.fieldInvalid');
        }
        if (Object.keys(errors).length) { this.serverErrors.set(errors); return; }
      }
    }
    this.notify.error(message);
  }

  private async loadEditRecord(assignmentId: string, definitionId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    try {
      const [assignment, detail, verPage] = await Promise.all([
        this.api.getAssignment(assignmentId),
        this.templatesApi.getTemplate(definitionId),
        this.loadVersions(definitionId),
      ]);
      if (seq !== this.loadSeq) return;

      this.baseAssignment.set(assignment);
      this.selectedDefinition.set(detail);
      this.versions.set(verPage);
      const next = draftFromAssignment(assignment);
      this.baseDraft.set({ ...next });
      this.assignmentForm().reset({ ...next });
      this.serverErrors.set({});
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 404) this.closeGone();
      this.notify.error(translateAssignmentError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  private async confirmLeaveAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (this.guardBusy()) return false;
    this.guardBusy.set(true);
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') {
        this.assignmentForm().reset({ ...this.baseDraft() });
        return true;
      }
      return await this.save();
    } finally {
      this.guardBusy.set(false);
    }
  }

  private resetOnClose(): void {
    this.allowClose = false;
    this.loadSeq++;
    this.templateLoadSeq++;
    this.definitionsSeq++;
    this.deactivateAction = null;
    this.lastLoadedTemplateId = '';
    this.isOpen.set(false);
    this.loading.set(false);
    this.versionsLoading.set(false);
    this.deactivating.set(false);
    this.conflictOpen.set(false);
    this.serverErrors.set({});
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;
  }
}

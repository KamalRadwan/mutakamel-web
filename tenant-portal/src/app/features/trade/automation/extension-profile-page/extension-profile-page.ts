import {
  Component,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerAlertTriangle,
  tablerArrowBackUp,
  tablerArrowLeft,
  tablerCheck,
  tablerChevronDown,
  tablerChevronRight,
  tablerDeviceFloppy,
  tablerEdit,
  tablerEye,
  tablerHistory,
  tablerPuzzle,
  tablerRefresh,
  tablerSend,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import type { WorkspaceUser } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, type TradeContext, errorCodeOf, tradeContext } from '../../shared/trade-api';
import { ActionKeys } from '../automation-shared/action-keys';
import { actorDisplayName } from '../automation-shared/actor';
import { formatDate } from '../../shared/trade-format';
import type { ScopeTarget } from '../automation-shared/automation.model';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import { ExtensionFieldModal } from '../extension-field-modal/extension-field-modal';
import { ExtensionFieldsTable } from '../extension-fields-table/extension-fields-table';
import {
  EXTENSION_PERMISSIONS,
  hasExtensionReadGrant,
  hasExtensionScopeGrant,
  isExtensionConflictError,
  isExtensionNotFoundError,
  isForbiddenError,
  isIdempotencyMismatch,
  parseExtensionScope,
} from '../extension-profiles-page/extension-access';
import { getProfile, getVersion, listVersions, publish, updateFields, validate } from '../extensions.api';
import type { ExtVersion, ExtensionField, ExtensionProfile } from '../extensions.model';
import { toFieldInput } from '../extensions.registry';

type ProfileTab = 'fields' | 'versions' | 'published';

const TABS: readonly { id: ProfileTab; icon: string; labelKey: string }[] = [
  { id: 'fields', icon: 'tablerAdjustmentsHorizontal', labelKey: 'extensions.profile.tabs.fields' },
  { id: 'versions', icon: 'tablerHistory', labelKey: 'extensions.profile.tabs.versions' },
  { id: 'published', icon: 'tablerEye', labelKey: 'extensions.profile.tabs.published' },
];

function parseTab(raw: string | undefined): ProfileTab {
  if (raw === 'versions' || raw === 'published') return raw;
  return 'fields';
}

function cloneFields(fields: readonly ExtensionField[] | undefined): ExtensionField[] {
  if (!fields) return [];
  return structuredClone(fields) as ExtensionField[];
}

function fieldsFingerprint(fields: readonly ExtensionField[]): string {
  return JSON.stringify(fields.map(toFieldInput));
}

let nextProfilePageId = 0;

@Component({
  selector: 'app-extension-profile-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    AutomationBadge,
    Button,
    ConfirmDialog,
    ConflictDialog,
    FullState,
    UnsavedDialog,
    ExtensionFieldModal,
    ExtensionFieldsTable,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-automation', alias: 'automation' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-auto-extensions', alias: 'extensions' }),
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerAlertTriangle,
      tablerArrowBackUp,
      tablerArrowLeft,
      tablerCheck,
      tablerChevronDown,
      tablerChevronRight,
      tablerDeviceFloppy,
      tablerEdit,
      tablerEye,
      tablerHistory,
      tablerPuzzle,
      tablerRefresh,
      tablerSend,
    }),
  ],
  templateUrl: './extension-profile-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-8 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class ExtensionProfilePage {
  protected readonly uid = `ext-profile-page-${++nextProfilePageId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly workspaceLookups = inject(WorkspaceLookups);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly fieldModal = viewChild.required(ExtensionFieldModal);
  private readonly testedResetDialog = viewChild.required<ConfirmDialog>('testedResetDialog');
  private readonly removeFieldDialog = viewChild.required<ConfirmDialog>('removeFieldDialog');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialog = viewChild.required(ConflictDialog);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  private readonly keys = new ActionKeys();

  readonly id = input.required<string>();
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });
  readonly scopeParam = input<string | undefined>(undefined, { alias: 'scope' });

  protected readonly scopeTarget = computed<ScopeTarget>(() => parseExtensionScope(this.scopeParam()));
  protected readonly ctx = computed<TradeContext>(() => tradeContext(this.scopeState, this.scopeTarget()));
  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasExtensionReadGrant(this.injector));
  protected readonly isForbidden = computed(() => !this.canRead() || this.forbidden());
  protected readonly tabsDef = TABS;

  protected readonly profile = signal<ExtensionProfile | null>(null);
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasExtensionScopeGrant(
        this.injector,
        this.scopeState,
        EXTENSION_PERMISSIONS.manage,
        this.profile()?.scopeTarget ?? this.scopeTarget(),
      ),
  );
  protected readonly canTest = this.canManage;
  protected readonly canPublish = computed(
    () =>
      !this.isForbidden() &&
      hasExtensionScopeGrant(
        this.injector,
        this.scopeState,
        EXTENSION_PERMISSIONS.publish,
        this.profile()?.scopeTarget ?? this.scopeTarget(),
      ),
  );
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);

  protected readonly versions = signal<ExtVersion[]>([]);
  private readonly publishers = resource({
    params: () => {
      const me = this.tenantScope.me();
      if (!me || this.isForbidden()) return undefined;
      const ids = [...new Set(this.versions().map((version) => version.publishedBy))]
        .filter((id): id is string => Boolean(id) && id !== me.id);
      return { ids, me, profileId: this.id(), context: this.ctx() };
    },
    loader: async ({ params }) => {
      const users: Record<string, WorkspaceUser> = {};
      await Promise.all(params.ids.map(async (id) => {
        try {
          const user = await this.workspaceLookups.user(id);
          if (user.id === id) users[id] = user;
        } catch {
          // Deleted or inaccessible authors use the existing empty-value label.
        }
      }));
      return users;
    },
  });
  protected readonly versionsLoading = signal(false);
  protected readonly versionsFailed = signal(false);
  protected readonly expandedVersionId = signal<string | null>(null);
  protected readonly versionDetails = signal<Readonly<Record<string, ExtVersion>>>({});
  protected readonly versionLoading = signal<Readonly<Record<string, boolean>>>({});
  protected readonly versionErrors = signal<Readonly<Record<string, boolean>>>({});

  protected readonly editingNewDraft = signal(false);
  private readonly baseFields = signal<ExtensionField[]>([]);
  protected readonly draftFields = signal<ExtensionField[]>([]);
  protected readonly diagnosticsByField = signal<Readonly<Record<string, readonly string[]>>>({});

  protected readonly removingKey = signal('');
  private editingFieldIndex: number | null = null;
  private loadSeq = 0;
  private versionsSeq = 0;
  private pendingConflictOp: 'save' | 'validate' | 'publish' | null = null;

  protected readonly activeTab = linkedSignal<string | undefined, ProfileTab>({
    source: () => this.tabParam(),
    computation: (param, previous) => {
      if (param !== previous?.source) return parseTab(param);
      return previous?.value ?? parseTab(param);
    },
  });

  protected readonly serverDraft = computed<ExtVersion | null>(
    () => this.profile()?.editableDraftVersion ?? null,
  );

  protected readonly publishedVersion = computed<ExtVersion | null>(
    () => this.profile()?.currentPublishedVersion ?? null,
  );

  protected readonly hasEditableDraft = computed(
    () => this.serverDraft() !== null || this.editingNewDraft(),
  );

  protected readonly fieldsTabReadonly = computed(
    () => !this.canManage() || !this.hasEditableDraft() || this.profile()?.status === 'RETIRED',
  );

  protected readonly displayedFields = computed<readonly ExtensionField[]>(() => {
    if (this.hasEditableDraft()) {
      return this.draftFields();
    }
    return this.publishedVersion()?.fields ?? [];
  });

  protected readonly dirty = computed(() => {
    if (!this.hasEditableDraft()) return false;
    return fieldsFingerprint(this.draftFields()) !== fieldsFingerprint(this.baseFields());
  });

  protected readonly subtitleText = computed(() => {
    this.i18n();
    this.language();
    const p = this.profile();
    if (!p) return '';
    const target = this.transloco.translate(`extensions.targets.${p.targetCode}`);
    const scope = this.transloco.translate(`extensions.scope.${p.scopeTarget}`);
    const live = p.currentPublishedVersion;
    if (live) {
      return this.transloco.translate('extensions.profile.subtitleLive', {
        target,
        scope,
        version: live.versionNumber,
      });
    }
    return this.transloco.translate('extensions.profile.subtitleNoLive', { target, scope });
  });

  protected readonly publishIsPrimary = computed(() => {
    const draft = this.serverDraft();
    return Boolean(
      draft &&
        draft.status === 'TESTED' &&
        !this.dirty(),
    );
  });

  protected readonly publishDisabledReason = computed<string | null>(() => {
    this.i18n();
    const draft = this.serverDraft();
    if (!draft || this.editingNewDraft()) {
      return this.transloco.translate('extensions.profile.saveBeforePublish');
    }
    if (this.dirty()) {
      return this.transloco.translate('extensions.profile.saveBeforePublish');
    }
    if (draft.status !== 'TESTED') {
      return this.transloco.translate('extensions.profile.validateFirst');
    }
    return null;
  });

  protected readonly validateDisabledReason = computed<string | null>(() => {
    this.i18n();
    if (!this.serverDraft() || this.dirty()) {
      return this.transloco.translate('extensions.profile.saveBeforeValidate');
    }
    return null;
  });

  constructor() {
    effect(() => {
      const profileId = this.id();
      const canRead = this.canRead();
      const ctx = this.ctx();
      untracked(() => {
        this.forbidden.set(false);
        if (!canRead) {
          this.loading.set(false);
          this.profile.set(null);
          return;
        }
        void this.loadAll(profileId, ctx);
      });
    });
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
    }
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.dirty()) return true;
    const choice = await this.unsavedDialog().open();
    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      this.undoChanges();
      return true;
    }
    return this.saveDraft();
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected async goBack(): Promise<void> {
    if (!(await this.canDeactivate())) return;
    const scope = this.scopeTarget() === 'TENANT' ? 'tenant' : undefined;
    void this.router.navigate(['/trade/automation/extension-profiles'], {
      ...(scope ? { queryParams: { scope } } : {}),
    });
  }

  protected retryLoad(): void {
    if (!this.canRead()) return;
    void this.loadAll(this.id(), this.ctx());
  }

  protected retryVersions(): void {
    if (!this.canRead()) return;
    void this.loadVersionsList(this.id(), this.ctx());
  }

  protected selectTab(tab: ProfileTab): void {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'fields' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let target = -1;
    if (event.key === nextKey) target = (index + 1) % TABS.length;
    else if (event.key === prevKey) target = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = TABS.length - 1;
    else return;

    event.preventDefault();
    const tab = TABS[target];
    if (!tab) return;
    this.selectTab(tab.id);
    this.tabButtons()[target]?.nativeElement.focus();
  }

  protected startChangeFields(): void {
    if (!this.canManage() || this.hasEditableDraft() || this.profile()?.status === 'RETIRED') return;
    const seed = cloneFields(this.publishedVersion()?.fields);
    this.baseFields.set(cloneFields(seed));
    this.draftFields.set(seed);
    this.diagnosticsByField.set({});
    this.editingNewDraft.set(true);
  }

  protected undoChanges(): void {
    this.draftFields.set(cloneFields(this.baseFields()));
    this.diagnosticsByField.set({});
    if (!this.serverDraft()) {
      this.editingNewDraft.set(false);
    }
  }

  protected openAddField(): void {
    const p = this.profile();
    if (!p || this.fieldsTabReadonly()) return;
    this.editingFieldIndex = null;
    const keys = this.draftFields().map((f) => f.fieldKey);
    this.fieldModal().openCreate(p.targetCode, keys);
  }

  protected openEditField(index: number): void {
    const p = this.profile();
    const target = this.draftFields()[index];
    if (!p || !target || this.fieldsTabReadonly()) return;
    this.editingFieldIndex = index;
    const keys = this.draftFields()
      .filter((_, i) => i !== index)
      .map((f) => f.fieldKey);
    this.fieldModal().openEdit(target, p.targetCode, keys);
  }

  protected onFieldModalSaved(field: ExtensionField): void {
    const idx = this.editingFieldIndex;
    this.editingFieldIndex = null;
    this.diagnosticsByField.set({});
    if (idx === null) {
      this.draftFields.update((list) => [...list, { ...field, ordinal: list.length + 1 }]);
    } else {
      this.draftFields.update((list) =>
        list.map((item, i) => (i === idx ? { ...field, ordinal: item.ordinal ?? i + 1 } : item)),
      );
    }
  }

  protected async requestRemoveField(index: number): Promise<void> {
    if (this.fieldsTabReadonly()) return;
    const target = this.draftFields()[index];
    if (!target) return;
    if (this.draftFields().length <= 1) {
      this.notify.warning(this.transloco.translate('extensions.profile.toasts.atLeastOneField'));
      return;
    }
    this.removingKey.set(target.fieldKey);
    const confirmed = await this.removeFieldDialog().open();
    if (!confirmed) return;
    this.diagnosticsByField.set({});
    this.draftFields.update((list) =>
      list
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, ordinal: i + 1 })),
    );
  }

  protected onToggleRequired(ev: { index: number; isRequired: boolean }): void {
    if (this.fieldsTabReadonly()) return;
    this.diagnosticsByField.set({});
    this.draftFields.update((list) =>
      list.map((item, i) => (i === ev.index ? { ...item, isRequired: ev.isRequired } : item)),
    );
  }

  protected onToggleSearchable(ev: { index: number; isSearchable: boolean }): void {
    const p = this.profile();
    if (!p || p.targetCode !== 'CATALOG_ITEM' || this.fieldsTabReadonly()) return;
    this.diagnosticsByField.set({});
    this.draftFields.update((list) =>
      list.map((item, i) => (i === ev.index ? { ...item, isSearchable: ev.isSearchable } : item)),
    );
  }

  protected async saveDraft(): Promise<boolean> {
    const p = this.profile();
    if (!p || !this.canManage() || !this.dirty() || this.busy()) return false;
    if (this.draftFields().length === 0) {
      this.notify.warning(this.transloco.translate('extensions.profile.toasts.atLeastOneField'));
      return false;
    }
    if (this.serverDraft()?.status === 'TESTED') {
      const confirmed = await this.testedResetDialog().open();
      if (!confirmed) return false;
    }

    const ctx = this.ctx();
    this.busy.set(true);
    try {
      const fields = this.draftFields().map(toFieldInput);
      const action = `save:${p.id}`;
      await updateFields(p.id, fields, p.version, this.keys.for(action, { fields, ifMatch: p.version }), ctx);
      this.keys.done(action);
      this.applyLoadedProfile(await getProfile(p.id, ctx));
      void this.loadVersionsList(p.id, ctx);
      this.notify.success(this.transloco.translate('extensions.profile.toasts.draftSaved'));
      return true;
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(`save:${p.id}`);
        this.forbidden.set(true);
        return false;
      }
      if (isExtensionNotFoundError(error)) {
        this.keys.done(`save:${p.id}`);
        this.notFound.set(true);
        return false;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(`save:${p.id}`);
      }
      if (isExtensionConflictError(error)) {
        this.pendingConflictOp = 'save';
        this.conflictDialog().open();
        return false;
      }
      this.notify.error(this.resolveErrorMessage(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async runValidate(): Promise<void> {
    const p = this.profile();
    if (!p || !this.canTest() || !this.serverDraft() || this.dirty() || this.busy()) return;

    const ctx = this.ctx();
    this.busy.set(true);
    try {
      const action = `validate:${p.id}`;
      const res = await validate(p.id, p.version, this.keys.for(action, { ifMatch: p.version }), ctx);
      this.keys.done(action);
      const grouped: Record<string, string[]> = {};
      for (const diag of res.diagnostics ?? []) {
        const list = grouped[diag.fieldKey] ?? [];
        list.push(diag.code);
        grouped[diag.fieldKey] = list;
      }
      this.diagnosticsByField.set(grouped);

      const fresh = await getProfile(p.id, ctx);
      this.applyLoadedProfile(fresh, grouped);
      void this.loadVersionsList(fresh.id, ctx);

      if (res.passed) {
        this.notify.success(this.transloco.translate('extensions.profile.toasts.validatedPassed'));
      } else {
        this.selectTab('fields');
        this.notify.warning(this.transloco.translate('extensions.profile.toasts.validatedFailed'));
      }
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(`validate:${p.id}`);
        this.forbidden.set(true);
        return;
      }
      if (isExtensionNotFoundError(error)) {
        this.keys.done(`validate:${p.id}`);
        this.notFound.set(true);
        return;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(`validate:${p.id}`);
      }
      if (isExtensionConflictError(error)) {
        this.pendingConflictOp = 'validate';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(this.resolveErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async runPublish(): Promise<void> {
    const p = this.profile();
    if (!p || !this.canPublish() || this.publishDisabledReason() || this.busy()) return;

    const ctx = this.ctx();
    this.busy.set(true);
    try {
      const action = `publish:${p.id}`;
      await publish(p.id, p.version, this.keys.for(action, { ifMatch: p.version }), ctx);
      this.keys.done(action);
      this.applyLoadedProfile(await getProfile(p.id, ctx));
      void this.loadVersionsList(p.id, ctx);
      this.notify.success(this.transloco.translate('extensions.profile.toasts.published'));
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(`publish:${p.id}`);
        this.forbidden.set(true);
        return;
      }
      if (isExtensionNotFoundError(error)) {
        this.keys.done(`publish:${p.id}`);
        this.notFound.set(true);
        return;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(`publish:${p.id}`);
      }
      if (isExtensionConflictError(error)) {
        this.pendingConflictOp = 'publish';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(this.resolveErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async onConflictReload(): Promise<void> {
    this.pendingConflictOp = null;
    await this.loadAll(this.id(), this.ctx());
  }

  protected async onConflictKeep(): Promise<void> {
    const op = this.pendingConflictOp;
    this.pendingConflictOp = null;
    const p = this.profile();
    if (!p) return;
    if (op === 'save') {
      try {
        const fresh = await getProfile(p.id, this.ctx());
        this.profile.set(fresh);
      } catch (error) {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
          return;
        }
        if (isExtensionNotFoundError(error)) {
          this.notFound.set(true);
          return;
        }
        this.notify.error(this.resolveErrorMessage(error));
      }
    }
  }

  protected toggleVersionExpand(ver: ExtVersion): void {
    const current = this.expandedVersionId();
    if (current === ver.id) {
      this.expandedVersionId.set(null);
      return;
    }
    this.expandedVersionId.set(ver.id);
    if (ver.fields && !this.versionDetails()[ver.id]) {
      this.versionDetails.update((map) => ({ ...map, [ver.id]: ver }));
      return;
    }
    if (!this.versionDetails()[ver.id] && !this.versionLoading()[ver.id]) {
      void this.fetchVersionDetail(ver.id);
    }
  }

  protected retryVersionDetail(versionId: string): void {
    void this.fetchVersionDetail(versionId);
  }

  protected versionFieldCount(ver: ExtVersion): string {
    const detail = this.versionDetails()[ver.id];
    const count = detail?.fields?.length ?? ver.fields?.length;
    return typeof count === 'number' ? String(count) : this.transloco.translate('extensions.profile.versions.none');
  }

  protected publishedByName(ver: ExtVersion): string {
    this.i18n();
    this.language();
    return actorDisplayName(
      ver.publishedBy,
      this.tenantScope.me(),
      ver.publishedBy ? this.publishers.value()?.[ver.publishedBy] : undefined,
      this.transloco.translate('extensions.profile.versions.none'),
    );
  }

  protected dateText(iso: string | null | undefined): string {
    if (!iso) return this.transloco.translate('extensions.profile.versions.none');
    return formatDate(iso, this.language());
  }

  protected tabCount(tab: ProfileTab): number {
    switch (tab) {
      case 'fields':
        return this.displayedFields().length;
      case 'versions':
        return this.versions().length;
      case 'published':
        return this.publishedVersion()?.fields?.length ?? 0;
    }
  }

  private async loadAll(profileId: string, ctx: TradeContext = this.ctx()): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.notFound.set(false);
    this.loadFailed.set(false);
    this.expandedVersionId.set(null);
    this.versionDetails.set({});
    this.versionErrors.set({});
    this.diagnosticsByField.set({});

    try {
      const loaded = await getProfile(profileId, ctx);
      if (seq !== this.loadSeq) return;
      this.applyLoadedProfile(loaded);
      this.loading.set(false);
      void this.loadVersionsList(profileId, ctx);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else if (isExtensionNotFoundError(error)) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
        this.notify.error(this.resolveErrorMessage(error));
      }
    }
  }

  private async loadVersionsList(profileId: string, ctx: TradeContext = this.ctx()): Promise<void> {
    const seq = ++this.versionsSeq;
    this.versionsLoading.set(true);
    this.versionsFailed.set(false);
    try {
      const page = await listVersions(profileId, { page: 1, limit: 100 }, ctx);
      if (seq !== this.versionsSeq) return;
      const items = [...page.items].sort((a, b) => b.versionNumber - a.versionNumber);
      this.versions.set(items);
      const cached: Record<string, ExtVersion> = { ...this.versionDetails() };
      for (const ver of items) {
        if (ver.fields) {
          cached[ver.id] = ver;
        }
      }
      this.versionDetails.set(cached);
    } catch (error) {
      if (seq !== this.versionsSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      this.versionsFailed.set(true);
      this.notify.error(this.resolveErrorMessage(error));
    } finally {
      if (seq === this.versionsSeq) {
        this.versionsLoading.set(false);
      }
    }
  }

  private async fetchVersionDetail(versionId: string): Promise<void> {
    const profileId = this.id();
    const ctx = this.ctx();
    this.versionLoading.update((map) => ({ ...map, [versionId]: true }));
    this.versionErrors.update((map) => ({ ...map, [versionId]: false }));
    try {
      const detail = await getVersion(profileId, versionId, ctx);
      if (this.id() !== profileId) return;
      this.versionDetails.update((map) => ({ ...map, [versionId]: detail }));
    } catch (error) {
      if (this.id() !== profileId) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      this.versionErrors.update((map) => ({ ...map, [versionId]: true }));
      this.notify.error(this.resolveErrorMessage(error));
    } finally {
      this.versionLoading.update((map) => ({ ...map, [versionId]: false }));
    }
  }

  private applyLoadedProfile(
    loaded: ExtensionProfile,
    preserveDiagnostics: Readonly<Record<string, readonly string[]>> = {},
  ): void {
    this.profile.set(loaded);
    this.editingNewDraft.set(false);
    const seed = cloneFields(loaded.editableDraftVersion?.fields);
    this.baseFields.set(cloneFields(seed));
    this.draftFields.set(seed);
    this.diagnosticsByField.set(preserveDiagnostics);
  }

  private resolveErrorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) {
      return this.transloco.translate('extensions.errors.network');
    }
    const reason = error.details?.['reason']?.[0];
    const candidates: string[] = [];
    if (reason) {
      candidates.push(`automation.errors.${error.code}.${reason}`);
      candidates.push(`extensions.errors.${error.code}.${reason}`);
    }
    candidates.push(`automation.errors.${error.code}`);
    candidates.push(`extensions.errors.${error.code}`);
    candidates.push(`tradeShared.errors.${error.code.replaceAll('.', '_')}`);
    for (const key of candidates) {
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
    }
    return this.transloco.translate('extensions.errors.generic');
  }
}

import { Component, Injector, computed, effect, inject, input, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowBackUp,
  tablerArrowLeft,
  tablerChevronDown,
  tablerChevronRight,
  tablerCloudOff,
  tablerFileSearch,
  tablerHistory,
  tablerRefresh,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Tabs, tabButtonId, tabPanelId, type TabItem } from '../../../../shared/ui/tabs/tabs';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf } from '../../shared/trade-api';
import { ActionKeys } from '../automation-shared/action-keys';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import { getImportTargets, getMapping, publishMapping, toMappingFieldInput, updateMapping } from '../imports.api';
import type {
  ImportMapping,
  ImportMappingDetail,
  MappingField,
  MappingVersion,
  UpdateImportMappingInput,
} from '../imports.model';
import {
  IMPORT_PERMISSIONS,
  hasImportReadGrant,
  hasImportScopeGrant,
  importContext,
  isForbiddenError,
  isIdempotencyMismatch,
} from '../mapping-rows/import-access';
import {
  MappingRows,
  type MappingRowServerError,
  extractMappingFieldErrors,
  fieldLabel,
  formatDateTime,
  targetLabel,
  translateImportError,
} from '../mapping-rows/mapping-rows';

function cloneFields(fields: readonly MappingField[]): MappingField[] {
  return [...fields]
    .sort((a, b) => a.sourceOrdinal - b.sourceOrdinal)
    .map((f) => ({ ...f }));
}

function snapshotFields(fields: readonly MappingField[]): string {
  return JSON.stringify(
    fields.map((f) => ({
      sourceColumnCode: f.sourceColumnCode,
      sourceOrdinal: f.sourceOrdinal,
      targetFieldCode: f.targetFieldCode,
      transformCode: f.transformCode,
      lookupCode: f.lookupCode ?? null,
      isRequired: Boolean(f.isRequired),
    })),
  );
}

@Component({
  selector: 'app-import-mapping-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    FullState,
    Tabs,
    UnsavedDialog,
    AutomationBadge,
    ConflictDialog,
    MappingRows,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-auto-imports', alias: 'imports' },
      { scope: 'trade-automation', alias: 'automation' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      'settings',
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerArrowBackUp,
      tablerArrowLeft,
      tablerChevronDown,
      tablerChevronRight,
      tablerCloudOff,
      tablerFileSearch,
      tablerHistory,
      tablerRefresh,
      tablerTable,
    }),
  ],
  templateUrl: './import-mapping-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-10 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class ImportMappingPage {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly scopeState = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly keys = new ActionKeys();
  private readonly i18n = translationEvents(this.transloco);

  private readonly rowsEditor = viewChild(MappingRows);
  private readonly unsavedDialog = viewChild(UnsavedDialog);
  private readonly conflictDialog = viewChild(ConflictDialog);

  protected readonly lang = inject(LanguageState).current;
  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasImportReadGrant(this.injector));
  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  readonly id = input.required<string>();

  protected readonly activeTab = signal<'columns' | 'versions'>('columns');
  protected readonly draftFields = signal<MappingField[]>([]);
  protected readonly savedSnapshot = signal('');
  protected readonly saveAttempted = signal(false);
  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly serverRowErrors = signal<Readonly<Record<number, MappingRowServerError>>>({});
  protected readonly expandedVersions = signal<ReadonlySet<string>>(new Set());
  private readonly refreshTick = signal(0);
  private readonly serverVersionOverride = signal<number | null>(null);
  private keepDraftOnReload = false;

  private readonly mappingResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden()) return undefined;
      return { id: this.id(), ctx: importContext(this.scopeState), tick: this.refreshTick() };
    },
    loader: ({ params }) => getMapping(params.id, params.ctx),
  });

  private readonly targetsResource = resource({
    params: () => {
      if (this.isForbidden()) return undefined;
      return { ctx: importContext(this.scopeState) };
    },
    loader: ({ params }) => getImportTargets(params.ctx).catch(() => null),
  });

  private readonly detailForbidden = computed(
    () => this.mappingResource.status() === 'error' && isForbiddenError(this.mappingResource.error()),
  );
  protected readonly isForbidden = computed(
    () => !this.canRead() || this.forbidden() || this.detailForbidden(),
  );
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasImportScopeGrant(
        this.injector,
        this.scopeState,
        IMPORT_PERMISSIONS.manage,
        this.mapping()?.scopeTarget,
      ),
  );
  protected readonly liveTargets = computed(() =>
    this.targetsResource.hasValue() ? (this.targetsResource.value()?.targets ?? null) : null,
  );

  protected readonly mapping = computed<ImportMappingDetail | null>(() =>
    this.mappingResource.hasValue() ? this.mappingResource.value() : null,
  );

  protected readonly loading = computed(
    () => !this.isForbidden() && this.mappingResource.isLoading() && !this.mappingResource.hasValue(),
  );

  protected readonly notFound = computed(() => {
    if (this.isForbidden()) return false;
    const err = this.mappingResource.error();
    return err instanceof ApiError && err.status === 404;
  });

  protected readonly loadFailed = computed(
    () => !this.isForbidden() && !!this.mappingResource.error() && !this.notFound(),
  );

  protected readonly versions = computed<MappingVersion[]>(() => {
    const list = this.mapping()?.versions ?? [];
    return [...list].sort((a, b) => b.versionNumber - a.versionNumber);
  });

  protected readonly liveVersion = computed<MappingVersion | null>(() => {
    const m = this.mapping();
    if (!m) return null;
    const list = m.versions ?? [];
    if (m.currentPublishedVersionId) {
      const exact = list.find((v) => v.id === m.currentPublishedVersionId);
      if (exact) return exact;
    }
    return list.find((v) => v.status === 'PUBLISHED') ?? null;
  });

  protected readonly savedDraftVersion = computed<MappingVersion | null>(
    () => (this.mapping()?.versions ?? []).find((v) => v.status === 'DRAFT') ?? null,
  );

  protected readonly dirty = computed(
    () => snapshotFields(this.draftFields()) !== this.savedSnapshot(),
  );

  protected readonly subtitleText = computed(() => {
    this.i18n();
    const m = this.mapping();
    if (!m) return '';
    const target = targetLabel(this.transloco, m.targetCode);
    const scope = this.scopeLabel(m);
    const live = this.liveVersion();
    const liveText = live
      ? this.transloco.translate('imports.mappingPage.liveVersion', { number: live.versionNumber })
      : this.transloco.translate('imports.mappingPage.noPublished');
    return this.transloco.translate('imports.mappingPage.subtitle', {
      target,
      scope,
      live: liveText,
    });
  });

  protected readonly tabItems = computed<TabItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'columns',
        label: this.transloco.translate('imports.mappingPage.tabs.columns'),
        icon: 'tablerTable',
        count: this.draftFields().length,
      },
      {
        id: 'versions',
        label: this.transloco.translate('imports.mappingPage.tabs.versions'),
        icon: 'tablerHistory',
        count: this.versions().length,
      },
    ];
  });

  constructor() {
    effect(() => {
      const m = this.mapping();
      if (!m) return;
      untracked(() => {
        if (this.keepDraftOnReload) {
          this.keepDraftOnReload = false;
          this.serverVersionOverride.set(m.version);
          return;
        }
        this.serverVersionOverride.set(null);
        const sourceVersion = this.savedDraftVersion() ?? this.liveVersion() ?? this.versions()[0];
        const cloned = cloneFields(sourceVersion?.fields ?? []);
        this.draftFields.set(cloned);
        this.savedSnapshot.set(snapshotFields(cloned));
        this.saveAttempted.set(false);
      });
    });
  }

  canLeave(): Promise<boolean> {
    if (!this.dirty() || !this.canManage()) return Promise.resolve(true);
    const dialog = this.unsavedDialog();
    if (!dialog) return Promise.resolve(true);
    return dialog.open().then(async (choice) => {
      if (choice === 'discard') return true;
      if (choice === 'cancel') return false;
      return this.save();
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() && this.canManage()) {
      event.preventDefault();
    }
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onDraftFieldsChange(fields: MappingField[]): void {
    this.draftFields.set(fields);
    if (Object.keys(this.serverRowErrors()).length > 0) {
      this.serverRowErrors.set({});
    }
  }

  protected async goBack(): Promise<void> {
    if (!(await this.canLeave())) return;
    void this.router.navigate(['/trade/automation/import-mappings']);
  }

  protected retryLoad(): void {
    this.serverRowErrors.set({});
    this.refreshTick.update((n) => n + 1);
  }

  protected undo(): void {
    const sourceVersion = this.savedDraftVersion() ?? this.liveVersion() ?? this.versions()[0];
    const cloned = cloneFields(sourceVersion?.fields ?? []);
    this.draftFields.set(cloned);
    this.savedSnapshot.set(snapshotFields(cloned));
    this.saveAttempted.set(false);
    this.serverRowErrors.set({});
  }

  protected async save(): Promise<boolean> {
    const m = this.mapping();
    if (!m || !this.canManage() || this.saving()) return false;
    this.saveAttempted.set(true);
    this.serverRowErrors.set({});
    if (!(this.rowsEditor()?.valid() ?? false)) {
      this.activeTab.set('columns');
      return false;
    }

    this.saving.set(true);
    const action = `save:${m.id}`;
    try {
      const version = this.serverVersionOverride() ?? m.version;
      const input: UpdateImportMappingInput = {
        executionMode: 'PER_ROW',
        fields: this.draftFields().map(toMappingFieldInput),
      };
      await updateMapping(
        m.id,
        input,
        version,
        this.keys.for(action, { input, ifMatch: version }),
        importContext(this.scopeState),
      );
      this.keys.done(action);
      this.serverVersionOverride.set(null);
      this.keepDraftOnReload = false;
      this.notify.success(this.transloco.translate('imports.mappingPage.savedToast'));
      this.refreshTick.update((n) => n + 1);
      return true;
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(action);
        this.forbidden.set(true);
        return false;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(action);
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog()?.open();
      } else if (
        error instanceof ApiError &&
        (error.code === 'TRADE.IMPORT.MAPPING_INVALID' || error.code === 'TRADE.VALIDATION_FAILED')
      ) {
        const fieldErrors = extractMappingFieldErrors(error, this.draftFields(), this.transloco, m.targetCode);
        if (Object.keys(fieldErrors).length > 0) {
          this.keys.done(action);
          this.serverRowErrors.set(fieldErrors);
          this.activeTab.set('columns');
        } else {
          this.notify.error(translateImportError(this.transloco, error));
        }
      } else {
        this.notify.error(translateImportError(this.transloco, error));
      }
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async publish(): Promise<void> {
    const m = this.mapping();
    if (!m || !this.canManage() || !this.savedDraftVersion() || this.dirty() || this.publishing()) return;

    this.publishing.set(true);
    const action = `publish:${m.id}`;
    try {
      const version = this.serverVersionOverride() ?? m.version;
      await publishMapping(
        m.id,
        version,
        this.keys.for(action, { ifMatch: version }),
        importContext(this.scopeState),
      );
      this.keys.done(action);
      this.serverVersionOverride.set(null);
      this.keepDraftOnReload = false;
      this.notify.success(this.transloco.translate('imports.mappingPage.publishedToast'));
      this.refreshTick.update((n) => n + 1);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.keys.done(action);
        this.forbidden.set(true);
        return;
      }
      if (isIdempotencyMismatch(errorCodeOf(error))) {
        this.keys.done(action);
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog()?.open();
      } else {
        this.notify.error(translateImportError(this.transloco, error));
      }
    } finally {
      this.publishing.set(false);
    }
  }

  protected onConflictReload(): void {
    this.keepDraftOnReload = false;
    this.refreshTick.update((n) => n + 1);
  }

  protected onConflictKeep(): void {
    this.keepDraftOnReload = true;
    this.refreshTick.update((n) => n + 1);
  }

  protected onTabChange(next: string): void {
    if (next === 'columns' || next === 'versions') {
      this.activeTab.set(next);
    }
  }

  protected toggleVersionExpanded(versionId: string): void {
    this.expandedVersions.update((curr) => {
      const next = new Set(curr);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  }

  protected isVersionExpanded(versionId: string): boolean {
    return this.expandedVersions().has(versionId);
  }

  protected sortedVersionFields(ver: MappingVersion): MappingField[] {
    return cloneFields(ver.fields ?? []);
  }

  protected fieldName(code: string): string {
    return fieldLabel(this.transloco, code);
  }

  protected transformLabel(code: string | null | undefined): string {
    const key = `imports.transforms.${code || 'NONE'}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : (code || 'NONE');
  }

  protected lookupLabel(code: string | null | undefined): string | null {
    if (!code) return null;
    const key = `imports.lookups.${code}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : code;
  }

  protected formatDate(iso: string | null | undefined): string {
    return formatDateTime(iso, this.lang());
  }

  private scopeLabel(mapping: ImportMapping): string {
    const companies = this.scopeState.companies();
    const language = this.lang();
    if (mapping.scopeTarget === 'BRANCH' && mapping.branchId) {
      for (const comp of companies) {
        const branch = comp.branches.find((b) => b.id === mapping.branchId);
        if (branch) {
          return language === 'ar' ? branch.nameAr : branch.nameEn;
        }
      }
      return this.transloco.translate('imports.common.branch');
    }
    const company = companies.find((c) => c.id === mapping.companyId) ?? this.scopeState.company();
    if (company) {
      return language === 'ar' ? company.nameAr : company.nameEn;
    }
    return this.transloco.translate('imports.common.company');
  }
}

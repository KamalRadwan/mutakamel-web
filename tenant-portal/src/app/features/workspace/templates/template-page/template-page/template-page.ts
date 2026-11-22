import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowLeft,
  tablerDeviceFloppy,
  tablerEye,
  tablerFileDescription,
  tablerFileInvoice,
  tablerFileSearch,
  tablerFileText,
  tablerHistory,
  tablerInfoCircle,
  tablerLock,
  tablerMail,
  tablerReceipt,
  tablerRefresh,
  tablerShieldCheck,
  tablerShoppingCart,
  tablerStack2,
  tablerTemplate,
  tablerUpload,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import {
  PatchTemplateDefinitionDto,
  TEMPLATE_PAGE_TABS,
  TemplateDefinitionDetail,
  TemplateDraftDto,
  TemplatePageTab,
  archiveTemplate,
  deleteTemplate,
  getCreationScopes,
  getDraft,
  getTemplate,
  listRecoverySnapshots,
  listVersions,
  patchTemplate,
  restoreTemplate,
} from '../../templates.api';
import { DesignerState } from '../../designer/designer-state';
import { DesignTab } from '../design-tab/design-tab';
import { TemplateDuplicateModal } from '../../create';
import { OverviewTab } from '../overview-tab/overview-tab';
import { PreviewTab } from '../preview-tab/preview-tab';
import { PublishModal } from '../publish/publish-modal';
import { ValidationActions } from '../publish/validation-actions';
import { RecoveryTab } from '../recovery-tab/recovery-tab';
import { TemplatePageService, errorDetailsOf, familyVisual } from '../template-page.service';
import { ValidationTab } from '../validation-tab/validation-tab';
import { VersionsTab } from '../versions-tab/versions-tab';

type LoadErrorKind = 'notFound' | 'forbidden' | 'featureDisabled' | 'loadFailed' | null;

interface TabDescriptor {
  id: TemplatePageTab;
  icon: string;
  labelKey: string;
  counter?: number;
}

const VALID_TABS = new Set<string>(TEMPLATE_PAGE_TABS);

@Component({
  selector: 'app-template-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    UnsavedDialog,
    OverviewTab,
    DesignTab,
    PreviewTab,
    ValidationTab,
    VersionsTab,
    RecoveryTab,
    TemplateDuplicateModal,
    PublishModal,
  ],
  providers: [
    TemplatePageService,
    DesignerState,
    ValidationActions,
    provideTranslocoScope(
      'templates',
      { scope: 'templates-page', alias: 'templatesPage' },
      { scope: 'templates-validation', alias: 'tplValidation' },
      { scope: 'templates-designer', alias: 'tplDesigner' },
      { scope: 'templates-designer-fields', alias: 'tplFields' },
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerArrowLeft,
      tablerDeviceFloppy,
      tablerEye,
      tablerFileDescription,
      tablerFileInvoice,
      tablerFileSearch,
      tablerFileText,
      tablerHistory,
      tablerInfoCircle,
      tablerLock,
      tablerMail,
      tablerReceipt,
      tablerRefresh,
      tablerShieldCheck,
      tablerShoppingCart,
      tablerStack2,
      tablerTemplate,
      tablerUpload,
    }),
  ],
  templateUrl: './template-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col p-12 gap-10',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class TemplatePage {
  private static nextId = 0;
  protected readonly uid = `tpl-page-${++TemplatePage.nextId}`;

  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);
  private readonly designerState = inject(DesignerState);
  protected readonly validationActions = inject(ValidationActions);

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly archiveConfirm = viewChild.required<ConfirmDialog>('archiveConfirm');
  private readonly restoreTemplateConfirm = viewChild.required<ConfirmDialog>('restoreTemplateConfirm');
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly conflictDialog = viewChild<ElementRef<HTMLDialogElement>>('conflictDialog');
  private readonly conflictReloadBtn = viewChild<Button, ElementRef<HTMLButtonElement>>('conflictReloadBtn', {
    read: ElementRef,
  });
  private readonly duplicateModal = viewChild.required(TemplateDuplicateModal);
  private readonly publishModal = viewChild.required(PublishModal);

  readonly id = input<string>();
  readonly tab = input<string>();

  readonly duplicateRequested = output<{
    definition: TemplateDefinitionDetail;
    draft: TemplateDraftDto | null;
    convertLayout: boolean;
  }>();

  protected readonly loading = signal(true);
  protected readonly loadError = signal<LoadErrorKind>(null);
  protected readonly loadCorrelationId = signal<string | null>(null);
  protected readonly actionBusy = signal(false);

  private loadSeq = 0;
  private loadedTemplateId: string | null = null;
  private bypassLeaveGuard = false;
  private navigatingWithinTemplate = false;

  protected readonly activeTab = computed<TemplatePageTab>(() => {
    const candidate = this.tab();
    const resolved = candidate && VALID_TABS.has(candidate) ? (candidate as TemplatePageTab) : 'overview';
    if (resolved === 'recovery' && !this.service.hasRecoveryTab()) {
      return 'overview';
    }
    return resolved;
  });

  protected readonly familyLook = computed(() => {
    const def = this.service.definition();
    return def ? familyVisual(def.documentType) : { icon: 'tablerFileText', tile: 'bg-icon-teal' };
  });

  protected readonly validationErrorCount = computed(() => this.service.draft()?.validation.errorCount ?? 0);

  protected readonly tabs = computed<TabDescriptor[]>(() => {
    const list: TabDescriptor[] = [
      { id: 'overview', icon: 'tablerInfoCircle', labelKey: 'templates.tabs.overview' },
      { id: 'design', icon: 'tablerTemplate', labelKey: 'templates.tabs.design' },
      { id: 'preview', icon: 'tablerEye', labelKey: 'templates.tabs.preview' },
      {
        id: 'validation',
        icon: 'tablerShieldCheck',
        labelKey: 'templates.tabs.validation',
        counter: this.validationErrorCount(),
      },
      { id: 'versions', icon: 'tablerStack2', labelKey: 'templates.tabs.versions' },
    ];
    if (this.service.hasRecoveryTab()) {
      list.push({ id: 'recovery', icon: 'tablerHistory', labelKey: 'templates.tabs.recovery' });
    }
    return list;
  });

  protected readonly showSaveButton = computed(() => this.service.canUpdate());

  protected readonly validateDisabled = computed(() => {
    const def = this.service.definition();
    if (!def || this.service.dirty() || this.service.validating() || this.service.saving() || this.actionBusy()) {
      return true;
    }
    if (!this.service.canUpdate()) return true;
    return def.capabilities.validate.state !== 'ENABLED';
  });

  protected readonly validateTooltip = computed(() => {
    this.language();
    if (this.service.dirty()) {
      return this.transloco.translate('templatesPage.header.saveFirst');
    }
    const def = this.service.definition();
    const reason = def?.capabilities.validate.reason;
    if (def && def.capabilities.validate.state !== 'ENABLED' && reason) {
      return this.capabilityReasonText(reason);
    }
    return '';
  });

  protected readonly publishDisabled = computed(() => {
    const def = this.service.definition();
    if (!def || this.service.dirty() || this.service.validating() || this.service.saving() || this.actionBusy()) {
      return true;
    }
    if (!this.service.canUpdate()) return true;
    return def.capabilities.publish.state !== 'ENABLED';
  });

  protected readonly publishTooltip = computed(() => {
    this.language();
    if (this.service.dirty()) {
      return this.transloco.translate('templatesPage.header.saveFirst');
    }
    const def = this.service.definition();
    const reason = def?.capabilities.publish.reason;
    if (def && def.capabilities.publish.state !== 'ENABLED' && reason) {
      return this.capabilityReasonText(reason);
    }
    return '';
  });

  protected readonly actionItems = computed<ActionItem[]>(() => {
    this.language();
    const def = this.service.definition();
    if (!def) return [];

    const items: ActionItem[] = [
      {
        id: 'duplicate',
        title: this.transloco.translate('templates.actions.duplicate'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      },
    ];

    if (def.outputChannel === 'PRINT') {
      items.push({
        id: 'convert',
        title: this.transloco.translate('templates.actions.createConvertedCopy'),
        icon: 'tablerArrowsExchange',
        tile: 'bg-icon-teal',
      });
    }

    if (def.capabilities.archive.state !== 'HIDDEN') {
      items.push({
        id: 'archive',
        title: this.transloco.translate('templates.actions.archive'),
        icon: 'tablerArchive',
        tile: 'bg-icon-gray',
        disabled: def.capabilities.archive.state !== 'ENABLED' || this.service.draftAccessForbidden(),
        reason: def.capabilities.archive.reason
          ? this.capabilityReasonText(def.capabilities.archive.reason)
          : undefined,
      });
    }

    if (def.capabilities.restore.state !== 'HIDDEN') {
      items.push({
        id: 'restore',
        title: this.transloco.translate('templates.actions.restore'),
        icon: 'tablerArrowBackUp',
        tile: 'bg-icon-teal',
        disabled: def.capabilities.restore.state !== 'ENABLED' || this.service.draftAccessForbidden(),
        reason: def.capabilities.restore.reason
          ? this.capabilityReasonText(def.capabilities.restore.reason)
          : undefined,
      });
    }

    if (def.capabilities.delete.state !== 'HIDDEN') {
      items.push({
        id: 'delete',
        title: this.transloco.translate('templates.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        disabled: def.capabilities.delete.state !== 'ENABLED' || this.service.draftAccessForbidden(),
        reason: def.capabilities.delete.reason
          ? this.capabilityReasonText(def.capabilities.delete.reason)
          : undefined,
      });
    }

    return items;
  });

  constructor() {
    effect(() => {
      const templateId = this.id();
      const rawTab = this.tab();
      if (!templateId) {
        this.loading.set(false);
        this.loadError.set('notFound');
        return;
      }

      if (!rawTab) {
        this.navigatingWithinTemplate = true;
        void this.router
          .navigate(['/workspace/operations/template-platform', templateId, 'overview'], {
            replaceUrl: true,
          })
          .finally(() => {
            this.navigatingWithinTemplate = false;
          });
      }

      if (templateId !== this.loadedTemplateId) {
        this.loadedTemplateId = templateId;
        void this.loadAll(templateId, false);
      }
    });

    effect(() => {
      const open = this.service.conflictOpen();
      const dialogEl = this.conflictDialog()?.nativeElement;
      if (!dialogEl) return;
      if (open && !dialogEl.open) {
        dialogEl.showModal();
        this.conflictReloadBtn()?.nativeElement.focus();
      } else if (!open && dialogEl.open) {
        dialogEl.close();
      }
    });

    effect(() => {
      const req = this.service.reloadRequestCount();
      if (req <= 0) return;
      const templateId = this.id();
      if (templateId) {
        void this.loadAll(templateId, false);
      }
    });
  }

  async canDeactivate(nextUrl?: string): Promise<boolean> {
    if (this.bypassLeaveGuard) {
      this.bypassLeaveGuard = false;
      return true;
    }
    if (this.navigatingWithinTemplate || this.isSameTemplateNavigation(nextUrl)) {
      return true;
    }
    if (!this.service.dirty() || !this.service.canUpdate()) {
      return true;
    }
    const choice = await this.unsavedDialog().open();
    if (choice === 'cancel') return false;
    if (choice === 'save') {
      return await this.save();
    }
    this.service.undoAllChanges();
    return true;
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.service.dirty() && this.service.canUpdate()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private isSameTemplateNavigation(nextUrl?: string): boolean {
    const currentId = this.id();
    if (!currentId) return false;
    const rawUrl = nextUrl ?? this.router.currentNavigation()?.extractedUrl.toString() ?? '';
    if (!rawUrl) return false;
    const path = rawUrl.split(/[?#]/)[0];
    const prefix = `/workspace/operations/template-platform/${currentId}`;
    return path === prefix || path.startsWith(`${prefix}/`);
  }

  protected async goBack(): Promise<void> {
    const allowed = await this.canDeactivate();
    if (!allowed) return;
    this.bypassLeaveGuard = true;
    try {
      await this.router.navigate(['/workspace/operations/template-platform']);
    } finally {
      this.bypassLeaveGuard = false;
    }
  }

  protected goToLibrary(): void {
    void this.router.navigate(['/workspace/operations/template-platform']);
  }

  protected selectTab(tab: TemplatePageTab): void {
    const templateId = this.id();
    if (!templateId || tab === this.activeTab()) return;
    this.navigatingWithinTemplate = true;
    void this.router
      .navigate(['/workspace/operations/template-platform', templateId, tab])
      .finally(() => {
        this.navigatingWithinTemplate = false;
      });
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const visibleTabs = this.tabs();
    if (visibleTabs.length === 0) return;
    const rtl = this.language() === 'ar';
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = rtl ? (index - 1 + visibleTabs.length) % visibleTabs.length : (index + 1) % visibleTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = rtl ? (index + 1) % visibleTabs.length : (index - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleTabs.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const target = visibleTabs[nextIndex];
    if (!target) return;
    this.tabButtons()[nextIndex]?.nativeElement.focus();
    this.selectTab(target.id);
  }

  protected retryLoad(): void {
    const templateId = this.id();
    if (!templateId) return;
    void this.loadAll(templateId, false);
  }

  protected undoChanges(): void {
    this.service.undoAllChanges();
  }

  protected async save(): Promise<boolean> {
    const def = this.service.definition();
    if (!def || !this.service.canUpdate() || !this.service.dirty() || this.service.saving()) {
      return false;
    }

    if (this.service.overviewDirty()) {
      const trimmedName = this.service.overviewName().trim();
      if (!trimmedName) {
        this.service.overviewNameError.set(this.transloco.translate('templatesPage.overview.nameRequired'));
        if (this.activeTab() !== 'overview') {
          this.selectTab('overview');
        }
        return false;
      }
    }

    this.service.saving.set(true);
    try {
      let latestDef = def;
      let latestDraft = this.service.draft();
      const directionChanged = this.service.overviewDirty() && this.service.overviewDirection() !== def.direction;

      if (directionChanged && this.service.hasDesignChanges()) {
        const tabSave = this.service.getTabHandlers().save;
        if (tabSave) {
          const ok = await tabSave();
          if (!ok) return false;
          latestDraft = this.service.draft();
        }
      }

      if (this.service.overviewDirty()) {
        const patch: PatchTemplateDefinitionDto = {};
        const nextName = this.service.overviewName().trim();
        const nextDesc = this.service.overviewDescription().trim();
        const prevDesc = (def.description ?? '').trim();

        if (nextName !== def.name.trim()) {
          patch.name = nextName;
        }
        if (nextDesc !== prevDesc) {
          patch.description = nextDesc ? nextDesc : null;
        }
        if (this.service.overviewDirection() !== def.direction) {
          patch.direction = this.service.overviewDirection();
          patch.expectedDraftRevision = latestDraft?.revision ?? def.currentDraft.revision;
        }

        const res = await patchTemplate(def.templateId, patch, def.etag);
        latestDef = res.definition;
        if (res.draft) {
          latestDraft = res.draft;
          this.service.syncExternalDraft(res.draft);
        }
        this.service.syncFromDefinition(latestDef);
      }

      if (this.service.hasDesignChanges() || this.service.dirty()) {
        const tabSave = this.service.getTabHandlers().save;
        if (tabSave) {
          const ok = await tabSave();
          if (!ok) return false;
        } else {
          this.service.setDirty(false);
        }
      }

      this.notify.success(this.transloco.translate('templatesPage.header.savedToast'));
      return true;
    } catch (error) {
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.service.openConflict();
      } else {
        this.notify.error(this.service.translateError(this.transloco, error));
      }
      return false;
    } finally {
      this.service.saving.set(false);
    }
  }

  protected async runValidate(): Promise<void> {
    if (this.validateDisabled()) return;
    await this.validationActions.validate();
  }

  protected requestPublish(): void {
    const def = this.service.definition();
    const draft = this.service.draft();
    if (!def || !draft || this.publishDisabled()) return;
    this.publishModal().open();
  }

  protected onActionSelected(selection: ActionSelection): void {
    const def = this.service.definition();
    if (!def) return;
    switch (selection.id) {
      case 'duplicate':
        this.duplicateRequested.emit({ definition: def, draft: this.service.draft(), convertLayout: false });
        this.duplicateModal().open({ templateId: def.templateId, convertLayout: false, draftDirty: this.service.dirty() });
        break;
      case 'convert':
        this.duplicateRequested.emit({ definition: def, draft: this.service.draft(), convertLayout: true });
        this.duplicateModal().open({ templateId: def.templateId, convertLayout: true, draftDirty: this.service.dirty() });
        break;
      case 'archive':
        void this.confirmArchive(def);
        break;
      case 'restore':
        void this.confirmRestoreTemplate(def);
        break;
      case 'delete':
        void this.confirmDelete(def);
        break;
    }
  }

  protected onConflictEscape(event: Event): void {
    event.preventDefault();
    this.service.closeConflict();
  }

  protected onConflictNativeClose(): void {
    if (this.service.conflictOpen()) {
      this.service.closeConflict();
    }
  }

  protected reloadAfterConflict(): void {
    this.service.closeConflict();
    const templateId = this.id();
    if (templateId) {
      void this.loadAll(templateId, false);
    }
  }

  protected keepMyChangesAfterConflict(): void {
    this.service.closeConflict();
  }

  private async confirmArchive(def: TemplateDefinitionDetail): Promise<void> {
    if (this.actionBusy()) return;
    const confirmed = await this.archiveConfirm().open();
    if (!confirmed) return;

    this.actionBusy.set(true);
    try {
      const updated = await archiveTemplate(def.templateId, def.etag);
      this.service.syncFromDefinition(updated);
      this.service.undoAllChanges();
      this.notify.success(this.transloco.translate('templatesPage.header.archivedToast'));
    } catch (error) {
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.service.openConflict();
      } else {
        this.notify.error(this.service.translateError(this.transloco, error));
      }
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async confirmRestoreTemplate(def: TemplateDefinitionDetail): Promise<void> {
    if (this.actionBusy()) return;
    const confirmed = await this.restoreTemplateConfirm().open();
    if (!confirmed) return;

    this.actionBusy.set(true);
    try {
      const updated = await restoreTemplate(def.templateId, def.etag);
      this.service.syncFromDefinition(updated);
      this.notify.success(this.transloco.translate('templatesPage.header.restoredToast'));
    } catch (error) {
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.service.openConflict();
      } else {
        this.notify.error(this.service.translateError(this.transloco, error));
      }
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async confirmDelete(def: TemplateDefinitionDetail): Promise<void> {
    if (this.actionBusy()) return;
    const confirmed = await this.deleteConfirm().open();
    if (!confirmed) return;

    this.actionBusy.set(true);
    try {
      await deleteTemplate(def.templateId, def.etag);
      this.notify.success(this.transloco.translate('templatesPage.header.deletedToast'));
      this.bypassLeaveGuard = true;
      try {
        await this.router.navigate(['/workspace/operations/template-platform']);
      } finally {
        this.bypassLeaveGuard = false;
      }
    } catch (error) {
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.service.openConflict();
      } else {
        this.notify.error(this.service.translateError(this.transloco, error));
      }
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async loadAll(templateId: string, keepOverviewEdits: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    this.loadCorrelationId.set(null);
    if (!keepOverviewEdits) {
      this.service.resetForTemplate();
      this.designerState.resetForTemplate();
    }

    try {
      const [def, versionsPage, scopesRes] = await Promise.all([
        getTemplate(templateId),
        listVersions(templateId, { limit: 25 }),
        getCreationScopes().catch(() => ({ scopes: [] })),
      ]);
      if (seq !== this.loadSeq) return;

      this.service.syncFromDefinition(def, keepOverviewEdits);
      this.service.versions.set(versionsPage.items);
      this.service.versionsHasNext.set(versionsPage.pageInfo.hasNextPage);
      this.service.versionsNextCursor.set(versionsPage.pageInfo.nextCursor);
      this.service.creationScopes.set(scopesRes.scopes);

      let draftForbidden = false;
      try {
        const draft = await getDraft(templateId);
        if (seq !== this.loadSeq) return;
        this.service.setDraft(draft);
      } catch (draftError) {
        if (seq !== this.loadSeq) return;
        const { status, code } = errorDetailsOf(draftError);
        if (status === 403 || code === 'CORE.TEMPLATE.PERMISSION.DENIED') {
          draftForbidden = true;
          this.service.setDraft(null);
        } else {
          throw draftError;
        }
      }
      this.service.draftAccessForbidden.set(draftForbidden);

      if (!draftForbidden) {
        try {
          const snapshotsPage = await listRecoverySnapshots(templateId, { limit: 20 });
          if (seq !== this.loadSeq) return;
          this.service.snapshots.set(snapshotsPage.items);
        } catch {
          if (seq !== this.loadSeq) return;
          this.service.snapshots.set([]);
        }
      } else {
        this.service.snapshots.set([]);
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const { status, code, correlationId } = errorDetailsOf(error);
      this.loadCorrelationId.set(correlationId);
      if (code === 'CORE.TEMPLATE.FEATURE.DISABLED') {
        this.loadError.set('featureDisabled');
      } else if (status === 403 || code === 'CORE.TEMPLATE.PERMISSION.DENIED') {
        this.loadError.set('forbidden');
      } else if (status === 404 || code === 'CORE.TEMPLATE.NOT_FOUND') {
        this.loadError.set('notFound');
      } else {
        this.loadError.set('loadFailed');
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private capabilityReasonText(reason: string): string {
    const key = `templatesPage.header.capabilities.${reason}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : '';
  }
}

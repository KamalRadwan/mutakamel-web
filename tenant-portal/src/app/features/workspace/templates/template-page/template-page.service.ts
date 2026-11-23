import { Service, Signal, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import {
  TemplateApiError,
  TemplateCreationScope,
  TemplateDefinitionDetail,
  TemplateDefinitionScope,
  TemplateDirection,
  TemplateDocumentType,
  TemplateDraftDto,
  TemplateRecoverySnapshotItem,
  TemplateValidationRunDto,
  TemplateVersionItem,
} from '../templates.api';

export interface TemplateFamilyVisual {
  icon: string;
  tile: string;
}

export type TemplateRecoverySnapshotState = 'AVAILABLE' | 'QUARANTINED' | 'EXPIRED' | 'RESTORED';

export interface TemplatePageTabHandlers {
  save?: () => Promise<boolean>;
  undo?: () => void;
}

export interface TemplateDraftEditorRegistration {
  dirty: Signal<boolean>;
  save(): Promise<boolean>;
  discard(): void;
  syncExternalDraft?: (draft: TemplateDraftDto) => void;
}

const FAMILY_VISUALS: Record<TemplateDocumentType, TemplateFamilyVisual> = {
  QUOTATION: { icon: 'tablerFileText', tile: 'bg-icon-teal' },
  PURCHASE_QUOTATION: { icon: 'tablerFileText', tile: 'bg-icon-orange' },
  SALES_ORDER: { icon: 'tablerReceipt', tile: 'bg-icon-green' },
  PURCHASE_ORDER: { icon: 'tablerShoppingCart', tile: 'bg-icon-orange' },
  INVOICE: { icon: 'tablerFileInvoice', tile: 'bg-icon-blue' },
  CONTRACT: { icon: 'tablerFileDescription', tile: 'bg-icon-navy' },
  LETTER: { icon: 'tablerFileText', tile: 'bg-icon-navy' },
  CRM_OUTBOUND_EMAIL: { icon: 'tablerMail', tile: 'bg-icon-blue' },
};

export function familyVisual(documentType: TemplateDocumentType): TemplateFamilyVisual {
  return FAMILY_VISUALS[documentType];
}

export function errorDetailsOf(error: unknown): {
  status: number | null;
  code: string | null;
  correlationId: string | null;
} {
  if (error instanceof TemplateApiError) {
    return {
      status: error.status,
      code: error.code,
      correlationId: error.correlationId ?? null,
    };
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      status: typeof obj['status'] === 'number' ? obj['status'] : null,
      code: typeof obj['code'] === 'string' ? obj['code'] : null,
      correlationId: typeof obj['correlationId'] === 'string' ? obj['correlationId'] : null,
    };
  }
  return { status: null, code: null, correlationId: null };
}

@Service()
export class TemplatePageService {
  private readonly language = inject(LanguageState).current;
  private readonly scopeState = inject(ScopeState);

  readonly definition = signal<TemplateDefinitionDetail | null>(null);
  readonly draft = signal<TemplateDraftDto | null>(null);
  readonly versions = signal<TemplateVersionItem[]>([]);
  readonly versionsHasNext = signal(false);
  readonly versionsNextCursor = signal<string | null>(null);
  readonly snapshots = signal<TemplateRecoverySnapshotItem[]>([]);
  readonly creationScopes = signal<TemplateCreationScope[]>([]);
  readonly lastValidationRun = signal<TemplateValidationRunDto | null>(null);

  readonly overviewName = signal('');
  readonly overviewDescription = signal('');
  readonly overviewDirection = signal<TemplateDirection>('AUTO');
  readonly overviewNameError = signal<string | null>(null);

  readonly designDirty = signal(false);
  readonly saving = signal(false);
  readonly validating = signal(false);
  readonly conflictOpen = signal(false);
  readonly draftAccessForbidden = signal(false);
  readonly publishRequestCount = signal(0);
  readonly reloadRequestCount = signal(0);

  private tabHandlers: TemplatePageTabHandlers = {};
  private readonly draftEditor = signal<TemplateDraftEditorRegistration | null>(null);

  readonly canUpdate = computed(() => {
    const def = this.definition();
    return !!def && !this.draftAccessForbidden() && def.capabilities.update.state === 'ENABLED';
  });

  readonly isReadOnly = computed(() => !this.canUpdate());

  readonly overviewDirty = computed(() => {
    const def = this.definition();
    if (!def || !this.canUpdate()) return false;
    const savedName = def.name.trim();
    const savedDesc = (def.description ?? '').trim();
    return (
      this.overviewName().trim() !== savedName ||
      this.overviewDescription().trim() !== savedDesc ||
      this.overviewDirection() !== def.direction
    );
  });

  readonly hasDesignChanges = computed(() => this.designDirty() || (this.draftEditor()?.dirty() ?? false));

  readonly dirty = computed(() => this.overviewDirty() || this.hasDesignChanges());

  readonly hasRecoveryTab = computed(() => this.snapshots().length > 0);

  readonly publishedVersionItem = computed(() => {
    const current = this.definition()?.currentPublishedVersion;
    if (!current) return null;
    return this.versions().find((item) => item.templateVersionId === current.templateVersionId) ?? null;
  });

  syncFromDefinition(def: TemplateDefinitionDetail, keepOverviewEdits = false): void {
    this.definition.set(def);
    if (!keepOverviewEdits) {
      this.overviewName.set(def.name);
      this.overviewDescription.set(def.description ?? '');
      this.overviewDirection.set(def.direction);
      this.overviewNameError.set(null);
    }
  }

  setDraft(draft: TemplateDraftDto | null): void {
    this.draft.set(draft);
  }

  syncExternalDraft(draft: TemplateDraftDto): void {
    this.setDraft(draft);
    this.draftEditor()?.syncExternalDraft?.(draft);
    this.designDirty.set(false);
  }

  setDirty(dirty: boolean): void {
    this.designDirty.set(dirty);
  }

  undoOverviewChanges(): void {
    const def = this.definition();
    if (!def) return;
    this.overviewName.set(def.name);
    this.overviewDescription.set(def.description ?? '');
    this.overviewDirection.set(def.direction);
    this.overviewNameError.set(null);
  }

  undoAllChanges(): void {
    this.undoOverviewChanges();
    this.draftEditor()?.discard();
    this.tabHandlers.undo?.();
    this.designDirty.set(false);
  }

  registerDraftEditor(editor: TemplateDraftEditorRegistration | null): void {
    this.draftEditor.set(editor);
  }

  registerTabHandlers(handlers: TemplatePageTabHandlers): void {
    this.tabHandlers = handlers;
  }

  getTabHandlers(): TemplatePageTabHandlers {
    const editor = this.draftEditor();
    if (!editor) return this.tabHandlers;
    return {
      save: this.tabHandlers.save ?? (() => editor.save()),
      undo: this.tabHandlers.undo ?? (() => editor.discard()),
    };
  }

  requestPublish(): void {
    this.publishRequestCount.update((count) => count + 1);
  }

  requestReload(): void {
    this.reloadRequestCount.update((count) => count + 1);
  }

  openConflict(): void {
    this.conflictOpen.set(true);
  }

  closeConflict(): void {
    this.conflictOpen.set(false);
  }

  resetForTemplate(): void {
    this.definition.set(null);
    this.draft.set(null);
    this.versions.set([]);
    this.versionsHasNext.set(false);
    this.versionsNextCursor.set(null);
    this.snapshots.set([]);
    this.lastValidationRun.set(null);
    this.overviewName.set('');
    this.overviewDescription.set('');
    this.overviewDirection.set('AUTO');
    this.overviewNameError.set(null);
    this.designDirty.set(false);
    this.saving.set(false);
    this.validating.set(false);
    this.conflictOpen.set(false);
    this.draftAccessForbidden.set(false);
  }

  snapshotState(item: TemplateRecoverySnapshotItem): TemplateRecoverySnapshotState {
    if (item.restoredAt !== null) return 'RESTORED';
    if (item.integrityStatus === 'QUARANTINED') return 'QUARANTINED';
    const expiresMs = Date.parse(item.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs <= Date.now()) return 'EXPIRED';
    return 'AVAILABLE';
  }

  scopeLabel(scope: TemplateDefinitionScope, transloco: TranslocoService): string {
    if (scope.type === 'TENANT') {
      return transloco.translate('templatesPage.overview.scopeTenant');
    }
    const lang = this.language();
    const portalCompany = this.scopeState.companies().find((c) => c.id === scope.companyId);
    if (portalCompany) {
      return lang === 'ar' ? portalCompany.nameAr : portalCompany.nameEn;
    }
    const matched = this.creationScopes().find(
      (item): item is Extract<TemplateCreationScope, { type: 'COMPANY' }> =>
        item.type === 'COMPANY' && item.companyId === scope.companyId,
    );
    if (matched?.label) {
      const byName = this.scopeState.companies().find(
        (c) => c.nameEn === matched.label || c.nameAr === matched.label,
      );
      if (byName) {
        return lang === 'ar' ? byName.nameAr : byName.nameEn;
      }
      return matched.label;
    }
    return scope.companyId;
  }

  formatDate(iso: string | null | undefined, lang: 'en' | 'ar'): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  formatDateTime(iso: string | null | undefined, lang: 'en' | 'ar'): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    const datePart = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
    const timePart = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
    return `${datePart} ${timePart}`;
  }

  translateError(transloco: TranslocoService, error: unknown): string {
    const { code } = errorDetailsOf(error);
    if (code) {
      const tplKey = `templates.errors.${code}`;
      const tplTranslated = transloco.translate(tplKey);
      if (tplTranslated && tplTranslated !== tplKey) {
        return tplTranslated;
      }
      const pageKey = `templatesPage.errors.${code}`;
      const pageTranslated = transloco.translate(pageKey);
      if (pageTranslated && pageTranslated !== pageKey) {
        return pageTranslated;
      }
    }
    return transloco.translate('templates.errors.generic');
  }
}

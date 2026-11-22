import { DestroyRef, Injectable, Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import {
  TemplateBindingFormat,
  TemplateDataSourceKey,
  TemplateDataSourceSchemaDto,
  TemplateDefinitionDetail,
  TemplateDocumentV1,
  TemplateDraftDto,
  TemplateFieldDataType,
  TemplateFormulaExpression,
  TemplateLayoutMode,
  TemplateNode,
  TemplatePageConfig,
  TemplateSchemaField,
  getAssetContent,
  getDataSourceSchema,
  getDraft,
  getTemplate,
  getVersion,
  patchDraft,
} from '../templates.api';
import { buildDraftSaveIfMatch } from '../shared/draft-save-precondition';
import { TemplatePageService, errorDetailsOf } from '../template-page/template-page.service';
import {
  NewTemplateNode,
  alignNodesInDocument,
  arrangeNodesInDocument,
  checkGraph,
  collectPageNodes,
  currentPageConfig,
  duplicateNodesInDocument,
  insertNodeInDocument,
  isInHeaderOrFooterZone,
  moveInFlowInDocument,
  newDesignerUuid,
  removeNodesFromDocument,
  updateFrameInDocument,
} from './document-ops';
import { DesignerTool, DesignerToolState, evaluateToolState } from './tool-rules';

export type LayoutMode = TemplateLayoutMode;
export type DataSourceSchema = TemplateDataSourceSchemaDto;
export type SchemaField = TemplateSchemaField;
export type SchemaDataType = TemplateFieldDataType;
export type PageConfig = TemplatePageConfig;
export type FormulaExpression = TemplateFormulaExpression;
export type BindingFormat = TemplateBindingFormat;
export type { DesignerTool, NewTemplateNode };

export type DesignerCommand =
  | { kind: 'insertText' }
  | { kind: 'insertLine' }
  | { kind: 'insertImage' }
  | { kind: 'replaceImage'; nodeId: string }
  | { kind: 'insertDataField' }
  | { kind: 'editBinding'; nodeId: string }
  | { kind: 'openProperties'; nodeId: string }
  | { kind: 'editTextContent'; nodeId: string }
  | { kind: 'openVisibility'; nodeId: string }
  | { kind: 'openLayers' }
  | { kind: 'openPages' }
  | { kind: 'openPageSetup' }
  | { kind: 'insertTable'; tableKind: 'STATIC' | 'DYNAMIC' }
  | { kind: 'openTableSettings'; nodeId: string }
  | { kind: 'editCell'; nodeId: string; cellId: string }
  | { kind: 'insertFormula' }
  | { kind: 'editFormula'; nodeId: string; cellId?: string }
  | { kind: 'insertTotals' }
  | { kind: 'openTotals'; nodeId: string }
  | { kind: 'openEmailSettings' }
  | { kind: 'insertButton' }
  | { kind: 'insertLink' }
  | { kind: 'editLink'; nodeId: string };

export interface AssetCacheEntry {
  status: 'LOADING' | 'READY' | 'ERROR';
  url: string | null;
}

const MAX_UNDO_STEPS = 100;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function humanizePathSegment(path: string): string {
  const cleaned = path.replace(/\[\]/g, '');
  const parts = cleaned.split('.');
  const last = parts[parts.length - 1] ?? path;
  const spaced = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  if (!spaced) return path;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

@Injectable()
export class DesignerState {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageService = inject(TemplatePageService);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;

  private readonly _templateId = signal('');
  private readonly _definition = signal<TemplateDefinitionDetail | null>(null);
  private readonly _document = signal<TemplateDocumentV1 | null>(null);
  private readonly _base = signal<TemplateDocumentV1 | null>(null);
  private readonly _schema = signal<DataSourceSchema | null>(null);
  private readonly _schemaFailed = signal(false);
  private readonly _selectedIds = signal<readonly string[]>([]);
  private readonly _undoStack = signal<TemplateDocumentV1[]>([]);
  private readonly _redoStack = signal<TemplateDocumentV1[]>([]);
  private readonly _command = signal<{ seq: number; cmd: DesignerCommand } | null>(null);
  private readonly _versionReadOnly = signal(false);

  private readonly _loading = signal(true);
  private readonly _loadError = signal<'loadFailed' | 'notFound' | 'forbidden' | null>(null);
  private readonly _loadCorrelationId = signal<string | null>(null);
  private readonly _noPublished = signal(false);

  private readonly assetCache = signal<Record<string, AssetCacheEntry>>({});
  private readonly requestedAssets = new Set<string>();
  private readonly schemaCache = new Map<string, DataSourceSchema>();

  private draftEtag = '"1"';
  private draftRevision = 1;
  private draftContentChecksum = '';
  private initializedTemplateId: string | null = null;
  private commandSeq = 0;
  private loadSeq = 0;
  private pendingSaveIntent: { payloadJson: string; idempotencyKey: string; clientMutationId: string } | null = null;

  readonly loading = this._loading.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly loadCorrelationId = this._loadCorrelationId.asReadonly();
  readonly noPublished = this._noPublished.asReadonly();

  readonly templateId: Signal<string> = this._templateId.asReadonly();
  readonly document: Signal<TemplateDocumentV1 | null> = this._document.asReadonly();
  readonly layoutMode: Signal<LayoutMode | null> = computed(() => this._document()?.layoutMode ?? null);
  readonly channel: Signal<'PRINT' | 'EMAIL' | null> = computed(() => this._document()?.outputChannel ?? null);
  readonly schema: Signal<DataSourceSchema | null> = this._schema.asReadonly();
  readonly schemaFailed: Signal<boolean> = this._schemaFailed.asReadonly();

  readonly readOnly: Signal<boolean> = computed(() => {
    if (this._versionReadOnly()) return true;
    const def = this._definition() ?? this.pageService.definition();
    if (!def) return true;
    return this.pageService.draftAccessForbidden() || def.lifecycleStatus === 'ARCHIVED' || def.capabilities.update.state !== 'ENABLED';
  });

  readonly pageIndex: WritableSignal<number> = signal(0);
  readonly pageCount: Signal<number> = computed(() => {
    const doc = this._document();
    if (!doc) return 0;
    if (doc.layoutMode === 'FIXED_CANVAS' && doc.canvasPages && doc.canvasPages.length > 0) {
      return doc.canvasPages.length;
    }
    return 1;
  });

  readonly currentPage: Signal<PageConfig | null> = computed(() => {
    const doc = this._document();
    if (!doc) return null;
    return currentPageConfig(doc, this.pageIndex());
  });

  readonly selectedIds: Signal<readonly string[]> = this._selectedIds.asReadonly();
  readonly selectedNodes: Signal<readonly TemplateNode[]> = computed(() => {
    const doc = this._document();
    if (!doc) return [];
    return this._selectedIds()
      .map((id) => doc.nodes[id])
      .filter((node): node is TemplateNode => Boolean(node));
  });
  readonly primary: Signal<TemplateNode | null> = computed(() => {
    const nodes = this.selectedNodes();
    return nodes.length > 0 ? nodes[nodes.length - 1] : null;
  });

  readonly zoom: WritableSignal<number> = signal(1);
  readonly zoomMode: WritableSignal<'FIT_WIDTH' | 'FIT_PAGE' | 'MANUAL'> = signal('FIT_WIDTH');
  readonly emailWidthPx: WritableSignal<600 | 320> = signal(600);

  private readonly baseJson = computed(() => {
    const base = this._base();
    return base ? stableStringify(base) : '';
  });
  private readonly docJson = computed(() => {
    const doc = this._document();
    return doc ? stableStringify(doc) : '';
  });

  readonly dirty: Signal<boolean> = computed(() => {
    if (this.readOnly()) return false;
    if (!this._base() || !this._document()) return false;
    return this.docJson() !== this.baseJson();
  });

  readonly canUndo: Signal<boolean> = computed(() => !this.readOnly() && this._undoStack().length > 0);
  readonly canRedo: Signal<boolean> = computed(() => !this.readOnly() && this._redoStack().length > 0);
  readonly command: Signal<{ seq: number; cmd: DesignerCommand } | null> = this._command.asReadonly();

  constructor() {
    this.pageService.registerDraftEditor({
      dirty: this.dirty,
      save: () => this.save(),
      discard: () => this.discard(),
      syncExternalDraft: (draft) => this.syncExternalDraft(draft),
    });

    // Keep draft ETag/revision aligned if Validation or Overview updates the draft externally while clean.
    effect(() => {
      const latestDraft = this.pageService.draft();
      if (latestDraft && !this.dirty() && latestDraft.templateId === this._templateId()) {
        this.draftEtag = latestDraft.etag;
        this.draftRevision = latestDraft.revision;
        if (
          this._document() &&
          latestDraft.contentChecksum &&
          latestDraft.contentChecksum !== this.draftContentChecksum
        ) {
          this.draftContentChecksum = latestDraft.contentChecksum;
          const nextDoc = structuredClone(latestDraft.editorDocument);
          this._base.set(structuredClone(nextDoc));
          this._document.set(nextDoc);
          this._undoStack.set([]);
          this._redoStack.set([]);
          this._selectedIds.set([]);
          this.pendingSaveIntent = null;
        }
      }
    });

    // Clamp pageIndex whenever pageCount shrinks (e.g. page deletion or undo).
    effect(() => {
      const count = this.pageCount();
      if (count > 0 && this.pageIndex() >= count) {
        this.pageIndex.set(count - 1);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.pageService.registerDraftEditor(null);
      this.revokeAllAssets();
    });
  }

  async init(templateId: string): Promise<void> {
    if (!templateId) {
      this.initializedTemplateId = null;
      this._loading.set(false);
      this._loadError.set('notFound');
      return;
    }
    if (this.initializedTemplateId === templateId && !this._loadError()) {
      return;
    }
    this.initializedTemplateId = templateId;
    this._templateId.set(templateId);
    await this.load(templateId);
  }

  resetForTemplate(): void {
    this.loadSeq++;
    this.initializedTemplateId = null;
    this._templateId.set('');
    this._definition.set(null);
    this._document.set(null);
    this._base.set(null);
    this._schema.set(null);
    this._schemaFailed.set(false);
    this._selectedIds.set([]);
    this._undoStack.set([]);
    this._redoStack.set([]);
    this._versionReadOnly.set(false);
    this._loading.set(true);
    this._loadError.set(null);
    this._loadCorrelationId.set(null);
    this._noPublished.set(false);
    this.draftEtag = '"1"';
    this.draftRevision = 1;
    this.draftContentChecksum = '';
    this.pendingSaveIntent = null;
    this.revokeAllAssets();
  }

  syncExternalDraft(draft: TemplateDraftDto): void {
    if (draft.templateId !== this._templateId()) return;
    this.draftEtag = draft.etag;
    this.draftRevision = draft.revision;
    this.draftContentChecksum = draft.contentChecksum;
    this.pendingSaveIntent = null;
    if (this._document() !== null || this._noPublished()) {
      this._versionReadOnly.set(false);
      this._noPublished.set(false);
      const nextDoc = structuredClone(draft.editorDocument);
      this._base.set(structuredClone(nextDoc));
      this._document.set(nextDoc);
      this._undoStack.set([]);
      this._redoStack.set([]);
      this._selectedIds.set([]);
    }
  }

  async reload(): Promise<void> {
    const id = this._templateId();
    if (!id) return;
    await this.load(id);
  }

  private async load(templateId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this._loading.set(true);
    this._loadError.set(null);
    this._loadCorrelationId.set(null);
    this._noPublished.set(false);
    this._selectedIds.set([]);
    this._undoStack.set([]);
    this._redoStack.set([]);
    this.pendingSaveIntent = null;

    try {
      const def = await getTemplate(templateId);
      if (seq !== this.loadSeq) return;

      this._definition.set(def);
      this.pageService.syncFromDefinition(def, this.pageService.overviewDirty());

      let loadedDoc: TemplateDocumentV1 | null = null;
      const canEditDraft = def.capabilities.update.state === 'ENABLED' && !this.pageService.draftAccessForbidden();

      if (canEditDraft) {
        try {
          const draft = await getDraft(templateId);
          if (seq !== this.loadSeq) return;
          this._versionReadOnly.set(false);
          this.draftRevision = draft.revision;
          this.draftEtag = draft.etag;
          this.draftContentChecksum = draft.contentChecksum;
          this.pageService.setDraft(draft);
          loadedDoc = structuredClone(draft.editorDocument);
        } catch (draftError) {
          if (seq !== this.loadSeq) return;
          const { status, code } = errorDetailsOf(draftError);
          if (status === 403 || code === 'CORE.TEMPLATE.PERMISSION.DENIED') {
            this.pageService.draftAccessForbidden.set(true);
          } else {
            throw draftError;
          }
        }
      }

      if (!loadedDoc) {
        this._versionReadOnly.set(true);
        if (!def.currentPublishedVersion) {
          this._noPublished.set(true);
          this._base.set(null);
          this._document.set(null);
          return;
        }
        const version = await getVersion(templateId, def.currentPublishedVersion.templateVersionId);
        if (seq !== this.loadSeq) return;
        loadedDoc = structuredClone(version.editorDocument);
      }

      this._base.set(structuredClone(loadedDoc));
      this._document.set(loadedDoc);
      this.pageIndex.set(0);
      this.zoomMode.set('FIT_WIDTH');

      await this.loadSchemaFor(def, loadedDoc.dataSourceKey, seq);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const { status, code, correlationId } = errorDetailsOf(error);
      this._loadCorrelationId.set(correlationId);
      if (status === 403 || code === 'CORE.TEMPLATE.PERMISSION.DENIED') {
        this._loadError.set('forbidden');
      } else if (status === 404 || code === 'CORE.TEMPLATE.NOT_FOUND') {
        this._loadError.set('notFound');
      } else {
        this._loadError.set('loadFailed');
      }
    } finally {
      if (seq === this.loadSeq) {
        this._loading.set(false);
      }
    }
  }

  private async loadSchemaFor(
    def: TemplateDefinitionDetail,
    dataSourceKey: TemplateDataSourceKey,
    seq: number,
  ): Promise<void> {
    const schemaVersion = (def.dataSourceSchemaVersion === 2 ? 2 : 1) as 1 | 2;
    const companyId = def.scope.type === 'COMPANY' ? def.scope.companyId : undefined;
    const cacheKey = `${dataSourceKey}:${def.scope.type}:${companyId ?? ''}:${schemaVersion}`;

    const cached = this.schemaCache.get(cacheKey);
    if (cached) {
      this._schema.set(cached);
      this._schemaFailed.set(false);
      return;
    }

    try {
      const schema = await getDataSourceSchema(dataSourceKey, {
        scopeType: def.scope.type,
        companyId,
        schemaVersion,
      });
      if (seq !== this.loadSeq) return;
      this.schemaCache.set(cacheKey, schema);
      this._schema.set(schema);
      this._schemaFailed.set(false);
    } catch {
      if (seq !== this.loadSeq) return;
      this._schema.set(null);
      this._schemaFailed.set(true);
    }
  }

  select(ids: readonly string[], mode: 'replace' | 'add' | 'toggle' = 'replace'): void {
    const doc = this._document();
    if (!doc) return;
    const valid = ids.filter((id) => Boolean(doc.nodes[id]));

    if (mode === 'replace') {
      this._selectedIds.set(Array.from(new Set(valid)));
      return;
    }
    if (mode === 'add') {
      const next = [...this._selectedIds()];
      for (const id of valid) {
        if (!next.includes(id)) next.push(id);
      }
      this._selectedIds.set(next);
      return;
    }

    // toggle
    const next = [...this._selectedIds()];
    for (const id of valid) {
      const idx = next.indexOf(id);
      if (idx >= 0) {
        next.splice(idx, 1);
      } else {
        next.push(id);
      }
    }
    this._selectedIds.set(next);
  }

  clearSelection(): void {
    if (this._selectedIds().length > 0) {
      this._selectedIds.set([]);
    }
  }

  apply(_labelKey: string, mutate: (doc: TemplateDocumentV1) => void): void {
    if (this.readOnly()) return;
    const current = this._document();
    if (!current) return;

    const prev = structuredClone(current);
    const next = structuredClone(current);
    mutate(next);

    if (!checkGraph(next)) {
      this.notify.error(this.transloco.translate('tplDesigner.errors.editRefused'));
      return;
    }

    if (stableStringify(prev) === stableStringify(next)) {
      return;
    }

    this._document.set(next);
    this._undoStack.update((stack) => [...stack.slice(-(MAX_UNDO_STEPS - 1)), prev]);
    this._redoStack.set([]);

    const cleanedSelection = this._selectedIds().filter((id) => Boolean(next.nodes[id]));
    if (cleanedSelection.length !== this._selectedIds().length) {
      this._selectedIds.set(cleanedSelection);
    }
  }

  updateNode(id: string, patch: Partial<TemplateNode>, labelKey = 'updateNode'): void {
    this.apply(labelKey, (doc) => {
      const existing = doc.nodes[id];
      if (!existing) return;
      doc.nodes[id] = {
        ...existing,
        ...patch,
        id: existing.id,
        type: existing.type,
      } as TemplateNode;
    });
  }

  updateFrame(
    ids: readonly string[],
    change: { dx?: number; dy?: number; x?: number; y?: number; width?: number; height?: number; rotationDeg?: number },
  ): void {
    this.apply('updateFrame', (doc) => {
      let nextChange = change;
      if ((change.dx !== undefined || change.dy !== undefined) && change.x === undefined && change.y === undefined) {
        const movable = ids
          .map((id) => doc.nodes[id])
          .filter((n): n is TemplateNode => Boolean(n && !n.locked && n.layout.kind === 'ABSOLUTE'));
        if (movable.length > 0) {
          let minDx = -Infinity;
          let maxDx = Infinity;
          let minDy = -Infinity;
          let maxDy = Infinity;
          for (const n of movable) {
            if (n.layout.kind !== 'ABSOLUTE') continue;
            minDx = Math.max(minDx, -n.layout.x);
            maxDx = Math.min(maxDx, 500 - n.layout.x);
            minDy = Math.max(minDy, -n.layout.y);
            maxDy = Math.min(maxDy, 1000 - n.layout.y);
          }
          const clampVal = (v: number, lo: number, hi: number) => (lo <= hi ? Math.min(hi, Math.max(lo, v)) : v);
          nextChange = {
            ...change,
            ...(change.dx !== undefined ? { dx: clampVal(change.dx, minDx, maxDx) } : {}),
            ...(change.dy !== undefined ? { dy: clampVal(change.dy, minDy, maxDy) } : {}),
          };
        }
      }
      updateFrameInDocument(doc, ids, nextChange);
    });
  }

  insertNode(node: NewTemplateNode, at?: { parentId?: string | null; index?: number }): string {
    if (this.readOnly() || !this._document()) return '';
    let newId = '';
    this.apply('insertNode', (doc) => {
      newId = insertNodeInDocument(doc, node, this.pageIndex(), this._selectedIds(), at);
    });
    if (newId) {
      this._selectedIds.set([newId]);
    }
    return newId;
  }

  removeNodes(ids: readonly string[]): void {
    if (this.readOnly() || ids.length === 0) return;
    let skippedLocked = false;
    let removedCount = 0;
    this.apply('removeNodes', (doc) => {
      const res = removeNodesFromDocument(doc, ids);
      skippedLocked = res.skippedLocked;
      removedCount = res.removedIds.length;
    });
    if (skippedLocked) {
      this.notify.info(this.transloco.translate('tplDesigner.toasts.lockedSkipped'));
    }
    if (removedCount > 0) {
      this.clearSelection();
    }
  }

  duplicateNodes(ids: readonly string[]): string[] {
    if (this.readOnly() || ids.length === 0) return [];
    let createdIds: string[] = [];
    this.apply('duplicateNodes', (doc) => {
      createdIds = duplicateNodesInDocument(doc, ids, this.pageIndex());
    });
    if (createdIds.length > 0) {
      this._selectedIds.set(createdIds);
    }
    return createdIds;
  }

  moveInFlow(id: string, delta: -1 | 1): void {
    this.apply('moveInFlow', (doc) => {
      moveInFlowInDocument(doc, id, delta);
    });
  }

  arrange(ids: readonly string[], op: 'FRONT' | 'BACK' | 'FORWARD' | 'BACKWARD'): void {
    this.apply('arrange', (doc) => {
      arrangeNodesInDocument(doc, ids, op, this.pageIndex());
    });
  }

  align(ids: readonly string[], edge: 'START' | 'CENTER_H' | 'END' | 'TOP' | 'CENTER_V' | 'BOTTOM'): void {
    const page = this.currentPage();
    if (!page) return;
    this.apply('align', (doc) => {
      const activePage = currentPageConfig(doc, this.pageIndex()) ?? page;
      const isRtl = doc.direction === 'RTL' || (doc.direction === 'AUTO' && doc.locale.startsWith('ar'));
      const physicalPage: PageConfig = isRtl
        ? {
            ...activePage,
            marginMm: {
              ...activePage.marginMm,
              start: activePage.marginMm.end,
              end: activePage.marginMm.start,
            },
          }
        : activePage;
      alignNodesInDocument(doc, ids, edge, physicalPage);
    });
  }

  undo(): void {
    if (this.readOnly()) return;
    const stack = this._undoStack();
    const current = this._document();
    if (stack.length === 0 || !current) return;

    const prev = stack[stack.length - 1];
    this._undoStack.set(stack.slice(0, -1));
    this._redoStack.update((redo) => [...redo.slice(-(MAX_UNDO_STEPS - 1)), structuredClone(current)]);
    this._document.set(structuredClone(prev));
    this._selectedIds.update((sel) => sel.filter((id) => Boolean(prev.nodes[id])));
  }

  redo(): void {
    if (this.readOnly()) return;
    const stack = this._redoStack();
    const current = this._document();
    if (stack.length === 0 || !current) return;

    const next = stack[stack.length - 1];
    this._redoStack.set(stack.slice(0, -1));
    this._undoStack.update((undo) => [...undo.slice(-(MAX_UNDO_STEPS - 1)), structuredClone(current)]);
    this._document.set(structuredClone(next));
    this._selectedIds.update((sel) => sel.filter((id) => Boolean(next.nodes[id])));
  }

  run(cmd: DesignerCommand): void {
    this._command.set({ seq: ++this.commandSeq, cmd });
  }

  toolState(tool: DesignerTool): DesignerToolState {
    const doc = this._document();
    const selected = this.selectedNodes();
    const hasAbsoluteSelection = selected.some((n) => n.layout.kind === 'ABSOLUTE');
    const inHeaderOrFooterZone = doc ? selected.some((n) => isInHeaderOrFooterZone(doc, n.id)) : false;

    const result = evaluateToolState(tool, {
      channel: this.channel(),
      layoutMode: this.layoutMode(),
      readOnly: this.readOnly(),
      schemaFailed: this._schemaFailed(),
      hasAbsoluteSelection,
      inHeaderOrFooterZone,
    });
    if (
      this.layoutMode() === 'FIXED_CANVAS' &&
      (tool === 'TOTALS' || tool === 'LINK') &&
      result.state === 'HIDDEN' &&
      result.reasonKey === 'notInZone'
    ) {
      return { state: 'HIDDEN', reasonKey: 'absoluteOnly' };
    }
    return result;
  }

  pageNodes(): TemplateNode[] {
    const doc = this._document();
    if (!doc) return [];
    return collectPageNodes(doc, this.pageIndex());
  }

  findNodePageIndex(nodeId: string): number | null {
    const doc = this._document();
    if (!doc || !doc.nodes[nodeId]) return null;
    if (doc.layoutMode !== 'FIXED_CANVAS' || !doc.canvasPages || doc.canvasPages.length === 0) {
      return 0;
    }

    let rootId = nodeId;
    let cursor: TemplateNode | undefined = doc.nodes[nodeId];
    while (cursor?.parentId) {
      rootId = cursor.parentId;
      cursor = doc.nodes[cursor.parentId];
    }

    const idx = doc.canvasPages.findIndex((p) => p.rootNodeIds.includes(rootId));
    return idx >= 0 ? idx : 0;
  }

  fieldLabel(path: string): string {
    this.language();
    const field = this._schema()?.fields.find((f) => f.path === path);
    const labelKey = field?.labelKey;
    if (labelKey) {
      const scopedKey = `tplFields.labels.${labelKey}`;
      const scoped = this.transloco.translate(scopedKey);
      if (scoped && scoped !== scopedKey) return scoped;

      const direct = this.transloco.translate(labelKey);
      if (direct && direct !== labelKey) return direct;
    }

    const fallbackKey = `tplFields.labels.${path}`;
    const fallbackTranslated = this.transloco.translate(fallbackKey);
    if (fallbackTranslated && fallbackTranslated !== fallbackKey) {
      return fallbackTranslated;
    }

    return humanizePathSegment(path);
  }

  nodeDisplayName(node: TemplateNode): string {
    this.language();
    const trimmed = node.name?.trim();
    if (trimmed) return trimmed;
    const key = `tplDesigner.node.${node.type}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : this.transloco.translate('tplDesigner.node.unsupported');
  }

  assetEntry(assetId: string): AssetCacheEntry {
    return this.assetCache()[assetId] ?? { status: 'LOADING', url: null };
  }

  requestAsset(assetId: string): void {
    if (!assetId || this.requestedAssets.has(assetId)) return;
    this.requestedAssets.add(assetId);

    queueMicrotask(() => {
      if (!this.assetCache()[assetId]) {
        this.assetCache.update((map) => ({
          ...map,
          [assetId]: { status: 'LOADING', url: null },
        }));
      }

      void getAssetContent(assetId)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          this.assetCache.update((map) => ({
            ...map,
            [assetId]: { status: 'READY', url },
          }));
        })
        .catch(() => {
          this.assetCache.update((map) => ({
            ...map,
            [assetId]: { status: 'ERROR', url: null },
          }));
        });
    });
  }

  /**
   * If-Match for PATCH draft. When the loaded data-source schema advertises
   * `capabilities.draftSavePrecondition.kind === 'draft-schema'` (Sales Quotation, non-branch
   * scope), the backend accepts the strong tag `"draft-schema:<schemaChecksum>:<revision>"`,
   * which also rejects the save if the retained draft schema changed. Otherwise the plain
   * `"<revision>"` draft ETag is sent.
   */
  draftSaveIfMatch(): string {
    return buildDraftSaveIfMatch({
      plainEtag: this.draftEtag || this.pageService.draft()?.etag || `"${this.draftRevision}"`,
      revision: this.draftRevision,
      dataSourceKey: this._definition()?.dataSourceKey,
      schema: this._schema(),
    });
  }

  async save(): Promise<boolean> {
    if (this.readOnly() || !this.dirty()) return true;
    const templateId = this._templateId();
    const current = this._document();
    if (!templateId || !current) return false;

    const payloadDoc = structuredClone(current);
    const payloadJson = stableStringify(payloadDoc);

    if (!this.pendingSaveIntent || this.pendingSaveIntent.payloadJson !== payloadJson) {
      this.pendingSaveIntent = {
        payloadJson,
        idempotencyKey: newDesignerUuid(),
        clientMutationId: newDesignerUuid(),
      };
    }

    const { idempotencyKey, clientMutationId } = this.pendingSaveIntent;
    const ifMatch = this.draftSaveIfMatch();

    try {
      const res = await patchDraft(
        templateId,
        {
          editorDocument: payloadDoc,
          clientMutationId,
        },
        ifMatch,
        idempotencyKey,
      );

      this.pendingSaveIntent = null;
      this.draftRevision = res.draft.revision;
      this.draftEtag = res.draft.etag;
      this.draftContentChecksum = res.draft.contentChecksum;
      this.pageService.setDraft(res.draft);

      const currentDef = this.pageService.definition();
      if (currentDef) {
        const updatedDef: TemplateDefinitionDetail = {
          ...currentDef,
          thumbnail: res.thumbnail,
          currentDraft: {
            draftId: res.draft.draftId,
            revision: res.draft.revision,
            contentChecksum: res.draft.contentChecksum,
            validationState: res.draft.validation.state,
            etag: res.draft.etag,
          },
          capabilities: {
            ...currentDef.capabilities,
            publish:
              res.draft.validation.state === 'PASSED'
                ? currentDef.capabilities.publish
                : { state: 'DISABLED', reason: 'VALIDATION_REQUIRED' },
          },
        };
        this._definition.set(updatedDef);
        this.pageService.syncFromDefinition(updatedDef, this.pageService.overviewDirty());
      }

      const normalized = structuredClone(res.draft.editorDocument);
      this._base.set(normalized);

      if (this.docJson() === payloadJson) {
        this._document.set(structuredClone(normalized));
      }

      if (res.migrationRecovery !== null) {
        this.notify.info(this.transloco.translate('tplDesigner.toasts.migrated'));
      }

      return true;
    } catch (error) {
      const { status, code, correlationId } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION') {
        this.pendingSaveIntent = null;
        this.pageService.openConflict();
        return false;
      }
      if (status === 409 && code === 'CORE.TEMPLATE.CONCURRENCY.SCHEMA_CHANGED') {
        this.pendingSaveIntent = null;
        this.notify.warning(this.transloco.translate('tplDesigner.errors.schemaChanged'));
        void this.load(templateId);
        return false;
      }
      if (status === 422 && code === 'CORE.TEMPLATE.SCHEMA.INVALID') {
        this.pendingSaveIntent = null;
        const msg = this.transloco.translate('tplDesigner.errors.saveInvalid');
        const ref = correlationId ? this.transloco.translate('tplDesigner.state.reference', { id: correlationId }) : '';
        this.notify.error(msg, ref);
        return false;
      }
      if (status === 413) {
        this.pendingSaveIntent = null;
        this.notify.error(this.transloco.translate('tplDesigner.errors.tooLarge'));
        return false;
      }

      this.notify.error(this.pageService.translateError(this.transloco, error));
      return false;
    }
  }

  discard(): void {
    const base = this._base();
    if (!base) return;
    this._document.set(structuredClone(base));
    this._undoStack.set([]);
    this._redoStack.set([]);
    this._selectedIds.set([]);
    this.pendingSaveIntent = null;
  }

  private revokeAllAssets(): void {
    const entries = Object.values(this.assetCache());
    for (const entry of entries) {
      if (entry.url) {
        URL.revokeObjectURL(entry.url);
      }
    }
    this.assetCache.set({});
    this.requestedAssets.clear();
  }
}

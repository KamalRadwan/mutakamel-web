import { Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../../core/notify/notify';
import {
  PublishTemplateRequestDto,
  PublishTemplateResponseDto,
  TemplateDocumentV1,
  TemplateRendererTarget,
  TemplateValidationRunDto,
  TemplateVersionRef,
  getDraft,
  getTemplate,
  listVersions,
  newTemplateIdempotencyKey,
  publishTemplate,
  validateDraft,
} from '../../templates.api';
import { TemplatePageService, errorDetailsOf } from '../template-page.service';

export type ValidationRun = TemplateValidationRunDto;
export type PublishResult = PublishTemplateResponseDto;

export interface TextSegment {
  readonly text: string;
  readonly isolate: 'none' | 'auto' | 'ltr';
}

export function issueCatalogueKey(code: string): string {
  return `tplValidation.issues.${code.replace(/\./g, '_')}`;
}

export function splitIsolatedTokens(
  translatedWithSentinels: string,
  tokens: Record<string, { text: string; isolate: 'auto' | 'ltr' }>,
): TextSegment[] {
  const keys = Object.keys(tokens);
  if (keys.length === 0) {
    return translatedWithSentinels ? [{ text: translatedWithSentinels, isolate: 'none' }] : [];
  }

  const pattern = new RegExp(`\u0000(${keys.map(escapeRegex).join('|')})\u0000`, 'g');
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of translatedWithSentinels.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ text: translatedWithSentinels.slice(lastIndex, idx), isolate: 'none' });
    }
    const token = tokens[match[1]];
    if (token) {
      segments.push({ text: token.text, isolate: token.isolate });
    }
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < translatedWithSentinels.length) {
    segments.push({ text: translatedWithSentinels.slice(lastIndex), isolate: 'none' });
  }

  return segments;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function revisionFromEtag(etag: string | null | undefined, fallback: number): number {
  if (!etag) return fallback;
  const plainMatch = /^"(\d+)"$/.exec(etag.trim());
  if (plainMatch) return Number(plainMatch[1]);
  const schemaMatch = /^"draft-schema:[a-f0-9]{64}:(\d+)"$/i.exec(etag.trim());
  if (schemaMatch) return Number(schemaMatch[1]);
  return fallback;
}

function isEmailSubjectEmpty(doc: TemplateDocumentV1): boolean {
  const segments = doc.email?.subject?.segments;
  if (!segments || segments.length === 0) return true;
  return segments.every((seg) => seg.kind === 'TEXT' && seg.value.trim().length === 0);
}

@Injectable()
export class ValidationActions {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly pageService = inject(TemplatePageService);

  private readonly _running = signal(false);
  private readonly _publishing = signal(false);
  private readonly _lastRun = signal<ValidationRun | null>(null);
  private readonly _lastPublishClosedModal = signal(false);

  private pendingPublishIntent: { signature: string; idempotencyKey: string } | null = null;
  private lastTemplateId: string | undefined;

  readonly running: Signal<boolean> = this._running.asReadonly();
  readonly publishing: Signal<boolean> = this._publishing.asReadonly();
  readonly lastRun: Signal<ValidationRun | null> = computed(() => {
    const run = this._lastRun();
    const templateId = this.pageService.definition()?.templateId;
    return run && templateId && run.templateId === templateId ? run : null;
  });
  readonly lastPublishClosedModal: Signal<boolean> = this._lastPublishClosedModal.asReadonly();

  constructor() {
    effect(() => {
      const templateId = this.pageService.definition()?.templateId;
      if (templateId !== this.lastTemplateId) {
        this.lastTemplateId = templateId;
        this.pendingPublishIntent = null;
        this._lastPublishClosedModal.set(false);
      }
    });
  }

  resetPublishIntent(): void {
    this.pendingPublishIntent = null;
    this._lastPublishClosedModal.set(false);
  }

  async validate(): Promise<ValidationRun | null> {
    const def = this.pageService.definition();
    const draft = this.pageService.draft();
    if (
      !def ||
      !draft ||
      this._running() ||
      this._publishing() ||
      this.pageService.dirty() ||
      this.pageService.saving() ||
      !this.pageService.canUpdate() ||
      def.capabilities.validate.state !== 'ENABLED'
    ) {
      return null;
    }

    const draftRevision = revisionFromEtag(draft.etag, draft.revision);
    const rendererTargets: [TemplateRendererTarget, TemplateRendererTarget] =
      def.outputChannel === 'PRINT' ? ['HTML', 'PDF'] : ['EMAIL_HTML', 'EMAIL_TEXT'];
    const idempotencyKey = newTemplateIdempotencyKey();

    this._running.set(true);
    this.pageService.validating.set(true);

    try {
      let run: ValidationRun;
      try {
        run = await validateDraft(
          def.templateId,
          {
            draftRevision,
            rendererTargets,
          },
          draft.etag,
          idempotencyKey,
        );
      } catch (error) {
        const { status, code, correlationId } = errorDetailsOf(error);
        if (status === 409 && (code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' || code === 'STALE_REVISION')) {
          this.pageService.openConflict();
        } else if (
          (status === 422 || status === null) &&
          (code === 'CORE.TEMPLATE.COMPILER.TARGET_UNSUPPORTED' || code === 'COMPILER.TARGET_UNSUPPORTED')
        ) {
          this.notify.error(this.transloco.translate('tplValidation.errors.targetUnsupported'));
        } else {
          this.notify.error(this.pageService.translateError(this.transloco, error), this.supportRef(correlationId));
        }
        return null;
      }

      this._lastRun.set(run);
      this.pageService.lastValidationRun.set(run);

      const errorCount = run.issues.filter((issue) => issue.severity === 'ERROR').length;
      const warningCount = run.issues.filter((issue) => issue.severity === 'WARNING').length;

      if (run.status === 'PASSED') {
        if (warningCount === 0) {
          this.notify.success(this.transloco.translate('tplValidation.validate.passed'));
        } else if (warningCount === 1) {
          this.notify.success(this.transloco.translate('tplValidation.validate.passedWarningOne'));
        } else {
          this.notify.success(
            this.transloco.translate('tplValidation.validate.passedWarnings', { n: warningCount }),
          );
        }
      } else {
        const key = errorCount === 1 ? 'tplValidation.validate.failedOne' : 'tplValidation.validate.failed';
        this.notify.error(this.transloco.translate(key, { n: errorCount }));
      }

      try {
        const [freshDef, freshDraft] = await Promise.all([
          getTemplate(def.templateId),
          getDraft(def.templateId),
        ]);
        this.pageService.syncFromDefinition(freshDef, this.pageService.overviewDirty());
        if (!this.pageService.dirty()) {
          this.pageService.syncExternalDraft(freshDraft);
        } else {
          this.pageService.setDraft(freshDraft);
        }
      } catch (refreshError) {
        const { correlationId } = errorDetailsOf(refreshError);
        this.notify.warning(
          this.transloco.translate('tplValidation.refreshFailed'),
          this.supportRef(correlationId),
        );
      }

      void this.router.navigate(['/workspace/operations/template-platform', def.templateId, 'validation']);
      return run;
    } finally {
      this._running.set(false);
      this.pageService.validating.set(false);
    }
  }

  async publish(input: { changeNote: string | null }): Promise<PublishResult | null> {
    this._lastPublishClosedModal.set(false);
    const def = this.pageService.definition();
    const draft = this.pageService.draft();

    if (
      !def ||
      !draft ||
      this._publishing() ||
      this._running() ||
      this.pageService.dirty() ||
      this.pageService.saving() ||
      !this.pageService.canUpdate() ||
      def.capabilities.publish.state !== 'ENABLED'
    ) {
      return null;
    }

    if (def.outputChannel === 'EMAIL' && isEmailSubjectEmpty(draft.editorDocument)) {
      this.notify.error(this.transloco.translate('tplValidation.issues.TEMPLATE_EMAIL_SUBJECT_EMPTY'));
      return null;
    }

    const lastRun = this.lastRun();
    const validationRunId =
      lastRun && lastRun.draftRevision === draft.revision && lastRun.status === 'PASSED'
        ? lastRun.validationRunId
        : draft.validation.state === 'PASSED' && draft.validation.validatedDraftRevision === draft.revision
          ? draft.validation.lastValidationRunId
          : null;

    if (!validationRunId) {
      this.notify.error(this.transloco.translate('tplValidation.publish.notValidated'));
      this._lastPublishClosedModal.set(true);
      return null;
    }

    const draftRevision = revisionFromEtag(draft.etag, draft.revision);
    const trimmedNote = input.changeNote?.trim() ?? '';
    const signature = `${def.templateId}|${def.revision}|${draftRevision}|${validationRunId}|${trimmedNote}`;

    if (!this.pendingPublishIntent || this.pendingPublishIntent.signature !== signature) {
      this.pendingPublishIntent = {
        signature,
        idempotencyKey: newTemplateIdempotencyKey(),
      };
    }
    const { idempotencyKey } = this.pendingPublishIntent;

    const body: PublishTemplateRequestDto = {
      definitionRevision: def.revision,
      draftRevision,
      validationRunId,
      setAsDefinitionPublished: true,
      ...(trimmedNote ? { changeNote: trimmedNote } : {}),
    };

    this._publishing.set(true);
    try {
      let result: PublishResult;
      try {
        result = await publishTemplate(def.templateId, body, draft.etag, idempotencyKey);
        this.pendingPublishIntent = null;
      } catch (error) {
        const { status, code, correlationId } = errorDetailsOf(error);
        if (status !== null && status < 500) {
          this.pendingPublishIntent = null;
        }

        if (status === 409 && (code === 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION' || code === 'STALE_REVISION')) {
          this._lastPublishClosedModal.set(true);
          this.pageService.openConflict();
        } else if (
          code === 'CORE.TEMPLATE.PUBLISH.NOT_VALIDATED' ||
          code === 'PUBLISH.NOT_VALIDATED' ||
          code === 'CORE.TEMPLATE.PUBLISH.VALIDATION_STALE' ||
          code === 'PUBLISH.VALIDATION_STALE'
        ) {
          // Backend errors carry only { code, message }; the reason lives in the validation issues.
          this.notify.error(
            this.transloco.translate(
              this.hasEmailSubjectIssue(validationRunId)
                ? 'tplValidation.issues.TEMPLATE_EMAIL_SUBJECT_EMPTY'
                : 'tplValidation.publish.notValidated',
            ),
          );
          this._lastPublishClosedModal.set(true);
        } else if (code === 'CORE.TEMPLATE.PUBLISH.NO_CHANGES' || code === 'PUBLISH.NO_CHANGES') {
          this.notify.error(
            this.transloco.translate('tplValidation.publish.noChanges', {
              n: def.currentPublishedVersion?.versionNumber ?? 0,
            }),
          );
        } else if (code === 'CORE.TEMPLATE.ASSET.NOT_READY' || code === 'ASSET.NOT_READY') {
          this.notify.error(this.transloco.translate('tplValidation.publish.assetNotReady'));
        } else if (code === 'CORE.TEMPLATE.DEFINITION.ARCHIVED' || code === 'DEFINITION.ARCHIVED') {
          this.notify.error(this.transloco.translate('tplValidation.publish.archived'));
        } else if (code === 'CORE.TEMPLATE.DEFINITION.SYSTEM_PROTECTED' || code === 'DEFINITION.SYSTEM_PROTECTED') {
          this.notify.error(this.transloco.translate('tplValidation.publish.system'));
        } else {
          this.notify.error(this.pageService.translateError(this.transloco, error), this.supportRef(correlationId));
        }
        return null;
      }

      // Apply authoritative ETags, revision, published version and STALE draft state immediately from the 201 response.
      const nextDraftRevision = revisionFromEtag(result.draftEtag, result.consumedDraftRevision + 1);
      const publishedRef: TemplateVersionRef = {
        templateDefinitionId: result.version.templateDefinitionId,
        templateVersionId: result.version.templateVersionId,
        versionNumber: result.version.versionNumber,
        documentType: result.version.documentType,
        outputChannel: result.version.outputChannel,
        layoutMode: result.version.layoutMode,
        locale: result.version.locale,
        direction: result.version.direction,
        dataSourceKey: result.version.dataSourceKey,
        dataSourceSchemaVersion: result.version.dataSourceSchemaVersion,
        dataSourceSchemaChecksum: result.version.dataSourceSchemaChecksum,
        templateContentChecksum: result.version.templateContentChecksum,
        compiledChecksum: result.version.compiledChecksum,
        compilerFingerprint: result.version.compilerFingerprint,
        lifecycleStatus: result.version.lifecycleStatus,
        publishedAt: result.version.publishedAt,
      };
      this.pageService.syncFromDefinition(
        {
          ...def,
          revision: result.definitionRevision,
          etag: result.definitionEtag,
          thumbnail: result.thumbnail,
          currentPublishedVersion: publishedRef,
          currentDraft: {
            ...def.currentDraft,
            revision: nextDraftRevision,
            validationState: 'STALE',
            etag: result.draftEtag,
          },
          capabilities: {
            ...def.capabilities,
            publish: { state: 'DISABLED', reason: 'VALIDATION_REQUIRED' },
          },
        },
        this.pageService.overviewDirty(),
      );
      const optimisticDraft = {
        ...draft,
        revision: nextDraftRevision,
        etag: result.draftEtag,
        baseVersionId: result.version.templateVersionId,
        restoreSourceVersionId: null,
        validation: {
          ...draft.validation,
          state: 'STALE' as const,
        },
      };
      if (!this.pageService.dirty()) {
        this.pageService.syncExternalDraft(optimisticDraft);
      } else {
        this.pageService.setDraft(optimisticDraft);
      }
      this.pageService.versions.update((list) =>
        list.some((item) => item.templateVersionId === result.version.templateVersionId)
          ? list
          : [result.version, ...list],
      );

      this.notify.success(
        this.transloco.translate('tplValidation.publish.done', { n: result.version.versionNumber }),
      );

      try {
        const [freshDef, freshDraft, freshVersions] = await Promise.all([
          getTemplate(def.templateId),
          getDraft(def.templateId),
          listVersions(def.templateId, { limit: 25 }),
        ]);
        this.pageService.syncFromDefinition(freshDef, this.pageService.overviewDirty());
        if (!this.pageService.dirty()) {
          this.pageService.syncExternalDraft(freshDraft);
        } else {
          this.pageService.setDraft(freshDraft);
        }
        this.pageService.versions.set(freshVersions.items);
        this.pageService.versionsHasNext.set(freshVersions.pageInfo.hasNextPage);
        this.pageService.versionsNextCursor.set(freshVersions.pageInfo.nextCursor);
      } catch (refreshError) {
        const { correlationId } = errorDetailsOf(refreshError);
        this.notify.warning(
          this.transloco.translate('tplValidation.refreshFailed'),
          this.supportRef(correlationId),
        );
      }

      return result;
    } finally {
      this._publishing.set(false);
    }
  }

  /** True when the loaded validation result for this run reports the email-subject issue. */
  private hasEmailSubjectIssue(validationRunId: string): boolean {
    const run = this.lastRun() ?? this.pageService.lastValidationRun();
    if (!run || run.validationRunId !== validationRunId) return false;
    return run.issues.some((issue) => issue.code === 'TEMPLATE_EMAIL_SUBJECT_EMPTY' && issue.severity === 'ERROR');
  }

  private supportRef(correlationId: string | null): string {
    return correlationId ? this.transloco.translate('tplValidation.reference', { id: correlationId }) : '';
  }
}

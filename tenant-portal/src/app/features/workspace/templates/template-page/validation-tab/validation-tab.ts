import { Component, computed, effect, inject, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleCheck, tablerRefresh, tablerShieldCheck } from '@ng-icons/tabler-icons';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { templateValidationMeta } from '../../shared/template-family';
import {
  TemplatesApi,
  type TemplateIssueSeverity,
  type TemplateValidationRunDto,
  type TemplateValidationState,
} from '../../templates.api';
import { TextSegment, ValidationActions, issueCatalogueKey, splitIsolatedTokens } from '../publish/validation-actions';
import { TemplatePageService, errorDetailsOf } from '../template-page.service';
import { nodeIdFromJsonPointer } from '../../shared/json-pointer';

type IssueFilter = 'ALL' | TemplateIssueSeverity;

interface ValidationIssueRow {
  readonly key: string;
  readonly severity: TemplateIssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly objectLabel: string;
  readonly jsonPointer: string;
  readonly nodeId: string | null;
}

/**
 * Backend issues carry params {} plus nodeId | null and a jsonPointer (issueDto). The node is taken from nodeId,
 * or from an RFC 6901 "/nodes/<id>/..." pointer (segment unescaped) when nodeId is null; its display name comes from the draft document.
 */
function issueNodeId(issue: { nodeId: string | null; jsonPointer: string }): string | null {
  if (issue.nodeId) return issue.nodeId;
  return nodeIdFromJsonPointer(issue.jsonPointer);
}

function isRetainedValidationRun(
  value: unknown,
  templateId: string,
  runId: string,
): value is TemplateValidationRunDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    row['validationRunId'] === runId &&
    row['templateId'] === templateId &&
    typeof row['draftRevision'] === 'number' &&
    Number.isSafeInteger(row['draftRevision']) &&
    row['draftRevision'] > 0 &&
    (row['status'] === 'PASSED' || row['status'] === 'FAILED') &&
    Array.isArray(row['issues']) &&
    row['issues'].every((issue: unknown) => {
      if (typeof issue !== 'object' || issue === null || Array.isArray(issue)) return false;
      const entry = issue as Record<string, unknown>;
      return (
        (entry['severity'] === 'ERROR' || entry['severity'] === 'WARNING' || entry['severity'] === 'INFO') &&
        typeof entry['code'] === 'string' &&
        typeof entry['jsonPointer'] === 'string' &&
        (entry['nodeId'] === null || typeof entry['nodeId'] === 'string')
      );
    }) &&
    typeof row['completedAt'] === 'string'
  );
}

const TOKEN_AT = '\u0000AT\u0000';
const TOKEN_REV = '\u0000REV\u0000';
const TOKEN_ERR = '\u0000ERR\u0000';
const TOKEN_WARN = '\u0000WARN\u0000';
const TOKEN_NUM = '\u0000NUM\u0000';

@Component({
  selector: 'app-validation-tab',
  imports: [NgIcon, TranslocoPipe, Button, Field, Segmented],
  providers: [
    provideTranslocoScope(
      'templates',
      { scope: 'templates-validation', alias: 'tplValidation' },
      { scope: 'templates-designer', alias: 'tplDesigner' },
    ),
    provideIcons({ tablerShieldCheck, tablerCircleCheck, tablerRefresh }),
  ],
  templateUrl: './validation-tab.html',
  host: { class: 'flex min-w-0 flex-col gap-10' },
})
export class ValidationTab {
  private static nextId = 0;
  protected readonly uid = `tpl-validation-${++ValidationTab.nextId}`;
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly templatesApi = inject(TemplatesApi);
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);
  protected readonly actions = inject(ValidationActions);

  protected readonly severityFilter = signal<IssueFilter>('ALL');
  protected readonly loadingRun = signal(false);
  protected readonly loadError = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  private readonly fetchedRun = signal<TemplateValidationRunDto | null>(null);
  private readonly notFoundRunId = signal<string | null>(null);

  private loadSeq = 0;
  private lastLoadedKey: string | null = null;
  private lastRunKeyForFilter: string | null = null;

  protected readonly activeRun = computed<TemplateValidationRunDto | null>(() => {
    const def = this.service.definition();
    const draft = this.service.draft();
    if (!def || !draft) return null;

    const actionRun = this.actions.lastRun();
    const runId = draft.validation.lastValidationRunId;
    if (actionRun && actionRun.templateId === def.templateId) {
      if (
        actionRun.validationRunId === runId ||
        !runId ||
        actionRun.draftRevision >= (draft.validation.validatedDraftRevision ?? 0)
      ) {
        return actionRun;
      }
    }

    if (!runId || this.notFoundRunId() === runId) return null;
    const fetched = this.fetchedRun();
    if (fetched && fetched.templateId === def.templateId && fetched.validationRunId === runId) {
      return fetched;
    }
    return null;
  });

  protected readonly effectiveState = computed<TemplateValidationState>(() => {
    const run = this.activeRun();
    const draft = this.service.draft();
    if (!run || !draft) return 'NOT_VALIDATED';
    if (draft.revision > run.draftRevision) return 'STALE';

    const runIsNewer =
      run.validationRunId !== draft.validation.lastValidationRunId ||
      run.draftRevision > (draft.validation.validatedDraftRevision ?? -1);
    if (runIsNewer) return run.status;

    return draft.validation.state;
  });

  protected readonly validationBadge = computed(() => templateValidationMeta(this.effectiveState()));

  protected readonly canValidate = computed(() => {
    const def = this.service.definition();
    return !!def && !this.service.isReadOnly() && def.capabilities.validate.state === 'ENABLED';
  });

  protected readonly checkNowDisabled = computed(
    () => this.service.dirty() || this.actions.running() || this.service.saving(),
  );

  protected readonly orderedIssues = computed<ValidationIssueRow[]>(() => {
    this.i18n();
    this.language();
    const run = this.activeRun();
    if (!run) return [];

    const nodes = this.service.draft()?.editorDocument.nodes ?? {};
    const errors: ValidationIssueRow[] = [];
    const warnings: ValidationIssueRow[] = [];

    run.issues.forEach((issue, idx) => {
      const catKey = issueCatalogueKey(issue.code);
      const translated = this.transloco.translate(catKey);
      const message =
        translated && translated !== catKey
          ? translated
          : this.transloco.translate('tplValidation.issues.UNKNOWN', { code: issue.code });

      const nodeId = issueNodeId(issue);
      let objectLabel: string;
      if (nodeId) {
        const node = nodes[nodeId];
        if (node) {
          const customName = node.name?.trim();
          if (customName) {
            objectLabel = customName;
          } else {
            const typeKey = `tplDesigner.node.${node.type}`;
            const typeLabel = this.transloco.translate(typeKey);
            objectLabel =
              typeLabel && typeLabel !== typeKey
                ? typeLabel
                : this.transloco.translate('tplDesigner.node.unsupported');
          }
        } else {
          objectLabel = this.transloco.translate('tplValidation.object.removed');
        }
      } else {
        objectLabel = this.transloco.translate('tplValidation.object.document');
      }

      const row: ValidationIssueRow = {
        key: `${idx}:${issue.code}:${issue.jsonPointer}`,
        severity: issue.severity,
        code: issue.code,
        message,
        objectLabel,
        jsonPointer: issue.jsonPointer,
        nodeId,
      };

      if (issue.severity === 'ERROR') {
        errors.push(row);
      } else {
        warnings.push(row);
      }
    });

    return [...errors, ...warnings];
  });

  protected readonly errorCount = computed(
    () => this.activeRun()?.issues.filter((issue) => issue.severity === 'ERROR').length ?? 0,
  );

  protected readonly warningCount = computed(
    () => this.activeRun()?.issues.filter((issue) => issue.severity === 'WARNING').length ?? 0,
  );

  protected readonly totalCount = computed(() => this.activeRun()?.issues.length ?? 0);

  protected readonly filteredIssues = computed(() => {
    const filter = this.severityFilter();
    const rows = this.orderedIssues();
    if (filter === 'ALL') return rows;
    return rows.filter((row) => row.severity === filter);
  });

  protected readonly filterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'ALL', label: this.transloco.translate('tplValidation.filter.all', { n: this.totalCount() }) },
      { value: 'ERROR', label: this.transloco.translate('tplValidation.filter.errors', { n: this.errorCount() }) },
      {
        value: 'WARNING',
        label: this.transloco.translate('tplValidation.filter.warnings', { n: this.warningCount() }),
      },
    ];
  });

  protected readonly checkedSegments = computed<TextSegment[]>(() => {
    this.i18n();
    const lang = this.language();
    const run = this.activeRun();
    if (!run) return [];
    const at = this.service.formatDateTime(run.completedAt, lang);
    const rev = `r${run.draftRevision}`;
    const raw = this.transloco
      .translate('tplValidation.summary.checked', { at: TOKEN_AT, rev: TOKEN_REV })
      .replace(`r${TOKEN_REV}`, TOKEN_REV);
    return splitIsolatedTokens(raw, {
      AT: { text: at, isolate: 'auto' },
      REV: { text: rev, isolate: 'ltr' },
    });
  });

  protected readonly changedSegments = computed<TextSegment[]>(() => {
    this.i18n();
    this.language();
    const draft = this.service.draft();
    if (!draft) return [];
    const rev = `r${draft.revision}`;
    const raw = this.transloco
      .translate('tplValidation.summary.changed', { rev: TOKEN_REV })
      .replace(`r${TOKEN_REV}`, TOKEN_REV);
    return splitIsolatedTokens(raw, {
      REV: { text: rev, isolate: 'ltr' },
    });
  });

  protected readonly countsSegments = computed<TextSegment[]>(() => {
    this.i18n();
    this.language();
    const errors = this.errorCount();
    const warnings = this.warningCount();
    if (errors !== 1 && warnings !== 1) {
      const raw = this.transloco.translate('tplValidation.summary.counts', {
        e: TOKEN_ERR,
        w: TOKEN_WARN,
      });
      return splitIsolatedTokens(raw, {
        ERR: { text: String(errors), isolate: 'ltr' },
        WARN: { text: String(warnings), isolate: 'ltr' },
      });
    }

    const errText =
      errors === 1
        ? this.transloco.translate('tplValidation.summary.errorOne', { n: TOKEN_NUM })
        : this.transloco.translate('tplValidation.summary.errors', { n: TOKEN_NUM });
    const warnText =
      warnings === 1
        ? this.transloco.translate('tplValidation.summary.warningOne', { n: TOKEN_NUM })
        : this.transloco.translate('tplValidation.summary.warnings', { n: TOKEN_NUM });

    return [
      ...splitIsolatedTokens(errText, { NUM: { text: String(errors), isolate: 'ltr' } }),
      { text: ' · ', isolate: 'none' },
      ...splitIsolatedTokens(warnText, { NUM: { text: String(warnings), isolate: 'ltr' } }),
    ];
  });

  constructor() {
    effect(() => {
      const def = this.service.definition();
      const draft = this.service.draft();
      const actionRun = this.actions.lastRun();

      if (!def || !draft) {
        this.loadSeq++;
        this.lastLoadedKey = null;
        this.fetchedRun.set(null);
        this.notFoundRunId.set(null);
        this.loadingRun.set(false);
        this.loadError.set(false);
        this.loadCorrelationId.set(null);
        return;
      }

      const runId = draft.validation.lastValidationRunId;
      if (
        actionRun &&
        actionRun.templateId === def.templateId &&
        (actionRun.validationRunId === runId ||
          !runId ||
          actionRun.draftRevision >= (draft.validation.validatedDraftRevision ?? 0))
      ) {
        this.loadSeq++;
        this.lastLoadedKey = null;
        this.loadingRun.set(false);
        this.loadError.set(false);
        this.loadCorrelationId.set(null);
        this.notFoundRunId.set(null);
        return;
      }

      if (!runId) {
        this.loadSeq++;
        this.lastLoadedKey = null;
        this.fetchedRun.set(null);
        this.notFoundRunId.set(null);
        this.loadingRun.set(false);
        this.loadError.set(false);
        this.loadCorrelationId.set(null);
        return;
      }

      const loadKey = `${def.templateId}:${runId}`;
      if (loadKey !== this.lastLoadedKey) {
        this.lastLoadedKey = loadKey;
        void this.loadRun(def.templateId, runId);
      }
    });

    effect(() => {
      const templateId = this.service.definition()?.templateId ?? '';
      const runId = this.activeRun()?.validationRunId ?? '';
      const nextKey = `${templateId}:${runId}`;
      if (nextKey !== this.lastRunKeyForFilter) {
        this.lastRunKeyForFilter = nextKey;
        this.severityFilter.set('ALL');
      }
    });
  }

  protected runCheckNow(): void {
    void this.actions.validate();
  }

  protected retryLoad(): void {
    const def = this.service.definition();
    const runId = this.service.draft()?.validation.lastValidationRunId;
    if (!def || !runId) return;
    this.lastLoadedKey = `${def.templateId}:${runId}`;
    void this.loadRun(def.templateId, runId);
  }

  protected onFilterChange(value: string | null): void {
    if (value === 'ALL' || value === 'ERROR' || value === 'WARNING') {
      this.severityFilter.set(value);
    }
  }

  protected showInDesign(nodeId: string): void {
    const templateId = this.service.definition()?.templateId;
    if (!templateId) return;
    void this.router.navigate(['/workspace/operations/template-platform', templateId, 'design'], {
      queryParams: { node: nodeId },
    });
  }

  private async loadRun(templateId: string, runId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loadingRun.set(true);
    this.loadError.set(false);
    this.loadCorrelationId.set(null);
    this.notFoundRunId.set(null);

    try {
      const run = await this.templatesApi.getValidationRun(templateId, runId);
      if (seq !== this.loadSeq || this.service.definition()?.templateId !== templateId) return;
      if (!isRetainedValidationRun(run, templateId, runId)) {
        throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
      }
      this.fetchedRun.set(run);
    } catch (error) {
      if (seq !== this.loadSeq || this.service.definition()?.templateId !== templateId) return;
      const { status, code, correlationId } = errorDetailsOf(error);
      if (status === 404 || code === 'CORE.TEMPLATE.NOT_FOUND') {
        this.fetchedRun.set(null);
        this.notFoundRunId.set(runId);
        this.loadError.set(false);
      } else {
        this.fetchedRun.set(null);
        this.loadError.set(true);
        this.loadCorrelationId.set(correlationId);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingRun.set(false);
      }
    }
  }
}

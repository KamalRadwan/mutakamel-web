import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowRight,
  tablerArrowsRightLeft,
  tablerCheck,
  tablerCircleCheck,
  tablerCircleX,
  tablerClock,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { getDataSourceSchema, getTemplate } from '../../templates.api';
import {
  ApplyFunctionToDraftsResponseDto,
  FUNCTION_MAX_IMPACT_TARGETS,
  FunctionImpactResponseDto,
  FunctionUsageItemDto,
  FunctionValue,
  TemplateApiError,
  applyFunctionToDrafts,
  checkFunctionImpact,
  formatFunctionTime,
  formatFunctionValue,
  newTemplateIdempotencyKey,
  translateFunctionError,
  translateFunctionIssueCode,
} from '../functions.api';

type ImpactStep = 'targets' | 'results' | 'apply';

interface ImpactTargetDraftRow {
  templateId: string;
  templateName: string;
  draftRevision: number;
  selected: boolean;
  fixtureKey: string;
  fixtureOptions: DropdownOption<string>[];
}

export interface FunctionImpactOpenOptions {
  functionId: string;
  functionName: string;
  versionId: string;
  versionNumber: number;
  usageItems: readonly FunctionUsageItemDto[];
}

@Component({
  selector: 'app-function-impact-modal',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Dropdown, Field, Modal],
  providers: [
    provideIcons({
      tablerArrowsRightLeft,
      tablerArrowRight,
      tablerCheck,
      tablerCircleCheck,
      tablerCircleX,
      tablerClock,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './function-impact-modal.html',
})
export class FunctionImpactModal {
  private static nextId = 0;
  protected readonly uid = `fn-impact-modal-${++FunctionImpactModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('impactModal');

  readonly applied = output<ApplyFunctionToDraftsResponseDto>();

  protected readonly steps: readonly { id: ImpactStep; num: number; labelKey: string }[] = [
    { id: 'targets', num: 1, labelKey: 'tplFunctions.impact.steps.targets' },
    { id: 'results', num: 2, labelKey: 'tplFunctions.impact.steps.results' },
    { id: 'apply', num: 3, labelKey: 'tplFunctions.impact.steps.apply' },
  ];

  protected readonly isOpen = signal(false);
  protected readonly step = signal<ImpactStep>('targets');
  protected readonly functionId = signal('');
  protected readonly functionName = signal('');
  protected readonly versionId = signal('');
  protected readonly versionNumber = signal(1);
  protected readonly loadingFixtures = signal(false);
  protected readonly checking = signal(false);
  protected readonly applying = signal(false);

  protected readonly targetRows = signal<ImpactTargetDraftRow[]>([]);
  protected readonly impactResult = signal<FunctionImpactResponseDto | null>(null);
  protected readonly reason = signal('');
  protected readonly attemptedApply = signal(false);
  protected readonly nowTick = signal(Date.now());

  private openSeq = 0;
  private expiryTimer: ReturnType<typeof setInterval> | null = null;
  private lastApplyFingerprint: string | null = null;
  private lastApplyIdempotencyKey: string | null = null;

  protected readonly selectedTargets = computed(() => this.targetRows().filter((r) => r.selected));
  protected readonly selectedCount = computed(() => this.selectedTargets().length);
  protected readonly maxTargets = FUNCTION_MAX_IMPACT_TARGETS;

  protected readonly isImpactExpired = computed(() => {
    const impact = this.impactResult();
    if (!impact) return false;
    const expiresMs = Date.parse(impact.expiresAt);
    return !Number.isNaN(expiresMs) && this.nowTick() >= expiresMs;
  });

  protected readonly validUntilLabel = computed(() => {
    this.i18n();
    const lang = this.language();
    const impact = this.impactResult();
    if (!impact) return '';
    return formatFunctionTime(impact.expiresAt, lang);
  });

  protected readonly reasonError = computed(() => {
    this.i18n();
    this.language();
    if (!this.attemptedApply()) return null;
    const trimmed = this.reason().trim();
    if (!trimmed) return this.transloco.translate('tplFunctions.impact.reasonRequired');
    if (trimmed.length > 1000) return this.transloco.translate('tplFunctions.impact.reasonTooLong');
    return null;
  });

  protected readonly currentStepNumber = computed(() => {
    switch (this.step()) {
      case 'targets':
        return 1;
      case 'results':
        return 2;
      case 'apply':
        return 3;
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopExpiryTimer());
  }

  open(options: FunctionImpactOpenOptions): void {
    const seq = ++this.openSeq;
    this.stopExpiryTimer();
    this.functionId.set(options.functionId);
    this.functionName.set(options.functionName);
    this.versionId.set(options.versionId);
    this.versionNumber.set(options.versionNumber);
    this.step.set('targets');
    this.impactResult.set(null);
    this.reason.set('');
    this.attemptedApply.set(false);
    this.checking.set(false);
    this.applying.set(false);
    this.lastApplyFingerprint = null;
    this.lastApplyIdempotencyKey = null;

    const seenTemplates = new Set<string>();
    const draftUsages: FunctionUsageItemDto[] = [];
    for (const item of options.usageItems) {
      if (item.sourceKind !== 'DRAFT') continue;
      if (seenTemplates.has(item.templateId)) continue;
      seenTemplates.add(item.templateId);
      draftUsages.push(item);
    }

    const defaultOpt: DropdownOption<string> = {
      value: 'default',
      label: this.transloco.translate('tplFunctions.impact.defaultFixture'),
    };

    const initialRows: ImpactTargetDraftRow[] = draftUsages.slice(0, 100).map((item, idx) => ({
      templateId: item.templateId,
      templateName: item.templateName,
      draftRevision: item.revisionOrVersionNumber,
      selected: idx < FUNCTION_MAX_IMPACT_TARGETS,
      fixtureKey: defaultOpt.value,
      fixtureOptions: [defaultOpt],
    }));

    this.targetRows.set(initialRows);
    this.isOpen.set(true);
    this.modal().open();

    if (initialRows.length > 0) {
      void this.hydrateFixtures(initialRows, seq);
    }
  }

  protected toggleTarget(templateId: string, checked: boolean): void {
    if (this.checking() || this.applying()) return;
    if (checked && this.selectedCount() >= FUNCTION_MAX_IMPACT_TARGETS) return;
    this.targetRows.update((rows) =>
      rows.map((r) => (r.templateId === templateId ? { ...r, selected: checked } : r)),
    );
  }

  protected onFixtureChange(templateId: string, fixtureKey: string): void {
    this.targetRows.update((rows) =>
      rows.map((r) => (r.templateId === templateId ? { ...r, fixtureKey } : r)),
    );
  }

  protected async runImpactCheck(): Promise<void> {
    const selected = this.selectedTargets();
    if (selected.length === 0 || selected.length > FUNCTION_MAX_IMPACT_TARGETS || this.checking()) return;

    this.checking.set(true);
    try {
      const response = await checkFunctionImpact(
        this.functionId(),
        {
          versionId: this.versionId(),
          targets: selected.map((r) => ({
            templateId: r.templateId,
            draftRevision: r.draftRevision,
            fixtureKey: r.fixtureKey,
          })),
        },
        newTemplateIdempotencyKey(),
      );
      this.impactResult.set(response);
      this.nowTick.set(Date.now());
      this.startExpiryTimer();
      this.step.set('results');
    } catch (error) {
      this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      this.checking.set(false);
    }
  }

  protected goToApplyStep(): void {
    if (!this.impactResult() || this.isImpactExpired() || this.impactResult()!.state === 'FAILED') return;
    this.attemptedApply.set(false);
    this.step.set('apply');
  }

  protected goPrevious(): void {
    if (this.checking() || this.applying()) return;
    if (this.step() === 'apply') {
      this.step.set('results');
    } else if (this.step() === 'results') {
      this.step.set('targets');
    }
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected async submitApply(): Promise<void> {
    const impact = this.impactResult();
    if (!impact || this.applying()) return;

    this.attemptedApply.set(true);
    if (this.reasonError() || this.isImpactExpired()) return;

    const payload = {
      versionId: this.versionId(),
      impactId: impact.impactId,
      targets: impact.targets.map((t) => ({
        templateId: t.templateId,
        draftRevision: t.draftRevision,
      })),
      reason: this.reason().trim(),
    };

    const fingerprint = JSON.stringify(payload);
    if (fingerprint !== this.lastApplyFingerprint || !this.lastApplyIdempotencyKey) {
      this.lastApplyFingerprint = fingerprint;
      this.lastApplyIdempotencyKey = newTemplateIdempotencyKey();
    }

    this.applying.set(true);
    try {
      const res = await applyFunctionToDrafts(this.functionId(), payload, this.lastApplyIdempotencyKey);
      this.lastApplyFingerprint = null;
      this.lastApplyIdempotencyKey = null;
      this.notify.success(this.transloco.translate('tplFunctions.impact.appliedToast', { n: res.updated.length }));
      this.applied.emit(res);
      this.close();
    } catch (error) {
      if (error instanceof TemplateApiError && error.code === 'FUNCTION_IMPACT_STALE') {
        this.notify.error(this.transloco.translate('tplFunctions.errors.FUNCTION_IMPACT_STALE'));
        return;
      }
      this.notify.error(translateFunctionError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      this.applying.set(false);
    }
  }

  protected close(): void {
    this.stopExpiryTimer();
    this.isOpen.set(false);
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.stopExpiryTimer();
    this.isOpen.set(false);
  }

  protected targetDisplayName(templateId: string): string {
    return this.targetRows().find((r) => r.templateId === templateId)?.templateName ?? templateId;
  }

  protected formatVal(value: FunctionValue): string {
    this.i18n();
    return formatFunctionValue(value, this.language(), {
      yes: this.transloco.translate('tplFunctions.values.yes'),
      no: this.transloco.translate('tplFunctions.values.no'),
      empty: this.transloco.translate('tplFunctions.values.empty'),
    });
  }

  protected issueText(code: string): string {
    this.i18n();
    return translateFunctionIssueCode(code, (k) => this.transloco.translate(k));
  }

  protected isStepDone(idx: number): boolean {
    return idx + 1 < this.currentStepNumber();
  }

  private async hydrateFixtures(rows: readonly ImpactTargetDraftRow[], seq: number): Promise<void> {
    this.loadingFixtures.set(true);
    try {
      const resolvedEntries = await Promise.allSettled(
        rows.map(async (row) => {
          const tpl = await getTemplate(row.templateId);
          const schema = await getDataSourceSchema(tpl.dataSourceKey, {
            scopeType: tpl.scope.type,
            companyId: tpl.scope.type === 'COMPANY' ? tpl.scope.companyId : undefined,
            schemaVersion: tpl.dataSourceSchemaVersion === 2 ? 2 : 1,
          });
          return { templateId: row.templateId, fixtures: schema.syntheticFixtures };
        }),
      );
      if (seq !== this.openSeq) return;

      const fixtureMap = new Map<string, DropdownOption<string>[]>();
      for (const settled of resolvedEntries) {
        if (settled.status !== 'fulfilled') continue;
        const { templateId, fixtures } = settled.value;
        if (fixtures.length === 0) continue;
        fixtureMap.set(
          templateId,
          fixtures.map((f) => ({
            value: f.fixtureKey,
            label: this.resolveFixtureLabel(f.labelKey, f.fixtureKey),
          })),
        );
      }

      if (fixtureMap.size > 0) {
        this.targetRows.update((current) =>
          current.map((row) => {
            const opts = fixtureMap.get(row.templateId);
            if (!opts || opts.length === 0) return row;
            return {
              ...row,
              fixtureOptions: opts,
              fixtureKey: opts[0].value,
            };
          }),
        );
      }
    } finally {
      if (seq === this.openSeq) {
        this.loadingFixtures.set(false);
      }
    }
  }

  private resolveFixtureLabel(labelKey: string, fallbackKey: string): string {
    for (const candidate of [labelKey, `templates.fixtures.${labelKey}`]) {
      const translated = this.transloco.translate(candidate);
      if (translated && translated !== candidate) return translated;
    }
    return fallbackKey;
  }

  private startExpiryTimer(): void {
    this.stopExpiryTimer();
    this.expiryTimer = setInterval(() => this.nowTick.set(Date.now()), 30_000);
  }

  private stopExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}

import { ChangeDetectorRef, Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerAlertTriangle,
  tablerHistory,
  tablerPlus,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { CurrentUser } from '../../../../../core/auth/current-user';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { type TradeContext, errorCodeOf, errorKey, newIdempotencyKey, tradeContext } from '../../../shared/trade-api';
import { formatDate } from '../../../shared/trade-format';
import { cancelVersion, getDefinition, retireVersion, testVersion } from '../configuration.api';
import {
  type ConfigDefinition,
  type ConfigDefinitionDetail,
  type ConfigVersionDetail,
  type EffectiveVersionState,
  type PublishedConfigVersion,
  SCOPE_TARGETS,
  type ScopeTarget,
} from '../configuration.model';
import { PublishDialog } from '../publish-dialog/publish-dialog';
import { describeSchemaLimits, formatValueSummary, propertyNameToWords } from '../value-schema';
import { VERSION_STATE_BADGE } from '../version-state';

@Component({
  selector: 'app-config-definition-modal',
  imports: [NgIcon, TranslocoPipe, Modal, Field, Segmented, Button, ActionsMenu, ConfirmDialog, PublishDialog],
  providers: [
    provideIcons({ tablerAdjustmentsHorizontal, tablerAlertTriangle, tablerHistory, tablerPlus, tablerRefresh }),
  ],
  templateUrl: './definition-modal.html',
})
export class DefinitionModal {
  private static nextId = 0;
  protected readonly uid = `cfg-def-${++DefinitionModal.nextId}`;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly scopeState = inject(ScopeState);
  private readonly currentUser = inject(CurrentUser);
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required(Modal);
  private readonly publishDialog = viewChild.required(PublishDialog);
  private readonly conflictDialog = viewChild.required<ConfirmDialog>('conflictDialog');
  private readonly retireDialog = viewChild.required<ConfirmDialog>('retireDialog');

  readonly scopeTarget = input.required<ScopeTarget>();
  readonly canManage = input(true);
  readonly canPublish = input(true);

  readonly newVersionRequested = output<{ definition: ConfigDefinitionDetail; scopeTarget: ScopeTarget }>();
  readonly changed = output<void>();

  private readonly openedSummary = signal<ConfigDefinition | null>(null);
  protected readonly detail = signal<ConfigDefinitionDetail | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly loadError = signal(false);
  private readonly isOpen = signal(false);

  protected readonly modalScope = signal<ScopeTarget>('COMPANY');
  protected readonly busyVersionId = signal<string | null>(null);
  protected readonly testingVersionId = signal<string | null>(null);
  protected readonly failedDiagnostics = signal<readonly string[] | null>(null);
  protected readonly pendingRetireVersion = signal<ConfigVersionDetail | null>(null);

  protected readonly skeletonRows = [1, 2, 3];
  private loadSeq = 0;

  protected readonly currentUserId = this.currentUser.userId;

  protected readonly activeDef = computed<ConfigDefinition | ConfigDefinitionDetail | null>(
    () => this.detail() ?? this.openedSummary(),
  );

  protected readonly modalCtx = computed<TradeContext>(() => tradeContext(this.scopeState, this.modalScope()));

  protected readonly scopeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return SCOPE_TARGETS.map((value) => ({
      value,
      label: this.transloco.translate(`tradeConfig.scope.${value}`),
    }));
  });

  protected readonly modalScopeSubtitle = computed(() => {
    this.i18n();
    const target = this.modalScope();
    const scopeName = this.transloco.translate(`tradeConfig.scope.${target}`);
    if (target === 'TENANT') {
      return scopeName;
    }
    const lang = this.language();
    const company = this.scopeState.company();
    const companyName = lang === 'ar' ? company.nameAr : company.nameEn;
    if (target === 'COMPANY') {
      return `${scopeName} · ${companyName}`;
    }
    const branch = this.scopeState.branch();
    const branchName = lang === 'ar' ? branch.nameAr : branch.nameEn;
    const pair = this.transloco.translate('tradeConfig.page.showingPair', {
      company: companyName,
      branch: branchName,
    });
    return `${scopeName} · ${pair}`;
  });

  protected readonly filteredVersions = computed<ConfigVersionDetail[]>(() => {
    const def = this.detail();
    if (!def) return [];
    const target = this.modalScope();
    const ctx = this.modalCtx();
    return def.versions.filter((ver) => {
      if (ver.scopeTarget !== target) return false;
      if (target === 'TENANT') {
        return ver.companyId === null && ver.branchId === null;
      }
      if (target === 'COMPANY') {
        return ver.companyId === (ctx.companyId ?? null) && ver.branchId === null;
      }
      return ver.companyId === (ctx.companyId ?? null) && ver.branchId === (ctx.branchId ?? null);
    });
  });

  protected readonly allowedHere = computed(() => {
    const def = this.activeDef();
    return def ? def.allowedScopes.includes(this.modalScope()) : false;
  });

  protected readonly valueTypeText = computed(() => {
    this.i18n();
    const def = this.activeDef();
    if (!def) return '';
    return describeSchemaLimits(def.valueSchema, (k, p) => this.transloco.translate(k, p)).typeWithLimits;
  });

  protected readonly allowedScopesText = computed(() => {
    this.i18n();
    const def = this.activeDef();
    if (!def) return '';
    return def.allowedScopes.map((s) => this.transloco.translate(`tradeConfig.scope.${s}`)).join(', ');
  });

  protected readonly mergeRuleText = computed(() => {
    this.i18n();
    const def = this.activeDef();
    return def ? this.transloco.translate(`tradeConfig.merge.${def.mergeStrategy}`) : '';
  });

  protected readonly riskText = computed(() => {
    this.i18n();
    const def = this.activeDef();
    return def ? this.transloco.translate(`tradeConfig.risk.${def.riskClass}`) : '';
  });

  protected readonly hasLockPolicy = computed(() => {
    const def = this.activeDef();
    return Boolean(def && def.companyLockPolicy.requireCompanyBaseline !== undefined);
  });

  protected readonly companyRequiredText = computed(() => {
    this.i18n();
    const def = this.activeDef();
    if (!def || def.companyLockPolicy.requireCompanyBaseline === undefined) return '';
    return this.transloco.translate(
      def.companyLockPolicy.requireCompanyBaseline ? 'tradeShared.common.yes' : 'tradeShared.common.no',
    );
  });

  protected readonly formattedDiagnostics = computed<string[]>(() => {
    this.i18n();
    const list = this.failedDiagnostics();
    if (!list || list.length === 0) return [];
    return [this.formatDiagnostic(list)];
  });

  protected readonly showActionsColumn = computed(() => this.canManage() || this.canPublish());

  protected readonly retireDialogTitle = computed(() => {
    this.i18n();
    const ver = this.pendingRetireVersion();
    return ver ? this.transloco.translate('tradeConfig.retire.title', { n: ver.versionNumber }) : '';
  });

  open(def: ConfigDefinition): void {
    this.openedSummary.set(def);
    this.detail.set(null);
    this.loadError.set(false);
    this.modalScope.set(this.scopeTarget());
    this.busyVersionId.set(null);
    this.testingVersionId.set(null);
    this.failedDiagnostics.set(null);
    this.pendingRetireVersion.set(null);
    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }
    void this.fetchDetail(def.id);
  }

  refresh(): void {
    const id = this.detail()?.id ?? this.openedSummary()?.id;
    if (!this.isOpen() || !id) return;
    void this.fetchDetail(id);
  }

  protected retryLoad(): void {
    const id = this.openedSummary()?.id ?? this.detail()?.id;
    if (!id) return;
    void this.fetchDetail(id);
  }

  protected onModalScopeChange(nextValue: string | null): void {
    if (nextValue !== 'TENANT' && nextValue !== 'COMPANY' && nextValue !== 'BRANCH') return;
    if (nextValue === this.modalScope()) return;
    this.modalScope.set(nextValue);
    this.failedDiagnostics.set(null);
  }

  protected close(): void {
    if (this.busyVersionId() !== null) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.loadSeq += 1;
    this.isOpen.set(false);
    this.openedSummary.set(null);
    this.detail.set(null);
    this.loadingDetail.set(false);
    this.loadError.set(false);
    this.busyVersionId.set(null);
    this.testingVersionId.set(null);
    this.failedDiagnostics.set(null);
    this.pendingRetireVersion.set(null);
  }

  protected stateOf(ver: ConfigVersionDetail): EffectiveVersionState {
    return ver.effectiveState;
  }

  protected stateBadgeClass(ver: ConfigVersionDetail): string {
    return VERSION_STATE_BADGE[ver.effectiveState];
  }

  protected pendingReplacementText(ver: ConfigVersionDetail): string | null {
    this.i18n();
    if (
      ver.supersededAt === null ||
      (ver.effectiveState !== 'LIVE' && ver.effectiveState !== 'REPLACED') ||
      Date.parse(ver.supersededAt) <= Date.now()
    ) {
      return null;
    }
    const date = formatDate(ver.supersededAt, this.language());
    return this.transloco.translate('tradeConfig.definitionModal.replacedFrom', { date });
  }

  protected valueSummary(ver: ConfigVersionDetail): string {
    this.i18n();
    const yes = this.transloco.translate('tradeShared.common.yes');
    const no = this.transloco.translate('tradeShared.common.no');
    return formatValueSummary(ver.value, yes, no);
  }

  protected effectiveFromText(ver: ConfigVersionDetail): string {
    this.i18n();
    return formatDate(ver.effectiveFrom, this.language());
  }

  protected effectiveToText(ver: ConfigVersionDetail): string {
    this.i18n();
    return ver.effectiveTo
      ? formatDate(ver.effectiveTo, this.language())
      : this.transloco.translate('tradeConfig.definitionModal.noEnd');
  }

  protected canTestRow(ver: ConfigVersionDetail): boolean {
    return this.canManage() && (ver.effectiveState === 'DRAFT' || ver.effectiveState === 'TESTED');
  }

  protected showPublishRow(ver: ConfigVersionDetail): boolean {
    return this.canPublish() && (ver.effectiveState === 'DRAFT' || ver.effectiveState === 'TESTED');
  }

  protected isCreatedByCurrentUser(ver: ConfigVersionDetail): boolean {
    return ver.createdBy === this.currentUserId();
  }

  protected isPublishDisabled(ver: ConfigVersionDetail): boolean {
    return (
      ver.effectiveState !== 'TESTED' ||
      this.isCreatedByCurrentUser(ver) ||
      this.busyVersionId() !== null
    );
  }

  protected publishDisabledTitle(ver: ConfigVersionDetail): string | null {
    this.i18n();
    if (this.isCreatedByCurrentUser(ver)) {
      return this.transloco.translate('tradeConfig.publish.makerChecker');
    }
    if (ver.effectiveState !== 'TESTED') {
      return this.transloco.translate('tradeConfig.definitionModal.publishDisabledHint');
    }
    return null;
  }

  protected rowMenuActions(ver: ConfigVersionDetail): ActionItem[] {
    this.i18n();
    if (!this.canManage()) return [];
    const disabled = this.busyVersionId() !== null;
    if (ver.effectiveState === 'LIVE' || ver.effectiveState === 'SCHEDULED') {
      return [
        {
          id: 'retire',
          title: this.transloco.translate('tradeConfig.actions.retire'),
          icon: 'tablerCircleOff',
          tile: 'bg-icon-red',
          danger: true,
          disabled,
        },
      ];
    }
    if (ver.effectiveState === 'DRAFT' || ver.effectiveState === 'TESTED') {
      return [
        {
          id: 'cancelDraft',
          title: this.transloco.translate('tradeConfig.actions.cancelDraft'),
          icon: 'tablerX',
          tile: 'bg-icon-red',
          danger: true,
          disabled,
        },
      ];
    }
    return [];
  }

  protected onRowMenuAction(ver: ConfigVersionDetail, selection: ActionSelection): void {
    if (selection.id === 'retire') {
      void this.runRetire(ver);
    } else if (selection.id === 'cancelDraft') {
      void this.runCancelDraft(ver);
    }
  }

  protected async runTest(ver: ConfigVersionDetail): Promise<void> {
    const def = this.detail();
    if (!def || !this.canManage() || this.busyVersionId() !== null) return;
    this.busyVersionId.set(ver.id);
    this.testingVersionId.set(ver.id);
    this.failedDiagnostics.set(null);
    try {
      const result = await testVersion(this.modalCtx(), ver.id, ver.version, newIdempotencyKey());
      if (!result.passed) {
        this.failedDiagnostics.set(result.diagnostics);
        return;
      }
      this.failedDiagnostics.set(null);
      this.notify.success(this.transloco.translate('tradeConfig.toasts.testPassed'));
      this.changed.emit();
      await this.fetchDetail(def.id);
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const reload = await this.conflictDialog().open();
        if (reload) {
          this.changed.emit();
          await this.fetchDetail(def.id);
        }
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      this.testingVersionId.set(null);
      this.busyVersionId.set(null);
    }
  }

  protected openPublish(ver: ConfigVersionDetail): void {
    const def = this.detail();
    if (
      !def ||
      !this.canPublish() ||
      ver.effectiveState !== 'TESTED' ||
      this.isCreatedByCurrentUser(ver) ||
      this.busyVersionId() !== null
    ) {
      return;
    }
    this.publishDialog().open(def, ver);
  }

  protected onPublished(_ver: PublishedConfigVersion): void {
    const id = this.detail()?.id ?? this.openedSummary()?.id;
    this.failedDiagnostics.set(null);
    this.changed.emit();
    if (id) {
      void this.fetchDetail(id);
    }
  }

  protected onChildReloadRequested(): void {
    const id = this.detail()?.id ?? this.openedSummary()?.id;
    this.changed.emit();
    if (id) {
      void this.fetchDetail(id);
    }
  }

  protected requestNewVersion(): void {
    const def = this.detail();
    if (!def || !this.canManage() || !this.allowedHere() || this.busyVersionId() !== null) return;
    this.newVersionRequested.emit({ definition: def, scopeTarget: this.modalScope() });
  }

  private async runRetire(ver: ConfigVersionDetail): Promise<void> {
    const def = this.detail();
    if (!def || !this.canManage() || this.busyVersionId() !== null) return;
    if (ver.effectiveState !== 'LIVE' && ver.effectiveState !== 'SCHEDULED') return;

    this.pendingRetireVersion.set(ver);
    this.cdr.detectChanges();
    const confirmed = await this.retireDialog().open();
    this.pendingRetireVersion.set(null);
    if (!confirmed) return;

    this.busyVersionId.set(ver.id);
    try {
      await retireVersion(this.modalCtx(), ver.id, ver.version, newIdempotencyKey());
      this.failedDiagnostics.set(null);
      this.notify.success(this.transloco.translate('tradeConfig.toasts.retired', { n: ver.versionNumber }));
      this.changed.emit();
      await this.fetchDetail(def.id);
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const reload = await this.conflictDialog().open();
        if (reload) {
          this.changed.emit();
          await this.fetchDetail(def.id);
        }
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      this.busyVersionId.set(null);
    }
  }

  private async runCancelDraft(ver: ConfigVersionDetail): Promise<void> {
    const def = this.detail();
    if (!def || !this.canManage() || this.busyVersionId() !== null) return;
    if (ver.effectiveState !== 'DRAFT' && ver.effectiveState !== 'TESTED') return;

    this.busyVersionId.set(ver.id);
    try {
      await cancelVersion(this.modalCtx(), ver.id, ver.version, newIdempotencyKey());
      this.failedDiagnostics.set(null);
      this.notify.success(
        this.transloco.translate('tradeConfig.toasts.draftCancelled', { n: ver.versionNumber }),
      );
      this.changed.emit();
      await this.fetchDetail(def.id);
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const reload = await this.conflictDialog().open();
        if (reload) {
          this.changed.emit();
          await this.fetchDetail(def.id);
        }
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      this.busyVersionId.set(null);
    }
  }

  private async fetchDetail(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loadingDetail.set(true);
    this.loadError.set(false);
    try {
      const result = await getDefinition(id);
      if (seq !== this.loadSeq || !this.isOpen()) return;
      this.detail.set(result);
    } catch (error) {
      if (seq !== this.loadSeq || !this.isOpen()) return;
      if (!this.detail()) {
        this.loadError.set(true);
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingDetail.set(false);
      }
    }
  }

  /** The backend sends one flat diagnostic: [code, ...paths]. */
  private formatDiagnostic(diag: readonly string[]): string {
    const rawCode = diag[0] ?? '';
    const shortCode = rawCode.replace(/^TRADE\.CONFIGURATION\./, '');
    if (shortCode === 'VALUE_INVALID') {
      const path = diag[1] ?? '$';
      const field = this.fieldNameFromPath(path);
      return this.transloco.translate('tradeConfig.diag.VALUE_INVALID', { field });
    }
    if (
      shortCode === 'COMPANY_BASELINE_REQUIRED' ||
      shortCode === 'BRANCH_WEAKENS_MIN' ||
      shortCode === 'BRANCH_WEAKENS_DENY'
    ) {
      return this.transloco.translate(`tradeConfig.diag.${shortCode}`);
    }
    return this.transloco.translate('tradeConfig.diag.fallback');
  }

  private fieldNameFromPath(path: string): string {
    if (!path || path === '$') {
      return this.transloco.translate('tradeConfig.valueEditor.rootLabel');
    }
    const cleaned = path.replace(/^\$\.?/, '');
    if (!cleaned) {
      return this.transloco.translate('tradeConfig.valueEditor.rootLabel');
    }
    return cleaned
      .split('.')
      .filter(Boolean)
      .map((seg) => {
        const indexMatch = /^(.*)\[(\d+)\]$/.exec(seg);
        if (indexMatch) {
          const base = indexMatch[1] ? propertyNameToWords(indexMatch[1]) : '';
          return base ? `${base} [${indexMatch[2]}]` : `[${indexMatch[2]}]`;
        }
        return propertyNameToWords(seg);
      })
      .join(' · ');
  }
}

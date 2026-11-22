import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowLeft,
  tablerArrowRight,
  tablerPlus,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { getFakeActor, actorName } from '../governance-fake-actors';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import {
  type GovernedRow,
  type GovernedRowAction,
  type GovernedRowActionEvent,
  GovernedVersionsTable,
} from '../governance-shared/governed-versions-table/governed-versions-table';
import {
  ReasonDialog,
  type ReasonDialogResult,
} from '../governance-shared/reason-dialog/reason-dialog';
import { ScopeChip } from '../governance-shared/scope-chip/scope-chip';
import { createVersion, getDefinition, getMetadata, getVersion, runAction } from '../policy.api';
import { isPolicyVersionDetail } from '../policy.model';
import type {
  GovernedDefinition,
  GovernedVersion,
  GovernedVersionDetail,
  GovernedVersionRecord,
  PolicyContent,
  PolicyMetadata,
  PolicyTestCase,
} from '../policy.model';
import { FACTS, FACTS_BY_KIND, operatorsFor } from '../policy.registry';
import { formatDateTime, rangeText } from '../pricing.service';

const CAN = { manage: true, test: true, approve: true, publish: true }; // later from the session

@Component({
  selector: 'app-policy-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConflictDialog,
    GovernedVersionsTable,
    ReasonDialog,
    ScopeChip,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerArrowLeft,
      tablerArrowRight,
      tablerPlus,
      tablerShieldCheck,
    }),
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-policy', alias: 'policy' }),
  ],
  templateUrl: './policy-page.html',
  host: { class: 'flex min-h-full flex-col gap-12 p-12' },
})
export class PolicyPage {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly rollbackDialog = viewChild<ReasonDialog>('rollbackDialog');
  private readonly retireDialog = viewChild<ReasonDialog>('retireDialog');
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  protected readonly canManage = CAN.manage;
  protected readonly canPublish = CAN.publish;

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly definitionId = computed(() => this.paramMap().get('id') ?? '');

  protected readonly definition = signal<GovernedDefinition | null>(null);
  protected readonly metadata = signal<PolicyMetadata | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly creatingVersion = signal(false);
  protected readonly actionBusy = signal(false);
  protected readonly reasonTarget = signal<GovernedVersion | null>(null);

  protected readonly versionRows = computed<GovernedRow[]>(() => {
    this.i18n();
    const def = this.definition();
    if (!def) return [];
    const currentLang = this.lang();
    const me = getFakeActor();
    const byId = new Map(def.versions.map((v) => [v.id, v]));

    return [...def.versions]
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map((v) => {
        const actorId = v.submittedBy || v.createdBy;
        const actor = actorName(actorId)[currentLang];
        const ts = v.approvedAt || v.effectiveFrom;
        const supersededByVersionNumber = v.supersededByVersionId
          ? (byId.get(v.supersededByVersionId)?.versionNumber ?? null)
          : null;
        const restoredFromVersionNumber = v.restoredFromVersionId
          ? (byId.get(v.restoredFromVersionId)?.versionNumber ?? null)
          : null;

        const actions: GovernedRowAction[] = [
          {
            key: 'open',
            title: this.transloco.translate('policy.list.actions.open'),
            icon: 'tablerEye',
            tile: 'bg-icon-blue',
          },
        ];

        if (this.canManage && (v.status === 'PUBLISHED' || v.status === 'RETIRED' || v.status === 'SUPERSEDED')) {
          actions.push({
            key: 'rollback',
            title: this.transloco.translate('policy.version.rollback'),
            icon: 'tablerArrowBackUp',
            tile: 'bg-icon-teal',
          });
        }

        if (this.canPublish && (v.status === 'PUBLISHED' || v.status === 'SCHEDULED')) {
          actions.push({
            key: 'retire',
            title: this.transloco.translate('policy.version.retire'),
            icon: 'tablerCircleOff',
            tile: 'bg-icon-red',
            danger: true,
          });
        }

        return {
          id: v.id,
          versionNumber: v.versionNumber,
          status: v.status,
          liveScheduled: v.status === 'SCHEDULED',
          awaitingActivation: v.status === 'APPROVED',
          supersededByVersionNumber,
          restoredFromVersionNumber,
          effectiveFrom: v.effectiveFrom,
          effectiveTo: v.effectiveTo,
          effectiveRange: rangeText(v.effectiveFrom, v.supersededAt ?? v.effectiveTo, currentLang),
          byPrimary: actor,
          bySecondary: formatDateTime(ts, currentLang),
          byIsMe: actorId === me,
          sourceLabel:
            restoredFromVersionNumber !== null
              ? this.transloco.translate('policy.review.fromVersion', {
                  version: restoredFromVersionNumber,
                })
              : '—',
          actions,
        };
      });
  });

  constructor() {
    effect(() => {
      const id = this.definitionId();
      if (id) {
        void this.reload();
      }
    });
  }

  protected async reload(): Promise<void> {
    const id = this.definitionId();
    if (!id) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [def, meta] = await Promise.all([
        getDefinition('policy', id),
        this.metadata() ? Promise.resolve(this.metadata()!) : getMetadata(),
      ]);
      this.definition.set(def);
      this.metadata.set(meta);
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/trade/governance/policy-studio']);
  }

  protected openVersion(row: GovernedRow): void {
    const id = this.definitionId();
    if (!id) return;
    void this.router.navigate(['/trade/governance/policy-studio', id, 'versions', row.id]);
  }

  protected async createNewVersion(): Promise<void> {
    const def = this.definition();
    if (!def || !this.canManage || this.creatingVersion()) return;
    this.creatingVersion.set(true);
    try {
      const live = [...def.versions]
        .filter((v) => v.status === 'PUBLISHED')
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];

      let content: PolicyContent;
      let testCases: PolicyTestCase[];

      if (live) {
        const liveDetail = await getVersion('policy', live.id);
        if (!isPolicyVersionDetail(liveDetail)) throw new Error('Not a policy version');
        content = structuredClone(liveDetail.content);
        testCases = structuredClone(liveDetail.testCases ?? []);
      } else {
        const meta = this.metadata();
        const factsList = meta?.facts ?? FACTS;
        const byKind = meta?.factsByKind ?? FACTS_BY_KIND;
        const firstFactKey = (byKind as Readonly<Record<string, readonly string[]>>)[(def.policyKind ?? '')]?.[0] ?? factsList[0]?.key ?? 'totalAmount';
        const firstFact = factsList.find((f) => f.key === firstFactKey);
        const op = operatorsFor(firstFact?.type ?? 'number')[0] ?? 'EQ';
        const defaultVal = firstFact?.type === 'boolean' ? false : firstFact?.type === 'number' ? 0 : '';
        content = {
          rules: [
            {
              code: '',
              priority: 10,
              all: [{ fact: firstFactKey, operator: op, value: defaultVal }],
              outcome: 'ALLOW',
              selectedValue: null,
              reasonCode: '',
            },
          ],
          defaultOutcome: 'ALLOW',
          defaultSelectedValue: null,
        };
        testCases = [
          {
            code: '',
            facts: { [firstFactKey]: defaultVal },
            expectedOutcome: 'ALLOW',
            expectedRuleCode: null,
            expectedSelectedValue: null,
          },
        ];
      }

      const effectiveFrom = new Date(Date.now() + 86_400_000).toISOString();
      const created = await createVersion<PolicyContent, PolicyTestCase>(
        'policy',
        def.id,
        {
          content,
          testCases,
          effectiveFrom,
          effectiveTo: null,
        },
        def.version,
        newIdempotencyKey(),
      );

      this.notify.success(
        this.transloco.translate('policy.detail.toasts.versionCreated', { n: created.versionNumber }),
      );
      void this.router.navigate(['/trade/governance/policy-studio', def.id, 'versions', created.id]);
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.creatingVersion.set(false);
    }
  }

  protected onVersionAction(event: GovernedRowActionEvent): void {
    if (event.key === 'open') {
      this.openVersion(event.row);
      return;
    }
    const target = this.definition()?.versions.find((v) => v.id === event.row.id);
    if (!target) return;
    this.reasonTarget.set(target);

    if (event.key === 'rollback') {
      void this.rollbackDialog()?.open();
    } else if (event.key === 'retire') {
      void this.retireDialog()?.open();
    }
  }

  protected async confirmRollback(result: ReasonDialogResult): Promise<void> {
    const target = this.reasonTarget();
    const def = this.definition();
    if (!target || !def || this.actionBusy()) return;

    this.actionBusy.set(true);
    try {
      const created = (await runAction(
        'policy',
        target.id,
        'rollback',
        { reasonCode: result.reasonCode, reasonNote: result.reasonNote || undefined },
        target.version,
        newIdempotencyKey(),
      )) as GovernedVersionRecord;
      this.rollbackDialog()?.close();
      this.reasonTarget.set(null);
      this.notify.success(
        this.transloco.translate('policy.detail.toasts.rolledBack', {
          n: created.versionNumber,
          from: target.versionNumber,
        }),
      );
      void this.router.navigate(['/trade/governance/policy-studio', def.id, 'versions', created.id]);
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.actionBusy.set(false);
    }
  }

  protected async confirmRetire(result: ReasonDialogResult): Promise<void> {
    const target = this.reasonTarget();
    if (!target || this.actionBusy()) return;

    this.actionBusy.set(true);
    try {
      await runAction(
        'policy',
        target.id,
        'retire',
        { reasonCode: result.reasonCode, reasonNote: result.reasonNote || undefined },
        target.version,
        newIdempotencyKey(),
      );
      this.retireDialog()?.close();
      this.reasonTarget.set(null);
      this.notify.success(
        this.transloco.translate('policy.detail.toasts.retired', { n: target.versionNumber }),
      );
      await this.reload();
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.actionBusy.set(false);
    }
  }

  protected clearReasonTarget(): void {
    if (!this.actionBusy()) {
      this.reasonTarget.set(null);
    }
  }

  protected onConflictReload(): void {
    this.conflictDialog().close();
    this.rollbackDialog()?.close();
    this.retireDialog()?.close();
    this.reasonTarget.set(null);
    void this.reload();
  }

  protected onConflictKeep(): void {
    this.conflictDialog().close();
  }

  private handleMutationError(err: unknown): void {
    if (err instanceof ApiError) {
      const code = errorCodeOf(err);
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION' || (err.status === 409 && (code ?? '').includes('STALE'))) {
        this.conflictDialog().open();
        return;
      }
      const key = `governance.errors.${(code ?? '').replaceAll('.', '_')}`;
      const translated = this.transloco.translate(key);
      this.notify.error(
        translated !== key ? translated : this.transloco.translate('tradeShared.errors.generic'),
      );
      return;
    }
    this.notify.error(this.transloco.translate('tradeShared.errors.network'));
  }
}

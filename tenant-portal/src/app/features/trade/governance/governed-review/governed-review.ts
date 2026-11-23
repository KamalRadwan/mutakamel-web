import { Component, computed, inject, input } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowBackUp,
  tablerCircleCheck,
  tablerCircleOff,
  tablerCircleX,
  tablerClock,
  tablerHistory,
  tablerSend,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import type { GovernedVersion, GovernedVersionDetail } from '../policy.model';
import { formatDateTime } from '../pricing.service';

export interface ReviewTimelineItem {
  id: string;
  action: string;
  actorDisplay: string;
  initials: string;
  occurredAt: string;
  timeText: string;
  dotClass: string;
  icon: string;
  testBadge: 'pass' | 'fail' | null;
  reasonText: string | null;
  noteText: string | null;
  restoredVersionNumber: number | null;
  restoredFallbackId: string | null;
}

// Backend audit actions (saveActionEvidence upper-cases the command) plus the two lifecycle rows
// loadGovernedActions adds for system activation.
const KNOWN_ACTIONS = new Set([
  'VALIDATE',
  'TEST',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'PUBLISH',
  'RETIRE',
  'ROLLBACK',
  'DELETE_DRAFT',
  'ACTIVATED',
  'SUPERSEDED',
]);

function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function dotClassFor(action: string): string {
  switch (action) {
    case 'VALIDATE':
    case 'APPROVE':
    case 'PUBLISH':
    case 'ACTIVATED':
      return 'bg-success';
    case 'REJECT':
    case 'DELETE_DRAFT':
      return 'bg-danger';
    case 'RETIRE':
    case 'SUPERSEDED':
      return 'bg-warning';
    case 'SUBMIT':
    case 'TEST':
    case 'ROLLBACK':
      return 'bg-brand';
    default:
      return 'bg-status-none';
  }
}

function iconFor(action: string): string {
  switch (action) {
    case 'VALIDATE':
    case 'APPROVE':
    case 'PUBLISH':
      return 'tablerCircleCheck';
    case 'REJECT':
    case 'DELETE_DRAFT':
      return 'tablerCircleX';
    case 'SUBMIT':
      return 'tablerSend';
    case 'ACTIVATED':
    case 'TEST':
      return 'tablerClock';
    case 'RETIRE':
    case 'SUPERSEDED':
      return 'tablerCircleOff';
    case 'ROLLBACK':
      return 'tablerArrowBackUp';
    default:
      return 'tablerHistory';
  }
}

@Component({
  selector: 'app-governed-review',
  imports: [TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-policy', alias: 'policy' }),
    provideIcons({
      tablerAlertTriangle,
      tablerArrowBackUp,
      tablerCircleCheck,
      tablerCircleOff,
      tablerCircleX,
      tablerClock,
      tablerHistory,
      tablerSend,
    }),
  ],
  templateUrl: './governed-review.html',
  host: { class: 'block min-w-0' },
})
export class GovernedReview {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly tenantScope = inject(TenantScopeState);

  readonly detail = input.required<GovernedVersionDetail<unknown, unknown>>();
  readonly versions = input<readonly GovernedVersion[]>([]);

  protected readonly events = computed<ReviewTimelineItem[]>(() => {
    this.i18n();
    const currentLang = this.lang();
    const d = this.detail();
    const versionById = new Map(this.versions().map((v) => [v.id, v.versionNumber]));

    const rawActions = [...(d.actions ?? [])];
    const hasAction = (code: string) => rawActions.some((item) => item.action === code);
    const me = this.tenantScope.me();
    const actorNames = new Map<string, string>();
    for (const entry of rawActions) {
      if (entry.actorUserId && entry.actorDisplayName?.trim() && actorNames.has(entry.actorUserId) === false) {
        actorNames.set(entry.actorUserId, entry.actorDisplayName.trim());
      }
    }

    const resolveActor = (actorId: string | null | undefined, fallbackName?: string | null): string => {
      if (fallbackName?.trim()) return fallbackName.trim();
      if (actorId && me?.id === actorId) {
        const name = `${me.firstName} ${me.lastName}`.trim();
        if (name) return name;
        if (me.email) return me.email;
      }
      return (actorId && actorNames.get(actorId)) || actorId || '—';
    };

    const newestTestIndex = rawActions.findIndex((item) => item.action === 'TEST');
    const items: ReviewTimelineItem[] = rawActions.map((entry, index) => {
      const actorDisplay = resolveActor(entry.actorUserId, entry.actorDisplayName);
      const reasonText =
        (currentLang === 'ar' ? entry.reasonNameAr : entry.reasonNameEn) ??
        entry.reasonNameEn ??
        entry.reasonCode ??
        null;
      // TEST rows do not carry the outcome; the current test evidence belongs to the newest one.
      const testBadge =
        index === newestTestIndex && d.evidence?.test ? (d.evidence.test.passed ? 'pass' : 'fail') : null;

      return {
        id: `${entry.action}-${entry.occurredAt}-${index}`,
        action: KNOWN_ACTIONS.has(entry.action) ? entry.action : 'OTHER',
        actorDisplay,
        initials: actorInitials(actorDisplay),
        occurredAt: entry.occurredAt,
        timeText: formatDateTime(entry.occurredAt, currentLang),
        dotClass: dotClassFor(entry.action),
        icon: iconFor(entry.action),
        testBadge,
        reasonText,
        noteText: entry.reasonNote ?? null,
        restoredVersionNumber: null,
        restoredFallbackId: null,
      };
    });

    const addMilestone = (
      id: string,
      action: string,
      actorId: string | null | undefined,
      occurredAt: string | null | undefined,
      extra?: Partial<ReviewTimelineItem>,
    ) => {
      if (!occurredAt) return;
      const actorDisplay = resolveActor(actorId, null);
      items.push({
        id,
        action,
        actorDisplay,
        initials: actorInitials(actorDisplay),
        occurredAt,
        timeText: formatDateTime(occurredAt, currentLang),
        dotClass: dotClassFor(action),
        icon: iconFor(action),
        testBadge: null,
        reasonText: null,
        noteText: null,
        restoredVersionNumber: null,
        restoredFallbackId: null,
        ...extra,
      });
    };

    // Evidence rows of the current content hash, when their action row is older than the 100 kept.
    if (d.evidence?.validation?.passed && !hasAction('VALIDATE')) {
      addMilestone('syn-validated', 'VALIDATE', d.createdBy, d.evidence.validation.recordedAt);
    }
    if (d.evidence?.test && !hasAction('TEST')) {
      addMilestone('syn-tested', 'TEST', d.createdBy, d.evidence.test.recordedAt, {
        testBadge: d.evidence.test.passed ? 'pass' : 'fail',
      });
    }
    if (d.approvedAt && !hasAction('APPROVE')) {
      addMilestone('syn-approved', 'APPROVE', d.approvedBy, d.approvedAt);
    }
    // A rollback draft: the ROLLBACK row lives on the source version, so show the link here.
    // A rollback draft starts at the rollback time (cloneRollback sets effectiveFrom = now).
    if (d.restoredFromVersionId) {
      const restoredNum = versionById.get(d.restoredFromVersionId) ?? null;
      addMilestone('syn-rollback', 'ROLLBACK', d.createdBy, d.effectiveFrom, {
        restoredVersionNumber: restoredNum,
        restoredFallbackId: restoredNum === null ? d.restoredFromVersionId : null,
      });
    }

    return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  });
}

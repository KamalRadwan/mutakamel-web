import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerLock, tablerUser } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { errorCodeOf } from '../../../settings/shared/settings-api';
import { listStageHistory } from '../../opportunities.api';
import { OpportunityStatus, StageHistoryItem, StageSnapshot } from '../../opportunities.model';
import { formatShortDate, opportunityErrorMessage } from '../../opportunity-card/opportunity-card';

type DurationUnit = 'day' | 'hour' | 'min';

interface StageTransitionItemVm {
  id: string;
  changedAt: string;
  dotClass: string;
  isInitial: boolean;
  fromText: string;
  toText: string;
  statusLabel: string | null;
  statusBadgeClass: string;
  reasonText: string | null;
  actorName: string;
  actorHasCustomName: boolean;
  avatarUrl: string | null;
  timeLabel: string;
  fullDateTime: string;
  durationText: string | null;
}

interface StageDayGroupVm {
  key: string;
  headerId: string;
  label: string;
  items: readonly StageTransitionItemVm[];
}

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6];

const EN_TIME = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const AR_TIME = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  hour: 'numeric',
  minute: '2-digit',
});

const EN_FULL_DATETIME = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const AR_FULL_DATETIME = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function dayKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function errorStatusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return null;
}

function isDeniedError(error: unknown): boolean {
  const status = errorStatusOf(error);
  const code = errorCodeOf(error);
  return (
    status === 403 ||
    status === 404 ||
    code === 'CRM_SCOPED_PERMISSION_DENIED' ||
    code === 'OPPORTUNITY_NOT_FOUND'
  );
}

function isReopenedTransition(fromStatus: OpportunityStatus | null, toStatus: OpportunityStatus): boolean {
  return (fromStatus === 'WON' || fromStatus === 'LOST') && toStatus !== 'WON' && toStatus !== 'LOST';
}

function snapshotStageLabel(
  snapshot: StageSnapshot | null,
  lang: 'ar' | 'en',
  includePipeline: boolean,
  hiddenText: string,
): string {
  if (!snapshot) return hiddenText;
  const stageName = lang === 'ar' ? snapshot.stageNameAr : snapshot.stageNameEn;
  if (!includePipeline) return stageName;
  const pipelineName = lang === 'ar' ? snapshot.pipelineNameAr : snapshot.pipelineNameEn;
  return `${pipelineName} · ${stageName}`;
}

function durationUnitKey(unit: DurationUnit, n: number): string {
  if (n === 1) return `oppPage.stages.duration.${unit}One`;
  if (n === 2) return `oppPage.stages.duration.${unit}Two`;
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `oppPage.stages.duration.${unit}Few`;
  return `oppPage.stages.duration.${unit}Many`;
}

/** Opportunity stage-transition timeline tab, grouped by day with previous-stage durations. */
@Component({
  selector: 'app-opportunity-stages-tab',
  imports: [NgIcon, TranslocoPipe, Button, FullState],
  providers: [provideIcons({ tablerArrowRight, tablerLock, tablerUser })],
  templateUrl: './opportunity-stages-tab.html',
  host: { class: 'block' },
})
export class OpportunityStagesTab {
  private static nextId = 0;
  protected readonly uid = `opp-stages-tab-${++OpportunityStagesTab.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);

  readonly opportunityId = input.required<string>();
  readonly refreshToken = input(0);
  readonly countChange = output<number>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly items = signal<StageHistoryItem[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly denied = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly integrityFailed = signal(false);

  private loadSeq = 0;
  private loadedOpportunityId: string | null = null;

  protected readonly dayGroups = computed<readonly StageDayGroupVm[]>(() => {
    this.i18n();
    const lang = this.language();
    const list = this.items()
      .slice()
      .sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
    if (list.length === 0) return [];

    const hiddenText = this.transloco.translate('oppPage.stages.hiddenStage');
    const unknownUser = this.transloco.translate('oppPage.stages.unknownUser');
    const joiner = this.transloco.translate('oppPage.stages.durationJoin');
    const todayDate = new Date();
    const todayKey = dayKeyOf(todayDate);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(todayDate.getDate() - 1);
    const yesterdayKey = dayKeyOf(yesterdayDate);

    const groups: StageDayGroupVm[] = [];
    const byKey = new Map<string, StageTransitionItemVm[]>();

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const older = i + 1 < list.length ? list[i + 1] : null;
      const date = new Date(item.changedAt);
      const validDate = !Number.isNaN(date.getTime());
      const key = validDate ? dayKeyOf(date) : item.changedAt;

      let groupItems = byKey.get(key);
      if (!groupItems) {
        groupItems = [];
        byKey.set(key, groupItems);
        let label = '';
        if (validDate) {
          if (key === todayKey) {
            label = this.transloco.translate('oppPage.stages.day.today');
          } else if (key === yesterdayKey) {
            label = this.transloco.translate('oppPage.stages.day.yesterday');
          } else {
            label = formatShortDate(item.changedAt, lang) ?? '';
          }
        }
        groups.push({
          key,
          headerId: `${this.uid}-day-${groups.length}`,
          label,
          items: groupItems,
        });
      }

      const fromSnap = item.fromStageSnapshot;
      const toSnap = item.toStageSnapshot;
      const isInitial = item.fromStageId === null && fromSnap === null;
      const pipelineChanged = Boolean(fromSnap && toSnap && fromSnap.pipelineId !== toSnap.pipelineId);

      const fromText = isInitial
        ? ''
        : snapshotStageLabel(item.fromStageId === null ? null : fromSnap, lang, pipelineChanged, hiddenText);
      // toStageId can be null (stage removed); the snapshot still names it, and a null snapshot shows hiddenText.
      const toText = snapshotStageLabel(toSnap, lang, pipelineChanged, hiddenText);

      let dotClass = 'bg-icon-red';
      let statusLabel: string | null = null;
      let statusBadgeClass = '';

      if (item.toStatus === 'WON') {
        dotClass = 'bg-success';
        if (item.fromStatus !== null && item.fromStatus !== 'WON') {
          statusLabel = this.transloco.translate('oppPage.stages.status.WON');
          statusBadgeClass = 'bg-success-soft text-on-success-soft';
        }
      } else if (item.toStatus === 'LOST') {
        dotClass = 'bg-danger';
        if (item.fromStatus !== null && item.fromStatus !== 'LOST') {
          statusLabel = this.transloco.translate('oppPage.stages.status.LOST');
          statusBadgeClass = 'bg-danger-soft text-on-danger-soft';
        }
      } else if (isReopenedTransition(item.fromStatus, item.toStatus)) {
        dotClass = 'bg-brand';
        statusLabel = this.transloco.translate('oppPage.stages.status.REOPENED');
        statusBadgeClass = 'bg-brand-soft text-on-brand-soft';
      }

      let durationText: string | null = null;
      if (older && (item.fromStageId !== null || fromSnap !== null || older.toStageSnapshot !== null)) {
        const diffMs = Date.parse(item.changedAt) - Date.parse(older.changedAt);
        if (Number.isFinite(diffMs) && diffMs >= 0) {
          const prevStageName = snapshotStageLabel(
            fromSnap ?? older.toStageSnapshot,
            lang,
            false,
            hiddenText,
          );
          const duration = this.formatDuration(diffMs, joiner);
          durationText = this.transloco.translate('oppPage.stages.durationInStage', {
            duration,
            stage: prevStageName,
          });
        }
      }

      const actorRaw = item.changedByDisplayName?.trim() || null;

      groupItems.push({
        id: item.id,
        changedAt: item.changedAt,
        dotClass,
        isInitial,
        fromText,
        toText,
        statusLabel,
        statusBadgeClass,
        reasonText: item.reason?.trim() || null,
        actorName: actorRaw ?? unknownUser,
        actorHasCustomName: actorRaw !== null,
        avatarUrl: item.changedByAvatarUrl?.trim() || null,
        timeLabel: validDate ? (lang === 'ar' ? AR_TIME : EN_TIME).format(date) : '',
        fullDateTime: validDate ? (lang === 'ar' ? AR_FULL_DATETIME : EN_FULL_DATETIME).format(date) : item.changedAt,
        durationText,
      });
    }

    return groups;
  });

  constructor() {
    effect(() => {
      const id = this.opportunityId().trim();
      const _refresh = this.refreshToken();
      if (!id) return;

      untracked(() => {
        const idChanged = this.loadedOpportunityId !== id;
        this.loadedOpportunityId = id;
        void this.loadFirstPage(id, idChanged);
      });
    });
  }

  protected retry(): void {
    const id = this.opportunityId().trim();
    if (!id) return;
    void this.loadFirstPage(id, true);
  }

  protected async loadMore(): Promise<void> {
    const id = this.opportunityId().trim();
    const cursor = this.nextCursor();
    if (!id || !cursor || this.loadingMore()) return;

    const seq = ++this.loadSeq;
    this.loadingMore.set(true);
    try {
      const res = await listStageHistory(id, cursor);
      if (seq !== this.loadSeq || this.opportunityId().trim() !== id) return;
      const byId = new Map<string, StageHistoryItem>();
      for (const existing of this.items()) byId.set(existing.id, existing);
      for (const incoming of res.items) byId.set(incoming.id, incoming);
      const merged = Array.from(byId.values());
      this.items.set(merged);
      this.nextCursor.set(res.nextCursor);
      this.countChange.emit(merged.length);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (errorCodeOf(error) === 'OPPORTUNITY_HISTORY_CURSOR_INVALID') {
        await this.loadFirstPage(id, true);
        return;
      }
      if (errorCodeOf(error) === 'OPPORTUNITY_HISTORY_INTEGRITY_INVALID') {
        this.integrityFailed.set(true);
        this.loadFailed.set(true);
        this.nextCursor.set(null);
        return;
      }
      if (isDeniedError(error)) {
        this.denied.set(true);
        this.items.set([]);
        this.nextCursor.set(null);
      } else {
        this.notify.error(opportunityErrorMessage(error, this.transloco, 'oppPage.stages.loadFailed'));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  private async loadFirstPage(id: string, showSkeleton: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    if (showSkeleton || this.items().length === 0) {
      this.items.set([]);
      this.nextCursor.set(null);
      this.loading.set(true);
    }
    this.denied.set(false);
    this.loadFailed.set(false);
    this.integrityFailed.set(false);

    try {
      const res = await listStageHistory(id, null);
      if (seq !== this.loadSeq || this.opportunityId().trim() !== id) return;
      this.items.set(res.items);
      this.nextCursor.set(res.nextCursor);
      this.countChange.emit(res.items.length);
    } catch (error) {
      if (seq !== this.loadSeq || this.opportunityId().trim() !== id) return;
      if (isDeniedError(error)) {
        this.denied.set(true);
        this.items.set([]);
        this.nextCursor.set(null);
      } else {
        this.integrityFailed.set(errorCodeOf(error) === 'OPPORTUNITY_HISTORY_INTEGRITY_INVALID');
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private formatDuration(ms: number, joiner: string): string {
    const totalMinutes = Math.floor(ms / 60_000);
    if (totalMinutes < 1) {
      return this.transloco.translate('oppPage.stages.duration.lessThanMinute');
    }

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(this.transloco.translate(durationUnitKey('day', days), { n: days }));
    if (hours > 0) parts.push(this.transloco.translate(durationUnitKey('hour', hours), { n: hours }));
    if (mins > 0 && parts.length < 2) {
      parts.push(this.transloco.translate(durationUnitKey('min', mins), { n: mins }));
    }
    return parts.slice(0, 2).join(joiner);
  }
}

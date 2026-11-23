import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowRight, tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { ApiError, correlationIdOf, errorMessage } from '../../../core/api/api-errors';
import { FullState } from '../../ui/full-state/full-state';
import { Button } from '../../ui/button/button';
import { Field } from '../../ui/field/field';
import { Segmented, SegmentedOption } from '../../ui/segmented/segmented';
import { RecordHistoryApi } from './record-history.api';
import {
  DEFAULT_HISTORY_CATEGORIES,
  HistoryCategoryOption,
  HistoryDiffEntry,
  HistoryItem,
  HistorySubjectKind,
} from './record-history.model';

interface HistoryDiffRowVm {
  fieldLabel: string;
  hasBefore: boolean;
  beforeText: string;
  afterText: string;
  ltr: boolean;
}

interface HistoryItemVm {
  id: string;
  createdAt: string;
  dotClass: string;
  actorName: string;
  sentenceBefore: string;
  sentenceAfter: string;
  timeLabel: string;
  fullDateTime: string;
  failedText: string | null;
  missingOutcome: boolean;
  diffCount: number;
  visibleDiffRows: readonly HistoryDiffRowVm[];
  expanded: boolean;
}

interface HistoryDayGroupVm {
  key: string;
  headerId: string;
  label: string;
  items: readonly HistoryItemVm[];
}

const KNOWN_FIELDS = new Set([
  'stageId',
  'ownerUserId',
  'status',
  'rating',
  'cardColor',
  'profileType',
  'sourceLeadId',
  'expectedValue',
  'currencyCode',
  'acquisitionSourceId',
  'tagIds',
  'description',
  'interestSummary',
  'expectedNeed',
  'displayName',
  'companyName',
  'companyEmail',
  'companyWebsite',
  'firstName',
  'lastName',
  'honorificTitle',
  'jobTitle',
  'phone',
  'email',
  'website',
  'legalName',
  'taxNumber',
  'commercialRegistrationNumber',
  'address',
  'isPrimary',
  'branchId',
  'subject',
  'dueAt',
  'type',
  'priority',
  'direction',
]);

const KNOWN_RECORD_STATUSES = new Set([
  'OPEN',
  'ON_HOLD',
  'DISQUALIFIED',
  'CONVERTED',
  'PROSPECT',
  'ACTIVE_CUSTOMER',
  'INACTIVE',
  'BLACKLISTED',
]);
const KNOWN_ACTIVITY_TYPES = new Set(['TODO', 'CALL', 'MEETING', 'EMAIL', 'VISIT', 'FOLLOW_UP', 'OTHER']);
const KNOWN_ACTIVITY_STATUSES = new Set(['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
const KNOWN_ACTIVITY_PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const KNOWN_ACTIVITY_DIRECTIONS = new Set(['INBOUND', 'OUTBOUND', 'INTERNAL', 'NONE']);
const ACTOR_MARKER = '\u0000ACTOR\u0000';
const LTR_FIELDS = new Set(['phone', 'email', 'companyEmail', 'website', 'companyWebsite', 'expectedValue', 'currencyCode']);

const DOT_BY_KIND: Record<HistorySubjectKind, string> = {
  lead: 'bg-icon-green',
  customer: 'bg-icon-blue',
  opportunity: 'bg-icon-red',
  contact: 'bg-icon-blue',
  activity: 'bg-icon-orange',
  note: 'bg-icon-violet',
  attachment: 'bg-icon-violet',
  quotation: 'bg-icon-teal',
  salesOrder: 'bg-icon-teal',
  invoice: 'bg-icon-teal',
  record: 'bg-icon-gray',
};

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const MAX_COLLAPSED_DIFFS = 4;

function humanizeFieldName(field: string): string {
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : field;
}

function dayKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mergeHistoryItems(existing: readonly HistoryItem[], incoming: readonly HistoryItem[]): HistoryItem[] {
  const byId = new Map<string, HistoryItem>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values()).sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isNaN(tb) && Number.isNaN(ta)) return 0;
    if (Number.isNaN(tb)) return -1;
    if (Number.isNaN(ta)) return 1;
    return tb - ta;
  });
}

@Component({
  selector: 'app-record-history',
  imports: [NgIcon, TranslocoPipe, Button, Field, Segmented, FullState],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'record-history', alias: 'recordHistory' },
      { scope: 'activities', alias: 'activities' },
    ),
  ],
  providers: [
    provideIcons({ tablerArrowRight, tablerLock }),
  ],
  templateUrl: './record-history.html',
})
export class RecordHistory {
  private static nextId = 0;
  protected readonly uid = `record-history-${++RecordHistory.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly api = inject(RecordHistoryApi);

  readonly entityTypes = input.required<readonly string[]>();
  readonly entityId = input.required<string>();
  readonly partyIds = input<readonly string[]>([]);
  readonly branchId = input<string | null>(null);
  readonly refreshRequest = input(0);
  readonly categories = input<readonly HistoryCategoryOption[]>(DEFAULT_HISTORY_CATEGORIES);
  readonly valueLabel = input<((field: string, value: unknown) => string | null) | undefined>(undefined);
  readonly subjectKindMap = input<Readonly<Record<string, HistorySubjectKind>> | null>(null);

  protected readonly filter = signal<string>('all');
  protected readonly items = signal<HistoryItem[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly denied = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  private readonly expandedIds = signal<ReadonlySet<string>>(new Set());

  private loadSeq = 0;
  private loadedEntityKey: string | null = null;
  private loadedPartyIdsKey = '';
  private prevRefreshRequest: number | null = null;
  private cursorsByType: Record<string, string | null> = {};

  protected readonly filterOptions = computed<readonly SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    const cats = this.categories();
    const hasAll = cats.some((c) => c.id === 'all');
    const options: SegmentedOption[] = hasAll
      ? []
      : [{ value: 'all', label: this.transloco.translate('recordHistory.filter.all') }];
    for (const cat of cats) {
      options.push({ value: cat.id, label: this.transloco.translate(cat.labelKey) });
    }
    return options;
  });

  protected readonly dayGroups = computed<readonly HistoryDayGroupVm[]>(() => {
    this.i18n();
    const resolveLabel = this.valueLabel();
    const kindMap = this.subjectKindMap();
    const lang = this.language();
    const locale = `${lang}-u-nu-latn`;
    const list = this.items();
    const expanded = this.expandedIds();

    const now = new Date();
    const todayKey = dayKeyOf(now);
    const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayKey = dayKeyOf(yesterdayDate);

    const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

    const groups = new Map<string, { label: string; items: HistoryItemVm[] }>();

    for (const item of list) {
      const created = new Date(item.createdAt);
      const validDate = !Number.isNaN(created.getTime());
      const key = validDate ? dayKeyOf(created) : 'unknown';

      let group = groups.get(key);
      if (!group) {
        const label =
          key === todayKey
            ? this.transloco.translate('recordHistory.day.today')
            : key === yesterdayKey
              ? this.transloco.translate('recordHistory.day.yesterday')
              : validDate
                ? dateFmt.format(created)
                : this.transloco.translate('recordHistory.none');
        group = { label, items: [] };
        groups.set(key, group);
      }

      const kind = kindMap?.[item.subjectKind] ?? item.subjectKind;
      const timeLabel = validDate ? timeFmt.format(created) : '';
      const fullDateTime = validDate ? `${dateFmt.format(created)} · ${timeLabel}` : item.createdAt;
      const isExpanded = expanded.has(item.id);
      const sentence = this.formatSentence(item, kind);
      const allDiffs = item.diff.map((entry) =>
        this.formatDiffRow(entry, kind, dateFmt, timeFmt, resolveLabel),
      );

      group.items.push({
        id: item.id,
        createdAt: item.createdAt,
        dotClass: item.outcome === 'FAILURE' ? 'bg-danger' : (DOT_BY_KIND[kind] ?? 'bg-icon-gray'),
        actorName: item.actorLabel?.trim() || this.transloco.translate('recordHistory.system'),
        sentenceBefore: sentence.before,
        sentenceAfter: sentence.after,
        timeLabel,
        fullDateTime,
        failedText:
          item.outcome === 'FAILURE'
            ? this.transloco.translate('recordHistory.failed', {
                reason: item.reason?.trim() || this.transloco.translate('recordHistory.none'),
              })
            : null,
        missingOutcome: item.outcome === null,
        diffCount: allDiffs.length,
        visibleDiffRows: isExpanded ? allDiffs : allDiffs.slice(0, MAX_COLLAPSED_DIFFS),
        expanded: isExpanded,
      });
    }

    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      headerId: `${this.uid}-day-${key}`,
      label: group.label,
      items: group.items,
    }));
  });

  constructor() {
    effect(() => {
      const types = this.normalizedEntityTypes();
      const id = this.entityId();
      const entityKey = `${types.join(',')}:${id}`;
      const refresh = this.refreshRequest();
      const partyIds = this.partyIds();
      const partyIdsKey = partyIds.join(',');

      if (this.loadedEntityKey !== entityKey) {
        this.loadedEntityKey = entityKey;
        this.loadedPartyIdsKey = partyIdsKey;
        this.prevRefreshRequest = refresh;
        this.filter.set('all');
        this.expandedIds.set(new Set());
        untracked(() => {
          void this.loadFirstPage(types, id, 'all', partyIds);
        });
        return;
      }

      if (partyIdsKey !== this.loadedPartyIdsKey) {
        this.loadedPartyIdsKey = partyIdsKey;
        this.prevRefreshRequest = refresh;
        this.expandedIds.set(new Set());
        untracked(() => {
          void this.loadFirstPage(types, id, this.filter(), partyIds);
        });
        return;
      }

      if (this.prevRefreshRequest !== null && refresh > this.prevRefreshRequest) {
        this.prevRefreshRequest = refresh;
        this.expandedIds.set(new Set());
        untracked(() => {
          void this.loadFirstPage(types, id, this.filter(), partyIds);
        });
        return;
      }

      this.prevRefreshRequest = refresh;
    });
  }

  protected onFilterChange(next: string | null): void {
    if (!next) return;
    const valid = next === 'all' || this.categories().some((cat) => cat.id === next);
    if (!valid || next === this.filter()) return;
    this.filter.set(next);
    this.expandedIds.set(new Set());
    void this.loadFirstPage(this.normalizedEntityTypes(), this.entityId(), next, this.partyIds());
  }

  protected retry(): void {
    void this.loadFirstPage(this.normalizedEntityTypes(), this.entityId(), this.filter(), this.partyIds());
  }

  protected toggleExpanded(itemId: string): void {
    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  protected async loadOlder(): Promise<void> {
    const pending = Object.entries(this.cursorsByType).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    );
    if (pending.length === 0 || this.loading() || this.loadingMore()) return;

    const seq = this.loadSeq;
    const entityId = this.entityId();
    const partyIds = this.partyIds();
    const category = this.filter() === 'all' ? undefined : this.filter();
    this.loadingMore.set(true);

    try {
      const pages = await Promise.all(
        pending.map(async ([type, cursor]) => ({
          type,
          page: await this.api.listRecordHistory(type, entityId, partyIds, { category, cursor, limit: 25 }),
        })),
      );
      if (seq !== this.loadSeq) return;
      const incoming: HistoryItem[] = [];
      for (const { type, page } of pages) {
        this.cursorsByType[type] = page.nextCursor;
        incoming.push(...page.items);
      }
      this.items.update((prev) => mergeHistoryItems(prev, incoming));
      this.hasMore.set(Object.values(this.cursorsByType).some((cursor) => cursor !== null));
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 403 && !['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED'].includes(error.code)) {
        this.denied.set(true);
      } else {
        this.notify.error(errorMessage(error, 'recordHistory', this.transloco));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  private normalizedEntityTypes(): string[] {
    return Array.from(new Set(this.entityTypes().filter(Boolean)));
  }

  private async loadFirstPage(
    types: readonly string[],
    entityId: string,
    activeFilter: string,
    partyIds: readonly string[],
  ): Promise<void> {
    const seq = ++this.loadSeq;
    const category = activeFilter === 'all' ? undefined : activeFilter;

    this.loading.set(true);
    this.loadingMore.set(false);
    this.denied.set(false);
    this.loadFailed.set(false);
    this.loadCorrelationId.set(null);
    this.items.set([]);
    this.cursorsByType = {};
    this.hasMore.set(false);

    if (!entityId || types.length === 0) {
      this.loading.set(false);
      return;
    }

    try {
      const pages = await Promise.all(
        types.map(async (type) => ({
          type,
          page: await this.api.listRecordHistory(type, entityId, partyIds, { category, limit: 25 }),
        })),
      );
      if (seq !== this.loadSeq) return;

      const allItems: HistoryItem[] = [];
      const nextCursors: Record<string, string | null> = {};
      for (const { type, page } of pages) {
        nextCursors[type] = page.nextCursor;
        allItems.push(...page.items);
      }
      this.cursorsByType = nextCursors;
      this.items.set(mergeHistoryItems([], allItems));
      this.hasMore.set(Object.values(nextCursors).some((cursor) => cursor !== null));
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 403 && !['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED'].includes(error.code)) {
        this.denied.set(true);
      } else {
        this.loadFailed.set(true);
        this.loadCorrelationId.set(correlationIdOf(error));
        if (error instanceof ApiError && [403, 429, 503].includes(error.status)) {
          this.notify.error(errorMessage(error, 'recordHistory', this.transloco));
        }
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private sentenceActionKey(item: HistoryItem, subjectKind: HistorySubjectKind): string {
    const action = item.action.toUpperCase();

    if (action === 'LEAD_CREATED') return 'leadCreated';
    if (action === 'LEAD_STAGE_CHANGED') return 'leadStage';
    if (action === 'LEAD_CONVERTED') return 'leadConverted';
    if (action === 'LEAD_DELETED') return 'leadDeleted';
    if (action === 'LEAD_UPDATED') return 'leadUpdated';

    if (action === 'CUSTOMER_CREATED' || action === 'CUSTOMER_PROFILE_CREATED') return 'customerCreated';
    if (action === 'CUSTOMER_STATUS_CHANGED' || action === 'CUSTOMER_PROFILE_STATUS_CHANGED') return 'customerStatus';
    if (action === 'CUSTOMER_DELETED' || action === 'CUSTOMER_PROFILE_DELETED') return 'customerDeleted';
    if (action === 'CUSTOMER_UPDATED' || action === 'CUSTOMER_PROFILE_UPDATED') return 'customerUpdated';

    if (action === 'OPPORTUNITY_CREATED') return 'opportunityCreated';
    if (action === 'OPPORTUNITY_STAGE_CHANGED') return 'opportunityStage';
    if (action === 'OPPORTUNITY_WON') return 'opportunityWon';
    if (action === 'OPPORTUNITY_LOST') return 'opportunityLost';
    if (action === 'OPPORTUNITY_DELETED') return 'opportunityDeleted';
    if (action === 'OPPORTUNITY_UPDATED') return 'opportunityUpdated';

    switch (subjectKind) {
      case 'lead':
        if (action === 'CREATE') return 'leadCreated';
        if (action === 'SOFT_DELETE' || action === 'DELETE') return 'leadDeleted';
        return 'leadUpdated';
      case 'customer':
        if (action === 'CREATE') return 'customerCreated';
        if (action === 'SOFT_DELETE' || action === 'DELETE') return 'customerDeleted';
        return 'customerUpdated';
      case 'opportunity':
        if (action === 'CREATE') return 'opportunityCreated';
        if (action === 'SOFT_DELETE' || action === 'DELETE') return 'opportunityDeleted';
        return 'opportunityUpdated';
      case 'record':
        if (action === 'CREATE' || action.endsWith('_CREATED')) return 'created';
        if (action === 'SOFT_DELETE' || action === 'DELETE' || action.endsWith('_DELETED')) return 'deleted';
        return 'updated';
      case 'contact':
        if (action === 'CREATE' || action === 'CONTACT_CREATED') return 'contactAdded';
        if (action === 'SOFT_DELETE' || action === 'DELETE' || action === 'CONTACT_DELETED') return 'contactRemoved';
        return 'contactUpdated';
      case 'note':
        if (action === 'NOTE_CREATED') return 'noteAdded';
        if (action === 'NOTE_UPDATED') return 'noteEdited';
        if (action === 'NOTE_DELETED') return 'noteDeleted';
        return 'other';
      case 'attachment':
        if (action === 'ATTACHMENT_CREATED') return 'fileAdded';
        if (action === 'ATTACHMENT_DELETED') return 'fileDeleted';
        return 'other';
      case 'activity':
        if (action.includes('COMPLETE')) return 'activityCompleted';
        if (action.includes('CANCEL')) return 'activityCancelled';
        if (action.includes('CREATE')) return 'activityPlanned';
        return 'activityUpdated';
      case 'quotation':
        return 'quotation';
      case 'salesOrder':
        return 'salesOrder';
      case 'invoice':
        return 'invoice';
      default:
        return 'other';
    }
  }

  private formatSentence(item: HistoryItem, subjectKind: HistorySubjectKind): { before: string; after: string } {
    const name = item.referenceLabel?.trim() || this.transloco.translate('recordHistory.none');
    const actionKey = this.sentenceActionKey(item, subjectKind);
    const suffix = item.outcome === 'FAILURE' ? 'failed' : 'ok';
    const raw = this.transloco.translate(`recordHistory.s.${actionKey}.${suffix}`, { actor: ACTOR_MARKER, name });
    const markerIndex = raw.indexOf(ACTOR_MARKER);
    if (markerIndex === -1) {
      return { before: '', after: ` ${raw}` };
    }
    return {
      before: raw.slice(0, markerIndex),
      after: raw.slice(markerIndex + ACTOR_MARKER.length),
    };
  }

  private formatDiffRow(
    entry: HistoryDiffEntry,
    subjectKind: HistorySubjectKind,
    dateFmt: Intl.DateTimeFormat,
    timeFmt: Intl.DateTimeFormat,
    resolveLabel?: (field: string, value: unknown) => string | null,
  ): HistoryDiffRowVm {
    const fieldLabel = KNOWN_FIELDS.has(entry.field)
      ? this.transloco.translate(`recordHistory.field.${entry.field}`)
      : humanizeFieldName(entry.field);
    const hasBefore = entry.before !== null && entry.before !== undefined;
    return {
      fieldLabel,
      hasBefore,
      beforeText: hasBefore
        ? this.formatValue(entry.field, entry.before, subjectKind, dateFmt, timeFmt, resolveLabel)
        : '',
      afterText: this.formatValue(entry.field, entry.after, subjectKind, dateFmt, timeFmt, resolveLabel),
      ltr: LTR_FIELDS.has(entry.field),
    };
  }

  private formatValue(
    field: string,
    value: unknown,
    subjectKind: HistorySubjectKind,
    dateFmt: Intl.DateTimeFormat,
    timeFmt: Intl.DateTimeFormat,
    resolveLabel?: (field: string, value: unknown) => string | null,
  ): string {
    const none = this.transloco.translate('recordHistory.none');
    if (value === null || value === undefined || value === '[NOT_RECORDED]') {
      return none;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return none;
      return value
        .map((item) => this.formatScalar(field, item, subjectKind, dateFmt, timeFmt, none, resolveLabel))
        .join(', ');
    }

    return this.formatScalar(field, value, subjectKind, dateFmt, timeFmt, none, resolveLabel);
  }

  private formatScalar(
    field: string,
    value: unknown,
    subjectKind: HistorySubjectKind,
    dateFmt: Intl.DateTimeFormat,
    timeFmt: Intl.DateTimeFormat,
    none: string,
    resolveLabel?: (field: string, value: unknown) => string | null,
  ): string {
    if (value === null || value === undefined || value === '[NOT_RECORDED]') {
      return none;
    }

    if (value === '[REDACTED]') return this.transloco.translate('recordHistory.redacted');
    if (value === '[TRUNCATED]') return this.transloco.translate('recordHistory.truncated');

    if (subjectKind === 'activity' && field === 'status') {
      const raw = String(value);
      if (KNOWN_ACTIVITY_STATUSES.has(raw)) {
        const key = `activities.statuses.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
      }
    }

    const customLabel = resolveLabel?.(field, value);
    if (customLabel !== null && customLabel !== undefined) {
      return customLabel;
    }

    if (field === 'rating') {
      const n = Number(value);
      return Number.isFinite(n) ? this.transloco.translate('recordHistory.ratingOf', { n }) : String(value);
    }

    if (field === 'isPrimary') {
      if (typeof value === 'boolean') {
        return this.transloco.translate(value ? 'recordHistory.yes' : 'recordHistory.no');
      }
      if (value === 'true' || value === 'false') {
        return this.transloco.translate(value === 'true' ? 'recordHistory.yes' : 'recordHistory.no');
      }
    }

    if (field === 'type') {
      const raw = String(value);
      if (KNOWN_ACTIVITY_TYPES.has(raw)) {
        const key = `activities.types.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
      }
    }

    if (field === 'priority') {
      const raw = String(value);
      if (KNOWN_ACTIVITY_PRIORITIES.has(raw)) {
        const key = `activities.priorities.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
      }
    }

    if (field === 'direction') {
      const raw = String(value);
      if (KNOWN_ACTIVITY_DIRECTIONS.has(raw)) {
        const key = `activities.directions.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
      }
    }

    if (field === 'status') {
      const raw = String(value);
      if (KNOWN_RECORD_STATUSES.has(raw)) {
        const key = `recordHistory.status.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
      }
      if (KNOWN_ACTIVITY_STATUSES.has(raw)) {
        const key = `activities.statuses.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
      }
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return none;
      if (ISO_DATE_ONLY_RE.test(trimmed)) {
        const parsed = new Date(`${trimmed}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
          return dateFmt.format(parsed);
        }
      }
      if (ISO_DATETIME_RE.test(trimmed)) {
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
          return `${dateFmt.format(parsed)} · ${timeFmt.format(parsed)}`;
        }
      }
      return value;
    }

    if (typeof value === 'object') {
      const entries = Object.values(value as Record<string, unknown>).filter(
        (v) => v !== null && v !== undefined && v !== '',
      );
      return entries.length ? entries.map(String).join(', ') : none;
    }

    return String(value);
  }
}

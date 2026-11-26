import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuilding,
  tablerChevronDown,
  tablerCopy,
  tablerLock,
  tablerUser,
  tablerUserPlus,
} from '@ng-icons/tabler-icons';
import { ActionItem, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { buildPayload } from './duplicate-payload';
import { DuplicateCheckPayload, DuplicateCompanySelection, DuplicateMatch, DuplicateProbe } from './duplicate.model';

const DEBOUNCE_MS = 500;
const VISIBLE_LIMIT = 3;
const SILENT_STATUSES = new Set([401, 403, 404]);

function isSilentError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && SILENT_STATUSES.has(status);
}

/** Inline live duplicate-check strip displayed inside record forms when potential matches exist. */
@Component({
  selector: 'app-duplicate-strip',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button],
  providers: [
    provideTranslocoScope({ scope: 'record-dup', alias: 'recordDup' }),
    provideIcons({
      tablerAlertTriangle,
      tablerBuilding,
      tablerChevronDown,
      tablerCopy,
      tablerLock,
      tablerUser,
      tablerUserPlus,
    }),
  ],
  templateUrl: './duplicate-strip.html',
  host: { class: 'block' },
})
export class DuplicateStrip {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private seq = 0;

  readonly probe = input<DuplicateProbe | null>(null);
  readonly check = input.required<(probe: DuplicateCheckPayload) => Promise<DuplicateMatch[]>>();
  readonly disabled = input(false);
  readonly openLabelKey = input.required<string>();

  readonly openRecord = output<DuplicateMatch>();
  readonly useCompany = output<DuplicateCompanySelection>();
  /** Emits whether any current match would block the save under the duplicate policy. */
  readonly blockingChange = output<boolean>();

  protected readonly hidden = signal(false);
  protected readonly matches = signal<DuplicateMatch[]>([]);
  protected readonly expanded = signal(true);
  protected readonly showAll = signal(false);
  protected readonly visibleMatches = computed(() =>
    this.showAll() ? this.matches() : this.matches().slice(0, VISIBLE_LIMIT),
  );
  protected readonly blocking = computed(
    () => !this.disabled() && !this.hidden() && this.matches().some((match) => match.wouldBlock === true),
  );
  protected readonly hasMore = computed(() => this.matches().length > VISIBLE_LIMIT);
  protected readonly openLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(this.openLabelKey());
  });

  protected readonly leadMenuItems = computed<Record<string, ActionItem[]>>(() => {
    this.i18n();
    const itemsByParty: Record<string, ActionItem[]> = {};
    for (const match of this.matches()) {
      const leads = match.leads;
      itemsByParty[match.partyId] = leads.map((lead) => ({
        id: lead.id,
        title: this.transloco.translate('recordDup.leadItem', {
          stage: this.transloco.translate('recordDup.stage.' + lead.stageFlag),
        }),
        icon: 'tablerUserPlus',
        tile: 'bg-icon-green',
      }));
    }
    return itemsByParty;
  });

  protected readonly matchLabels = computed<Record<string, string>>(() => {
    this.i18n();
    const labelsByParty: Record<string, string> = {};
    for (const match of this.matches()) {
      labelsByParty[match.partyId] = match.matchTypes
        .map((type) => this.transloco.translate('recordDup.match.' + type))
        .join(' · ');
    }
    return labelsByParty;
  });

  private readonly payload = computed(
    () => (this.disabled() || this.hidden() ? null : buildPayload(this.probe())),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  constructor() {
    effect(() => this.blockingChange.emit(this.blocking()));

    effect((onCleanup) => {
      const payload = this.payload();
      const checkFn = this.check();
      const seq = ++this.seq;

      this.matches.set([]);
      this.showAll.set(false);
      if (!payload) return;

      const timer = setTimeout(() => {
        void this.runCheck(checkFn, payload, seq);
      }, DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected canOpenMatch(match: DuplicateMatch): boolean {
    return match.leads.length > 0 || Boolean(match.recordId && !match.restricted);
  }

  protected onOpenMatch(match: DuplicateMatch, selectedLeadId?: string): void {
    const leads = match.leads;
    if (selectedLeadId && leads.length > 0) {
      const picked = leads.find((item) => item.id === selectedLeadId);
      const reordered = picked ? [picked, ...leads.filter((item) => item.id !== selectedLeadId)] : leads;
      this.openRecord.emit({
        ...match,
        recordId: selectedLeadId,
        leads: reordered,
      });
      return;
    }
    this.openRecord.emit({
      ...match,
      recordId: match.recordId ?? leads[0]?.id,
    });
  }

  protected canUseCompany(match: DuplicateMatch): boolean {
    const p = this.probe();
    return Boolean(p?.corporate && !p.excludePartyId && match.partyType === 'ORGANIZATION' && !match.restricted && match.displayName);
  }

  protected onUseCompany(match: DuplicateMatch): void {
    if (!match.displayName) return;
    this.useCompany.emit({ partyId: match.partyId, displayName: match.displayName });
  }

  private async runCheck(
    checkFn: (probe: DuplicateCheckPayload) => Promise<DuplicateMatch[]>,
    payload: DuplicateCheckPayload,
    seq: number,
  ): Promise<void> {
    try {
      const result = await checkFn(payload);
      if (seq !== this.seq) return;
      this.matches.set(result);
      if (result.length <= VISIBLE_LIMIT) {
        this.showAll.set(false);
      }
    } catch (error) {
      if (seq !== this.seq) return;
      if (isSilentError(error)) {
        this.hidden.set(true);
      }
      this.matches.set([]);
      this.showAll.set(false);
    }
  }
}

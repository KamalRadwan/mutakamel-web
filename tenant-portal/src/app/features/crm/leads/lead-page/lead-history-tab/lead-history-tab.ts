import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { RecordHistory } from '../../../../../shared/widgets/record-history/record-history';
import { HistoryCategoryOption } from '../../../../../shared/widgets/record-history/record-history.model';
import { listBranchOwners, listLeadSources, listLeadStages } from '../../leads.api';
import { LeadStage, OwnerOption, SourceOption, nameIn } from '../../leads.model';

@Component({
  selector: 'app-lead-history-tab',
  imports: [RecordHistory],
  providers: [
    provideTranslocoScope(
      { scope: 'lead-page', alias: 'leadPage' },
      { scope: 'record-history', alias: 'recordHistory' },
    ),
  ],
  templateUrl: './lead-history-tab.html',
})
export class LeadHistoryTab {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  readonly leadId = input.required<string>();
  readonly partyIds = input<string[]>([]);
  readonly branchId = input<string | null>(null);
  readonly refreshRequest = input(0);

  protected readonly entityTypes = ['Lead'] as const;
  protected readonly categories: readonly HistoryCategoryOption[] = [
    { id: 'lead', labelKey: 'leadPage.history.filter.lead' },
    { id: 'contact', labelKey: 'recordHistory.filter.contact' },
    { id: 'activity', labelKey: 'recordHistory.filter.activity' },
  ];

  private readonly stages = signal<readonly LeadStage[]>([]);
  private readonly sources = signal<readonly SourceOption[]>([]);
  private readonly owners = signal<readonly OwnerOption[]>([]);
  private ownersSeq = 0;
  private loadedOwnersBranchId: string | null = null;
  private loadingOwnersBranchId: string | null = null;

  protected readonly valueLabelFn = computed(() => {
    this.i18n();
    const lang = this.language();
    const stageById = new Map(this.stages().map((s) => [s.id, s]));
    const sourceById = new Map(this.sources().map((s) => [s.id, s]));
    const ownerById = new Map(this.owners().map((o) => [o.id, o]));
    const none = this.transloco.translate('recordHistory.none');

    return (field: string, value: unknown): string | null => {
      if (field === 'stageId') {
        const stage = stageById.get(String(value));
        return stage ? nameIn(stage, lang) : none;
      }
      if (field === 'ownerUserId') {
        const owner = ownerById.get(String(value));
        return owner ? owner.displayName : none;
      }
      if (field === 'acquisitionSourceId') {
        const source = sourceById.get(String(value));
        return source ? nameIn(source, lang) : none;
      }
      if (field === 'status') {
        const raw = String(value);
        const key = `leadPage.history.status.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
      }
      return null;
    };
  });

  constructor() {
    void listLeadStages()
      .then((list) => this.stages.set(list))
      .catch(() => {});
    void listLeadSources()
      .then((list) => this.sources.set(list))
      .catch(() => {});

    effect(() => {
      const nextBranchId = this.branchId();
      if (!nextBranchId) {
        this.ownersSeq++;
        this.owners.set([]);
        this.loadedOwnersBranchId = null;
        this.loadingOwnersBranchId = null;
        return;
      }
      if (nextBranchId !== this.loadedOwnersBranchId && nextBranchId !== this.loadingOwnersBranchId) {
        untracked(() => void this.refreshBranchOwners(nextBranchId));
      }
    });
  }

  private async refreshBranchOwners(branchId: string): Promise<void> {
    const seq = ++this.ownersSeq;
    this.loadingOwnersBranchId = branchId;
    try {
      const list = await listBranchOwners(branchId);
      if (seq !== this.ownersSeq || this.branchId() !== branchId) return;
      this.owners.set(list);
      this.loadedOwnersBranchId = branchId;
    } catch {
      // Keep existing owners if lookup fails.
    } finally {
      if (this.loadingOwnersBranchId === branchId) {
        this.loadingOwnersBranchId = null;
      }
    }
  }
}

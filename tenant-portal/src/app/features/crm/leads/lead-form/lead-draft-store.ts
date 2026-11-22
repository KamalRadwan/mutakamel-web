import { Service, inject } from '@angular/core';
import { RecordDraftStore } from '../../shared/record/nav/record-draft-store';
import { LeadNavContext } from '../leads.model';
import { LeadDraft } from './lead-draft';

export { RecordDraftStore } from '../../shared/record/nav/record-draft-store';
export type { RecordDraftEntry } from '../../shared/record/nav/record-draft-store';

const LEAD_RECORD_TYPE = 'lead';

export interface LeadDraftEntry {
  draft: LeadDraft;
  leadId: string | null;
  baseUpdatedAt: string | null;
  nav?: LeadNavContext | null;
}

@Service()
export class LeadDraftStore {
  private readonly store = inject(RecordDraftStore);

  put(entry: LeadDraftEntry): string {
    return this.store.put<LeadDraft>({
      recordType: LEAD_RECORD_TYPE,
      draft: entry.draft,
      recordId: entry.leadId,
      baseUpdatedAt: entry.baseUpdatedAt,
      nav: entry.nav ?? null,
    });
  }

  take(key: string): LeadDraftEntry | null {
    const entry = this.store.take<LeadDraft>(key, LEAD_RECORD_TYPE);
    if (!entry) return null;
    return {
      draft: entry.draft,
      leadId: entry.recordId,
      baseUpdatedAt: entry.baseUpdatedAt,
      nav: entry.nav,
    };
  }
}

import type { LeadDetail, LeadRow } from '../leads.model';

/** A detail's authoritative owner id remains usable when its display summary is unavailable. */
export function leadActionRow(lead: LeadDetail): LeadRow {
  return {
    ...lead,
    owner: lead.ownerUserId
      ? { firstName: null, lastName: null, ...lead.owner, userId: lead.ownerUserId }
      : null,
  };
}

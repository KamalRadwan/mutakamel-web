"use client";

import { AlertTriangle } from "lucide-react";
import { Button, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { LeadDuplicateMatch } from "../../lead-bulk-contract";

const WARNING_BOX = "flex flex-col gap-1.5 rounded-sm border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-foreground";
const MAX_LISTED_MATCHES = 5;

export interface LeadDuplicateWarningsProps {
  /** A Directory company whose name contains the company name being typed. */
  companyMatch: { id: string; displayName: string } | null;
  onUseCompany: () => void;
  /** Exact matches from `POST /leads/duplicate-check`. Advisory: saving is never blocked. */
  matches: readonly LeadDuplicateMatch[];
  disabled?: boolean;
}

export function LeadDuplicateWarnings({ companyMatch, onUseCompany, matches, disabled }: LeadDuplicateWarningsProps) {
  const { t, lang } = useI18n();
  const labels = t.crmLeadWorkspace.duplicates;
  const reasons = new Intl.ListFormat(INTL_LOCALE[lang], { type: "conjunction" });

  return (
    <>
      {companyMatch && (
        <div role="status" className={`${WARNING_BOX} sm:flex-row sm:items-center sm:justify-between`}>
          <span className="flex items-center gap-2">
            <AlertTriangle className={`${iconSize({ size: "md" })} text-warning`} aria-hidden="true" />
            {formatTemplate(labels.companyMatch, { name: companyMatch.displayName })}
          </span>
          <Button variant="secondary" size="xs" disabled={disabled} onClick={onUseCompany}>
            {labels.useCompany}
          </Button>
        </div>
      )}

      {matches.length > 0 && (
        <div role="status" className={WARNING_BOX}>
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle className={`${iconSize({ size: "md" })} text-warning`} aria-hidden="true" />
            {labels.title}
          </span>
          <ul className="ms-6 list-disc">
            {matches.slice(0, MAX_LISTED_MATCHES).map((match) => (
              <li key={match.partyId}>
                <span className="font-medium">{match.displayName ?? labels.otherBranch}</span>
                {" — "}
                {formatTemplate(labels.matchedOn, {
                  reasons: reasons.format(match.matchTypes.map((type) => labels.reasons[type])),
                })}
                {match.leads.length > 0 &&
                  ` (${formatTemplate(labels.existingLeads, { count: formatNumber(match.leads.length, lang) })})`}
                {match.restricted && ` — ${labels.restricted}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

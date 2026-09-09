"use client";

import { useId } from "react";
import { Card, CardContent, CardHeader } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadDetail } from "../../lead-contract";
import { useLeadContactModal } from "../hooks/useLeadContactModal";
import { LeadContactEditModal } from "./LeadContactEditModal";
import { LeadContactList } from "./LeadContactList";
import { LeadIndividualContactCard } from "./LeadIndividualContactCard";

export interface LeadContactsCardProps {
  lead: LeadDetail;
  canEdit: boolean;
  onSaved: (lead: LeadDetail) => void;
  onReconcile: () => void;
}

export function LeadContactsCard(props: LeadContactsCardProps) {
  const { lead, canEdit, onSaved, onReconcile } = props;
  const { t } = useI18n();
  const headingId = useId();
  const editable = canEdit && lead.status !== "CONVERTED";
  const edit = useLeadContactModal(lead, onSaved, onReconcile, editable);
  return (
    <>
      <Card role="region" aria-labelledby={headingId} className="w-full min-w-0">
        <CardHeader className="p-2">
          <h2 id={headingId} className="text-sm font-semibold leading-none text-card-foreground">
            {t.crmLeads.create.sections.contacts}
          </h2>
        </CardHeader>
        <CardContent className="grid grid-cols-1 items-start gap-2 p-2 sm:grid-cols-2">
          {lead.leadProfileType === "CORPORATE" ? (
            lead.contacts.length > 0 ? <LeadContactList contacts={lead.contacts}
              onEdit={editable ? edit.openContact : undefined} /> : (
              <p className="col-span-full text-xs text-muted-foreground">{t.crmLeadDetail.contactsEmpty}</p>
            )
          ) : <LeadIndividualContactCard {...props} canEdit={editable} />}
        </CardContent>
      </Card>
      <LeadContactEditModal edit={edit} />
    </>
  );
}

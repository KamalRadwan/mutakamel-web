"use client";

import { Check, UserRound, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent, CardHeader, DateTime, ErrorState, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { LeadDetail } from "../../lead-contract";
import { LEAD_CREATE_LIMITS } from "../../lead-create-contract";
import { leadDetailsInitials, leadDetailsUserName } from "../lead-details-edit-contract";
import { useLeadDetailsEdit } from "../hooks/useLeadDetailsEdit";
import { useLeadDetailsReferences } from "../hooks/useLeadDetailsReferences";

const NO_SOURCE = "__none__";

/** Sales details follow the separate Company and Contacts cards. */
export function LeadIdentityCards({ lead, sources, canEdit, allowedOwnerIds, onSaved, onReconcile }: {
  lead: LeadDetail;
  sources: AcquisitionSource[];
  canEdit: boolean;
  allowedOwnerIds: string[] | null;
  onSaved: (lead: LeadDetail) => void;
  onReconcile: () => void;
}) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const edit = useLeadDetailsEdit(lead, canEdit, onSaved, onReconcile, allowedOwnerIds);
  const choices = useLeadDetailsReferences(lead, edit.form !== null, allowedOwnerIds);
  const selectedSourceId = edit.form?.acquisitionSourceId ?? lead.acquisitionSourceId ?? "";
  const selectedSource = sources.find(({ id }) => id === selectedSourceId);
  const sourceName = selectedSource
    ? localizedValue(selectedSource.nameAr, selectedSource.nameEn, lang)
    : localizedValue(lead.acquisitionSourceNameAr, lead.acquisitionSourceNameEn, lang);
  const ownerId = edit.form?.ownerUserId ?? lead.ownerUserId ?? "";
  const ownerName = leadDetailsUserName(choices.knownUsers.get(ownerId));
  const creatorName = leadDetailsUserName(choices.knownUsers.get(lead.createdByUserId ?? ""));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 p-2">
        <h2 className="text-sm font-semibold">{t.crmLeadDetail.detailsTitle}</h2>
        {edit.editable && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="xs" className="bg-success text-success-foreground" aria-label={t.crmLeadDetail.saveDetails} title={t.crmLeadDetail.saveDetails} loading={edit.saving} disabled={!edit.isDirty} onClick={() => void edit.save()}><Check className="size-3.5" aria-hidden="true" /></Button>
            <Button variant="ghost" size="xs" aria-label={t.common.cancel} title={t.common.cancel} disabled={edit.saving || !edit.isDirty} onClick={edit.cancel}><X className="size-3.5" aria-hidden="true" /></Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2">
      <dl className="grid gap-2 sm:grid-cols-2">
        <DetailsValue label={t.crmLeads.source}>
          {edit.form ? (
            <Field label={t.crmLeads.source}>
            <Select value={selectedSourceId || NO_SOURCE} onValueChange={(value) => edit.change("acquisitionSourceId", value === NO_SOURCE ? "" : value)} disabled={edit.saving}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SOURCE}>{t.crmLeadDetail.noSource}</SelectItem>
                {selectedSourceId && !selectedSource && <SelectItem value={selectedSourceId}><DetailsIdentity name={sourceName || t.detail.notRecorded} /></SelectItem>}
                {sources.map((source) => <SelectItem key={source.id} value={source.id}><DetailsIdentity name={localizedValue(source.nameAr, source.nameEn, lang)} image={source.iconUrl} /></SelectItem>)}
              </SelectContent>
            </Select>
            </Field>
          ) : <DetailsIdentity name={sourceName || t.crmLeadDetail.noSource} image={selectedSource?.iconUrl} />}
        </DetailsValue>
        <DetailsValue label={t.crmLeadDetail.tags}>
          {choices.tagsLoading ? <span className="text-xs text-muted-foreground">{t.common.loading}</span> : choices.tagsUnavailable ? <span role="status" className="text-xs text-muted-foreground">{t.crmLeadDetail.tagsUnavailable}</span> : choices.tags.length ? (
            <ul className="flex min-h-6 flex-wrap items-center gap-1">{choices.tags.map((tag) => <li key={tag.id} className="max-w-full break-words rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tag.name}</li>)}</ul>
          ) : <span className="text-xs text-muted-foreground">{t.crmLeadDetail.noTags}</span>}
        </DetailsValue>
        <DetailsValue label={t.crmLeadDetail.salesPerson}>
        <Field label={t.crmLeadDetail.salesPerson} hint={edit.form?.ownerUserId && !lead.ownerUserId ? t.crmLeadDetail.currentUserSuggested : undefined}>
          <Select value={ownerId || undefined} onValueChange={(value) => edit.change("ownerUserId", value)} disabled={!edit.form || edit.saving || choices.usersLoading || choices.ownerOptions.length === 0}>
            <SelectTrigger size="sm"><SelectValue placeholder={t.detail.notRecorded}><DetailsIdentity name={ownerName || (ownerId ? t.crmLeadDetail.userNameUnavailable : t.detail.notRecorded)} initialsName={ownerName} /></SelectValue></SelectTrigger>
            <SelectContent>
              {ownerId && !choices.ownerOptions.some(({ id }) => id === ownerId) && <SelectItem value={ownerId} disabled><DetailsIdentity name={ownerName || t.crmLeadDetail.userNameUnavailable} initialsName={ownerName} /></SelectItem>}
              {choices.ownerOptions.map((user) => <SelectItem key={user.id} value={user.id}><DetailsIdentity name={leadDetailsUserName(user) || t.crmLeadDetail.userNameUnavailable} /></SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        </DetailsValue>
        <DetailsValue label={t.crmLeadDetail.createdAt}><DateTime value={lead.createdAt} precision="datetime" /></DetailsValue>
        <DetailsValue label={t.crmLeadDetail.createdBy}><DetailsIdentity name={creatorName || (lead.createdByUserId ? t.crmLeadDetail.userNameUnavailable : t.detail.notRecorded)} initialsName={creatorName} /></DetailsValue>
        <DetailsValue label={t.crmLeadDetail.updatedAt}><DateTime value={lead.updatedAt} precision="datetime" /></DetailsValue>
        {(["interestSummary", "expectedNeed", "description"] as const).map((field) => (
          <DetailsValue key={field} label={field === "description" ? t.crmLeadDetail.notes : t.crmLeadDetail[field]} wide>
            <Field label={field === "description" ? t.crmLeadDetail.notes : t.crmLeadDetail[field]} error={edit.errors[field]}>
              <Textarea size="sm" value={edit.form?.[field] ?? lead[field] ?? ""} readOnly={!edit.form} disabled={edit.saving} onChange={(event) => edit.change(field, event.target.value)} onBlur={() => edit.validate(field)} rows={2} maxLength={LEAD_CREATE_LIMITS[field]} />
            </Field>
          </DetailsValue>
        ))}
      </dl>
        {edit.form && (!choices.canReadUsers || choices.usersUnavailable) && <p role="status" className="mt-3 text-xs text-muted-foreground">{choices.canReadUsers ? t.crmLeadDetail.usersUnavailable : t.crmLeadDetail.usersPermissionRequired}</p>}
        {edit.error && <ErrorState title={describeError(edit.error) ?? t.crmLeadDetail.saveFailed} onRetry={edit.clearError} retryLabel={t.common.dismiss} />}
      </CardContent>
    </Card>
  );
}

function DetailsValue({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cn("flex min-w-0 flex-col gap-1", wide && "sm:col-span-2")}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="min-w-0 text-xs">{children}</dd></div>;
}

function DetailsIdentity({ name, image, initialsName = name }: { name: string; image?: string | null; initialsName?: string }) {
  const initials = leadDetailsInitials(initialsName);
  return <span className="flex min-h-6 min-w-0 items-center gap-1.5 text-xs"><Avatar className="size-6" aria-hidden="true"><AvatarImage src={image ?? undefined} alt="" /><AvatarFallback>{initials || <UserRound className="size-3.5" aria-hidden="true" />}</AvatarFallback></Avatar><span className="min-w-0 break-words">{name}</span></span>;
}

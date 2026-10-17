"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Sparkles, UserRound, X } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  DOSSIER_TAG_TONE_CLASSES,
  DateTime,
  ErrorState,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagChip,
  Textarea,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { localizedValue } from "@/lib/format/localized";
import { isUUIDv7 } from "@/lib/uuid";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../../shared/tag-contract";
import type { LeadDetail } from "../../lead-contract";
import { LEAD_CREATE_LIMITS } from "../../lead-create-contract";
import { leadDetailsInitials, leadDetailsUserName } from "../lead-details-edit-contract";
import { useLeadDetailsEdit } from "../hooks/useLeadDetailsEdit";
import { useLeadDetailsReferences } from "../hooks/useLeadDetailsReferences";

const NO_SOURCE = "__none__";

/**
 * Qualification, Ownership, Tags & Custom Fields Card (Dossier 360° Section 2).
 */
export function LeadIdentityCards({
  lead,
  sources,
  canEdit,
  allowedOwnerIds,
  onSaved,
  onReconcile,
  viewModeByDefault = false,
  customFieldsSlot,
}: {
  lead: LeadDetail;
  sources: AcquisitionSource[];
  canEdit: boolean;
  allowedOwnerIds: string[] | null;
  onSaved: (lead: LeadDetail) => void;
  onReconcile: () => void;
  viewModeByDefault?: boolean;
  customFieldsSlot?: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const describeError = useCrmErrorText();
  const [isEditingMode, setIsEditingMode] = useState(!viewModeByDefault);
  const edit = useLeadDetailsEdit(lead, canEdit, onSaved, onReconcile, allowedOwnerIds);
  const showEditControls = edit.editable && isEditingMode;
  const choices = useLeadDetailsReferences(lead, showEditControls, allowedOwnerIds);
  const [localTags, setLocalTags] = useState<CrmTag[] | null>(null);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<CrmTag[]>([]);

  useEffect(() => {
    setLocalTags(null);
    setIsTagPickerOpen(false);
  }, [lead.id]);

  const displayedTags = localTags ?? choices.tags;

  const handleOpenTagPicker = useCallback(() => {
    if (!edit.editable) return;
    setIsTagPickerOpen((prev) => !prev);
    if (availableTags.length === 0) {
      void axiosClient
        .get<unknown>(CRM_TAGS_PATH, { cache: "no-store", maxResponseBytes: 256 * 1024 })
        .then((res) => {
          setAvailableTags(parseCrmTagCatalogue(res.data));
        })
        .catch(() => {});
    }
  }, [edit.editable, availableTags.length]);

  const handleAttachTag = useCallback(
    async (tag: CrmTag) => {
      if (!edit.editable) return;
      setLocalTags((prev) => {
        const base = prev ?? choices.tags;
        return base.some((item) => item.id === tag.id) ? base : [...base, tag];
      });
      setIsTagPickerOpen(false);
      if (isUUIDv7(lead.id) && isUUIDv7(tag.id)) {
        try {
          const res = await axiosClient.post<unknown>(
            `/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}/tags`,
            { tagId: tag.id },
            { skipAutoIdempotency: true },
          );
          if (Array.isArray(res.data)) {
            setLocalTags(parseCrmTags(res.data));
          }
        } catch {
          // Keep optimistic tag
        }
      }
    },
    [edit.editable, choices.tags, lead.id],
  );

  const handleDetachTag = useCallback(
    async (tagId: string) => {
      if (!edit.editable) return;
      setLocalTags((prev) => (prev ?? choices.tags).filter((item) => item.id !== tagId));
      if (isUUIDv7(lead.id) && isUUIDv7(tagId)) {
        try {
          await axiosClient.delete(
            `/api/tenant/crm/v1/leads/${encodeURIComponent(lead.id)}/tags/${encodeURIComponent(tagId)}`,
          );
        } catch {
          // Keep optimistic removal
        }
      }
    },
    [edit.editable, choices.tags, lead.id],
  );

  const selectedSourceId = (showEditControls ? edit.form?.acquisitionSourceId : undefined) ?? lead.acquisitionSourceId ?? "";
  const selectedSource = sources.find(({ id }) => id === selectedSourceId);
  const sourceName = selectedSource
    ? localizedValue(selectedSource.nameAr, selectedSource.nameEn, lang)
    : localizedValue(lead.acquisitionSourceNameAr, lead.acquisitionSourceNameEn, lang);
  const ownerId = (showEditControls ? edit.form?.ownerUserId : undefined) ?? lead.ownerUserId ?? "";
  const ownerName = leadDetailsUserName(choices.knownUsers.get(ownerId));
  const creatorName = leadDetailsUserName(choices.knownUsers.get(lead.createdByUserId ?? ""));

  return (
    <Card
      className={cn(
        "dossier-card dossier-card-violet",
        showEditControls && viewModeByDefault && "dossier-card-editing-violet",
      )}
    >
      <CardHeader
        className={cn(
          "dossier-card-head flex-row items-center justify-between gap-2",
          showEditControls && viewModeByDefault && "dossier-card-header-editing-violet",
        )}
      >
        <div className="dossier-card-title">
          <span className="dossier-icon-pill dossier-ip-violet" aria-hidden="true">
            <Sparkles className="size-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-xs font-extrabold tracking-wider uppercase">
            {t.crmLeadDetail.detailsTitle}
          </h2>
        </div>
        {edit.editable ? (
          showEditControls ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="dossier-btn-cancel"
                aria-label={t.common.cancel}
                title={t.common.cancel}
                disabled={edit.saving || (!viewModeByDefault && !edit.isDirty)}
                onClick={() => {
                  edit.cancel();
                  if (viewModeByDefault) setIsEditingMode(false);
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>{t.common.cancel}</span>
              </button>
              <button
                type="button"
                className="dossier-btn-save"
                aria-label={t.crmLeadDetail.saveDetails}
                title={t.crmLeadDetail.saveDetails}
                disabled={!edit.isDirty || edit.saving}
                onClick={async () => {
                  await edit.save();
                  if (viewModeByDefault) setIsEditingMode(false);
                }}
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>{t.crmLeadDetail.saveDetails}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="dossier-btn-action dossier-btn-action-violet"
              aria-label={t.crmTags.edit}
              title={t.crmTags.edit}
              onClick={() => setIsEditingMode(true)}
            >
              <Pencil className="size-3" aria-hidden="true" />
              <span>{t.crmTags.edit}</span>
            </button>
          )
        ) : (
          <span className="dossier-badge dossier-badge-converted">
            🔒 {isAr ? "للقراءة فقط" : "Read-Only"}
          </span>
        )}
      </CardHeader>

      <CardContent className="dossier-card-body">
        <dl className="grid gap-2 sm:grid-cols-2">
          <DetailsValue label={t.crmLeadDetail.salesPerson}>
            {viewModeByDefault && !showEditControls ? (
              <DetailsIdentity
                name={ownerName || (ownerId ? t.crmLeadDetail.userNameUnavailable : t.detail.notRecorded)}
                initialsName={ownerName}
              />
            ) : (
              <Field label={t.crmLeadDetail.salesPerson} hint={edit.form?.ownerUserId && !lead.ownerUserId ? t.crmLeadDetail.currentUserSuggested : undefined}>
                <Select value={ownerId || undefined} onValueChange={(value) => edit.change("ownerUserId", value)} disabled={!showEditControls || !edit.form || edit.saving || choices.usersLoading || choices.ownerOptions.length === 0}>
                  <SelectTrigger size="sm"><SelectValue placeholder={t.detail.notRecorded}><DetailsIdentity name={ownerName || (ownerId ? t.crmLeadDetail.userNameUnavailable : t.detail.notRecorded)} initialsName={ownerName} /></SelectValue></SelectTrigger>
                  <SelectContent>
                    {ownerId && !choices.ownerOptions.some(({ id }) => id === ownerId) && <SelectItem value={ownerId} disabled><DetailsIdentity name={ownerName || t.crmLeadDetail.userNameUnavailable} initialsName={ownerName} /></SelectItem>}
                    {choices.ownerOptions.map((user) => <SelectItem key={user.id} value={user.id}><DetailsIdentity name={leadDetailsUserName(user) || t.crmLeadDetail.userNameUnavailable} /></SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </DetailsValue>

          <DetailsValue label={t.crmLeads.source}>
            {showEditControls && edit.form ? (
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
            ) : (
              <DetailsIdentity name={sourceName || t.crmLeadDetail.noSource} image={selectedSource?.iconUrl} />
            )}
          </DetailsValue>

          <DetailsValue label={t.crmLeadDetail.createdBy}>
            <DetailsIdentity name={creatorName || (lead.createdByUserId ? t.crmLeadDetail.userNameUnavailable : t.detail.notRecorded)} initialsName={creatorName} />
          </DetailsValue>

          <DetailsValue label={t.crmLeadDetail.createdAt}>
            <DateTime value={lead.createdAt} precision="datetime" />
          </DetailsValue>

          <DetailsValue label={t.crmLeadDetail.updatedAt} wide>
            <DateTime value={lead.updatedAt} precision="datetime" />
          </DetailsValue>

          {(["interestSummary", "expectedNeed", "description"] as const).map((field) => {
            const fieldLabel = field === "description" ? t.crmLeadDetail.notes : t.crmLeadDetail[field];
            const fieldValue = (showEditControls ? edit.form?.[field] : undefined) ?? lead[field] ?? "";
            const isWide = field === "description";
            return (
              <DetailsValue key={field} label={fieldLabel} wide={isWide}>
                {viewModeByDefault && !showEditControls ? (
                  <div className="min-h-6 text-xs font-bold text-foreground">
                    {fieldValue.trim().length > 0 ? (
                      <span className="whitespace-pre-wrap break-words">{fieldValue}</span>
                    ) : (
                      <span className="font-medium text-muted-foreground">{t.detail.notRecorded}</span>
                    )}
                  </div>
                ) : (
                  <Field label={fieldLabel} error={edit.errors[field]}>
                    <Textarea
                      placeholder={fieldLabel}
                      size="sm"
                      value={fieldValue}
                      readOnly={!showEditControls || !edit.form}
                      disabled={edit.saving}
                      onChange={(event) => edit.change(field, event.target.value)}
                      onBlur={() => edit.validate(field)}
                      rows={2}
                      maxLength={LEAD_CREATE_LIMITS[field]}
                    />
                  </Field>
                )}
              </DetailsValue>
            );
          })}

          <DetailsValue label={t.crmLeadDetail.tags} wide>
            {choices.tagsLoading ? (
              <span className="text-xs text-muted-foreground">{t.common.loading}</span>
            ) : choices.tagsUnavailable ? (
              <span role="status" className="text-xs text-muted-foreground">{t.crmLeadDetail.tagsUnavailable}</span>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="dossier-tags">
                  {displayedTags.length > 0 ? (
                    <ul className="flex min-h-6 flex-wrap items-center gap-1.5">
                      {displayedTags.map((tag, idx) => {
                        const toneClass = DOSSIER_TAG_TONE_CLASSES[idx % DOSSIER_TAG_TONE_CLASSES.length];
                        return (
                          <li key={tag.id} className="flex min-w-0 max-w-full items-center">
                            {tag.backgroundColor || tag.textColor ? (
                              <span className="inline-flex items-center gap-1">
                                <TagChip label={tag.name} backgroundColor={tag.backgroundColor} textColor={tag.textColor} />
                                {edit.editable && (
                                  <button
                                    type="button"
                                    aria-label={`Remove tag ${tag.name}`}
                                    onClick={() => void handleDetachTag(tag.id)}
                                    className="rounded px-1 text-xs font-extrabold text-muted-foreground hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ) : (
                              <span className={toneClass}>
                                <span>{tag.name}</span>
                                {edit.editable && (
                                  <button
                                    type="button"
                                    aria-label={`Remove tag ${tag.name}`}
                                    onClick={() => void handleDetachTag(tag.id)}
                                    className="ms-1 border-0 bg-transparent p-0 font-extrabold opacity-75 hover:opacity-100"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">{t.crmLeadDetail.noTags}</span>
                  )}

                  {edit.editable && (
                    <button
                      type="button"
                      onClick={handleOpenTagPicker}
                      className="dossier-tag dossier-tag-add"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                      <span>{isAr ? "ربط وسم" : "Attach Tag"}</span>
                    </button>
                  )}
                </div>

                {isTagPickerOpen && availableTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-violet-300/60 bg-violet-500/[0.06] p-2 dark:border-violet-500/30">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => void handleAttachTag(tag)}
                        className="dossier-tag dossier-tag-indigo"
                      >
                        + {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DetailsValue>
        </dl>

        {customFieldsSlot && (
          <div className="dossier-custom-fields-section mt-3">
            {customFieldsSlot}
          </div>
        )}

        {showEditControls && edit.form && (!choices.canReadUsers || choices.usersUnavailable) && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            {choices.canReadUsers ? t.crmLeadDetail.usersUnavailable : t.crmLeadDetail.usersPermissionRequired}
          </p>
        )}
        {edit.error && (
          <ErrorState
            title={describeError(edit.error) ?? t.crmLeadDetail.saveFailed}
            onRetry={edit.clearError}
            retryLabel={t.common.dismiss}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DetailsValue({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("dossier-field-box flex min-w-0 flex-col gap-1", wide && "sm:col-span-2")}>
      <dt className="dossier-field-label text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs">{children}</dd>
    </div>
  );
}

function DetailsIdentity({ name, image, initialsName = name }: { name: string; image?: string | null; initialsName?: string }) {
  const initials = leadDetailsInitials(initialsName);
  return (
    <span className="flex min-h-6 min-w-0 items-center gap-1.5 text-xs font-bold text-foreground">
      <Avatar className="size-6" aria-hidden="true">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback>{initials || <UserRound className="size-3.5" aria-hidden="true" />}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}



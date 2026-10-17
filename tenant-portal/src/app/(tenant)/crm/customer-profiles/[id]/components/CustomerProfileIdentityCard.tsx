"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  Check,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  User,
  X,
} from "lucide-react";
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
  focusRing,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCoreData } from "@/lib/api/envelope";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { isUUIDv7 } from "@/lib/uuid";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../../shared/tag-contract";
import { CreateTagModal } from "../../../leads/components/create-lead/CreateTagModal";
import { readOwnerOptions } from "../../../leads/[id]/hooks/readLeadOwnerOptions";
import {
  parseLeadDetailsUser,
  type LeadDetailsUser,
} from "../../../leads/[id]/lead-details-edit-contract";
import { CustomerProfileTagList } from "../../components/customer-card/CustomerProfileTagList";
import {
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../../customer-profile-contract";
import { customerProfilePath } from "../../hooks/useCustomerProfiles";

const USERS_PATH = "/api/tenant/core/v1/users";
const NO_SOURCE_VALUE = "__none__";

export interface CustomerProfileIdentityCardProps {
  profile: CustomerProfileDetail;
  sources?: AcquisitionSource[];
  canEdit?: boolean;
  allowedOwnerIds?: string[] | null;
  onSaved?: (next: CustomerProfileDetail) => void;
  onReconcile?: () => void;
  viewModeByDefault?: boolean;
  customFieldsSlot?: React.ReactNode;
}

export function CustomerProfileIdentityCard({
  profile,
  sources = [],
  canEdit = false,
  allowedOwnerIds = null,
  onSaved,
  onReconcile,
  viewModeByDefault = true,
  customFieldsSlot,
}: CustomerProfileIdentityCardProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const detail = t.crmLeadDetail;
  const actions = t.crmCustomerProfileActions;
  const unavailable = t.crmCustomerProfiles.unavailable;
  const { user: actor } = useTenantAuth();

  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  const canCreateTag =
    actor?.isTenantOwner === true ||
    (actor?.permissions.includes("crm.tags.create") ?? false);

  const [isEditing, setIsEditing] = useState(!viewModeByDefault && canEdit);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    ownerUserId: profile.ownerUserId ?? "",
    acquisitionSourceId: profile.acquisitionSourceId ?? "",
    description: profile.description ?? "",
  });

  // Owner & Users Resolution
  const [knownUsers, setKnownUsers] = useState<Map<string, LeadDetailsUser>>(
    new Map(),
  );
  const [ownerOptions, setOwnerOptions] = useState<LeadDetailsUser[]>([]);

  // Tags State
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [availableTags, setAvailableTags] = useState<CrmTag[]>([]);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);

  useEffect(() => {
    if (!canReadUsers || !profile.ownerUserId || !isUUIDv7(profile.ownerUserId)) {
      return;
    }
    const controller = new AbortController();
    void readCoreData(
      `${USERS_PATH}/${encodeURIComponent(profile.ownerUserId)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(parseLeadDetailsUser)
      .then((user) => {
        if (!controller.signal.aborted) {
          setKnownUsers((prev) => new Map(prev).set(user.id, user));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [canReadUsers, profile.ownerUserId]);

  useEffect(() => {
    if (!isEditing || !canReadUsers || !isUUIDv7(profile.branchId)) return;
    const controller = new AbortController();
    void readOwnerOptions(profile.branchId, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) {
          const filtered = list.filter(
            (u) => allowedOwnerIds === null || allowedOwnerIds.includes(u.id),
          );
          setOwnerOptions(filtered);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [allowedOwnerIds, canReadUsers, isEditing, profile.branchId]);

  useEffect(() => {
    if (!isUUIDv7(profile.id)) return;
    const controller = new AbortController();
    void axiosClient
      .get<unknown>(`${customerProfilePath(profile.id)}/tags`, {
        signal: controller.signal,
        cache: "no-store",
        maxResponseBytes: 256 * 1024,
      })
      .then((res) => {
        if (!controller.signal.aborted && Array.isArray(res.data)) {
          setTags(parseCrmTags(res.data));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [profile.id, profile.updatedAt]);

  const handleOpenTagPicker = useCallback(() => {
    if (!canEdit) return;
    setIsTagPickerOpen((prev) => !prev);
    if (availableTags.length === 0) {
      void axiosClient
        .get<unknown>(CRM_TAGS_PATH, {
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        })
        .then((res) => setAvailableTags(parseCrmTagCatalogue(res.data)))
        .catch(() => undefined);
    }
  }, [availableTags.length, canEdit]);

  const handleAttachTag = useCallback(
    async (tag: CrmTag) => {
      if (!canEdit) return;
      setTags((prev) =>
        prev.some((item) => item.id === tag.id) ? prev : [...prev, tag],
      );
      setIsTagPickerOpen(false);
      if (isUUIDv7(profile.id) && isUUIDv7(tag.id)) {
        try {
          const res = await axiosClient.post<unknown>(
            `${customerProfilePath(profile.id)}/tags`,
            { tagId: tag.id },
            { skipAutoIdempotency: true },
          );
          if (Array.isArray(res.data)) {
            setTags(parseCrmTags(res.data));
          }
        } catch {
          // Keep optimistic tag
        }
      }
    },
    [canEdit, profile.id],
  );

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      if (!canEdit) return;
      setTags((prev) => prev.filter((item) => item.id !== tagId));
      if (isUUIDv7(profile.id) && isUUIDv7(tagId)) {
        try {
          await axiosClient.delete(
            `${customerProfilePath(profile.id)}/tags/${encodeURIComponent(tagId)}`,
            { nonReplayable: true, skipAutoIdempotency: true },
          );
        } catch {
          // Ignore
        }
      }
    },
    [canEdit, profile.id],
  );

  const handleSave = async () => {
    if (!onSaved || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const body: Record<string, unknown> = {
        description: draft.description.trim() || null,
        acquisitionSourceId: draft.acquisitionSourceId || null,
      };
      if (draft.ownerUserId && isUUIDv7(draft.ownerUserId)) {
        body.ownerUserId = draft.ownerUserId;
      }

      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "patch",
        path: customerProfilePath(profile.id),
        body,
        parse: parseCustomerProfileDetailResponse,
        config: { maxResponseBytes: 512 * 1024 },
      });

      if (outcome.kind === "success") {
        onSaved(outcome.value);
        setIsEditing(false);
      } else {
        setErrorMsg(
          outcome.error.message ?? t.crmCustomerProfiles.cardUpdateFailed,
        );
        if (
          outcome.kind === "ambiguous" ||
          outcome.kind === "applied_unreadable"
        ) {
          setIsEditing(false);
          onReconcile?.();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = localizedValue(
    profile.acquisitionSourceNameAr,
    profile.acquisitionSourceNameEn,
    lang,
  );

  const ownerUser = profile.ownerUserId
    ? knownUsers.get(profile.ownerUserId) ??
      (actor?.id === profile.ownerUserId
        ? {
            id: actor.id,
            firstName: actor.firstName,
            lastName: actor.lastName,
          }
        : undefined)
    : undefined;
  const ownerDisplay = ownerUser
    ? [ownerUser.firstName, ownerUser.lastName].filter(Boolean).join(" ")
    : profile.ownerUserId || unavailable;

  const createdDate = formatDate(profile.createdAt, lang);
  const updatedDate = formatDate(profile.updatedAt, lang);

  const unattachedTags = availableTags.filter(
    (candidate) => !tags.some((attached) => attached.id === candidate.id),
  );

  const activeSources = sources.filter(
    (s) => s.isActive || s.id === profile.acquisitionSourceId,
  );

  return (
    <section
      aria-label={detail.detailsTitle}
      className="dossier-card dossier-card-violet"
    >
      <div className="dossier-card-header">
        <div className="dossier-card-title-group">
          <div className="dossier-card-icon">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="dossier-card-title">{detail.detailsTitle}</h3>
            <p className="dossier-card-subtitle">
              {isAr
                ? "المسؤول ومصدر الاستقطاب والوسوم والملاحظات العامة"
                : "Ownership, acquisition source, tags & account notes"}
            </p>
          </div>
        </div>

        {canEdit && onSaved && !isEditing && (
          <button
            type="button"
            onClick={() => {
              setDraft({
                ownerUserId: profile.ownerUserId ?? "",
                acquisitionSourceId: profile.acquisitionSourceId ?? "",
                description: profile.description ?? "",
              });
              setErrorMsg(null);
              setIsEditing(true);
            }}
            className="dossier-edit-btn"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            <span>{t.crmTags.edit}</span>
          </button>
        )}
      </div>

      <div className="dossier-card-body space-y-4">
        {errorMsg && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
          >
            {errorMsg}
          </p>
        )}

        {isEditing ? (
          <div className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.03] p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {canReadUsers && ownerOptions.length > 0 && (
                <Field label={t.crmLeads.salesperson}>
                  <Select
                    value={draft.ownerUserId || undefined}
                    onValueChange={(value: string) =>
                      setDraft((d) => ({ ...d, ownerUserId: value }))
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder={t.crmLeads.salesperson} />
                    </SelectTrigger>
                    <SelectContent>
                      {ownerOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                            u.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label={t.crmCustomerProfiles.source}>
                <Select
                  value={draft.acquisitionSourceId || NO_SOURCE_VALUE}
                  onValueChange={(value: string) =>
                    setDraft((d) => ({
                      ...d,
                      acquisitionSourceId:
                        value === NO_SOURCE_VALUE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue
                      placeholder={t.crmLeads.create.selectSourcePlaceholder}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SOURCE_VALUE}>
                      {detail.noSource}
                    </SelectItem>
                    {activeSources.map((source) => {
                      const label = localizedName(source, lang);
                      return (
                        <SelectItem key={source.id} value={source.id}>
                          <AcquisitionSourceOption
                            source={source}
                            label={label}
                          />
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={detail.description}>
              <Textarea
                rows={3}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
              />
            </Field>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-2.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <X className="size-3.5" />
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {t.common.save}
              </button>
            </div>
          </div>
        ) : (
          <dl className="dossier-field-grid">
            <div className="dossier-field">
              <dt className="dossier-field-label">
                {t.crmCustomerProfiles.source}
              </dt>
              <dd
                className={cn(
                  "dossier-field-value",
                  !sourceLabel && "dossier-field-empty",
                )}
              >
                {sourceLabel || unavailable}
              </dd>
            </div>

            <div className="dossier-field">
              <dt className="dossier-field-label">{t.crmLeads.salesperson}</dt>
              <dd
                className={cn(
                  "dossier-field-value inline-flex items-center gap-1.5",
                  !profile.ownerUserId && "dossier-field-empty",
                )}
              >
                <User
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate">{ownerDisplay}</span>
              </dd>
            </div>

            <div className="dossier-field">
              <dt className="dossier-field-label">{actions.sourceLead}</dt>
              <dd
                className={cn(
                  "dossier-field-value",
                  !profile.sourceLeadId && "dossier-field-empty",
                )}
              >
                {profile.sourceLeadId ? (
                  <Link
                    href={`/crm/leads/${encodeURIComponent(profile.sourceLeadId)}`}
                    className={cn(
                      "inline-flex items-center gap-1 text-primary hover:underline",
                      focusRing,
                    )}
                  >
                    <span className="truncate font-mono text-xs">
                      {profile.sourceLeadId}
                    </span>
                    <ArrowUpRight
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  unavailable
                )}
              </dd>
            </div>

            <div className="dossier-field">
              <dt className="dossier-field-label">{detail.createdAt}</dt>
              <dd
                className={cn(
                  "dossier-field-value inline-flex items-center gap-1.5",
                  !createdDate && "dossier-field-empty",
                )}
              >
                <Calendar
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{createdDate || unavailable}</span>
              </dd>
            </div>

            <div className="dossier-field">
              <dt className="dossier-field-label">{detail.updatedAt}</dt>
              <dd
                className={cn(
                  "dossier-field-value inline-flex items-center gap-1.5",
                  !updatedDate && "dossier-field-empty",
                )}
              >
                <Calendar
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{updatedDate || unavailable}</span>
              </dd>
            </div>
          </dl>
        )}

        {/* Tags Section */}
        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Tag className="size-3.5" aria-hidden="true" />
              <span>{t.crmLeads.create.tags}</span>
            </span>

            {canEdit && (
              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleOpenTagPicker}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted"
                >
                  <Plus className="size-3" />
                  <span>{isAr ? "إضافة وسم" : "Add Tag"}</span>
                </button>
                {canCreateTag && (
                  <button
                    type="button"
                    onClick={() => setCreateTagOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                  >
                    <Sparkles className="size-3" />
                    <span>{t.crmTags.add}</span>
                  </button>
                )}

                {isTagPickerOpen && (
                  <div className="absolute end-0 top-full z-30 mt-1 max-h-48 w-52 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">
                    {unattachedTags.length === 0 ? (
                      <p className="px-2.5 py-2 text-xs text-muted-foreground">
                        {isAr ? "لا توجد وسوم إضافية" : "No more tags"}
                      </p>
                    ) : (
                      unattachedTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => void handleAttachTag(tag)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium hover:bg-muted"
                        >
                          <span
                            className="size-2.5 rounded-full"
                            style={{
                              backgroundColor: tag.backgroundColor ?? "#6366f1",
                            }}
                          />
                          <span className="truncate">{tag.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <CustomerProfileTagList
                tags={tags}
                moreLabel={t.crmLeads.card.moreTags}
                maxVisible={12}
              />
              {canEdit &&
                tags.map((tag) => (
                  <button
                    key={`rm-${tag.id}`}
                    type="button"
                    onClick={() => void handleRemoveTag(tag.id)}
                    title={`${t.common.delete} ${tag.name}`}
                    className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                  >
                    <span>{tag.name}</span>
                    <X className="size-2.5" />
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{unavailable}</p>
          )}
        </div>

        {/* Description Block */}
        {!isEditing && (
          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <FileText className="size-3.5" aria-hidden="true" />
              <span>{detail.description}</span>
            </div>
            <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs leading-relaxed text-foreground">
              {profile.description || unavailable}
            </p>
          </div>
        )}

        {/* Custom Fields Slot */}
        {customFieldsSlot && (
          <div className="border-t border-border/60 pt-3">
            {customFieldsSlot}
          </div>
        )}
      </div>

      {canCreateTag && (
        <CreateTagModal
          open={createTagOpen}
          initialName=""
          existingTags={availableTags}
          onClose={() => setCreateTagOpen(false)}
          onSuccess={(created) => {
            setAvailableTags((prev) =>
              prev.some((item) => item.id === created.id)
                ? prev
                : [...prev, created],
            );
            void handleAttachTag(created);
            setCreateTagOpen(false);
          }}
        />
      )}
    </section>
  );
}

function formatDate(value: string | null, lang: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
    }).format(parsed);
  } catch {
    return value.slice(0, 10);
  }
}

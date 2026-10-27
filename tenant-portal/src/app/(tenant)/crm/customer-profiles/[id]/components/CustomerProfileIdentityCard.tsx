"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardHeader,
  DOSSIER_TAG_TONE_CLASSES,
  DateTime,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagChip,
  Textarea,
  cn,
  focusRing,
  useToast,
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
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import {
  CRM_TAGS_PATH,
  parseCrmTagCatalogue,
  parseCrmTags,
  type CrmTag,
} from "../../../shared/tag-contract";
import { CreateTagModal } from "../../../leads/components/create-lead/CreateTagModal";
import { readOwnerOptions } from "../../../leads/[id]/hooks/readLeadOwnerOptions";
import {
  leadDetailsInitials,
  leadDetailsUserName,
  parseLeadDetailsUser,
  type LeadDetailsUser,
} from "../../../leads/[id]/lead-details-edit-contract";
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
  const describeError = useCrmErrorText();
  const toast = useToast();
  const detail = t.crmLeadDetail;
  const actions = t.crmCustomerProfileActions;
  const { user: actor } = useTenantAuth();

  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  const canReadTags =
    actor?.isTenantOwner === true ||
    (actor?.permissions.includes("crm.tags.read") ?? false);
  const canCreateTag =
    actor?.isTenantOwner === true ||
    (actor?.permissions.includes("crm.tags.manage") ?? false);

  const editable = Boolean(canEdit && onSaved);
  const [isEditing, setIsEditing] = useState(!viewModeByDefault && editable);
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
  const tagWritePending = useRef(false);
  const [availableTags, setAvailableTags] = useState<CrmTag[]>([]);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);

  useEffect(() => {
    if (
      !canReadUsers ||
      !profile.ownerUserId ||
      !isUUIDv7(profile.ownerUserId)
    ) {
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
    if (!canEdit || !canReadTags) return;
    setIsTagPickerOpen((prev) => !prev);
    if (availableTags.length === 0) {
      void axiosClient
        .get<unknown>(CRM_TAGS_PATH, {
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        })
        .then((res) => setAvailableTags(parseCrmTagCatalogue(res.data)))
        .catch(() => {
          setIsTagPickerOpen(false);
          toast.error(t.crmTags.loadFailed);
        });
    }
  }, [availableTags.length, canEdit, canReadTags, t.crmTags.loadFailed, toast]);

  const handleAttachTag = useCallback(
    async (tag: CrmTag) => {
      if (!canEdit || tagWritePending.current) return;
      if (!isUUIDv7(profile.id) || !isUUIDv7(tag.id)) {
        toast.error(t.crmTags.errors.saveFailed);
        return;
      }
      const previousTags = tags;
      if (previousTags.some((item) => item.id === tag.id)) return;
      tagWritePending.current = true;
      setTags([...previousTags, tag]);
      setIsTagPickerOpen(false);
      try {
        const res = await axiosClient.post<unknown>(
          `${customerProfilePath(profile.id)}/tags`,
          { tagIds: [tag.id] },
          { skipAutoIdempotency: true },
        );
        if (!Array.isArray(res.data)) throw new Error("INVALID_CRM_TAGS_RESPONSE");
        setTags(parseCrmTags(res.data));
      } catch {
        setTags(previousTags);
        toast.error(t.crmTags.errors.saveFailed);
      } finally {
        tagWritePending.current = false;
      }
    },
    [canEdit, profile.id, tags, t, toast],
  );

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      if (!canEdit || tagWritePending.current) return;
      if (!isUUIDv7(profile.id) || !isUUIDv7(tagId)) {
        toast.error(t.crmTags.errors.saveFailed);
        return;
      }
      const previousTags = tags;
      tagWritePending.current = true;
      setTags(previousTags.filter((item) => item.id !== tagId));
      try {
        await axiosClient.delete(
          `${customerProfilePath(profile.id)}/tags/${encodeURIComponent(tagId)}`,
          { nonReplayable: true, skipAutoIdempotency: true },
        );
      } catch {
        setTags(previousTags);
        toast.error(t.crmTags.errors.saveFailed);
      } finally {
        tagWritePending.current = false;
      }
    },
    [canEdit, profile.id, tags, t, toast],
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
          describeError(outcome.error) ?? t.crmCustomerProfiles.cardUpdateFailed,
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

  const selectedSourceId =
    (isEditing ? draft.acquisitionSourceId : profile.acquisitionSourceId) ?? "";
  const selectedSource = sources.find(({ id }) => id === selectedSourceId);
  const sourceLabel = selectedSource
    ? localizedValue(selectedSource.nameAr, selectedSource.nameEn, lang)
    : localizedValue(
        profile.acquisitionSourceNameAr,
        profile.acquisitionSourceNameEn,
        lang,
      );

  const ownerId = (isEditing ? draft.ownerUserId : profile.ownerUserId) ?? "";
  const ownerUser = ownerId
    ? knownUsers.get(ownerId) ??
      (actor?.id === ownerId
        ? {
            id: actor.id,
            firstName: actor.firstName,
            lastName: actor.lastName,
          }
        : undefined)
    : undefined;
  const ownerName = leadDetailsUserName(ownerUser);

  const unattachedTags = availableTags.filter(
    (candidate) => !tags.some((attached) => attached.id === candidate.id),
  );

  const activeSources = sources.filter(
    (s) => s.isActive || s.id === profile.acquisitionSourceId,
  );

  return (
    <Card
      aria-label={detail.detailsTitle}
      className={cn(
        "dossier-card dossier-card-violet",
        isEditing && viewModeByDefault && "dossier-card-editing-violet",
      )}
    >
      <CardHeader
        className={cn(
          "dossier-card-head flex-row items-center justify-between gap-2",
          isEditing && viewModeByDefault && "dossier-card-header-editing-violet",
        )}
      >
        <div className="dossier-card-title">
          <span
            className="dossier-icon-pill dossier-ip-violet"
            aria-hidden="true"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-xs font-semibold tracking-wider uppercase">
            {detail.detailsTitle}
          </h2>
        </div>

        {editable ? (
          isEditing ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="dossier-btn-cancel"
                aria-label={t.common.cancel}
                title={t.common.cancel}
                disabled={saving}
                onClick={() => {
                  setIsEditing(false);
                  setErrorMsg(null);
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>{t.common.cancel}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="dossier-btn-save"
                aria-label={detail.saveDetails}
                title={detail.saveDetails}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="size-3.5" aria-hidden="true" />
                )}
                <span>{detail.saveDetails}</span>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="dossier-btn-action dossier-btn-action-violet"
              aria-label={t.crmTags.edit}
              title={t.crmTags.edit}
              onClick={() => {
                setDraft({
                  ownerUserId: profile.ownerUserId ?? "",
                  acquisitionSourceId: profile.acquisitionSourceId ?? "",
                  description: profile.description ?? "",
                });
                setErrorMsg(null);
                setIsEditing(true);
              }}
            >
              <Pencil className="size-3" aria-hidden="true" />
              <span>{t.crmTags.edit}</span>
            </Button>
          )
        ) : (
          <span className="dossier-badge dossier-badge-converted">
            🔒 {t.crmCustomerProfiles.ui.identity.readOnly}
          </span>
        )}
      </CardHeader>

      <CardContent className="dossier-card-body">
        {errorMsg && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
          >
            {errorMsg}
          </p>
        )}

        <dl className="grid gap-2 sm:grid-cols-2">
          <DetailsValue label={detail.salesPerson}>
            {!isEditing ? (
              <DetailsIdentity
                name={
                  ownerName ||
                  (ownerId ? detail.userNameUnavailable : t.detail.notRecorded)
                }
                initialsName={ownerName}
              />
            ) : (
              <Field label={detail.salesPerson}>
                <Select
                  value={ownerId || undefined}
                  onValueChange={(value: string) =>
                    setDraft((d) => ({ ...d, ownerUserId: value }))
                  }
                  disabled={saving || !canReadUsers || ownerOptions.length === 0}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder={t.detail.notRecorded}>
                      <DetailsIdentity
                        name={
                          ownerName ||
                          (ownerId
                            ? detail.userNameUnavailable
                            : t.detail.notRecorded)
                        }
                        initialsName={ownerName}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ownerId &&
                      !ownerOptions.some(({ id }) => id === ownerId) && (
                        <SelectItem value={ownerId} disabled>
                          <DetailsIdentity
                            name={ownerName || detail.userNameUnavailable}
                            initialsName={ownerName}
                          />
                        </SelectItem>
                      )}
                    {ownerOptions.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <DetailsIdentity
                          name={
                            leadDetailsUserName(user) ||
                            detail.userNameUnavailable
                          }
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </DetailsValue>

          <DetailsValue label={t.crmLeads.source}>
            {isEditing ? (
              <Field label={t.crmLeads.source}>
                <Select
                  value={draft.acquisitionSourceId || NO_SOURCE_VALUE}
                  onValueChange={(value: string) =>
                    setDraft((d) => ({
                      ...d,
                      acquisitionSourceId:
                        value === NO_SOURCE_VALUE ? "" : value,
                    }))
                  }
                  disabled={saving}
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
            ) : (
              <DetailsIdentity
                name={sourceLabel || detail.noSource}
                image={selectedSource?.iconUrl}
              />
            )}
          </DetailsValue>

          <DetailsValue label={actions.sourceLead}>
            {profile.sourceLeadId ? (
              <Link
                href={`/crm/leads/${encodeURIComponent(profile.sourceLeadId)}`}
                className={cn(
                  "inline-flex min-h-6 items-center gap-1 font-semibold text-primary hover:underline",
                  focusRing,
                )}
              >
                <span dir="ltr" className="truncate font-mono text-xs tabular-nums">
                  {profile.sourceLeadId}
                </span>
                <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
              </Link>
            ) : (
              <span className="flex min-h-6 items-center font-medium text-muted-foreground">
                {t.detail.notRecorded}
              </span>
            )}
          </DetailsValue>

          <DetailsValue label={detail.createdAt}>
            <DateTime value={profile.createdAt} precision="datetime" />
          </DetailsValue>

          <DetailsValue label={detail.updatedAt} wide>
            <DateTime value={profile.updatedAt} precision="datetime" />
          </DetailsValue>

          <DetailsValue label={detail.notes} wide>
            {!isEditing ? (
              <div className="min-h-6 text-xs font-semibold text-foreground">
                {(profile.description ?? "").trim().length > 0 ? (
                  <span className="whitespace-pre-wrap break-words">
                    {profile.description}
                  </span>
                ) : (
                  <span className="font-medium text-muted-foreground">
                    {t.detail.notRecorded}
                  </span>
                )}
              </div>
            ) : (
              <Field label={detail.notes}>
                <Textarea
                  placeholder={detail.notes}
                  size="sm"
                  rows={2}
                  value={draft.description}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                />
              </Field>
            )}
          </DetailsValue>

          <DetailsValue label={detail.tags} wide>
            <div className="flex flex-col gap-2">
              <div className="dossier-tags">
                {tags.length > 0 ? (
                  <ul className="flex min-h-6 flex-wrap items-center gap-1.5">
                    {tags.map((tag, idx) => {
                      const toneClass =
                        DOSSIER_TAG_TONE_CLASSES[
                          idx % DOSSIER_TAG_TONE_CLASSES.length
                        ];
                      return (
                        <li
                          key={tag.id}
                          className="flex min-w-0 max-w-full items-center"
                        >
                          {tag.backgroundColor || tag.textColor ? (
                            <span className="inline-flex items-center gap-1">
                              <TagChip
                                label={tag.name}
                                backgroundColor={tag.backgroundColor}
                                textColor={tag.textColor}
                              />
                              {canEdit && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  aria-label={`Remove tag ${tag.name}`}
                                  onClick={() => void handleRemoveTag(tag.id)}
                                  className="h-auto rounded px-1 py-0 text-xs font-semibold text-muted-foreground hover:text-destructive"
                                >
                                  ×
                                </Button>
                              )}
                            </span>
                          ) : (
                            <span className={toneClass}>
                              <span>{tag.name}</span>
                              {canEdit && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  aria-label={`Remove tag ${tag.name}`}
                                  onClick={() => void handleRemoveTag(tag.id)}
                                  className="ms-1 h-auto border-0 bg-transparent p-0 font-semibold opacity-75 hover:opacity-100"
                                >
                                  ×
                                </Button>
                              )}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {detail.noTags}
                  </span>
                )}

                {canEdit && (
                  <>
                    {canReadTags && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={handleOpenTagPicker}
                        className="dossier-tag dossier-tag-add"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        <span>{t.crmCustomerProfiles.ui.identity.attachTag}</span>
                      </Button>
                    )}
                    {canCreateTag && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setCreateTagOpen(true)}
                        className="dossier-tag dossier-tag-add"
                      >
                        <Sparkles className="size-3" aria-hidden="true" />
                        <span>{t.crmTags.add}</span>
                      </Button>
                    )}
                  </>
                )}
              </div>

              {canEdit && canReadTags && isTagPickerOpen && unattachedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-swatch-purple-soft bg-swatch-purple-soft p-2">
                  {unattachedTags.map((tag) => (
                    <Button
                      key={tag.id}
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => void handleAttachTag(tag)}
                      className="dossier-tag dossier-tag-indigo"
                    >
                      + {tag.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </DetailsValue>
        </dl>

        {customFieldsSlot && (
          <div className="dossier-custom-fields-section mt-3">
            {customFieldsSlot}
          </div>
        )}
      </CardContent>

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
    </Card>
  );
}

function DetailsValue({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "dossier-field-box flex min-w-0 flex-col gap-1",
        wide && "sm:col-span-2",
      )}
    >
      <dt className="dossier-field-label text-xs font-semibold text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-xs">{children}</dd>
    </div>
  );
}

function DetailsIdentity({
  name,
  image,
  initialsName = name,
}: {
  name: string;
  image?: string | null;
  initialsName?: string;
}) {
  const initials = leadDetailsInitials(initialsName);
  return (
    <span className="flex min-h-6 min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
      <Avatar className="size-6" aria-hidden="true">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback>
          {initials || <UserRound className="size-3.5" aria-hidden="true" />}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}


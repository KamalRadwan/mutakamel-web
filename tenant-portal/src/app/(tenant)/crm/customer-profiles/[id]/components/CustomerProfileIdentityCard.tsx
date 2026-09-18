"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  CopyButton,
  DateTime,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import type { CustomerProfileDetail } from "../../customer-profile-contract";

export interface CustomerProfileIdentityCardProps {
  profile: CustomerProfileDetail;
  sources: AcquisitionSource[];
}

export function CustomerProfileIdentityCard({
  profile,
  sources,
}: CustomerProfileIdentityCardProps) {
  const { t, lang } = useI18n();

  const userIds = profile.ownerUserId ? [profile.ownerUserId] : [];
  const { profiles } = useUserProfiles(userIds, userIds.length > 0);
  const ownerResult = profile.ownerUserId
    ? profiles.get(profile.ownerUserId)
    : null;
  const ownerName =
    ownerResult?.status === "ready" && ownerResult.profile
      ? ownerResult.profile.fullName
      : profile.ownerUserId
        ? t.crmLeadDetail.userNameUnavailable
        : t.detail.notRecorded;

  const selectedSource = sources.find(
    ({ id }) => id === profile.acquisitionSourceId,
  );
  const sourceName = selectedSource
    ? localizedValue(selectedSource.nameAr, selectedSource.nameEn, lang)
    : localizedValue(
        profile.acquisitionSourceNameAr,
        profile.acquisitionSourceNameEn,
        lang,
      );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 p-2">
        <h2 className="text-sm font-semibold">{t.crmLeadDetail.detailsTitle}</h2>
      </CardHeader>
      <CardContent className="p-2">
        <dl className="grid gap-2 sm:grid-cols-2">
          <DetailsValue label={t.crmLeads.source}>
            <DetailsIdentity
              name={sourceName || t.crmLeadDetail.noSource}
              image={selectedSource?.iconUrl}
            />
          </DetailsValue>

          <DetailsValue label={t.crmLeadDetail.salesPerson}>
            <DetailsIdentity
              name={ownerName}
              image={
                ownerResult?.status === "ready"
                  ? ownerResult.profile?.imageUrl
                  : null
              }
              initialsName={ownerName}
            />
          </DetailsValue>

          <DetailsValue label={t.crmCustomerProfiles.type}>
            <span className="text-xs font-medium">
              {t.crmCustomerProfiles.profileTypes[profile.profileType]}
            </span>
          </DetailsValue>

          {profile.sourceLeadId && (
            <DetailsValue label={t.crmCustomerProfileActions.sourceLead}>
              <Link
                href={`/crm/leads/${profile.sourceLeadId}`}
                className="font-mono text-xs text-primary underline hover:text-primary/80"
                dir="ltr"
              >
                {profile.sourceLeadId.slice(0, 8)}…
              </Link>
            </DetailsValue>
          )}

          <DetailsValue label={t.crmLeadDetail.createdAt}>
            <DateTime value={profile.createdAt} precision="datetime" />
          </DetailsValue>

          <DetailsValue label={t.crmLeadDetail.updatedAt}>
            <DateTime value={profile.updatedAt} precision="datetime" />
          </DetailsValue>

          <DetailsValue label={t.crmCustomerProfiles.profileId} wide>
            <span className="flex items-center gap-1">
              <span className="font-mono text-xs wrap-anywhere" dir="ltr">
                {profile.id}
              </span>
              <CopyButton
                value={profile.id}
                copyLabel={t.crmShared.copyId}
                copiedLabel={t.crmShared.copied}
                failedLabel={t.crmShared.copyFailed}
              />
            </span>
          </DetailsValue>

          {profile.description && (
            <DetailsValue label={t.crmLeadDetail.notes} wide>
              <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-foreground">
                {profile.description}
              </p>
            </DetailsValue>
          )}
        </dl>
      </CardContent>
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
        "flex min-w-0 flex-col gap-1",
        wide && "sm:col-span-2",
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
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
  const initials = initialsName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span className="flex min-h-6 min-w-0 items-center gap-1.5 text-xs">
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

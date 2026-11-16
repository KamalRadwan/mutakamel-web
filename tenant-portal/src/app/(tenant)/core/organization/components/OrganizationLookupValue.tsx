"use client";

import Link from "next/link";
import { IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { UserContactProfile } from "@/lib/people/user-profile";
import type { ResolvedLookup } from "../hooks/useOrgLookupResolver";

interface OrgParentLookupValueProps<T extends { id: string; name: string; code: string }> {
  lookup: ResolvedLookup<T> | null;
  baseHref?: string;
  showCode?: boolean;
  onNavigate?: () => void;
}

export function OrgParentLookupValue<T extends { id: string; name: string; code: string }>({
  lookup,
  baseHref,
  showCode = false,
  onNavigate,
}: OrgParentLookupValueProps<T>) {
  const { t } = useI18n();
  if (!lookup || lookup.status === "forbidden" || lookup.status === "unavailable") {
    return <span className="text-muted-foreground">{t.coreIdentity.grants.nameUnavailable}</span>;
  }
  if (lookup.status !== "ready") {
    return <span className="text-muted-foreground">{t.common.loading}</span>;
  }
  const resolved = lookup.value;
  const content = (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-sans text-caption font-normal text-foreground">{resolved.name}</span>
      {showCode ? (
        <IdentifierText className="text-2xs text-muted-foreground">
          {resolved.code}
        </IdentifierText>
      ) : null}
    </span>
  );
  if (!baseHref) return content;
  return (
    <Link
      href={`${baseHref}/${resolved.id}`}
      onClick={onNavigate}
      className="inline-flex items-center gap-1.5 hover:underline"
    >
      {content}
    </Link>
  );
}

interface OrgLeadUserValueProps {
  leadUserId: string | null | undefined;
  lookup: ResolvedLookup<UserContactProfile> | null;
  showEmail?: boolean;
  emptyLabel?: string;
}

export function OrgLeadUserValue({
  leadUserId,
  lookup,
  showEmail = false,
  emptyLabel,
}: OrgLeadUserValueProps) {
  const { t } = useI18n();
  if (!leadUserId) {
    return <span className="text-muted-foreground">{emptyLabel ?? t.detail.notRecorded}</span>;
  }
  if (!lookup || lookup.status === "forbidden" || lookup.status === "unavailable") {
    return <span className="text-muted-foreground">{t.coreIdentity.grants.nameUnavailable}</span>;
  }
  if (lookup.status !== "ready") {
    return <span className="text-muted-foreground">{t.common.loading}</span>;
  }
  const resolved = lookup.value;
  if (!showEmail) {
    return <span className="text-foreground">{resolved.fullName}</span>;
  }
  return (
    <span className="flex flex-col">
      <span className="font-medium text-foreground">{resolved.fullName}</span>
      <span dir="ltr" className="text-2xs text-muted-foreground">
        {resolved.email}
      </span>
    </span>
  );
}

"use client";

import { PersonProfileLink, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { USER_PROFILE_READ_PERMISSION, type UserProfileResult } from "@/lib/people/user-profile";

/** Contact-only user presentation; pair with useUserProfiles for name resolution. */
export function UserProfileLink({ result, previous, onRetry }: {
  result?: UserProfileResult;
  previous?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  const copy = t.personProfile;
  const status = result?.status ?? "unavailable";
  const person = result?.profile ?? { fullName: status === "loading" ? copy.loading : copy.nameUnavailable };
  return <PersonProfileLink person={person} previous={previous} loading={status === "loading"} placeholder={status !== "ready"}
    notice={status === "forbidden" ? <PermissionGate require={USER_PROFILE_READ_PERMISSION} denied><span /></PermissionGate>
      : status === "error" ? copy.loadFailed : status === "unavailable" ? copy.detailsUnavailable : undefined}
    onRetry={status === "error" ? onRetry : undefined}
    labels={{ open: formatTemplate(copy.open, { name: person.fullName }), description: copy.description,
      phone: copy.phone, email: copy.email, unavailable: copy.unavailable, close: t.common.close, retry: t.common.retry }} />;
}

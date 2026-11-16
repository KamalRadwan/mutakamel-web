"use client";

import { useMemo } from "react";
import { useCan, type DeletionBlocker } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import type { OrgLevelConfig } from "../level-config";

/**
 * Maps a server-authored `details.blockers` phrase from `OrganizationService.notEmpty()`
 * to the child workspace route where the blocking items can be inspected, gated by
 * the signed-in user's read permissions. The phrase itself stays verbatim.
 */
function resolveBlockerHref(
  phrase: string,
  config: OrgLevelConfig,
  permissions: {
    canReadBranches: boolean;
    canReadDepartments: boolean;
    canReadTeams: boolean;
    canReadUsers: boolean;
  },
): string | undefined {
  const lower = phrase.toLowerCase();
  if ((lower.includes("user") || lower.includes("member")) && permissions.canReadUsers) {
    return TENANT_ROUTES.coreUsers;
  }
  if (lower.includes("branch") && permissions.canReadBranches) {
    return TENANT_ROUTES.coreBranches;
  }
  if (lower.includes("department") && permissions.canReadDepartments) {
    return TENANT_ROUTES.coreDepartments;
  }
  if (lower.includes("team") && permissions.canReadTeams) {
    return TENANT_ROUTES.coreTeams;
  }
  const fallbackAllowed =
    (config.childDestination.kind === "branches" && permissions.canReadBranches) ||
    (config.childDestination.kind === "departments" && permissions.canReadDepartments) ||
    (config.childDestination.kind === "teams" && permissions.canReadTeams) ||
    (config.childDestination.kind === "users" && permissions.canReadUsers);
  return fallbackAllowed ? config.childDestination.href : undefined;
}

export function useOrganizationDeleteDialogs(
  config: OrgLevelConfig,
  blockers: readonly string[],
  hqTransferError: NormalizedApiError | null,
) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();

  const canReadBranches = useCan("org.branch.read");
  const canReadDepartments = useCan("org.department.read");
  const canReadTeams = useCan("org.team.read");
  const canReadUsers = useCan("users.user.read");

  const blockerItems = useMemo<DeletionBlocker[]>(() => {
    const phrases = blockers.length > 0 ? blockers : [copy.errors.ORG_NODE_NOT_EMPTY];
    return phrases.map((phrase, index) => ({
      id: `${index}:${phrase}`,
      label: phrase,
      href: resolveBlockerHref(phrase, config, {
        canReadBranches,
        canReadDepartments,
        canReadTeams,
        canReadUsers,
      }),
    }));
  }, [
    blockers,
    canReadBranches,
    canReadDepartments,
    canReadTeams,
    canReadUsers,
    config,
    copy.errors.ORG_NODE_NOT_EMPTY,
  ]);

  const hqMessage = describeError(hqTransferError) ?? copy.errors.ORG_HQ_TRANSFER_REQUIRED;

  return { t, copy, blockerItems, hqMessage };
}

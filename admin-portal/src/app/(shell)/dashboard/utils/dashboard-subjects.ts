import type { DashboardGroupKey, DashboardResponse } from "@/types/dashboard";
import { getAuthorizedDashboardGroupKeys } from "./dashboard-groups";

/**
 * The dashboard's fourteen reports, gathered into the five subjects an
 * operator actually thinks in.
 *
 * Fourteen tabs meant a horizontally scrolling strip where the last few were
 * off-screen, and — worse — it split questions that are one question. A
 * subscription becomes an invoice becomes a payment becomes a wallet
 * movement; following one payment meant visiting four tabs and holding the
 * numbers in your head. A tenant, its hostname and how it was provisioned are
 * one lifecycle. Grouping the *menu* would have tidied the strip and left
 * that split in place, so the reports are gathered onto one page instead.
 *
 * Nothing here changes what anyone may see. Permissions stay per report, a
 * subject appears only when the actor may see at least one report inside it,
 * and a subject shows only the reports they are actually authorized for.
 */
export type DashboardSubjectKey =
  | "tenants"
  | "revenue"
  | "infrastructure"
  | "platform"
  | "trust";

export type DashboardTabKey = "overview" | DashboardSubjectKey;

export const DASHBOARD_SUBJECTS: Record<
  DashboardSubjectKey,
  readonly DashboardGroupKey[]
> = {
  // A tenant, the hostname it answers on, and how it was brought up.
  tenants: ["tenants", "domains", "provisioning"],
  // One pipeline: subscription → invoice → payment → wallet movement.
  revenue: ["subscriptions", "billing", "payments", "wallets"],
  // Where tenant data physically lives, and whether there is room for more.
  infrastructure: ["database", "storage"],
  // What the platform offers, what it sends, and what it serves.
  platform: ["catalogue", "notifications", "usage"],
  // The posture, and the record that evidences it.
  trust: ["security", "audit"],
};

export const DASHBOARD_SUBJECT_KEYS = Object.keys(
  DASHBOARD_SUBJECTS,
) as DashboardSubjectKey[];

/** Which subject a report belongs to, for deep links and restored state. */
export function subjectForGroup(
  group: DashboardGroupKey,
): DashboardSubjectKey | undefined {
  return DASHBOARD_SUBJECT_KEYS.find((subject) =>
    DASHBOARD_SUBJECTS[subject].includes(group),
  );
}

/**
 * The reports inside a subject that this actor may see, in the declared
 * order — which is the order of the story, not alphabetical.
 */
export function authorizedGroupsInSubject(
  response: DashboardResponse | null,
  subject: DashboardSubjectKey,
): DashboardGroupKey[] {
  if (!response) return [];
  const authorized = new Set(getAuthorizedDashboardGroupKeys(response));
  return DASHBOARD_SUBJECTS[subject].filter((group) => authorized.has(group));
}

/** Subjects holding at least one report this actor may see. */
export function authorizedSubjects(
  response: DashboardResponse | null,
): DashboardSubjectKey[] {
  if (!response) return [];
  return DASHBOARD_SUBJECT_KEYS.filter(
    (subject) => authorizedGroupsInSubject(response, subject).length > 0,
  );
}

/**
 * The reports to fetch for a tab. Overview asks for everything, because its
 * charts read across every group; a subject asks only for its own.
 */
export function requestedGroupsForTab(
  tab: DashboardTabKey,
  response: DashboardResponse | null,
): DashboardGroupKey[] {
  if (tab === "overview") return [];
  return authorizedGroupsInSubject(response, tab);
}

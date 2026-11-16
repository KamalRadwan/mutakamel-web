import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

function collectShape(node: unknown, prefix = ""): Map<string, string> {
  const leaves = new Map<string, string>();
  if (typeof node === "string") {
    leaves.set(prefix, node);
    return leaves;
  }
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      for (const [leafKey, leafValue] of collectShape(value, next)) {
        leaves.set(leafKey, leafValue);
      }
    }
  }
  return leaves;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/gu)].map((match) => match[1]).sort();
}

describe("coreIdentity bilingual copy parity and truth", () => {
  const arLeaves = collectShape(ar.coreIdentity);
  const enLeaves = collectShape(en.coreIdentity);

  it("keeps identical nested key shapes across ar.coreIdentity and en.coreIdentity", () => {
    expect([...enLeaves.keys()].sort()).toEqual([...arLeaves.keys()].sort());
  });

  it("has non-empty trimmed strings and matching interpolation placeholders on every key", () => {
    for (const [path, arValue] of arLeaves.entries()) {
      const enValue = enLeaves.get(path);
      expect(enValue, `missing en.coreIdentity.${path}`).toBeDefined();
      if (enValue === undefined) {
        continue;
      }
      expect(arValue.trim().length, `empty ar.coreIdentity.${path}`).toBeGreaterThan(0);
      expect(enValue.trim().length, `empty en.coreIdentity.${path}`).toBeGreaterThan(0);
      expect(
        placeholders(enValue),
        `placeholder mismatch at coreIdentity.${path}`,
      ).toEqual(placeholders(arValue));
    }
  });

  it("publishes all shared cascade, action, and user lifecycle keys required by parallel lanes", () => {
    const requiredCascadeKeys = [
      "company",
      "branch",
      "department",
      "team",
      "autoSelected",
      "singleOption",
      "noOptions",
      "chooseCompanyFirst",
      "chooseBranchFirst",
      "chooseDepartmentFirst",
      "loadFailed",
      "retry",
    ] as const;
    for (const key of requiredCascadeKeys) {
      expect(en.coreIdentity.cascade[key]).toBeTruthy();
      expect(ar.coreIdentity.cascade[key]).toBeTruthy();
    }

    const requiredActionKeys = ["view", "edit", "close", "delete", "refresh"] as const;
    for (const key of requiredActionKeys) {
      expect(en.coreIdentity.actions[key]).toBeTruthy();
      expect(ar.coreIdentity.actions[key]).toBeTruthy();
    }

    const requiredUserKeys = [
      "resendInvite",
      "resendInviteTitle",
      "resendInviteDescription",
      "inviteQueued",
      "inviteQueuedDescription",
      "revokeSessions",
      "revokeSessionsTitle",
      "revokeSessionsDescription",
    ] as const;
    for (const key of requiredUserKeys) {
      expect(en.coreIdentity.users[key]).toBeTruthy();
      expect(ar.coreIdentity.users[key]).toBeTruthy();
    }
  });

  it("removes stale resend/placement/status-transition claims in both English and Arabic", () => {
    expect(en.coreIdentity.users.inviteLifecycleNote.toLowerCase()).not.toContain(
      "no resend route",
    );
    expect(ar.coreIdentity.users.inviteLifecycleNote).not.toContain(
      "لا يوجد مسار لإعادة الإرسال",
    );

    expect(en.coreIdentity.users.branchHint.toLowerCase()).not.toContain(
      "determines which records this user can reach",
    );
    expect(ar.coreIdentity.users.branchHint).not.toContain(
      "يحدد الفرع السجلات التي يمكن لهذا المستخدم الوصول إليها",
    );

    expect(en.coreIdentity.detail.placementDescription.toLowerCase()).not.toContain(
      "foreign keys",
    );

    expect(en.coreIdentity.errors.INVALID_STATUS_TRANSITION.toLowerCase()).not.toBe(
      "only a suspended user can be reactivated.",
    );

    expect(en.coreIdentity.errors.ORG_PARENT_INACTIVE.toLowerCase()).not.toBe(
      "the parent is inactive, so nothing can be created under it.",
    );
    expect(en.coreIdentity.errors.ORG_PARENT_INACTIVE.toLowerCase()).toContain(
      "activating",
    );
    expect(ar.coreIdentity.errors.ORG_PARENT_INACTIVE).toContain("تفعيل");
  });

  it("covers all source-verified Core Identity, Organization, Role, Scope-Role, and Module error codes in both languages", () => {
    const domainErrorCodes = [
      "ORG_NODE_NOT_EMPTY",
      "TENANT_WIDE_PERMISSION_REQUIRED",
      "TENANT_ACCESS_REQUIRED",
      "COMPANY_PERMISSION_DENIED",
      "BRANCH_PERMISSION_DENIED",
      "MISSING_REQUIRED_PERMISSIONS",
      "TARGET_AUTHORITY_EXCEEDS_ACTOR",
      "ORG_CODE_TAKEN",
      "ORG_HQ_EXISTS",
      "ORG_HQ_TRANSFER_REQUIRED",
      "ORG_PARENT_INACTIVE",
      "ORG_NODE_NOT_FOUND",
      "ORG_BRANCH_SCOPE_STALE",
      "ORG_NODE_SCOPE_STALE",
      "ORG_TREE_TOO_LARGE",
      "CURRENCY_NOT_ENABLED",
      "ORG_LEAD_USER_NOT_FOUND",
      "ORG_LEAD_BRANCH_REQUIRED",
      "ORG_LEAD_CHANGE_CONFLICT",
      "USER_LIMIT_REACHED",
      "SEAT_LIMIT_REACHED",
      "MODULE_NOT_SUBSCRIBED",
      "MODULE_NOT_FOUND",
      "SUBSCRIPTION_NOT_FOUND",
      "ADDON_ASSIGNMENTS_EXIST",
      "APPLICATION_ALLOWANCE_NOT_READY",
      "APPLICATION_ALLOWANCE_STALE",
      "APPLICATION_ALLOWANCE_UNAVAILABLE",
      "TENANT_USER_ASSIGNMENTS_CHANGED",
      "USER_SELF_FORBIDDEN",
      "TENANT_OWNER_PROTECTED",
      "TENANT_USER_NOT_FOUND",
      "TENANT_USER_CHANGED",
      "TENANT_EMAIL_TAKEN",
      "INVITE_EMAIL_UNDELIVERABLE",
      "EMPLOYEE_CODE_TAKEN",
      "PLACEMENT_INCONSISTENT",
      "MANAGER_CYCLE",
      "MANAGER_NOT_FOUND",
      "INVALID_STATUS_TRANSITION",
      "PRIMARY_TEAM_MEMBERSHIP_PROTECTED",
      "TEAM_MEMBERSHIP_NOT_FOUND",
      "TEAM_MEMBERSHIP_ALREADY_EXISTS",
      "TEAM_MEMBERSHIP_PRIMARY_CONFLICT",
      "TEAM_MEMBERSHIP_LIMIT_EXCEEDED",
      "TENANT_USER_TEAM_QUERY_INVALID",
      "BRANCH_ACCESS_DENIED",
      "ROLE_NOT_FOUND",
      "ROLE_IS_SYSTEM",
      "ROLE_IN_USE",
      "ROLE_NAME_TAKEN",
      "ROLE_NAME_RESERVED",
      "ROLE_RESERVED_FOR_OWNER",
      "ROLE_SELF_ASSIGNMENT_FORBIDDEN",
      "ROLE_PRIVILEGE_ESCALATION",
      "ROLE_PERMISSION_AUTHORITY_EXCEEDED",
      "ROLE_PERMISSION_GRANT_DENIED",
      "ROLE_PERMISSION_GRANT_REQUEST_INVALID",
      "PERMISSION_UNKNOWN",
      "ACTOR_NOT_FOUND",
      "ASSIGNMENT_EXISTS",
      "ASSIGNMENT_NOT_FOUND",
      "BRANCH_OR_ROLE_INVALID",
      "ROLE_ASSIGNMENT_LABELS_LIMIT_EXCEEDED",
      "TENANT_ROLE_ASSIGNMENT_LIMIT_EXCEEDED",
      "TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED",
      "SCOPE_ROLE_ASSIGNMENT_OWNER_REQUIRED",
      "SCOPE_ROLE_ASSIGNMENT_LIMIT_EXCEEDED",
      "SCOPE_ROLE_ASSIGNMENT_CONFLICT",
      "SCOPE_ROLE_ASSIGNMENT_INVALID",
      "PERMISSION_SCOPE_UNAVAILABLE",
      "TENANT_PERMISSION_SCOPE_UNAVAILABLE",
      "PERMISSION_SCOPE_AUTHORITY_INCONSISTENT",
      "ACCESS_POLICY_UNAVAILABLE",
      "ACCESS_POLICY_BLOCKED",
      "PROFILE_EXTENSIONS_TOO_LARGE",
      "TENANT_INACTIVE",
      "TENANT_CONTEXT_MISSING",
      "WEAK_PASSWORD",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "VALIDATION_FAILED",
      "REQUEST_TIMEOUT",
      "OFFLINE",
      "UNKNOWN",
    ] as const;

    for (const code of domainErrorCodes) {
      expect(en.coreIdentity.errors[code], `missing en.coreIdentity.errors.${code}`).toBeTruthy();
      expect(ar.coreIdentity.errors[code], `missing ar.coreIdentity.errors.${code}`).toBeTruthy();
    }
  });
});

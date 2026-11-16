// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const languageMock = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => languageMock }));

import { MIGRATION_PRECONDITION_CODES } from "../model/migration-errors";
import {
  MIGRATIONS_COPY,
  MigrationMutationNotice,
} from "./migrations-shared";

afterEach(cleanup);

describe.each(["en", "ar"] as const)("migration precondition feedback (%s)", (language) => {
  beforeEach(() => { languageMock.lang = language; });
  const copy = MIGRATIONS_COPY[language];
  const labels = {
    "WORKER.MIGRATION.RUN_ALREADY_ACTIVE": copy.preconditionRunActive,
    "WORKER.MIGRATION.BLOCKED": copy.preconditionBlocked,
    "WORKER.MIGRATION.LINT_FAILED": copy.preconditionLint,
    "WORKER.MIGRATION.UNTESTED": copy.preconditionUntested,
    "WORKER.MIGRATION.BACKUP_REQUIRED": copy.preconditionBackupRequired,
    "WORKER.TENANT_CLAIM.HELD": copy.preconditionClaim,
    "WORKER.MIGRATION.TENANT_INELIGIBLE": copy.preconditionIneligible,
    "WORKER.MIGRATION.MAINTENANCE_WINDOW_CLOSED": copy.preconditionWindow,
  };

  it.each(MIGRATION_PRECONDITION_CODES)("announces the actionable message for %s", (code) => {
    const reason = "UnsafeIndex1900000000002 L1/CREATE_INDEX_NOT_CONCURRENT";
    render(
      <MigrationMutationNotice
        copy={copy}
        mutation={{
          name: "START",
          phase: "PRECONDITION",
          error: {
            isNormalized: true,
            httpStatus: [
              "WORKER.MIGRATION.RUN_ALREADY_ACTIVE",
              "WORKER.MIGRATION.BLOCKED",
              "WORKER.TENANT_CLAIM.HELD",
            ].includes(code) ? 409 : 422,
            errorCode: code,
            message: "Worker refusal",
            details: { reason: [reason] },
          },
        }}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(labels[code]);
    expect(alert.textContent).toContain(reason);
    expect(alert.textContent).toContain(code);
    expect(alert.textContent).not.toContain("Worker refusal");
  });

  it("localizes an unknown failure while retaining code and correlation ID", () => {
    render(
      <MigrationMutationNotice
        copy={copy}
        mutation={{
          name: "START", phase: "ERROR",
          error: {
            isNormalized: true, httpStatus: 500, errorCode: "FUTURE.MIGRATION_FAILURE",
            message: "Private migration backend wording", correlationId: "019f1000-0000-7000-8000-000000000999",
          },
        }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent((language === "ar" ? ar : en).apiErrorMessages.generic);
    expect(alert).toHaveTextContent("FUTURE.MIGRATION_FAILURE");
    expect(alert).toHaveTextContent("019f1000-0000-7000-8000-000000000999");
    expect(alert).not.toHaveTextContent("Private migration backend wording");
  });

  it("keeps the catalogued permission reason localized and actionable", () => {
    render(
      <MigrationMutationNotice
        copy={copy}
        mutation={{
          name: "START", phase: "FORBIDDEN",
          error: {
            isNormalized: true, httpStatus: 403,
            errorCode: "ADMIN_PERMISSION_DENIED",
            message: "admin.migrations.manage is required to start a migration.",
            correlationId: "corr-7f3a",
          },
        }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent((language === "ar" ? ar : en).apiErrorMessages.migrationManageRequired);
    expect(alert).toHaveTextContent("ADMIN_PERMISSION_DENIED");
    expect(alert).toHaveTextContent("corr-7f3a");
    if (language === "ar") {
      expect(alert).not.toHaveTextContent("is required to start a migration.");
    }
  });
});

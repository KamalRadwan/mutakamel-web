// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MIGRATION_PRECONDITION_CODES } from "../model/migration-errors";
import {
  MIGRATIONS_COPY,
  MigrationMutationNotice,
} from "./migrations-shared";

afterEach(cleanup);

describe.each(["en", "ar"] as const)("migration precondition feedback (%s)", (language) => {
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
  });
});

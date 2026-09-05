// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
  useOptionalI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

import { DatabaseServerSecurityTab } from "./DatabaseServerSecurityTab";
import type { DatabaseServerView } from "../../types";

afterEach(() => cleanup());

const server = (overrides: Partial<DatabaseServerView>): DatabaseServerView =>
  ({
    id: "019f0000-0000-7000-8000-000000000001",
    name: "Cairo PostgreSQL 01",
    host: "postgres-01.internal",
    port: 5432,
    sslMode: "require",
    sslRejectUnauthorized: true,
    ...overrides,
  }) as DatabaseServerView;

/**
 * UI-003. The verification row read `sslRejectUnauthorized` on its own, so a
 * server with TLS switched off still reported "Strict Verification" - naming a
 * protection that cannot be operating, because there is no certificate to
 * verify when TLS is off. The flag is stored and still applies the moment TLS
 * is turned on; what it does not do is describe the connection today.
 */
describe("DatabaseServerSecurityTab verification", () => {
  const copy = en.databaseServerDetail.security;

  it("reports strict verification when TLS is on and the flag is set", () => {
    render(
      <DatabaseServerSecurityTab
        server={server({ sslMode: "require", sslRejectUnauthorized: true })}
      />,
    );
    expect(screen.getByText(copy.strictVerification)).toBeTruthy();
  });

  it("reports relaxed verification when TLS is on and the flag is clear", () => {
    render(
      <DatabaseServerSecurityTab
        server={server({ sslMode: "require", sslRejectUnauthorized: false })}
      />,
    );
    expect(screen.getByText(copy.relaxedVerification)).toBeTruthy();
  });

  it("claims no verification at all when TLS is disabled, whatever the flag says", () => {
    render(
      <DatabaseServerSecurityTab
        server={server({ sslMode: "disable", sslRejectUnauthorized: true })}
      />,
    );
    expect(screen.getByText(copy.verificationNotApplicable)).toBeTruthy();
    expect(screen.queryByText(copy.strictVerification)).toBeNull();
  });
});

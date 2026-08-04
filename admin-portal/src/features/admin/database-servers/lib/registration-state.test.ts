import { describe, expect, it } from "vitest";
import {
  createDatabaseServerInitialValues,
  credentialCheckLabel,
  failedCredentialChecks,
  needsActiveApplicationBindingBackfill,
} from "./registration-state";

describe("database server registration state", () => {
  it("uses Core's non-TLS default instead of forcing SSL", () => {
    expect(createDatabaseServerInitialValues().sslMode).toBe("disable");
  });

  it("keeps the security-administrator failure detail", () => {
    const failed = failedCredentialChecks({
      connected: false,
      message: "One or more database credential checks failed.",
      checks: [
        {
          principal: "securityAdmin",
          connected: false,
          message: "password authentication failed",
        },
      ],
    });

    expect(failed).toEqual([
      {
        principal: "securityAdmin",
        connected: false,
        message: "password authentication failed",
      },
    ]);
  });

  it("labels the only credential accepted from the browser", () => {
    expect(credentialCheckLabel("securityAdmin")).toBe("Security admin");
  });

  it("identifies a system-ready DRAFT that is waiting for active Application bindings", () => {
    expect(
      needsActiveApplicationBindingBackfill(
        {
          credentialBootstrap: {
            status: "PENDING",
            totalPrincipals: 2,
            readyPrincipals: 2,
          },
          systemPrincipals: [
            {
              purpose: "PROVISIONING",
              databasePrincipal: "mutakamel_provisioner",
              status: "READY",
            },
            {
              purpose: "BACKUP",
              databasePrincipal: "mutakamel_backup",
              status: "READY",
            },
          ],
        } as never,
        0,
        true,
      ),
    ).toBe(true);
  });

  it("does not claim an Application blocker before bindings settle or when a system principal is incomplete", () => {
    const server = {
      credentialBootstrap: {
        status: "PENDING",
        totalPrincipals: 2,
        readyPrincipals: 1,
      },
      systemPrincipals: [
        {
          purpose: "PROVISIONING",
          databasePrincipal: "mutakamel_provisioner",
          status: "READY",
        },
        {
          purpose: "BACKUP",
          databasePrincipal: "mutakamel_backup",
          status: "DEGRADED",
        },
      ],
    } as never;

    expect(needsActiveApplicationBindingBackfill(server, 0, false)).toBe(false);
    expect(needsActiveApplicationBindingBackfill(server, 0, true)).toBe(false);
  });
});

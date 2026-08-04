import { describe, expect, it } from "vitest";
import {
  compactDatabaseSslConfig,
  validateDatabaseSslConfig,
} from "./database-ssl-config";

describe("database SSL configuration", () => {
  it("omits an empty certificate bundle from the API DTO", () => {
    expect(compactDatabaseSslConfig({ ca: "  ", cert: "", key: "" })).toBeUndefined();
  });

  it("requires a CA certificate for a new verify-full connection", () => {
    expect(
      validateDatabaseSslConfig({ mode: "verify-full" }),
    ).toContain("A CA certificate is required for verify-ca and verify-full modes.");
  });

  it("allows verify-full to keep a stored certificate bundle", () => {
    expect(
      validateDatabaseSslConfig({
        mode: "verify-full",
        hasStoredConfig: true,
      }),
    ).toEqual([]);
  });

  it("requires a full replacement bundle to include its CA", () => {
    expect(
      validateDatabaseSslConfig({
        mode: "verify-ca",
        hasStoredConfig: true,
        config: { cert: "client", key: "private-key" },
      }),
    ).toContain("A CA certificate is required for verify-ca and verify-full modes.");
  });

  it("requires client certificate and private key together", () => {
    expect(
      validateDatabaseSslConfig({
        mode: "require",
        config: { cert: "client" },
      }),
    ).toContain("The client certificate and private key must be uploaded together.");
  });

  it("rejects a passphrase without a replacement private key", () => {
    expect(
      validateDatabaseSslConfig({
        mode: "require",
        config: { passphrase: "secret" },
      }),
    ).toContain("A private-key passphrase requires an uploaded private key.");
  });
});

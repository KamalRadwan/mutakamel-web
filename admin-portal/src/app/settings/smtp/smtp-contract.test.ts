import { describe, expect, it } from "vitest";
import {
  buildSmtpPatch,
  formFromSmtpConfig,
  readSmtpAuditEnvelope,
  readSmtpConfigEnvelope,
  validateSmtpForm,
  type PlatformSmtpConfig,
} from "./smtp-contract";

const TIMESTAMP = "2026-08-12T08:00:00.000Z";

function envelope<T>(data: T) {
  return {
    success: true,
    data,
    correlationId: "corr-smtp",
    timestamp: TIMESTAMP,
  };
}

function unconfigured(): PlatformSmtpConfig {
  return {
    configured: false,
    revision: null,
    fromAddress: null,
    fromName: null,
    senderDomain: null,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: null,
    smtpProtocol: null,
    smtpUsername: null,
    smtpPasswordConfigured: false,
    updatedAt: null,
  };
}

function configured(): PlatformSmtpConfig {
  return {
    configured: true,
    revision: 3,
    fromAddress: "notifications@example.com",
    fromName: "Mutakamel",
    senderDomain: "mail.example.com",
    smtpHost: "smtp.example.com",
    smtpPort: 465,
    smtpSecure: true,
    smtpProtocol: "smtps",
    smtpUsername: "mailer@example.com",
    smtpPasswordConfigured: true,
    updatedAt: TIMESTAMP,
  };
}

describe("SMTP contract", () => {
  it("preserves the exact all-null unconfigured projection without invented defaults", () => {
    const result = readSmtpConfigEnvelope(envelope(unconfigured()));
    expect(result.data).toEqual(unconfigured());
    expect(formFromSmtpConfig(result.data)).toEqual({
      fromAddress: "",
      fromName: "",
      senderDomain: "",
      smtpHost: "",
      smtpPort: "",
      smtpSecure: null,
      smtpProtocol: null,
      smtpUsername: "",
    });
  });

  it("matches the current DTO port allowlist and protocol/security fences", () => {
    const form = formFromSmtpConfig(configured());
    expect(validateSmtpForm({ ...form, smtpPort: "8080" }, "", true).smtpPort).toBe(
      "UNSUPPORTED_PORT",
    );
    const insecureSmtps = validateSmtpForm(
      { ...form, smtpSecure: false },
      "",
      true,
    );
    expect(insecureSmtps.smtpProtocol).toBe("PORT_465_REQUIRES_SMTPS");
    expect(insecureSmtps.smtpSecure).toBe("PORT_465_REQUIRES_SMTPS");
    expect(
      validateSmtpForm(
        { ...form, smtpPort: "587", smtpProtocol: "smtp", smtpSecure: false },
        "",
        true,
      ),
    ).toEqual({});
  });

  it("normalizes and allowlists the exact initial patch fields", () => {
    const { dto, errors } = buildSmtpPatch(
      {
        fromAddress: "  Notify@Example.COM ",
        fromName: "  Mutakamel Platform ",
        senderDomain: " MAIL.Example.COM ",
        smtpHost: " SMTP.Example.COM ",
        smtpPort: "587",
        smtpSecure: false,
        smtpProtocol: "smtp",
        smtpUsername: " mailer@example.com ",
      },
      "secret-value",
      unconfigured(),
    );
    expect(errors).toEqual({});
    expect(dto).toEqual({
      fromAddress: "notify@example.com",
      fromName: "Mutakamel Platform",
      senderDomain: "mail.example.com",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpProtocol: "smtp",
      smtpUsername: "mailer@example.com",
      smtpPassword: "secret-value",
    });
  });

  it("rejects invalid domains, line breaks, missing initial password, and unsafe responses", () => {
    const errors = validateSmtpForm(
      {
        fromAddress: "not-an-email",
        fromName: "Unsafe\nName",
        senderDomain: "localhost",
        smtpHost: "127.0.0.1",
        smtpPort: "465",
        smtpSecure: false,
        smtpProtocol: "smtp",
        smtpUsername: "",
      },
      "",
      false,
    );
    expect(errors).toMatchObject({
      fromAddress: "INVALID_EMAIL",
      fromName: "INVALID_FROM_NAME",
      senderDomain: "INVALID_DOMAIN",
      smtpHost: "INVALID_DOMAIN",
      smtpPassword: "PASSWORD_REQUIRED",
      smtpPort: "PORT_465_REQUIRES_SMTPS",
    });
    expect(() =>
      readSmtpConfigEnvelope(
        envelope({ ...configured(), smtpPort: 8080 }),
      ),
    ).toThrow("INVALID_SMTP_RESPONSE");
    expect(() =>
      readSmtpConfigEnvelope(
        envelope({ ...configured(), smtpPassword: "should-never-return" }),
      ),
    ).toThrow("INVALID_SMTP_RESPONSE");
  });

  it("allows only redacted password states in the bounded audit projection", () => {
    expect(
      readSmtpAuditEnvelope(
        envelope([
          {
            id: "audit-1",
            action: "UPDATED",
            revision: 4,
            actor: "Admin",
            changes: [
              {
                field: "smtpPassword",
                label: "SMTP password",
                previousValue: "Configured",
                newValue: "Updated",
              },
            ],
            createdAt: TIMESTAMP,
          },
        ]),
      ).data,
    ).toHaveLength(1);
    expect(() =>
      readSmtpAuditEnvelope(
        envelope([
          {
            id: "audit-1",
            action: "UPDATED",
            revision: 4,
            actor: "Admin",
            changes: [
              {
                field: "smtpPassword",
                label: "SMTP password",
                previousValue: "Configured",
                newValue: "plaintext-secret",
              },
            ],
            createdAt: TIMESTAMP,
          },
        ]),
      ),
    ).toThrow("INVALID_SMTP_RESPONSE");
  });
});

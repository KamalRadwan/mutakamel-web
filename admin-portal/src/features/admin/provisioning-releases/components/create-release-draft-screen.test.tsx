// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { languageMock, creatorMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar", dir: "ltr" as "ltr" | "rtl" },
  creatorMock: {
    permissions: {
      canRead: true,
      canManageDrafts: true,
      canPublishCritical: false,
      canRetireCritical: false,
    },
    isAuthLoading: false,
    definition: {
      componentId: "",
      releaseVersion: "",
      manifestVersion: "1",
      contractVersion: "1",
      runtimeBuildSha: "",
      schemaTarget: "",
      schemaChecksum: "",
      manifestPayload: "{}",
      compatibility: "{}",
      riskLevel: "LOW" as const,
      selfServiceAllowed: false,
      requiresBackup: false,
      requiresMaintenance: false,
    },
    errors: {} as Record<string, string>,
    mutation: {
      name: null,
      phase: "IDLE",
      error: null,
      correlationId: null,
    },
    created: null,
    update: vi.fn(),
    submit: vi.fn(),
  },
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => languageMock }));
vi.mock("../hooks/use-create-release-draft", () => ({
  useCreateReleaseDraft: () => creatorMock,
}));

import { CreateReleaseDraftScreen } from "./create-release-draft-screen";

describe("CreateReleaseDraftScreen", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    languageMock.dir = "ltr";
    creatorMock.permissions.canManageDrafts = true;
    creatorMock.isAuthLoading = false;
    creatorMock.errors = {};
    creatorMock.mutation = {
      name: null,
      phase: "IDLE",
      error: null,
      correlationId: null,
    };
    creatorMock.created = null;
    creatorMock.update.mockClear();
    creatorMock.submit.mockClear();
  });

  it("renders every draft DTO control and submits the reachable create action", () => {
    render(<CreateReleaseDraftScreen />);

    for (const label of [
      "Component UUID v7",
      "Release version",
      "Manifest version",
      "Contract version",
      "Runtime build SHA",
      "Schema target",
      "Schema checksum (optional SHA-256)",
      "Risk level",
      "Manifest payload (JSON object)",
      "Compatibility contract (JSON object)",
      "Allow tenant self-service",
      "Require verified backup",
      "Require maintenance fence",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    fireEvent.change(screen.getByLabelText("Release version"), {
      target: { value: "2.0.0" },
    });
    expect(creatorMock.update).toHaveBeenCalledWith("releaseVersion", "2.0.0");
    fireEvent.submit(screen.getByRole("form", { name: "Create release draft" }));
    expect(creatorMock.submit).toHaveBeenCalledOnce();
  });

  it("renders accessible validation and feature-local RTL Arabic copy", () => {
    languageMock.lang = "ar";
    languageMock.dir = "rtl";
    creatorMock.errors = { componentId: "INVALID_UUID_V7" };
    const { container } = render(<CreateReleaseDraftScreen />);

    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    // Field (design-system) generates its own id via useId() rather than
    // accepting a caller-supplied fixed one, so this can no longer look up
    // a hardcoded "release-component-id" - find the control by its Arabic
    // label instead, the same way the other test in this file already does
    // for the English render.
    const componentId = screen.getByLabelText("معرّف المكوّن UUID v7");
    expect(componentId).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("fails closed before showing form controls without manage permission", () => {
    creatorMock.permissions.canManageDrafts = false;
    render(<CreateReleaseDraftScreen />);

    expect(screen.getByText("Required permission: admin.provisioning.releases.publish")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Create release draft" })).toBeNull();
  });
});

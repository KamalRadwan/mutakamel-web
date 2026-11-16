// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { commercialFixture } from "@/features/admin/tenant-workspace/billing/model/subscription-commercial-fixtures";

const state = vi.hoisted(() => ({
  error: null as { errorCode: string; message: string; correlationId: string } | null,
  catalogueError: null as { errorCode: string; message: string; correlationId: string } | null,
}));
vi.mock("./hooks/useCommercialChangeWorkspace", () => ({
  useCommercialChangeSessionKey: () => "test-session",
  useCommercialChangeWorkspace: () => ({
    error: state.error, errorMessage: "Raw derived error", errorRef: { current: null },
    draftLocked: true, canPrepare: false, canReadCatalogue: true,
    lifecycleAllowsChange: true, targets: [], journal: {},
    catalogue: { error: state.catalogueError, applications: [], addons: [], tiers: [] },
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));
import { CommercialChangeWorkspace } from "./CommercialChangeWorkspace";
import { commercialWorkspaceCopy } from "./commercial-workspace-copy";

afterEach(() => { cleanup(); state.error = null; state.catalogueError = null; });

describe.each(["en", "ar"] as const)("commercial error display (%s)", (lang) => {
  const copy = (lang === "ar" ? ar : en).apiErrorMessages;
  it.each(["command", "catalogue"] as const)("localizes %s conflicts with diagnostics", (surface) => {
    const error = { errorCode: "HTTP_409", message: "Raw commercial error", correlationId: "commercial-correlation" };
    if (surface === "command") state.error = error;
    else state.catalogueError = error;
    const view = render(<CommercialChangeWorkspace source={commercialFixture()} lang={lang} onCommitted={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.conflict);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP_409");
    expect(screen.getByRole("alert")).toHaveTextContent("commercial-correlation");
    expect(screen.queryByText(/Raw (commercial|derived) error/)).not.toBeInTheDocument();
    error.errorCode = "FUTURE_COMMERCIAL_ERROR";
    view.rerender(<CommercialChangeWorkspace source={commercialFixture()} lang={lang} onCommitted={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.generic);
    expect(screen.getByRole("alert")).toHaveTextContent("FUTURE_COMMERCIAL_ERROR");
  });

  it("keeps reviewed release-upgrade guidance", () => {
    state.error = { errorCode: "TENANT_PROVISIONING_RELEASE_UPGRADE_REQUIRED", message: "Raw commercial error", correlationId: "upgrade-correlation" };
    render(<CommercialChangeWorkspace source={commercialFixture()} lang={lang} onCommitted={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(commercialWorkspaceCopy(lang).releaseUpgradeRequired);
    expect(screen.getByRole("alert")).toHaveTextContent("upgrade-correlation");
    expect(screen.queryByText("Raw commercial error")).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { ConfigurationDefinition } from "../configuration-contract";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mocks = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: dictionaries[mocks.lang],
    lang: mocks.lang,
    dir: directions[mocks.lang],
  }),
}));

const {
  ConfigurationInspectModal,
  CreateDefinitionDrawer,
  CreateVersionDrawer,
} = await import("./ConfigurationDrawers");

const SAMPLE_DEFINITION: ConfigurationDefinition = {
  id: "def-1",
  key: "trade.credit.strict_exposure_check",
  valueSchema: { type: "boolean" },
  allowedScopes: ["COMPANY", "BRANCH"],
  mergeStrategy: "DENY_WINS",
  riskClass: "CRITICAL",
  version: 1,
  versions: [
    {
      id: "ver-1",
      scopeTarget: "COMPANY",
      versionNumber: 1,
      version: 1,
      status: "PUBLISHED",
      value: true,
      effectiveFrom: "2026-01-01T00:00:00Z",
      effectiveTo: null,
      contentHash: "hash-1",
    },
  ],
};

beforeEach(() => {
  mocks.lang = "en";
});
afterEach(cleanup);

describe("ConfigurationDrawers UI component suite", () => {
  it("renders CreateDefinitionDrawer with starter templates and visual value constraint builder", () => {
    render(
      <CreateDefinitionDrawer
        isOpen
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />,
    );

    const discountTplBtn = screen.getByRole("button", {
      name: /Max Manual Discount Ceiling/i,
    });
    fireEvent.click(discountTplBtn);

    expect(
      screen.getByDisplayValue("trade.pricing.max_manual_discount_pct"),
    ).toBeInTheDocument();
  });

  it("renders CreateVersionDrawer with boolean toggle buttons for boolean policy definitions", () => {
    render(
      <CreateVersionDrawer
        definition={SAMPLE_DEFINITION}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText(SAMPLE_DEFINITION.key)).toBeInTheDocument();
    const falseBtn = screen.getByRole("button", { name: /Disabled \/ Deny \(False\)/i });
    fireEvent.click(falseBtn);
    expect(screen.getByDisplayValue("false")).toBeInTheDocument();
  });

  it("renders ConfigurationInspectModal with human-readable version values", () => {
    render(
      <ConfigurationInspectModal
        definition={SAMPLE_DEFINITION}
        canManage
        onClose={vi.fn()}
        onCreateVersion={vi.fn()}
      />,
    );

    expect(screen.getByText(SAMPLE_DEFINITION.key)).toBeInTheDocument();
    expect(screen.getByText("Enabled (True)")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const locale = vi.hoisted(() => ({ lang: "en", dir: "ltr" }));
vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await vi.importActual<typeof import("@/i18n/dictionaries/en")>("@/i18n/dictionaries/en");
  return { useI18n: () => ({ ...locale, t: en }) };
});
import { InitialOptionsReference } from "./InitialOptionsReference";
import { initialOptionsFixture } from "./initial-create-options.fixture";
import { initialId } from "./initial-commercial.fixture";
import { initialCommercialCopy } from "./initial-commercial-copy";
import { TenantApplicationsStep } from "@/app/(shell)/tenants/new/components/TenantApplicationsStep";
import { buildTenantSubscriptionLines, readTenantCreateOptions } from "@/app/(shell)/tenants/new/lib/tenant-registration";
import type { TenantApplicationCandidate } from "@/app/(shell)/tenants/new/types";

beforeEach(() => { locale.lang = "en"; locale.dir = "ltr"; });
afterEach(cleanup);
const candidate = (selectionAllowed: boolean): TenantApplicationCandidate => ({ applicationId: initialId(11), key: "crm", name: "Candidate CRM", description: null,
  rank: 0, commercialMode: "SUBSCRIPTION", technicalDefinitionRevision: "9", addons: [], selectionBlockers: selectionAllowed ? [] : ["APPLICATION_NOT_PUBLISHED"], readinessReasons: [], catalogueReasons: [],
  tiers: [{ id: initialId(12), key: "starter", name: "Candidate Starter", rank: 0 }] });

describe("Canonical option diagnostics and display-only reference", () => {
  it.each([false, true])("preserves the selection diagnostic decision available=%s", selectionAllowed => {
    const options = initialOptionsFixture(), legacy = candidate(selectionAllowed), onToggle = vi.fn();
    render(<><TenantApplicationsStep candidates={[legacy]} selections={{}} state="ready" error={null} selectedLines={[]} billingCycle="MONTHLY"
      showSelectionError={false} preview={null} previewState="idle" previewError={null} onRetryCandidates={vi.fn()} onRetryPreview={vi.fn()}
      onToggle={onToggle} onUpdateSelection={vi.fn()} onBillingCycleChange={vi.fn()} /><InitialOptionsReference value={options} /></>);
    const checkbox = screen.getByRole("checkbox", { name: /Candidate CRM/ });
    if (selectionAllowed) expect(checkbox).not.toBeDisabled(); else expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(selectionAllowed ? 1 : 0);
    const lines = buildTenantSubscriptionLines([legacy], { crm: { selectionKey: initialId(10), tierId: initialId(12), seats: 3, addons: [] } });
    expect(lines).toHaveLength(selectionAllowed ? 1 : 0);
    const reference = screen.getByRole("region", { name: "Published application and addon reference" });
    expect(reference.querySelector("input,button,select,[role=checkbox],[role=combobox]")).toBeNull();
    expect(reference.textContent).toContain("Display only.");
    expect(options.applications[0]).not.toHaveProperty("selectionAllowed");
    expect(options.applications[0].selectionBlockers).toEqual([]);
    expect(options.applications[0].readinessReasons).toEqual([]);
  });
  it("preserves the same closed canonical data used by the registration reader", () => {
    const options = initialOptionsFixture();
    expect(readTenantCreateOptions(options)).toEqual(options.applications);
    const before = JSON.stringify(options);
    render(<InitialOptionsReference value={options} />);
    const details = screen.getByText("Published CRM").closest("details")!;
    fireEvent.click(screen.getByText("Published CRM"));
    expect(details.open).toBe(true);
    expect(within(details).getByRole("heading", { name: "Published Logistics" })).toBeInTheDocument();
    expect(within(details).getByText(initialId(15))).toBeInTheDocument();
    expect(JSON.stringify(options)).toBe(before);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("shows revoked diagnostics as display evidence without action controls or an inferred ready state", () => {
    const options = initialOptionsFixture(); options.applications[0].addons[0].catalogueReasons = ["ADDON_DEFINITION_REVOKED"];
    const { container } = render(<InitialOptionsReference value={options} />);
    expect(container.textContent).toContain("ADDON_DEFINITION_REVOKED");
    expect(container.querySelector("button,input,select")).toBeNull();
    expect(container.textContent).not.toContain("Ready");
  });
  it("supports Arabic RTL and an authoritative empty projection without inventing default selections", () => {
    locale.lang = "ar"; locale.dir = "rtl";
    render(<InitialOptionsReference value={{ quoteRequired: true, applications: [] }} />);
    const region = screen.getByRole("region", { name: "مرجع التطبيقات والإضافات المنشورة" });
    expect(region).toHaveAttribute("dir", "rtl");
    expect(within(region).getByRole("status").textContent).toBe(initialCommercialCopy("ar").optionsEmpty);
    expect(region.querySelector("input,button,select")).toBeNull();
  });
});

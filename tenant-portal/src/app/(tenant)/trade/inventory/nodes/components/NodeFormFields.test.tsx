// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { EMPTY_NODE_FORM } from "../../inventory-contract";
import { NodeFormFields } from "./NodeFormFields";

const cairo = "01900100-0000-7000-8000-000000000001";
const alexandria = "01900100-0000-7000-8000-000000000002";
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: {} }) }));
vi.mock("@/hooks/useTenantBranchSelection", () => ({ useTenantBranchSelection: () => ({ branchIds: [cairo, alexandria] }) }));
vi.mock("@/hooks/useTenantBranchLabels", () => ({
  useTenantBranchLabels: () => new Map([[cairo, "Cairo"], [alexandria, "Alexandria"]]),
  useTenantCompanyLabels: () => new Map(),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);

it("assigns named branches while preserving the exact replacement IDs", () => {
  const onChange = vi.fn();
  const { container } = render(<NodeFormFields values={{ ...EMPTY_NODE_FORM, branchIds: cairo }}
    onChange={onChange} isSubmitting={false} isEdit={false} />);
  expect(screen.getByText("Cairo")).toBeInTheDocument();
  expect(container.textContent).not.toContain(cairo);
  fireEvent.click(screen.getByRole("button", { name: en.tradeInventory.nodeBranches }));
  fireEvent.click(screen.getByRole("option", { name: "Alexandria" }));
  expect(onChange).toHaveBeenCalledWith({ branchIds: `${cairo}\n${alexandria}` });
});

it("renders each node field validation beside its labelled control", () => {
  render(<NodeFormFields values={EMPTY_NODE_FORM} errors={{ code: "Invalid code", name: "Name required", timezone: "Invalid timezone", branchIds: "Branch required" }} onChange={vi.fn()} isSubmitting={false} isEdit={false} />);
  for (const message of ["Invalid code", "Name required", "Invalid timezone", "Branch required"]) expect(screen.getByText(message)).toBeVisible();
  expect(screen.getByRole("textbox", { name: en.tradeInventory.nodeCode })).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("textbox", { name: en.tradeInventory.nodeName })).toHaveAttribute("aria-invalid", "true");
});

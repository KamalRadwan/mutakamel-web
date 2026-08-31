// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TenantWizardProgress } from "./TenantWizardProgress";

const steps = [
  { number: 1, label: "Identity" },
  { number: 2, label: "Owner" },
  { number: 3, label: "Applications" },
  { number: 4, label: "Infrastructure" },
  { number: 5, label: "Confirm" },
] as const;

describe("TenantWizardProgress", () => {
  it("renders an ordered five-step navigation with explicit current and completed cues", () => {
    const onStepChange = vi.fn();
    render(
      <TenantWizardProgress
        steps={steps}
        currentStep={3}
        navigationLabel="Tenant creation steps"
        currentLabel="Current"
        completedLabel="Completed"
        onStepChange={onStepChange}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Tenant creation steps",
    });
    expect(within(navigation).getByRole("list").children).toHaveLength(5);
    expect(screen.getByRole("button", { name: /Applications\s*Current/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: /Identity\s*Completed/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Owner\s*Completed/ })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Infrastructure/ }));
    expect(onStepChange).toHaveBeenCalledWith(4);
  });
});

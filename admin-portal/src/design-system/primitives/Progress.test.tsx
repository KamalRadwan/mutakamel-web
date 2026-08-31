// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./Progress";

describe("Progress", () => {
  it("keeps the Radix accessible value synchronized with the visual value", () => {
    const { rerender } = render(<Progress value={42} aria-label="Provisioning progress" />);
    expect(screen.getByRole("progressbar", { name: "Provisioning progress" }))
      .toHaveAttribute("aria-valuenow", "42");

    rerender(<Progress value={75} aria-label="Provisioning progress" />);
    expect(screen.getByRole("progressbar", { name: "Provisioning progress" }))
      .toHaveAttribute("aria-valuenow", "75");
  });
});

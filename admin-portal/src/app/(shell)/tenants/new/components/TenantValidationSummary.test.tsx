// @vitest-environment jsdom

import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TenantValidationSummary } from "./TenantValidationSummary";

describe("TenantValidationSummary", () => {
  it("is focusable and returns focus to the linked invalid field", () => {
    const summaryRef = createRef<HTMLDivElement>();
    render(
      <>
        <TenantValidationSummary
          ref={summaryRef}
          errors={[
            {
              fieldId: "tenant-owner-email",
              message: "Owner email is required.",
              step: 2,
            },
          ]}
          title="Review the highlighted fields"
          description="Correct the following items before continuing."
          onFieldFocus={(fieldId) => document.getElementById(fieldId)?.focus()}
        />
        <label htmlFor="tenant-owner-email">Owner email</label>
        <input id="tenant-owner-email" name="ownerEmail" />
      </>,
    );

    summaryRef.current?.focus();
    expect(document.activeElement).toBe(summaryRef.current);

    fireEvent.click(screen.getByRole("link", { name: "Owner email is required." }));
    expect(screen.getByLabelText("Owner email")).toHaveFocus();
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";

afterEach(cleanup);

describe("Field", () => {
  it("wires a stable htmlFor/id pair so the label targets the control", () => {
    render(
      <Field label="Email">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it("wires aria-describedby to hint text when there is no error", () => {
    render(
      <Field label="Email" hint="We will never share this.">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("We will never share this.");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("wires aria-describedby to the error and sets aria-invalid when an error is present", () => {
    render(
      <Field label="Email" hint="We will never share this." error="Enter a valid email address.">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const describedIds = describedBy.split(" ");
    const describedText = describedIds.map((id) => document.getElementById(id)?.textContent).join(" ");
    expect(describedText).toContain("Enter a valid email address.");
  });

  it("marks the control aria-required when required is set", () => {
    render(
      <Field label="Email" required>
        <Input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("aria-required", "true");
  });
});

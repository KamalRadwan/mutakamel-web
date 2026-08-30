// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion";

afterEach(cleanup);

function renderAccordion() {
  return render(
    <Accordion type="single" collapsible>
      <AccordionItem value="billing">
        <AccordionTrigger>Billing</AccordionTrigger>
        <AccordionContent>Invoices and payment methods</AccordionContent>
      </AccordionItem>
      <AccordionItem value="branches">
        <AccordionTrigger>Branches</AccordionTrigger>
        <AccordionContent>Branch list</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

describe("Accordion", () => {
  it("wires each trigger to its own region", () => {
    renderAccordion();
    const trigger = screen.getByRole("button", { name: "Billing" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Invoices and payment methods")).toBeInTheDocument();
  });

  it("collapses the open panel when another opens, in single mode", () => {
    renderAccordion();
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    fireEvent.click(screen.getByRole("button", { name: "Branches" }));
    expect(screen.getByRole("button", { name: "Billing" })).toHaveAttribute("aria-expanded", "false");
  });

  it("does not animate its height — motion.md bans transitioning height, keyframes included", () => {
    const { container } = renderAccordion();
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    const markup = container.innerHTML;
    expect(markup).not.toContain("animate-accordion");
    expect(markup).not.toContain("transition-[height]");
    expect(markup).not.toContain("grid-rows-");
    // Radix always publishes --radix-accordion-content-height; what matters is
    // that nothing here consumes it to drive a height.
    expect(markup).not.toContain("h-(--radix-accordion-content-height)");
  });

  it("rotates the chevron vertically, which needs no RTL mirror", () => {
    const { container } = renderAccordion();
    const chevron = container.querySelector("svg");
    expect(chevron?.getAttribute("class")).toContain("data-[state=open]:rotate-180");
    expect(chevron?.getAttribute("class")).not.toContain("rtl:");
  });
});

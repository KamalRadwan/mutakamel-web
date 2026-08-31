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

  it("takes the one permitted height KEYFRAME, and never a height transition", () => {
    const { container } = renderAccordion();
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    const markup = container.innerHTML;

    // MASTER-PLAN 1.42 narrowed the ban rather than dropping it — see
    // docs/design/motion.md#the-one-height-exception. A keyframe over a height
    // Radix has already measured is permitted on a disclosure panel, and
    // nowhere else.
    expect(markup).toContain("data-[state=open]:animate-accordion-down");
    expect(markup).toContain("data-[state=closed]:animate-accordion-up");
    // Exit is faster than enter, as everywhere else in the budget.
    expect(markup).toContain("data-[state=open]:duration-150");
    expect(markup).toContain("data-[state=closed]:duration-100");

    // What stays banned: TRANSITIONING height, and the grid-template-rows
    // trick, which is the same layout animation by another property.
    expect(markup).not.toContain("transition-[height]");
    expect(markup).not.toContain("grid-rows-");
  });

  it("rotates the chevron vertically, which needs no RTL mirror", () => {
    const { container } = renderAccordion();
    const chevron = container.querySelector("svg");
    expect(chevron?.getAttribute("class")).toContain("data-[state=open]:rotate-180");
    expect(chevron?.getAttribute("class")).not.toContain("rtl:");
  });
});

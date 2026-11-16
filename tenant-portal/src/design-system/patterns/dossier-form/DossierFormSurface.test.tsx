// @vitest-environment jsdom

import { useCallback } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { Input } from "../../primitives/Input";
import { PageActionSlotsProvider, usePageActionSlots } from "../../shell/page-action-slots";
import { DossierFormSurface, type DossierFormSurfaceProps } from "./DossierFormSurface";

vi.mock("@/i18n/useLanguage", () => ({ useDictionary: () => en }));
afterEach(cleanup);

function props(): DossierFormSurfaceProps {
  return { open: true, expanded: true, title: "Create opportunity", branchLabel: "Cairo HQ", isDirty: false, isSubmitting: false,
    onExpandedChange: vi.fn(), onClose: vi.fn(), onSubmit: vi.fn(),
    children: <Input aria-label="Opportunity title" defaultValue="Annual contract" />,
    labels: { compact: "Fast create", expanded: "Full view", submit: "Create opportunity", cancel: "Cancel", close: "Close",
      discardTitle: "Discard changes?", discardDescription: "Your changes will be discarded.", discardConfirm: "Discard" } };
}

function ActionTarget() {
  const { register } = usePageActionSlots();
  const ref = useCallback((node: HTMLDivElement | null) => register("actions", node), [register]);
  return <div ref={ref} data-testid="shell-actions" />;
}

describe("Dossier Full form actions", () => {
  it("submits its form from the shell action bar while keeping the mode switch in the hero", () => {
    const model = props();
    render(<PageActionSlotsProvider><ActionTarget /><DossierFormSurface {...model} /></PageActionSlotsProvider>);
    const actions = screen.getByTestId("shell-actions");
    const submit = within(actions).getByRole("button", { name: "Create opportunity" });
    const form = screen.getByLabelText("Opportunity title").closest("form");
    expect(form).not.toContainElement(submit);
    expect(submit).toHaveAttribute("form", form?.id);
    fireEvent.click(submit);
    expect(model.onSubmit).toHaveBeenCalledOnce();
    fireEvent.click(within(actions).getByRole("button", { name: "Cancel" }));
    expect(model.onClose).toHaveBeenCalledOnce();
    const hero = screen.getByRole("heading", { name: "Create opportunity" }).closest(".dossier-hero");
    expect(hero).not.toBeNull();
    fireEvent.click(within(hero as HTMLElement).getByRole("button", { name: "Fast create" }));
    expect(model.onExpandedChange).toHaveBeenCalledWith(false);
    expect(within(actions).queryByRole("button", { name: "Full view" })).toBeNull();
  });

  it("keeps actions available without a shell and honors a blocked submit", () => {
    const model = props();
    const { rerender } = render(<DossierFormSurface {...model} />);
    fireEvent.click(screen.getByRole("button", { name: "Create opportunity" }));
    expect(model.onSubmit).toHaveBeenCalledOnce();
    rerender(<DossierFormSurface {...model} submitDisabled />);
    expect(screen.getByRole("button", { name: "Create opportunity" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Create opportunity" }));
    expect(model.onSubmit).toHaveBeenCalledOnce();
  });
});

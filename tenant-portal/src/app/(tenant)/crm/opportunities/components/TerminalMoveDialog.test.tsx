// @vitest-environment jsdom

import { createElement, type ButtonHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TerminalMoveDialog } from "./TerminalMoveDialog";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/design-system", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  Field: ({ label, children }: { label: string; children: ReactNode }) => (
    <label>{label}{children}</label>
  ),
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  Button: ({ loading: _loading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) =>
    createElement("button", props),
}));

afterEach(cleanup);

describe("Opportunity terminal stage confirmation", () => {
  it("requires and forwards a reason before moving to LOST", () => {
    const onConfirm = vi.fn().mockResolvedValue(true);
    render(
      <TerminalMoveDialog
        isOpen
        onClose={vi.fn()}
        opportunity={{ title: "Renewal" }}
        targetFlag="LOST"
        onConfirm={onConfirm}
        isSubmitting={false}
        error={null}
      />,
    );

    const confirm = screen.getByRole("button", { name: en.crmOpportunities.confirmLost });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Budget declined" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Budget declined");
  });
});

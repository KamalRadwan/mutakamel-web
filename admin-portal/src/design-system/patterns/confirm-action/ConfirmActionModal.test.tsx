// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmActionModal } from "./ConfirmActionModal";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" }),
}));

describe("ConfirmActionModal", () => {
  it("requires case-, whitespace-, and punctuation-exact typed confirmation", () => {
    const onConfirm = vi.fn();
    renderConfirmation("Tenant.A / 01", onConfirm);

    const input = screen.getByRole("textbox", { name: "Type the exact name to confirm" });
    const confirm = screen.getByRole("button", { name: "Delete tenant" });

    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "tenant.A / 01" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "Tenant.A / 01 " } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "Tenant.A / 01!" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "Tenant.A / 01" } });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not require typed confirmation when no exact text is supplied", () => {
    const onConfirm = vi.fn();
    renderConfirmation(undefined, onConfirm);

    const dialog = screen.getByRole("alertdialog", { name: "Delete tenant" });
    expect(dialog).toHaveClass(
      "fixed",
      "top-1/2",
      "max-h-[calc(100dvh-2rem)]",
      "overflow-y-auto",
      "overscroll-contain",
    );
    expect(dialog).not.toHaveClass("relative");

    const confirm = screen.getByRole("button", { name: "Delete tenant" });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

function renderConfirmation(requiredConfirmationText: string | undefined, onConfirm: () => void) {
  render(
    <ConfirmActionModal
      isOpen
      onClose={() => undefined}
      onConfirm={onConfirm}
      titleEn="Delete tenant"
      titleAr="حذف المستأجر"
      descriptionEn="This action is permanent."
      descriptionAr="هذا الإجراء دائم."
      confirmTextEn="Delete tenant"
      confirmTextAr="حذف المستأجر"
      requiredConfirmationText={requiredConfirmationText}
    />,
  );
}

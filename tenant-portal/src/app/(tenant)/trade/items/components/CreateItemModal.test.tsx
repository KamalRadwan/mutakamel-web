// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, TooltipProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { CreateItemModal } from "./CreateItemModal";

afterEach(cleanup);

vi.mock("../../categories/hooks/useCategoryPicker", () => ({
  useCategoryPicker: () => ({ items: [], page: 1, total: 0, loading: false, error: null,
    selected: null, search: vi.fn(), setPage: vi.fn(), retry: vi.fn(), choose: vi.fn() }),
}));

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("../hooks/useCatalogUoms", () => ({
  useCatalogUoms: () => ({
    options: [
      {
        id: "01890a5d-ac96-774b-bcce-b302099a8058",
        code: "EA",
        displayName: "Each",
        isBaseUom: true,
        canSell: true,
        canPurchase: true,
      },
    ],
    isLoading: false,
    isUnavailable: false,
  }),
}));

vi.mock("../hooks/useItemReferenceData", () => ({
  useItemReferenceData: () => ({
    owners: [], taxes: [], companyCurrencyCode: null, isLoading: false, error: null,
  }),
}));

vi.mock("../hooks/useItemReferenceOptions", () => ({
  useItemReferenceOptions: () => ({
    items: [], isLoading: false, error: null, search: vi.fn(), labelFor: (id: string) => id,
  }),
}));

function renderModal(onSubmit = vi.fn().mockResolvedValue(false)) {
  return {
    onSubmit,
    ...render(
      <TooltipProvider>
        <I18nProvider>
          <CreateItemModal
            isOpen
            isSubmitting={false}
            error={null}
            onClose={vi.fn()}
            onSubmit={onSubmit}
          />
        </I18nProvider>
      </TooltipProvider>,
    ),
  };
}

describe("CreateItemModal", () => {
  it("renders a balanced wide card with a segmented type and advanced details", () => {
    renderModal();

    expect(screen.getByRole("heading", { name: "Create item" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass(
      "max-w-[960px]",
      "max-h-[85dvh]",
      "w-[calc(100%-2rem)]",
    );
    expect(screen.getByRole("group", { name: "Item type" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Product" })).toHaveAttribute(
      "data-state",
      "on",
    );
    expect(screen.getByText("Type icon")).toBeInTheDocument();
    expect(screen.getByText("Generated from item type")).toBeInTheDocument();
    const advanced = screen.getByRole("button", { name: /Advanced details/ });
    expect(advanced).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByLabelText(/Choose a category/)).toBeInTheDocument();
  });

  it("keeps the type icon derived from the selected segment", () => {
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Service" }));
    expect(screen.getByRole("radio", { name: "Service" })).toHaveAttribute(
      "data-state",
      "on",
    );
  });

  it("separates required combo components from optional cross-sell products", () => {
    renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Combo" }));
    expect(screen.getByText("Combo components")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    expect(screen.getByLabelText(/Quantity/)).toHaveValue("1");

    fireEvent.click(screen.getByRole("button", { name: /Optional products/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add optional product" }));
    expect(screen.getByText("Optional product 1")).toBeInTheDocument();
  });

  it("builds variant JSON without exposing a separate upload or fake payload field", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Add attribute" }));
    fireEvent.change(screen.getByLabelText("Attribute name 1"), {
      target: { value: "color" },
    });
    fireEvent.change(screen.getByLabelText("Value 1"), { target: { value: "black" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit JSON" }));

    expect(screen.getByLabelText("Variant identity")).toHaveValue(
      '{\n  "color": "black"\n}',
    );
    expect(screen.queryByLabelText(/upload/i)).not.toBeInTheDocument();
  });

  it("shows inline errors and does not call the API for an invalid form", () => {
    const { onSubmit } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create item" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(en.trade.itemFormCode)).toBeInTheDocument();
    expect(screen.getByText(en.trade.itemFormNames)).toBeInTheDocument();
    expect(screen.getByText(en.trade.itemFormUom)).toBeInTheDocument();
    expect(screen.getByText(en.trade.itemFormCategory)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Item code *"));
    fireEvent.click(screen.getByRole("button", { name: "No category" }));
    expect(screen.queryByText(en.trade.itemFormCategory)).not.toBeInTheDocument();
  });

  it("resets local form state after discarded changes before reopening", () => {
    function StatefulModal() {
      const [open, setOpen] = useState(true);
      return (
        <TooltipProvider>
          <I18nProvider>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Reopen
            </Button>
            <CreateItemModal
              isOpen={open}
              isSubmitting={false}
              error={null}
              onClose={() => setOpen(false)}
              onSubmit={vi.fn().mockResolvedValue(false)}
            />
          </I18nProvider>
        </TooltipProvider>
      );
    }

    render(<StatefulModal />);
    fireEvent.click(screen.getByRole("button", { name: "Add attribute" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

    expect(screen.queryByLabelText("Attribute name 1")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Product" })).toHaveAttribute(
      "data-state",
      "on",
    );
  });
});

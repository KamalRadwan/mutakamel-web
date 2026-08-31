// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TierView } from "../types";
import { CatalogueResourceDialog } from "./CatalogueResourceDialog";

vi.mock("@/i18n/I18nContext", () => {
  const value = { lang: "en", dir: "ltr", t: { common: { close: "Close" } } };
  return {
    useI18n: () => value,
    useOptionalI18n: () => value,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const tier: TierView = {
  id: "01900000-0000-7000-8000-000000000001",
  moduleId: "01900000-0000-7000-8000-000000000002",
  key: "starter",
  name: "Starter",
  rank: 0,
  color: "#3b82f6",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

function renderTierDialog(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  render(
    <CatalogueResourceDialog
      kind="tier"
      applicationKey="crm"
      resource={tier}
      isOpen
      isSubmitting={false}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onClose, onSubmit };
}

describe("CatalogueResourceDialog rank validation", () => {
  it.each(["-1", "1.5", "not-a-number"])(
    "blocks invalid rank %s before the API call",
    async (rank) => {
      const { onSubmit } = renderTierDialog();
      const input = await screen.findByRole("spinbutton", { name: "Rank" });

      fireEvent.change(input, { target: { value: rank } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findAllByText("Rank must be a non-negative whole number.")).toHaveLength(2);
      expect(input).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(input).toHaveFocus());
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("preserves zero as a valid rank", async () => {
    const { onClose, onSubmit } = renderTierDialog();
    const input = await screen.findByRole("spinbutton", { name: "Rank" });
    fireEvent.change(input, { target: { value: "0" } });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Starter",
        rank: 0,
        color: "#3b82f6",
        isActive: true,
      });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { LeadPhoneActionsRow } from "./LeadPhoneActionsRow";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

afterEach(cleanup);

describe("LeadPhoneActionsRow", () => {
  it.each([
    {
      phone: "0501234567", country: "SA",
      whatsapp: "https://wa.me/966501234567", telegram: "https://t.me/+966501234567",
    },
    {
      phone: "01050049899", country: "Egypt",
      whatsapp: "https://wa.me/201050049899", telegram: "https://t.me/+201050049899",
    },
  ])("links local $phone internationally using $country", ({ phone, country, whatsapp, telegram }) => {
    render(<LeadPhoneActionsRow phone={phone} country={country} />);

    expect(screen.getByRole("link", { name: `Message ${phone} on WhatsApp` }))
      .toHaveAttribute("href", whatsapp);
    expect(screen.getByRole("link", { name: `Message ${phone} on Telegram` }))
      .toHaveAttribute("href", telegram);
    expect(screen.getByRole("link", { name: `Call ${phone}` }))
      .toHaveAttribute("href", `tel:${phone}`);
  });

  it.each([{ actionsOnly: true }, { showNumber: false }])(
    "uses the same chat links when the number is displayed by its parent: %j",
    (props) => {
      const openLead = vi.fn();
      render(
        <div onClick={openLead}>
          <LeadPhoneActionsRow phone="0501234567" country="SA" {...props} />
        </div>,
      );

      const link = screen.getByRole("link", { name: "Message 0501234567 on WhatsApp" });
      expect(link).toHaveAttribute("href", "https://wa.me/966501234567");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(screen.queryByText("0501234567")).toBeNull();
      fireEvent.click(link);
      expect(openLead).not.toHaveBeenCalled();
    },
  );

  it("keeps calling available but hides chats for a local number without a country", () => {
    render(<LeadPhoneActionsRow phone="01050049899" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Call 01050049899" }))
      .toHaveAttribute("href", "tel:01050049899");
  });

  it("renders no actions for a missing number", () => {
    render(<LeadPhoneActionsRow phone="" country="SA" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

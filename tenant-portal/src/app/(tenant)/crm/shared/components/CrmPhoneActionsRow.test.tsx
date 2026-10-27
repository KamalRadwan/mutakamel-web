// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CrmPhoneActionsRow } from "./CrmPhoneActionsRow";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

afterEach(cleanup);

describe("CrmPhoneActionsRow", () => {
  it.each([
    {
      phone: "0501234567",
      country: "SA",
      whatsapp: "https://wa.me/966501234567",
      telegram: "https://t.me/+966501234567",
    },
    {
      phone: "01050049899",
      country: "Egypt",
      whatsapp: "https://wa.me/201050049899",
      telegram: "https://t.me/+201050049899",
    },
  ])(
    "links local $phone internationally using $country",
    ({ phone, country, whatsapp, telegram }) => {
      render(<CrmPhoneActionsRow phone={phone} country={country} />);

      expect(
        screen.getByRole("link", { name: `Message ${phone} on WhatsApp` }),
      ).toHaveAttribute("href", whatsapp);
      expect(
        screen.getByRole("link", { name: `Message ${phone} on Telegram` }),
      ).toHaveAttribute("href", telegram);
      expect(screen.getByRole("link", { name: `Call ${phone}` })).toHaveAttribute(
        "href",
        `tel:${phone}`,
      );
      expect(screen.getByText(en.crmLeadDetail.callAction)).toBeInTheDocument();
    },
  );

  it("renders number, badge, and icon-only actions on one line when compact", () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <CrmPhoneActionsRow
          compact
          phone="0501234567"
          country="SA"
          badge="Primary"
        />
      </div>,
    );

    expect(screen.getByText("0501234567")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.queryByText(en.crmLeadDetail.callAction)).toBeNull();
    expect(screen.queryByText(en.crmLeadDetail.whatsappAction)).toBeNull();
    expect(screen.queryByText(en.crmLeadDetail.telegramAction)).toBeNull();

    const callLink = screen.getByRole("link", { name: "Call 0501234567" });
    expect(callLink).toHaveAttribute("href", "tel:0501234567");
    fireEvent.click(callLink);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it.each([{ actionsOnly: true }, { showNumber: false }])(
    "hides the number while keeping action links when %j",
    (props) => {
      render(<CrmPhoneActionsRow phone="0501234567" country="SA" {...props} />);

      expect(screen.queryByText("0501234567")).toBeNull();
      expect(
        screen.getByRole("link", { name: "Message 0501234567 on WhatsApp" }),
      ).toHaveAttribute("href", "https://wa.me/966501234567");
    },
  );

  it("renders no actions when the phone number is empty", () => {
    render(<CrmPhoneActionsRow compact phone="" country="SA" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

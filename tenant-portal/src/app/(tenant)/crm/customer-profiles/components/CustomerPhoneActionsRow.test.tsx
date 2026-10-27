// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CustomerPhoneActionsRow } from "./CustomerPhoneActionsRow";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

afterEach(cleanup);

describe.each([false, true])("CustomerPhoneActionsRow actionsOnly=%s", (actionsOnly) => {
  it.each([undefined, "Unknown country"])(
    "keeps local calling but offers no chat links with country %s",
    (country) => {
      render(
        <CustomerPhoneActionsRow
          phone="01050049899"
          country={country}
          actionsOnly={actionsOnly}
        />,
      );

      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(screen.getByRole("link", { name: "Call 01050049899" }))
        .toHaveAttribute("href", "tel:01050049899");
    },
  );

  it.each([
    { phone: "01050049899", country: "Egypt", digits: "201050049899" },
    { phone: "0501234567", country: "SA", digits: "966501234567" },
    { phone: "+966501234567", country: "Egypt", digits: "966501234567" },
    { phone: "+966501234567", country: undefined, digits: "966501234567" },
  ])("builds international chat links for $phone / $country", ({ phone, country, digits }) => {
    render(
      <CustomerPhoneActionsRow
        phone={phone}
        country={country}
        actionsOnly={actionsOnly}
      />,
    );

    expect(screen.getByRole("link", { name: `Message ${phone} on WhatsApp` }))
      .toHaveAttribute("href", `https://wa.me/${digits}`);
    expect(screen.getByRole("link", { name: `Message ${phone} on Telegram` }))
      .toHaveAttribute("href", `https://t.me/+${digits}`);
    expect(screen.getByRole("link", { name: `Call ${phone}` }))
      .toHaveAttribute("href", `tel:${phone}`);
  });
});

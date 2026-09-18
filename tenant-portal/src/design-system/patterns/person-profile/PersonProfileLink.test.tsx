// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PersonProfileLink } from "./PersonProfileLink";
afterEach(cleanup);
const labels = { open: "View contact details", description: "Contact details", phone: "Phone", email: "Email",
  unavailable: "Not available", close: "Close", retry: "Retry" };

describe("the reusable person template", () => {
  it("accepts verified contact data from another caller independently of user/audit APIs", () => {
    render(<PersonProfileLink person={{ fullName: "Saly Essam", phone: "+201000000000", email: "saly@example.com" }} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.open }));
    const dialog = screen.getByRole("dialog", { name: "Saly Essam" });
    expect(within(dialog).getByText("+201000000000")).toBeInTheDocument();
    expect(within(dialog).getByText("saly@example.com")).toBeInTheDocument();
    expect(within(dialog).getByText("SE")).toBeInTheDocument();
  });
  it("keeps failed images on the initials fallback and absent contact data explicit", () => {
    render(<PersonProfileLink person={{ fullName: "Saly Essam", imageUrl: "/unavailable-avatar.png" }} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.open }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("SE")).toBeInTheDocument();
    expect(within(dialog).getAllByText(labels.unavailable)).toHaveLength(2);
  });
});

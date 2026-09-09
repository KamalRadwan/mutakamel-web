// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContactChannelIcon } from "./ContactChannelIcon";

afterEach(cleanup);

describe("ContactChannelIcon", () => {
  it.each([
    { channel: "call", color: "text-success-vivid", viewBox: "0 0 16 16" },
    { channel: "whatsapp", color: "text-channel-whatsapp", viewBox: "0 0 24 24" },
    { channel: "telegram", color: "text-channel-telegram", viewBox: "0 0 24 24" },
  ] as const)("renders a local, colored $channel glyph inside a labelled action", ({ channel, color, viewBox }) => {
    const { container } = render(<ContactChannelIcon channel={channel} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", viewBox);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("fill", "currentColor");
    expect(svg).toHaveClass("size-4", "shrink-0", color);
    expect(svg?.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(100);
    expect(container.querySelector("img, image, use")).toBeNull();
  });
});

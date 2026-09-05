// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AcquisitionSourceIcon, AcquisitionSourceOption } from "./AcquisitionSourceIcon";

afterEach(cleanup);

const ICON_URL =
  "/api/tenant/crm/v1/acquisition-sources/01900100-0000-7000-8000-000000000001/icon?v=1770000000000";

describe("AcquisitionSourceIcon", () => {
  it("renders the server path exactly as given, never one it assembles", () => {
    const { container } = render(<AcquisitionSourceIcon source={{ iconUrl: ICON_URL }} />);
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(ICON_URL);
    // Decorative: the name is always rendered beside it.
    expect(image?.getAttribute("alt")).toBe("");
  });

  it("falls back to a mark when a source has uploaded no icon", () => {
    const { container } = render(<AcquisitionSourceIcon source={{ iconUrl: null }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("leaves the tile empty for a row that is not a source, keeping labels aligned", () => {
    const { container } = render(<AcquisitionSourceIcon source={null} />);
    // No megaphone here: "no source" is not a source without an icon.
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.firstElementChild?.childElementCount).toBe(0);
  });
});

describe("AcquisitionSourceOption", () => {
  it("puts the icon and the name in one element, which the trigger clone needs", () => {
    // Radix clones a selected item's text into the trigger, whose direct span
    // children are line-clamped into a vertical -webkit-box. Two children
    // there would stack the icon above the name.
    const { container } = render(
      <AcquisitionSourceOption source={{ iconUrl: ICON_URL }} label="Google Ads" />,
    );
    expect(container.childElementCount).toBe(1);
    expect(screen.getByText("Google Ads")).toBeInTheDocument();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(ICON_URL);
  });

  it("still renders a tile for the no-source row", () => {
    const { container } = render(<AcquisitionSourceOption source={null} label="No source" />);
    expect(screen.getByText("No source")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar, AvatarFallback } from "./Avatar";

afterEach(cleanup);

describe("Avatar", () => {
  it("renders the default neutral fallback with no outer ring", () => {
    render(
      <Avatar data-testid="avatar-root">
        <AvatarFallback>AH</AvatarFallback>
      </Avatar>,
    );

    const root = screen.getByTestId("avatar-root");
    const fallback = screen.getByText("AH");

    expect(root).not.toHaveClass("ring-[1.5px]", "ring-card");
    expect(fallback).toHaveClass("bg-secondary", "font-medium", "text-secondary-foreground");
    expect(fallback).not.toHaveClass("bg-gradient-avatar");
  });

  it("renders tone='user' with bg-gradient-avatar, white bold initials, and a 1.5px card ring", () => {
    render(
      <Avatar tone="user" data-testid="avatar-root">
        <AvatarFallback>AH</AvatarFallback>
      </Avatar>,
    );

    const root = screen.getByTestId("avatar-root");
    const fallback = screen.getByText("AH");

    expect(root).toHaveClass("ring-[1.5px]", "ring-card");
    expect(fallback).toHaveClass("bg-gradient-avatar", "text-white", "font-bold");
    expect(fallback.className).not.toMatch(/purple|violet|indigo|fuchsia|pink/);
  });
});

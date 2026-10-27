// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar, AvatarFallback } from "./Avatar";

afterEach(cleanup);

describe("Avatar", () => {
  it("allows a fallback to override the inherited user tone", () => {
    render(
      <Avatar tone="user">
        <AvatarFallback tone="default">AH</AvatarFallback>
      </Avatar>,
    );

    expect(screen.getByText("AH")).toHaveClass("bg-muted", "text-muted-foreground");
    expect(screen.getByText("AH")).not.toHaveClass("bg-gradient-avatar");
  });

  it("supports a user fallback within a default root without leaking tone to the DOM", () => {
    render(
      <Avatar data-testid="avatar-root">
        <AvatarFallback tone="user">AH</AvatarFallback>
      </Avatar>,
    );

    const fallback = screen.getByText("AH");
    expect(fallback).toHaveClass("bg-gradient-avatar", "ring-[1.5px]", "ring-inset", "ring-card");
    expect(fallback).not.toHaveAttribute("tone");
    expect(screen.getByTestId("avatar-root")).not.toHaveAttribute("tone");
  });

  it("renders the default neutral fallback with no outer ring", () => {
    render(
      <Avatar data-testid="avatar-root">
        <AvatarFallback>AH</AvatarFallback>
      </Avatar>,
    );

    const root = screen.getByTestId("avatar-root");
    const fallback = screen.getByText("AH");

    expect(root).not.toHaveClass("ring-[1.5px]", "ring-card");
    expect(fallback).toHaveClass("bg-muted", "font-semibold", "text-muted-foreground");
    expect(fallback).not.toHaveClass("bg-gradient-avatar");
  });

  it("renders tone='user' with bg-gradient-avatar, white semibold initials, and a 1.5px card ring", () => {
    render(
      <Avatar tone="user" data-testid="avatar-root">
        <AvatarFallback>AH</AvatarFallback>
      </Avatar>,
    );

    const root = screen.getByTestId("avatar-root");
    const fallback = screen.getByText("AH");

    expect(root).toHaveClass("ring-[1.5px]", "ring-card");
    expect(fallback).toHaveClass("bg-gradient-avatar", "text-white", "font-semibold");
    expect(fallback.className).not.toMatch(/purple|violet|indigo|fuchsia|pink/);
  });
});

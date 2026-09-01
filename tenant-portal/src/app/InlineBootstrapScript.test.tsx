// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InlineBootstrapScript } from "./InlineBootstrapScript";

const BOOTSTRAP = "window.__themeBootstrapProbe = true;";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("InlineBootstrapScript", () => {
  it("serializes an executable, nonced script on the server", () => {
    vi.stubGlobal("window", undefined);

    const markup = renderToStaticMarkup(
      <InlineBootstrapScript nonce="request-nonce" html={BOOTSTRAP} />,
    );

    expect(markup).toContain('id="theme-bootstrap"');
    expect(markup).toContain('type="text/javascript"');
    expect(markup).toContain('nonce="request-nonce"');
    expect(markup).toContain(BOOTSTRAP);
  });

  it("renders an inert data block on the client without React's script warning", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { container } = render(
      <InlineBootstrapScript nonce="request-nonce" html={BOOTSTRAP} />,
    );
    const script = container.querySelector<HTMLScriptElement>("#theme-bootstrap");

    expect(script).not.toBeNull();
    expect(script?.type).toBe("text/plain");
    expect(script?.textContent).toBe(BOOTSTRAP);
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "Encountered a script tag while rendering React component",
    );
  });
});

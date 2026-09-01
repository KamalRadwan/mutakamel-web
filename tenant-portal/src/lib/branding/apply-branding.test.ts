// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { applyBrandingTokens } from "./apply-branding";
import { PUBLIC_BRANDING_ICON_PATH, type PublicBranding } from "./public-branding";

function branding(overrides: Partial<PublicBranding> = {}): PublicBranding {
  return {
    appName: null,
    tabTitle: null,
    primaryColor: null,
    secondaryColor: null,
    fontFamily: null,
    loginHtml: null,
    logoUrl: null,
    iconUrl: null,
    ...overrides,
  };
}

function iconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.title = "";
  document.documentElement.removeAttribute("style");
});

describe("applyBrandingTokens — tab icon", () => {
  it("points an existing icon link at the tenant's own icon", () => {
    // What Next's app-dir convention emits for src/app/icon.svg.
    document.head.innerHTML =
      '<link rel="icon" href="/icon.svg?222ae2daa3baf316" type="image/svg+xml" sizes="any">';

    applyBrandingTokens(branding({ iconUrl: PUBLIC_BRANDING_ICON_PATH }));

    expect(iconLink()?.getAttribute("href")).toBe(PUBLIC_BRANDING_ICON_PATH);
    expect(document.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);
  });

  it("drops the type attribute, because the upload need not be an SVG", () => {
    document.head.innerHTML = '<link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any">';

    applyBrandingTokens(branding({ iconUrl: PUBLIC_BRANDING_ICON_PATH }));

    // Leaving type="image/svg+xml" on a PNG the tenant uploaded tells the
    // browser something false about bytes it is about to fetch.
    expect(iconLink()?.hasAttribute("type")).toBe(false);
  });

  it("creates the link when the document has none", () => {
    applyBrandingTokens(branding({ iconUrl: PUBLIC_BRANDING_ICON_PATH }));
    expect(iconLink()?.getAttribute("href")).toBe(PUBLIC_BRANDING_ICON_PATH);
  });

  it("leaves the system icon alone when the tenant has not uploaded one", () => {
    document.head.innerHTML = '<link rel="icon" href="/icon.svg" type="image/svg+xml">';

    applyBrandingTokens(branding());

    expect(iconLink()?.getAttribute("href")).toBe("/icon.svg");
    expect(iconLink()?.getAttribute("type")).toBe("image/svg+xml");
  });

  it("applies the icon even when no brand colour is set", () => {
    // The ordering trap. `applyBrandingTokens` returns `systemDefault` as soon
    // as `primaryColor` is absent; if the icon were applied after that guard, a
    // tenant with an icon and no colour would silently never get their icon.
    const outcome = applyBrandingTokens(
      branding({ iconUrl: PUBLIC_BRANDING_ICON_PATH, tabTitle: "Mersany" }),
    );

    expect(outcome).toEqual({ kind: "systemDefault" });
    expect(iconLink()?.getAttribute("href")).toBe(PUBLIC_BRANDING_ICON_PATH);
    expect(document.title).toBe("Mersany");
  });

  it("still applies the icon when the brand colour is refused", () => {
    // A colour that cannot pass the ramp's contrast gate must not take the
    // icon down with it — they are independent pieces of branding.
    const outcome = applyBrandingTokens(
      branding({ iconUrl: PUBLIC_BRANDING_ICON_PATH, primaryColor: "not-a-colour" }),
    );

    expect(outcome.kind).toBe("rejectedInvalid");
    expect(iconLink()?.getAttribute("href")).toBe(PUBLIC_BRANDING_ICON_PATH);
  });
});

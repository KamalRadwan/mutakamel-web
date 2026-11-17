import { headers } from "next/headers";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("next-themes", () => ({ ThemeProvider: () => null }));
vi.mock("./fonts", () => ({
  uiArabic: { variable: "arabic" },
  uiLatin: { variable: "latin" },
  uiMono: { variable: "mono" },
}));
vi.mock("@/i18n/I18nContext", () => ({ I18nProvider: () => null }));
vi.mock("@/i18n/DirectionBridge", () => ({ DirectionBridge: () => null }));
vi.mock("@/components/ui/ToastContext", () => ({ ToastProvider: () => null }));
vi.mock("@/context/AuthContext", () => ({ AuthProvider: () => null }));
vi.mock("@/context/PreferencesContext", () => ({ PreferencesProvider: () => null }));
vi.mock("@/components/auth/AuthGuard", () => ({ AuthGuard: () => null }));
vi.mock("@/components/layout/AdminWebPhone", () => ({ AdminWebPhone: () => null }));

describe("Root layout CSP nonce", () => {
  it.each(["a".repeat(32), "b".repeat(32)])(
    "passes request nonce %s to both pre-hydration scripts",
    async (nonce) => {
      vi.mocked(headers).mockResolvedValue(new Headers({ "x-nonce": nonce }));

      const layout = await RootLayout({ children: null });
      const [bootstrap, theme] = layout.props.children.props.children;

      expect(layout.props).toMatchObject({ lang: "en", dir: "ltr" });
      expect(bootstrap.type).toBe(Script);
      expect(bootstrap.props).toMatchObject({
        id: "lang-dir-bootstrap",
        strategy: "beforeInteractive",
        nonce,
      });
      expect(bootstrap.props.children).toContain('localStorage.getItem("app_lang")');
      expect(theme.type).toBe(ThemeProvider);
      expect(theme.props).toMatchObject({ nonce, attribute: "class", defaultTheme: "light" });
    },
  );
});

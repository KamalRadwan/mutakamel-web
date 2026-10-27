// @vitest-environment jsdom

import { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { OutboundEmailDetail } from "./outbound-email-contract";

const { state, reload } = vi.hoisted(() => ({
  state: { error: null as NormalizedApiError | null, email: null as OutboundEmailDetail | null },
  reload: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: ["crm.activities.read.own"] } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./hooks/useOutboundEmails", () => ({
  useOutboundEmails: () => ({
    items: [], hasLoaded: true, hasNext: false, isLoading: false,
    isLoadingMore: false, queryError: state.error, canSend: false,
    status: "", setStatus: vi.fn(), loadMore: vi.fn(), reload,
  }),
}));
vi.mock("./hooks/useOutboundEmailDetail", () => ({
  useOutboundEmailDetail: () => ({
    detail: state.email, queryError: state.error, isLoading: false,
    canRetry: false, isRetrying: false,
    notFound: state.error?.status === 404, reload,
  }),
}));
vi.mock("./hooks/useOutboundEmailComposer", () => ({ useOutboundEmailComposer: () => ({}) }));
vi.mock("./components/ComposeEmailDrawer", () => ({ ComposeEmailDrawer: () => null }));

import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { DICTIONARIES, type Language } from "@/i18n/useLanguage";
import { TooltipProvider } from "@/design-system";
import OutboundEmailsPage from "./page";
import OutboundEmailDetailPage from "./[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
  state.error = null;
  state.email = null;
  window.localStorage.setItem("tenant_lang", "en");
});

describe("outbound-email list filters", () => {
  it.each<Language>(["en", "ar"])("omits unsupported search in %s", async (lang) => {
    window.localStorage.setItem("tenant_lang", lang);
    await renderPage(false);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("retry unavailable explanations", () => {
  it.each<Language>(["en", "ar"])("links an existing child and hides retry in %s", async (lang) => {
    window.localStorage.setItem("tenant_lang", lang);
    state.email = makeFailedEmail();
    state.email.retriedById = "01900500-0000-7000-8000-000000000002";
    await renderPage(true);
    const copy = DICTIONARIES[lang].crmOutboundEmails;
    expect(screen.getByText(copy.retryAlreadyCreated)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.viewRetry })).toHaveAttribute(
      "href", `/crm/outbound-emails/${state.email.retriedById}`,
    );
    expect(screen.queryByRole("button", { name: copy.retry })).not.toBeInTheDocument();
  });

  it.each<Language>(["en", "ar"])("explains redacted content and hides retry in %s", async (lang) => {
    window.localStorage.setItem("tenant_lang", lang);
    state.email = makeFailedEmail();
    state.email.content = { state: "REDACTED_BY_RETENTION", redactedAt: state.email.requestedAt };
    await renderPage(true);
    const copy = DICTIONARIES[lang].crmOutboundEmails;
    expect(screen.getByText(copy.retryContentUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.retry })).not.toBeInTheDocument();
  });
});

function makeFailedEmail(): OutboundEmailDetail {
  const id = "01900500-0000-7000-8000-000000000001";
  return {
    outboundEmailId: id, activityId: id, sourceType: "LEAD", sourceId: id,
    status: "FAILED",
    recipient: { displayName: "Sara", maskedAddress: "s***@example.com" },
    sender: { displayName: "CRM", maskedAddress: "n***@example.com" },
    content: { state: "AVAILABLE", subject: "Hello", preheader: null, text: "Hello" },
    failure: null, feedback: [], timeline: [],
    requestedAt: "2026-10-18T09:00:00.000Z", sentAt: null, failedAt: null,
    retryOfId: null, retriedById: null,
  };
}
afterEach(cleanup);

async function renderPage(detail: boolean) {
  const params = Promise.resolve({ id: "01900500-0000-7000-8000-000000000001" });
  await act(async () => {
    render(
      <I18nProvider>
        <TooltipProvider>
          <Suspense fallback={null}>
            {detail ? <OutboundEmailDetailPage params={params} /> : <OutboundEmailsPage />}
          </Suspense>
        </TooltipProvider>
      </I18nProvider>,
    );
  });
}

describe.each([false, true])("outbound-email access (detail=%s)", (detail) => {
  it.each<Language>(["en", "ar"])("shows a non-retry plan state in %s", async (lang) => {
    window.localStorage.setItem("tenant_lang", lang);
    state.error = { status: 403, code: "CRM_FEATURE_DISABLED" };
    await renderPage(detail);
    const dictionary = DICTIONARIES[lang];
    expect(screen.getByText(dictionary.crmOutboundEmails.featureDisabledTitle)).toBeInTheDocument();
    expect(screen.getByText(dictionary.crmOutboundEmails.featureDisabledDescription)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.crmOutboundEmails.loadFailed)).not.toBeInTheDocument();
  });

  it("honors a server scope denial despite the session read grant", async () => {
    state.error = { status: 403, code: "CRM_SCOPED_PERMISSION_DENIED" };
    await renderPage(detail);
    expect(screen.getByText(detail ? en.crmShared.scopeDeniedTitle : en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(en.crmOutboundEmails.loadFailed)).not.toBeInTheDocument();
  });

  it("keeps server failures retryable", async () => {
    state.error = { status: 500 };
    await renderPage(detail);
    expect(screen.getByText(en.crmOutboundEmails.loadFailed)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: en.common.retry }).at(-1)!);
    expect(reload).toHaveBeenCalledOnce();
  });
});

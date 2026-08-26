// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublisherKeysScreen } from "./PublisherKeysScreen";
import type { PublisherKeysView } from "./usePublisherKeys";
import {
  ACTIVE_KEY,
  CHALLENGE_ID,
  IDEMPOTENCY_KEY,
  SIGNATURE,
} from "./test-fixtures";

const { languageMock, viewBox } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar" },
  viewBox: { current: null as unknown },
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => languageMock }));
vi.mock("./usePublisherKeys", () => ({
  usePublisherKeys: () => viewBox.current,
}));

function makeView(): PublisherKeysView {
  return {
    permissions: {
      canRead: true,
      canManage: true,
      canCritical: true,
      canRegisterOrRevoke: true,
    },
    directory: {
      data: [ACTIVE_KEY],
      state: "READY",
      error: null,
      correlationId: "019f1000-0000-7000-8000-000000000001",
      timestamp: "2026-08-12T12:00:01.000Z",
      isRefreshing: false,
    },
    refreshDirectory: vi.fn(),
    selectedId: ACTIVE_KEY.publisherKeyId,
    selectKey: vi.fn(),
    detail: {
      data: ACTIVE_KEY,
      state: "READY",
      error: null,
      correlationId: "019f1000-0000-7000-8000-000000000001",
      timestamp: "2026-08-12T12:00:01.000Z",
      isRefreshing: false,
    },
    refreshDetail: vi.fn(),
    challengeDraft: {
      keyId: "core-release-primary",
      publicKeyBase64: ACTIVE_KEY.publicKeyBase64,
      expiresInSeconds: "300",
    },
    challengeErrors: {},
    setChallengeDraftField: vi.fn(),
    registerDraft: {
      challengeId: CHALLENGE_ID,
      proofSignatureBase64: SIGNATURE,
    },
    registerErrors: {},
    setRegisterDraftField: vi.fn(),
    revokeDraft: {
      publisherKeyId: ACTIVE_KEY.publisherKeyId,
      expectedRevision: "1",
      reasonCode: "KEY_ROTATED",
    },
    revokeErrors: {},
    setRevokeDraftField: vi.fn(),
    challengeResult: null,
    mutation: {
      state: "IDLE",
      kind: null,
      error: null,
      correlationId: null,
      result: null,
      pendingIntent: null,
      exactRetryAvailable: false,
    },
    requestChallenge: vi.fn(() => true),
    requestRegister: vi.fn(() => true),
    requestRevoke: vi.fn(() => true),
    confirmMutation: vi.fn(),
    closeConfirmation: vi.fn(),
    retryExactMutation: vi.fn(),
    clearMutation: vi.fn(),
  } as PublisherKeysView;
}

describe("PublisherKeysScreen", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    viewBox.current = makeView();
  });

  it("renders the full five-route operator workflow and reachable controls", () => {
    const view = viewBox.current as PublisherKeysView;
    render(<PublisherKeysScreen />);

    expect(
      screen.getByRole("heading", { name: "Provisioning publisher keys" }),
    ).toBeTruthy();
    expect(screen.getAllByText(/Never paste a seed/u).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Trusted-key directory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Publisher-key detail" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Create an actor-bound challenge/u })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Register the verified public key/u })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    fireEvent.click(screen.getByRole("button", { name: "Create challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Review registration" }));
    fireEvent.click(screen.getByRole("button", { name: "Review revocation" }));

    expect(view.refreshDirectory).toHaveBeenCalledOnce();
    expect(view.selectKey).toHaveBeenCalledWith(ACTIVE_KEY.publisherKeyId);
    expect(view.requestChallenge).toHaveBeenCalledOnce();
    expect(view.requestRegister).toHaveBeenCalledOnce();
    expect(view.requestRevoke).toHaveBeenCalledOnce();
  });

  it("keeps directory and challenge permissions independent", () => {
    const view = makeView();
    view.permissions.canRead = false;
    view.directory = {
      data: null,
      state: "FORBIDDEN",
      error: null,
      correlationId: null,
      timestamp: null,
      isRefreshing: false,
    };
    view.selectedId = null;
    viewBox.current = view;
    render(<PublisherKeysScreen />);

    expect(
      screen.getByText(
        "Required permission: admin.provisioning.publisher-keys.read",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create challenge" })).toBeTruthy();
  });

  it("disables critical commands without the critical permission", () => {
    const view = makeView();
    view.permissions.canCritical = false;
    view.permissions.canRegisterOrRevoke = false;
    viewBox.current = view;
    render(<PublisherKeysScreen />);

    expect(
      (screen.getByRole("button", {
        name: "Review registration",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Review revocation",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      screen.getAllByText(/admin\.provisioning\.critical/u).length,
    ).toBeGreaterThan(0);
  });

  it("renders and confirms the exact critical registration intent", () => {
    const view = makeView();
    view.mutation = {
      ...view.mutation,
      state: "CONFIRMING_REGISTER",
      kind: "REGISTER",
      pendingIntent: {
        kind: "REGISTER",
        command: {
          challengeId: CHALLENGE_ID,
          proofSignatureBase64: SIGNATURE,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    };
    viewBox.current = view;
    render(<PublisherKeysScreen />);

    expect(
      screen.getByRole("dialog", { name: "Confirm critical key registration" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(view.confirmMutation).toHaveBeenCalledOnce();
  });

  it("uses feature-local Arabic copy and RTL direction", () => {
    languageMock.lang = "ar";
    const { container } = render(<PublisherKeysScreen />);

    expect(
      screen.getByRole("heading", { name: "مفاتيح ناشري التهيئة" }),
    ).toBeTruthy();
    expect(container.firstElementChild?.getAttribute("dir")).toBe("rtl");
  });
});

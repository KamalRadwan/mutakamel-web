// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getMock } = vi.hoisted(() => ({
  authMock: { freshLoginCount: 0 },
  getMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock },
  unwrapCoreData: (payload: unknown) =>
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload,
}));

import { BrowserPermissionsGate } from "./BrowserPermissionsGate";
import { WEBPHONE_ME_ENDPOINT } from "./browser-permissions";
import { en } from "@/i18n/dictionaries/en";

const COPY = en.browserPermissions;

type MicrophoneQueryAnswer = "granted" | "denied" | "prompt" | "throws";

let stopTrack: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let requestNotificationPermission: ReturnType<typeof vi.fn>;

function stubMicrophoneQuery(answer: MicrophoneQueryAnswer | "unsupported") {
  if (answer === "unsupported") {
    Reflect.deleteProperty(navigator, "permissions");
    return;
  }
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: {
      query: vi.fn(async () => {
        if (answer === "throws") {
          throw new TypeError("microphone is not a valid PermissionName");
        }
        return { state: answer };
      }),
    },
  });
}

function stubMediaDevices({ supported }: { supported: boolean }) {
  stopTrack = vi.fn();
  getUserMedia = vi.fn(async () => ({
    getTracks: () => [{ stop: stopTrack }, { stop: stopTrack }],
  }));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: supported ? { getUserMedia } : undefined,
  });
}

function stubNotifications(permission: NotificationPermission | "unsupported") {
  requestNotificationPermission = vi.fn(async () => "granted");
  if (permission === "unsupported") {
    vi.stubGlobal("Notification", undefined);
    return;
  }
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: requestNotificationPermission,
  });
}

function stubSoftphone({ enabled }: { enabled: boolean }) {
  getMock.mockResolvedValue({ data: { data: { enabled, extension: "1001" } } });
}

/**
 * The gate reaches the answer through a chain of awaits (permission query →
 * Gateway probe → state commit). Flushing a generous number of microtask
 * turns inside act() lets a "nothing should open" assertion be meaningful
 * rather than merely early.
 */
async function settle() {
  await act(async () => {
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
  });
}

function renderAfterLogin(freshLoginCount = 1) {
  authMock.freshLoginCount = freshLoginCount;
  return render(<BrowserPermissionsGate />);
}

function openDialogTitles(): string[] {
  return screen
    .queryAllByRole("alertdialog")
    .map((dialog) => dialog.textContent ?? "");
}

describe("BrowserPermissionsGate", () => {
  beforeEach(() => {
    authMock.freshLoginCount = 0;
    getMock.mockReset();
    stubMicrophoneQuery("prompt");
    stubMediaDevices({ supported: true });
    stubNotifications("default");
    stubSoftphone({ enabled: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "permissions");
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("asks for the microphone after a fresh login, without touching the browser API on mount", async () => {
    renderAfterLogin();

    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(WEBPHONE_ME_ENDPOINT, {
      cache: "no-store",
    });
    // The native prompt must wait for the Allow click — a getUserMedia call
    // during the effect is the exact page-load prompt this dialog replaces.
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(requestNotificationPermission).not.toHaveBeenCalled();
  });

  it("stays silent for a session restored without a fresh login", async () => {
    const view = render(<BrowserPermissionsGate />);
    await settle();

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(getMock).not.toHaveBeenCalled();

    // A bootstrap, a proactive refresh, and cross-tab session adoption all
    // re-render the tree without moving the counter.
    view.rerender(<BrowserPermissionsGate />);
    await settle();

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("asks again on the next sign-in in the same document", async () => {
    const view = renderAfterLogin();
    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText(COPY.notificationsTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    authMock.freshLoginCount = 2;
    view.rerender(<BrowserPermissionsGate />);

    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();
  });

  it("skips the microphone when the browser has already granted it", async () => {
    stubMicrophoneQuery("granted");
    renderAfterLogin();

    expect(await screen.findByText(COPY.notificationsTitle)).toBeInTheDocument();
    expect(screen.queryByText(COPY.audioTitle)).toBeNull();
    // An answered permission is settled locally, so no Gateway probe is owed.
    expect(getMock).not.toHaveBeenCalled();
  });

  /**
   * A blocked permission cannot be re-prompted from script, so the dialog
   * tells rather than asks — and it has to appear at all, because the
   * operator who blocked the microphone once is exactly the one who will
   * otherwise never learn why their calls carry no audio.
   */
  it("tells the operator when the microphone is blocked, instead of staying silent", async () => {
    stubMicrophoneQuery("denied");
    renderAfterLogin();

    expect(await screen.findByText(COPY.audioBlockedTitle)).toBeInTheDocument();
    expect(screen.queryByText(COPY.audioTitle)).toBeNull();
  });

  /** Acknowledging it asks the browser for nothing, and moves on. */
  it("makes no request from the blocked dialog", async () => {
    stubMicrophoneQuery("denied");
    stubNotifications("default");
    renderAfterLogin();

    fireEvent.click(await screen.findByRole("button", { name: COPY.audioBlockedConfirm }));

    expect(await screen.findByText(COPY.notificationsTitle)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("prompts for the microphone when the permission query is unsupported", async () => {
    stubMicrophoneQuery("throws");
    renderAfterLogin();

    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();
  });

  it("skips the microphone entirely when the admin has no softphone", async () => {
    stubSoftphone({ enabled: false });
    renderAfterLogin();

    expect(await screen.findByText(COPY.notificationsTitle)).toBeInTheDocument();
    expect(screen.queryByText(COPY.audioTitle)).toBeNull();
  });

  it("treats a refused webphone probe as no softphone", async () => {
    getMock.mockRejectedValue({ response: { status: 403 } });
    renderAfterLogin();

    expect(await screen.findByText(COPY.notificationsTitle)).toBeInTheDocument();
    expect(screen.queryByText(COPY.audioTitle)).toBeNull();
  });

  /**
   * Blocked notifications are the case that otherwise stays invisible
   * forever: calls stop reaching the operator and nothing ever says why.
   */
  it("tells the operator when notifications are blocked", async () => {
    stubMicrophoneQuery("granted");
    stubNotifications("denied");
    renderAfterLogin();

    expect(
      await screen.findByText(COPY.notificationsBlockedTitle),
    ).toBeInTheDocument();
  });

  /**
   * There is no speaker permission to ask for, so the only thing that can
   * genuinely be wrong is that no output device exists — and a softphone on
   * a machine with no speaker is silent in a way no permission dialog would
   * ever explain. The grant alone is therefore not enough to stay quiet.
   */
  it("raises the audio question when a granted microphone has nothing to play through", async () => {
    stubMicrophoneQuery("granted");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: vi.fn(async () => [
          { kind: "audioinput", deviceId: "mic-1" } as MediaDeviceInfo,
        ]),
      },
    });
    renderAfterLogin();

    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(COPY.noSpeakerNotice))).toBeInTheDocument();
  });

  /** A browser that withholds the device list is not a missing speaker. */
  it("does not invent a speaker fault when the device list is unavailable", async () => {
    stubMicrophoneQuery("granted");
    stubNotifications("granted");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: vi.fn(async () => {
          throw new Error("not permitted");
        }),
      },
    });
    renderAfterLogin();
    await settle();

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  /**
   * A live grant is the only answer that ends the question. `denied` gets the
   * blocked dialog above, because that is the state worth surfacing.
   */
  it("stays silent once both permissions are actually granted", async () => {
    stubMicrophoneQuery("granted");
    stubNotifications("granted");
    renderAfterLogin();
    await settle();

    expect(screen.queryByRole("alertdialog")).toBeNull();
    // Nothing to ask about means the softphone probe is never worth paying for.
    expect(getMock).not.toHaveBeenCalled();
  });

  it("runs the two questions one at a time, not together", async () => {
    renderAfterLogin();

    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();
    expect(openDialogTitles()).toHaveLength(1);
    expect(screen.queryByText(COPY.notificationsTitle)).toBeNull();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: COPY.audioConfirm }),
      );
    });

    expect(await screen.findByText(COPY.notificationsTitle)).toBeInTheDocument();
    expect(openDialogTitles()).toHaveLength(1);
    expect(screen.queryByText(COPY.audioTitle)).toBeNull();
    expect(requestNotificationPermission).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: COPY.notificationsConfirm }),
      );
    });

    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
    await settle();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("still asks about notifications after the microphone question is cancelled", async () => {
    renderAfterLogin();
    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText(COPY.notificationsTitle)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("releases every microphone track as soon as the grant is recorded", async () => {
    renderAfterLogin();
    expect(await screen.findByText(COPY.audioTitle)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: COPY.audioConfirm }),
      );
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    // Both tracks — leaving either open keeps the tab's recording indicator
    // lit even though the grant already survives the stream.
    expect(stopTrack).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when the browser exposes neither capability", async () => {
    stubMediaDevices({ supported: false });
    stubNotifications("unsupported");
    renderAfterLogin();
    await settle();

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });
});

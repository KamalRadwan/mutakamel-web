import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";

export const WEBPHONE_ME_ENDPOINT = "/api/admin/core/v1/webphone/me";

/**
 * `navigator` exists on the server as a stub in some runtimes and not at all
 * in others, and even in a real browser `mediaDevices` is absent outside a
 * secure context while `permissions` is absent in older Safari. Every entry
 * point below therefore reads them through this optional view rather than the
 * lib.dom types, which declare both as always-present.
 */
type OptionalCapabilityNavigator = Navigator & {
  mediaDevices?: MediaDevices;
  permissions?: Permissions;
};

/**
 * `prompt` can be asked for. `denied` cannot be reopened from script —
 * `getUserMedia` and `requestPermission` both resolve straight back to
 * "denied" without showing anything — so that case needs telling, not asking.
 */
export type MicrophonePermissionState = "granted" | "denied" | "prompt";

/** What a dialog can usefully do about a permission. */
export type PromptMode = "ask" | "blocked";

function readNavigator(): OptionalCapabilityNavigator | null {
  if (typeof navigator === "undefined") return null;
  return navigator as OptionalCapabilityNavigator;
}

export function supportsMicrophoneCapture(): boolean {
  const capabilities = readNavigator();
  return typeof capabilities?.mediaDevices?.getUserMedia === "function";
}

export async function readMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  const permissions = readNavigator()?.permissions;
  if (typeof permissions?.query !== "function") return "prompt";

  try {
    const status = await permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state === "granted" || status.state === "denied"
      ? status.state
      : "prompt";
  } catch {
    // Firefox and Safari reject the "microphone" descriptor outright. The
    // state is then unknowable without asking, so fall through to asking.
    return "prompt";
  }
}

/**
 * Opens the microphone only long enough for the browser to record the grant,
 * then releases every track. Holding the stream would leave the tab's
 * recording indicator lit for the whole session even though nothing is
 * listening; the permission itself outlives the stream.
 */
export async function requestMicrophoneAccess(): Promise<void> {
  const mediaDevices = readNavigator()?.mediaDevices;
  if (typeof mediaDevices?.getUserMedia !== "function") return;

  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
  } catch {
    // "Block" at the browser's own prompt is an answer, not a fault. The
    // sequence moves on rather than reporting a failure the user chose.
  }
}

function readNotificationApi(): typeof Notification | null {
  if (typeof Notification === "undefined") return null;
  if (typeof Notification.requestPermission !== "function") return null;
  return Notification;
}

/**
 * How to raise the notification question, or `null` when there is none.
 *
 * Anything other than a live grant is worth raising: `default` has never been
 * asked, and `denied` is the case that otherwise stays invisible forever —
 * the operator who blocked notifications once is exactly the one who will
 * never learn why calls stopped reaching them.
 */
export function notificationPromptMode(): PromptMode | null {
  const permission = readNotificationApi()?.permission;
  if (!permission || permission === "granted") return null;
  return permission === "denied" ? "blocked" : "ask";
}

export async function requestNotificationAccess(): Promise<void> {
  const api = readNotificationApi();
  if (!api) return;

  try {
    await api.requestPermission();
  } catch {
    // Legacy Safari only supports the callback form and rejects the promise.
  }
}

/**
 * `enabled: true` means this admin owns an extension. Anything else — an
 * absent extension, a 403 from the owner guard, an unreachable Gateway — is
 * read as "no softphone", because this probe exists to decide whether to ask
 * for a permission, and there is nothing worth interrupting the operator
 * about when it cannot be answered.
 */
export async function hasAssignedSoftphone(): Promise<boolean> {
  try {
    const response = await axiosClient.get(WEBPHONE_ME_ENDPOINT, {
      cache: "no-store",
    });
    const payload = unwrapCoreData<unknown>(response.data);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return false;
    }
    return (payload as { enabled?: unknown }).enabled === true;
  } catch {
    return false;
  }
}

/**
 * Whether the browser can actually play call audio anywhere.
 *
 * There is no speaker *permission* to request — browsers gate capture, not
 * playback. What can genuinely be wrong is that no output device exists at
 * all, and a softphone on a machine with no speaker or headset is silent in
 * a way no permission dialog would ever explain. Device labels stay blank
 * until the microphone is granted, but presence is readable regardless,
 * which is the part this needs.
 */
export async function hasAudioOutputDevice(): Promise<boolean> {
  const mediaDevices = readNavigator()?.mediaDevices;
  if (typeof mediaDevices?.enumerateDevices !== "function") return true;

  try {
    const devices = await mediaDevices.enumerateDevices();
    // Some browsers withhold the output list entirely rather than reporting
    // an empty one; absence of evidence is not a missing speaker.
    if (!devices.some((device) => device.kind === "audiooutput")) {
      return !devices.some((device) => device.kind === "audioinput");
    }
    return true;
  } catch {
    return true;
  }
}

export interface AudioReadiness {
  mode: PromptMode;
  /** No output device at all — the call would be one-way even once granted. */
  missingSpeaker: boolean;
}

/**
 * The audio question for an operator who has a softphone: microphone and
 * speaker together, since a call needs both and one dialog is less
 * interruption than two.
 *
 * Returns `null` when there is nothing to raise — no softphone, no capture
 * support, or the microphone is already granted and an output exists.
 */
export async function audioReadiness(): Promise<AudioReadiness | null> {
  if (!supportsMicrophoneCapture()) return null;

  // Both of these are local reads. Settling them before the softphone probe
  // means an operator whose audio is already in order costs no Gateway round
  // trip on every single sign-in.
  const state = await readMicrophonePermissionState();
  const missingSpeaker = !(await hasAudioOutputDevice());
  if (state === "granted" && !missingSpeaker) return null;

  if (!(await hasAssignedSoftphone())) return null;
  return { mode: state === "denied" ? "blocked" : "ask", missingSpeaker };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Headphones } from "lucide-react";
import { ConfirmActionModal } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import {
  audioReadiness,
  notificationPromptMode,
  requestMicrophoneAccess,
  requestNotificationAccess,
  type PromptMode,
} from "./browser-permissions";

interface Question {
  kind: "audio" | "notifications";
  mode: PromptMode;
  /** No output device at all, so audio would be one-way even once granted. */
  missingSpeaker?: boolean;
}

type CopyKey = "audio" | "audioBlocked" | "notifications" | "notificationsBlocked";

/**
 * Asks, once per fresh sign-in, for the browser permissions the portal needs
 * — never on mount, and never two at once.
 *
 * `getUserMedia` and `Notification.requestPermission()` are only honoured
 * from a user gesture, and a page that prompts unasked on load is exactly the
 * experience these dialogs replace. So the browser APIs are reached from the
 * Allow click alone; everything before it is read-only probing that cannot
 * raise a native prompt.
 *
 * A permission the operator already blocked gets a different dialog rather
 * than none. Script cannot reopen that decision — `getUserMedia` rejects
 * instantly without showing anything — so an Allow button there would be a
 * lie, and the dialog says where to change it instead. Silence was the worse
 * option: whoever blocked notifications once is precisely the person who
 * never finds out why calls stopped reaching them.
 */
export function BrowserPermissionsGate() {
  const { freshLoginCount } = useAuth();
  const { lang } = useI18n();
  const [question, setQuestion] = useState<Question | null>(null);
  const [isAwaitingBrowser, setIsAwaitingBrowser] = useState(false);
  const handledLoginRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Notification state is re-read here rather than at sign-in: the audio
  // dialog may have been on screen for a while, and answering it is what
  // makes the next question current.
  const advance = useCallback(() => {
    setQuestion((current) => {
      if (current?.kind !== "audio") return null;
      const mode = notificationPromptMode();
      return mode ? { kind: "notifications", mode } : null;
    });
  }, []);

  useEffect(() => {
    // A counter bumped only by a real sign-in is what separates one from a
    // restore: bootstrap, refresh and cross-tab adoption never move it, and a
    // reload starts back at 0.
    if (freshLoginCount === 0 || freshLoginCount === handledLoginRef.current) {
      return;
    }
    handledLoginRef.current = freshLoginCount;

    let cancelled = false;
    void (async () => {
      const audio = await audioReadiness();
      if (cancelled || !mountedRef.current) return;
      if (audio) {
        setQuestion({ kind: "audio", ...audio });
        return;
      }
      const mode = notificationPromptMode();
      setQuestion(mode ? { kind: "notifications", mode } : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [freshLoginCount]);

  const confirm = useCallback(async () => {
    // A blocked permission has no request to make: that dialog was telling,
    // not asking, so acknowledging it simply moves on.
    if (!question || question.mode === "blocked") {
      advance();
      return;
    }

    setIsAwaitingBrowser(true);
    try {
      if (question.kind === "audio") {
        await requestMicrophoneAccess();
      } else {
        await requestNotificationAccess();
      }
    } finally {
      if (mountedRef.current) {
        setIsAwaitingBrowser(false);
        advance();
      }
    }
  }, [advance, question]);

  if (!question) return null;

  const enCopy = en.browserPermissions;
  const arCopy = ar.browserPermissions;
  const key: CopyKey = `${question.kind}${
    question.mode === "blocked" ? "Blocked" : ""
  }` as CopyKey;

  // Appended rather than a dialog of its own: a machine with no output device
  // still needs the microphone question answered, and two dialogs about one
  // call's audio is one too many.
  const speakerNote = question.missingSpeaker ?? false;

  return (
    <ConfirmActionModal
      isOpen
      onClose={advance}
      onConfirm={confirm}
      variant="info"
      icon={question.kind === "audio" ? Headphones : Bell}
      isLoading={isAwaitingBrowser}
      loadingLabel={(lang === "ar" ? arCopy : enCopy).waiting}
      titleEn={enCopy[`${key}Title`]}
      titleAr={arCopy[`${key}Title`]}
      descriptionEn={
        speakerNote
          ? `${enCopy[`${key}Description`]} ${enCopy.noSpeakerNotice}`
          : enCopy[`${key}Description`]
      }
      descriptionAr={
        speakerNote
          ? `${arCopy[`${key}Description`]} ${arCopy.noSpeakerNotice}`
          : arCopy[`${key}Description`]
      }
      confirmTextEn={enCopy[`${key}Confirm`]}
      confirmTextAr={arCopy[`${key}Confirm`]}
    />
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { endAdminBrowserSession } from "@/lib/api/axiosClient";

import { confirmMfaSettings, readMfaSettings, startMfaSettings } from "@/lib/auth/mfaApi";
import { useMfaChallenge } from "@/lib/auth/useMfaChallenge";

export function useProfileMfa() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const loadGeneration = useRef(0);
  const mfa = useMfaChallenge(async (challengeId, code) => {
    await confirmMfaSettings(challengeId, code);
    endAdminBrowserSession();
    window.location.replace("/login");
  }, true);

  const reload = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setLoadFailed(false);
    setEnabled(null);
    try {
      const value = await readMfaSettings();
      if (loadGeneration.current === generation) setEnabled(value);
    } catch {
      if (loadGeneration.current === generation) setLoadFailed(true);
    } finally {
      if (loadGeneration.current === generation) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void reload(); });
    return () => { cancelled = true; loadGeneration.current++; };
  }, [reload]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (enabled === null || !password || inFlight.current || mfa.blocked) return;
    inFlight.current = true;
    setSending(true);
    try {
      const step = await startMfaSettings(!enabled, password);
      mfa.start(step);
    } catch (caught) {
      mfa.reportFailure(caught);
    } finally {
      setPassword("");
      inFlight.current = false;
      setSending(false);
    }
  };

  const restart = () => {
    // An ambiguous confirmation may have committed and revoked this session.
    if (mfa.restartRequired) { window.location.replace("/login"); return; }
    mfa.reset();
    setPassword("");
    setEditing(false);
    void reload();
  };

  return { enabled, loading, loadFailed, editing, setEditing, password, setPassword,
    sending, submit, reload, restart, mfa };
}

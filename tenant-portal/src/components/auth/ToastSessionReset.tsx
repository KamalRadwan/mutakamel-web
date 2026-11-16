"use client";

import { useEffect, useRef } from "react";
import { toast as sonnerToast } from "sonner";
import { useTenantAuth } from "@/context/AuthContext";

export function ToastSessionReset() {
  const { user } = useTenantAuth();
  const userId = user?.id ?? null;
  const previousUserId = useRef(userId);

  useEffect(() => {
    if (previousUserId.current === userId) return;
    previousUserId.current = userId;
    sonnerToast.dismiss();
  }, [userId]);

  return null;
}

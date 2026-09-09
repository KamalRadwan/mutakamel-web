"use client";

import { useTenantAuth } from "@/context/AuthContext";
import { SubscriptionWorkspace } from "./components/subscription-workspace";

export default function SubscriptionPage() {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  return (
    <SubscriptionWorkspace key={`${user?.id ?? "none"}:${realtimeAuthGeneration ?? "none"}`} />
  );
}

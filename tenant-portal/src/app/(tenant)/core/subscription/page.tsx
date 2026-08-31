"use client";

import { OwnerGate } from "../components/OwnerGate";
import { SubscriptionWorkspace } from "./components/subscription-workspace";

export default function SubscriptionPage() {
  return (
    <OwnerGate>
      <SubscriptionWorkspace />
    </OwnerGate>
  );
}

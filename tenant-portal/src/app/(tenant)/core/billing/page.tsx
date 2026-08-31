"use client";

import { OwnerGate } from "../components/OwnerGate";
import { BillingWorkspace } from "./components/billing-workspace";

export default function BillingPage() {
  return (
    <OwnerGate>
      <BillingWorkspace />
    </OwnerGate>
  );
}

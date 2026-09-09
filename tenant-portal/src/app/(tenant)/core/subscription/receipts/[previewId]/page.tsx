"use client";

import { use } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { OwnerGate } from "../../../components/OwnerGate";
import { CommercialReceiptWorkspace } from "../../components/CommercialReceiptWorkspace";

export default function CommercialReceiptPage({ params }: { params: Promise<{ previewId: string }> }) {
  const { previewId } = use(params);
  const { user, realtimeAuthGeneration } = useTenantAuth();
  return <OwnerGate>
    <CommercialReceiptWorkspace key={`${previewId}:${user?.id ?? "none"}:${realtimeAuthGeneration ?? "none"}`} reference={{ previewId }} />
  </OwnerGate>;
}

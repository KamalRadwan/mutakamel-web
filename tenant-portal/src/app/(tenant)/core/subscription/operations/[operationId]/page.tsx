"use client";

import { use } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { OwnerGate } from "../../../components/OwnerGate";
import { CommercialOperationWorkspace } from "../../components/CommercialOperationWorkspace";

export default function CommercialOperationPage({ params }: { params: Promise<{ operationId: string }> }) {
  const { operationId } = use(params);
  const { user, realtimeAuthGeneration } = useTenantAuth();
  return <OwnerGate>
    <CommercialOperationWorkspace key={`${operationId}:${user?.id ?? "none"}:${realtimeAuthGeneration ?? "none"}`} operationId={operationId} />
  </OwnerGate>;
}

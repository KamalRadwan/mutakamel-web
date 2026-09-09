"use client";

import { use } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { OwnerGate } from "../../../components/OwnerGate";
import { InvoiceDetailWorkspace } from "./components/invoice-detail-workspace";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, realtimeAuthGeneration } = useTenantAuth();
  return (
    <OwnerGate>
      <InvoiceDetailWorkspace key={`${id}:${user?.id ?? "none"}:${realtimeAuthGeneration ?? "none"}`} invoiceId={id} />
    </OwnerGate>
  );
}

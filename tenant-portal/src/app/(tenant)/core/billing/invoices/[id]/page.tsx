"use client";

import { use } from "react";
import { OwnerGate } from "../../../components/OwnerGate";
import { InvoiceDetailWorkspace } from "./components/invoice-detail-workspace";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <OwnerGate>
      <InvoiceDetailWorkspace invoiceId={id} />
    </OwnerGate>
  );
}

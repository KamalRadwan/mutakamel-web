"use client";

import { use } from "react";
import { PartyDetailWorkspace } from "./components/party-detail-workspace";

export default function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PartyDetailWorkspace id={id} />;
}

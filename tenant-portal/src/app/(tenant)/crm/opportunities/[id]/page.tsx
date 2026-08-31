"use client";

import { use } from "react";
import { OpportunityDetailWorkspace } from "./components/opportunity-detail-workspace";

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OpportunityDetailWorkspace opportunityId={id} />;
}

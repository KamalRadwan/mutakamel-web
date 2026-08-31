"use client";

import { use } from "react";
import { OrganizationNodeDetail } from "../../components/OrganizationNodeDetail";

export default function BranchesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrganizationNodeDetail level="branches" id={id} />;
}

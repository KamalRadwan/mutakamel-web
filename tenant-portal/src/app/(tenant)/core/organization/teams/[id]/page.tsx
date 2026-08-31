"use client";

import { use } from "react";
import { OrganizationNodeDetail } from "../../components/OrganizationNodeDetail";

export default function TeamsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrganizationNodeDetail level="teams" id={id} />;
}

"use client";

import { use } from "react";
import { OrganizationNodeDetail } from "../../components/OrganizationNodeDetail";

export default function CompaniesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrganizationNodeDetail level="companies" id={id} />;
}

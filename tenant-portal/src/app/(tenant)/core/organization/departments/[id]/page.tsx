"use client";

import { use } from "react";
import { OrganizationNodeDetail } from "../../components/OrganizationNodeDetail";

export default function DepartmentsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrganizationNodeDetail level="departments" id={id} />;
}

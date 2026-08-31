"use client";

import { use } from "react";
import { CustomerProfileDetailWorkspace } from "./components/customer-profile-detail-workspace";

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CustomerProfileDetailWorkspace profileId={id} />;
}

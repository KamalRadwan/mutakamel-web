"use client";

import { use } from "react";
import { StorageServerDetailScreen } from "@/features/admin/storage-servers/screens/StorageServerDetailScreen";

export default function StorageServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <StorageServerDetailScreen id={use(params).id} />;
}

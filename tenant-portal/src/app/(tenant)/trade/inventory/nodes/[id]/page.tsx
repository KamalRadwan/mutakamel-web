"use client";

import { use } from "react";
import { NodeDetailWorkspace } from "./components/node-detail-workspace";

export default function InventoryNodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <NodeDetailWorkspace nodeId={id} />;
}

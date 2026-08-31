"use client";

import { use } from "react";
import { TemplateDetailWorkspace } from "./components/template-detail-workspace";

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TemplateDetailWorkspace id={id} />;
}

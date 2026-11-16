"use client";

import { use } from "react";
import { PipelineConfiguration } from "../components/PipelineConfiguration";

export default function PipelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PipelineConfiguration key={id} pipelineId={id} />;
}

import type { Metadata } from "next";
import { PipelineWorkspace } from "@/features/crm/pipeline/components/pipeline-workspace";

export const metadata: Metadata = {
  title: "CRM Pipeline | Mutakamel Tenant Portal",
  description: "Manage sales opportunities in board, list, and card views.",
};

export default function PipelinePage() {
  return <PipelineWorkspace />;
}

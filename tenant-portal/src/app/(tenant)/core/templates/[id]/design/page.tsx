import { notFound } from "next/navigation";
import { isUUIDv7 } from "@/lib/uuid";
import { TemplateDesignWorkspace } from "./TemplateDesignWorkspace";

export default async function TemplateDesignPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ previewVersion?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUUIDv7(id)) notFound();
  const versionId = query?.previewVersion;
  if (versionId !== undefined && (typeof versionId !== "string" || !isUUIDv7(versionId))) notFound();
  return <TemplateDesignWorkspace id={id} previewVersionId={versionId?.toLowerCase()} />;
}

import { notFound } from "next/navigation";
import { applicationAccessRoute, applicationAccessScopeRoute } from "../application-access-route";
import { ApplicationAccessDetail } from "../components/ApplicationAccessDetail";
import { ApplicationAccessList } from "../components/ApplicationAccessList";

export default async function ApplicationAccessPage({ params }: { params: Promise<{ target: string[] }> }) {
  const { target } = await params;
  const scope = applicationAccessScopeRoute(target);
  if (scope) return <ApplicationAccessList {...scope} />;
  const request = applicationAccessRoute(target);
  if (!request) notFound();
  return <ApplicationAccessDetail request={request} />;
}

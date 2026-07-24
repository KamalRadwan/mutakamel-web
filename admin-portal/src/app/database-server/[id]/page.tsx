import { redirect } from "next/navigation";

export default function DatabaseServerDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return redirect(`/database-servers`);
}

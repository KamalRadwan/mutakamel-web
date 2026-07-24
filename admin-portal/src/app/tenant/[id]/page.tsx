import { redirect } from "next/navigation";

export default function TenantDetailRedirectPage() {
  return redirect("/tenants");
}

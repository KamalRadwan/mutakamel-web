import { redirect } from "next/navigation";

export default function RegisterTenantRedirectPage() {
  return redirect("/tenants/new");
}

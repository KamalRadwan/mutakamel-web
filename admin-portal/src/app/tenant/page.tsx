import { redirect } from "next/navigation";

export default function TenantRedirectPage() {
  return redirect("/tenants");
}

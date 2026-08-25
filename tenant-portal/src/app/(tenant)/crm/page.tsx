"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import {
  TENANT_ROUTES,
  getFirstPermittedCrmRoute,
} from "@/lib/navigation/tenant-routes";

export default function CrmIndexPage() {
  const router = useRouter();
  const { user } = useTenantAuth();
  const destination =
    getFirstPermittedCrmRoute(user?.permissions ?? []) ?? TENANT_ROUTES.home;

  useEffect(() => {
    router.replace(destination);
  }, [destination, router]);

  return null;
}

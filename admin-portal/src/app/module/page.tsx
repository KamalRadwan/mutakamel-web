"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ModuleSingularRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/modules");
  }, [router]);

  return null;
}

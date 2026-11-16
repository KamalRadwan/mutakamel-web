"use client";
import { lazy, Suspense, type ComponentProps } from "react";
import { Skeleton } from "@/design-system";
import type { TemplateDesignEditor } from "../components/TemplateDesignEditor";

const Editor = lazy(() => import("../components/TemplateDesignEditor").then(module => ({ default: module.TemplateDesignEditor })));
export function LazyTemplateDesignEditor(props: ComponentProps<typeof TemplateDesignEditor>) {
  return <Suspense fallback={<Skeleton className="h-32 w-full" aria-busy="true" />}><Editor {...props} /></Suspense>;
}

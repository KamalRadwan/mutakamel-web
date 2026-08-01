"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisualizationType } from "../models/dashboard-types";

interface WidgetSkeletonProps {
  type: DashboardVisualizationType;
}

export function WidgetSkeleton({ type }: WidgetSkeletonProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  const isMetric = type === "METRIC_CARD" || type === "PROGRESS_CARD";
  const isTable = type === "TABLE" || type === "LEADERBOARD" || type === "ALERT_LIST";
  
  return (
    <div className={`w-full h-full p-4 flex flex-col gap-4 animate-pulse ${isRtl ? "rtl" : "ltr"}`}>
      {/* Title placeholder */}
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      
      {isMetric && (
        <div className="flex flex-col gap-3 mt-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        </div>
      )}
      
      {isTable && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        </div>
      )}
      
      {!isMetric && !isTable && (
        <div className="flex-1 w-full bg-gray-100 dark:bg-gray-800 rounded-lg mt-2" />
      )}
    </div>
  );
}

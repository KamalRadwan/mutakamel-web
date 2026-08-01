"use client";

import { useI18n } from "@/i18n/I18nContext";
import { BarChart3 } from "lucide-react";

interface WidgetEmptyProps {
  message?: string;
}

export function WidgetEmpty({ message }: WidgetEmptyProps) {
  const { lang } = useI18n();
  const defaultMessage = lang === "ar" ? "There is no data available to display" : "No data available";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-gray-400 dark:text-gray-500">
      <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
        <BarChart3 className="w-6 h-6 opacity-50" />
      </div>
      <p className="text-sm font-medium">{message || defaultMessage}</p>
    </div>
  );
}

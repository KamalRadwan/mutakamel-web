"use client";

import { useI18n } from "@/i18n/I18nContext";
import { useDashboardStore } from "../models/useDashboardStore";
import { Button } from "@/components/ui/Button";
import { Calendar, RefreshCw, Settings, Save, X, Edit, LayoutDashboard, Download } from "lucide-react";
import type { CrmDashboard } from "../models/dashboard-types";

interface DashboardHeaderProps {
  dashboard: CrmDashboard;
  onRefresh: () => void;
  onEditClick: () => void;
  onShareClick: () => void;
  isRefreshing?: boolean;
}

export function DashboardHeader({ dashboard, onRefresh, onEditClick, onShareClick, isRefreshing }: DashboardHeaderProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const { editMode, setEditMode, draftPlacements, isDirty } = useDashboardStore();

  const handleSave = () => {
    // API Call to save draftPlacements goes here
    console.log("Saving new placements", draftPlacements);
    setEditMode(false);
  };

  const handleCancel = () => {
    // We should revert draftPlacements back to dashboard.placements here
    setEditMode(false);
  };

  return (
    <div className={`w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white dark:bg-gray-900 border-b dark:border-gray-800 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {dashboard.name}
            {dashboard.isFavorite && (
              <span className="text-yellow-500 text-lg">★</span>
            )}
          </h1>
          {dashboard.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {dashboard.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!editMode ? (
          <>
            <Button variant="secondary" className="gap-2 text-gray-600 dark:text-gray-300">
              <Calendar className="w-4 h-4" />
              {isRtl ? "This month" : "This Month"}
            </Button>
            
            <Button variant="secondary" onClick={onRefresh} disabled={isRefreshing} className="text-gray-600 dark:text-gray-300">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>

            <Button variant="secondary" onClick={onShareClick} className="gap-2 text-gray-600 dark:text-gray-300">
              {isRtl ? "sharing" : "Share"}
            </Button>

            <Button variant="secondary" className="gap-2 text-gray-600 dark:text-gray-300">
              <Download className="w-4 h-4" />
              {isRtl ? "export" : "Export"}
            </Button>

            {dashboard.accessLevel === "EDIT" && (
              <Button onClick={() => setEditMode(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Edit className="w-4 h-4" />
                {isRtl ? "Modify the panel" : "Edit Dashboard"}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onEditClick} className="gap-2">
              <Settings className="w-4 h-4" />
              {isRtl ? "Panel properties" : "Properties"}
            </Button>

            <Button variant="ghost" onClick={handleCancel} className="gap-2 text-gray-500 hover:text-red-600">
              <X className="w-4 h-4" />
              {isRtl ? "Cancel and undo" : "Cancel"}
            </Button>

            <Button onClick={handleSave} disabled={!isDirty} className={`gap-2 ${isDirty ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-100 text-gray-400"}`}>
              <Save className="w-4 h-4" />
              {isRtl ? "Save changes" : "Save Changes"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

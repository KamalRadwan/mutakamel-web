"use client";

import { useI18n } from "@/i18n/I18nContext";
import { useDashboardStore } from "../models/useDashboardStore";
import { Plus, Layout, Palette, Settings2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function DashboardSidebar() {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const { editMode, setEditMode } = useDashboardStore();

  return (
    <AnimatePresence>
      {editMode && (
        <motion.div
          initial={{ x: isRtl ? "-100%" : "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isRtl ? "-100%" : "100%", opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="w-80 h-full bg-white dark:bg-gray-900 border-l dark:border-gray-800 shadow-2xl flex flex-col flex-shrink-0 z-50 overflow-y-auto"
        >
          {/* Header */}
          <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isRtl ? "استوديو لوحة القيادة" : "Dashboard Studio"}
            </h2>
            <button 
              onClick={() => setEditMode(false)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Widgets Library Panel */}
          <div className="p-4 border-b dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" />
              {isRtl ? "مكتبة التطبيقات المصغرة" : "Widgets Library"}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="p-3 border dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-500 transition-colors flex flex-col items-center justify-center gap-2">
                <span className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  123
                </span>
                {isRtl ? "مؤشر" : "Metric"}
              </button>
              <button className="p-3 border dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-500 transition-colors flex flex-col items-center justify-center gap-2">
                <span className="w-8 h-8 rounded bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  📊
                </span>
                {isRtl ? "رسم بياني" : "Chart"}
              </button>
              <button className="p-3 border dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-500 transition-colors flex flex-col items-center justify-center gap-2">
                <span className="w-8 h-8 rounded bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  📑
                </span>
                {isRtl ? "جدول" : "Table"}
              </button>
            </div>
            <button className="w-full mt-4 py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              + {isRtl ? "تصفح الكتالوج" : "Browse Catalog"}
            </button>
          </div>

          {/* Layout Settings */}
          <div className="p-4 border-b dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Layout className="w-4 h-4 text-purple-500" />
              {isRtl ? "إعدادات التخطيط" : "Layout Settings"}
            </h3>
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                <span>{isRtl ? "محاذاة تلقائية" : "Snap to Grid"}</span>
                <input type="checkbox" className="rounded text-blue-500 focus:ring-blue-500 bg-gray-100 border-gray-300" defaultChecked />
              </label>
              <label className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                <span>{isRtl ? "تخطيط مضغوط" : "Compact Layout"}</span>
                <input type="checkbox" className="rounded text-blue-500 focus:ring-blue-500 bg-gray-100 border-gray-300" defaultChecked />
              </label>
            </div>
          </div>

          {/* Design & Theme */}
          <div className="p-4 border-b dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-pink-500" />
              {isRtl ? "التصميم والمظهر" : "Design & Theme"}
            </h3>
            <div className="flex gap-2 mb-3">
              {["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-rose-500"].map((color, i) => (
                <button key={i} className={`w-8 h-8 rounded-full ${color} ring-2 ring-transparent hover:ring-gray-300 transition-all`} />
              ))}
            </div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}

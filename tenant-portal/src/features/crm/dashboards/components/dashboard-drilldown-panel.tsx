"use client";

import { useI18n } from "@/i18n/I18nContext";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import type { DashboardDrilldownRecord } from "../models/dashboard-types";
import { exportToCSV } from "../utils/export-utils";

interface DashboardDrilldownPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  records: DashboardDrilldownRecord[];
  isLoading?: boolean;
}

export function DashboardDrilldownPanel({ open, onClose, title, subtitle, records, isLoading }: DashboardDrilldownPanelProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  const totalPages = Math.ceil((records?.length || 0) / itemsPerPage);
  const visibleRecords = records?.slice((page - 1) * itemsPerPage, page * itemsPerPage) || [];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 overflow-hidden flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Slide Over Panel */}
          <motion.div
            initial={{ x: isRtl ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? "-100%" : "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={`absolute ${isRtl ? "left-0 border-r" : "right-0 border-l"} top-0 bottom-0 w-full md:w-[600px] lg:w-[800px] bg-white dark:bg-slate-900 dark:border-slate-800 shadow-2xl flex flex-col`}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="gap-2" onClick={() => exportToCSV(records, title)}>
                  <Download className="w-4 h-4" />
                  {isRtl ? "export" : "Export"}
                </Button>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-auto p-6 relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <p>{isRtl ? "No data available." : "No data available."}</p>
                </div>
              ) : (
                <div className="border dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium border-b dark:border-slate-800">
                      <tr>
                        {Object.keys(visibleRecords[0] || {}).map((key) => (
                          <th key={key} className="px-4 py-3 whitespace-nowrap">
                            {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {visibleRecords.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            {!isLoading && records.length > 0 && (
              <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {isRtl ? "an offer" : "Showing"} {((page - 1) * itemsPerPage) + 1} {isRtl ? "to" : "to"} {Math.min(page * itemsPerPage, records.length)} {isRtl ? "from" : "of"} {records.length} {isRtl ? "register" : "records"}
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
                  </Button>
                  <Button 
                    variant="secondary" 
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

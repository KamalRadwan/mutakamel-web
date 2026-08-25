"use client";

import { useEffect, useRef, useState } from "react";
import { Kanban, ChevronDown, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export interface PipelineOption {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string;
}

interface PipelineSelectDropdownProps {
  pipelines: PipelineOption[];
  selectedPipelineId: string | null;
  onChange: (pipelineId: string) => void;
  disabled?: boolean;
}

export function PipelineSelectDropdown({
  pipelines,
  selectedPipelineId,
  onChange,
  disabled = false,
}: PipelineSelectDropdownProps) {
  const { lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedPipeline =
    pipelines.find(({ id }) => id === selectedPipelineId) ?? null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        disabled={disabled || pipelines.length === 0}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
      >
        <div className="w-4 h-4 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <Kanban className="w-3 h-3" />
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase hidden sm:inline">
          {lang === "ar" ? "المسار:" : "Pipeline:"}
        </span>
        <span className="truncate max-w-[110px] sm:max-w-[130px]">
          {selectedPipeline
            ? lang === "ar"
              ? selectedPipeline.nameAr
              : selectedPipeline.nameEn
            : lang === "ar"
              ? "لا يوجد مسار"
              : "No pipeline"}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 start-0 z-50 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {lang === "ar" ? "اختر مسار المبيعات" : "Select Sales Pipeline"}
          </div>
          {pipelines.map((pipe) => {
            const isSelected = selectedPipeline?.id === pipe.id;
            return (
              <button
                key={pipe.id}
                type="button"
                onClick={() => {
                  onChange(pipe.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-purple-50/80 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? "bg-purple-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                    <Kanban className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{lang === "ar" ? pipe.nameAr : pipe.nameEn}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

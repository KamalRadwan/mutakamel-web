"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check, MapPin } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export interface BranchOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  city: string;
}

const mockBranches: BranchOption[] = [
  { id: "all", code: "ALL", nameAr: "جميع الفروع", nameEn: "All Branches", city: "All" },
  { id: "b-1", code: "RUH_MAIN", nameAr: "فرع الرياض الرئيسي", nameEn: "Riyadh Main Branch", city: "Riyadh" },
  { id: "b-2", code: "JED_BR", nameAr: "فرع جدة", nameEn: "Jeddah Branch", city: "Jeddah" },
  { id: "b-3", code: "DMM_BR", nameAr: "فرع الدمام", nameEn: "Dammam Branch", city: "Dammam" },
  { id: "b-4", code: "DXB_OFF", nameAr: "المكتب الإقليمي - دبي", nameEn: "Dubai Regional Office", city: "Dubai" },
];

export function BranchSelectDropdown() {
  const { lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchOption>(mockBranches[1]);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
      >
        <div className="w-4 h-4 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Building2 className="w-3 h-3" />
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase hidden sm:inline">
          {lang === "ar" ? "الفرع:" : "Branch:"}
        </span>
        <span className="truncate max-w-[110px] sm:max-w-[130px]">
          {lang === "ar" ? selectedBranch.nameAr : selectedBranch.nameEn}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 start-0 z-50 w-60 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {lang === "ar" ? "الفروع المتاح الوصول إليها" : "Accessible Branches"}
          </div>
          {mockBranches.map((branch) => {
            const isSelected = selectedBranch.id === branch.id;
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => {
                  setSelectedBranch(branch);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col text-start leading-tight">
                    <span className="truncate">{lang === "ar" ? branch.nameAr : branch.nameEn}</span>
                    {branch.city !== "All" && (
                      <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {branch.city}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

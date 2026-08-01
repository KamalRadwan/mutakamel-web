"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, User2, Briefcase, Phone, Users } from "lucide-react";
import type { SearchFilterToken } from "../../models/pipeline-types";
import { useI18n } from "@/i18n/I18nContext";

interface PipelineMultiSearchProps {
  tokens: SearchFilterToken[];
  onChange: (tokens: SearchFilterToken[]) => void;
}

export function PipelineMultiSearch({ tokens, onChange }: PipelineMultiSearchProps) {
  const { lang, t } = useI18n();
  const isRtl = lang === "ar";
  
  const SEARCH_FIELDS = [
    { id: "sales_person", icon: User2, labelEn: "Sales Person", labelAr: t.crm.salesOfficer },
    { id: "opportunity", icon: Briefcase, labelEn: "Opportunity", labelAr: t.crm.opportunity },
    { id: "phone", icon: Phone, labelEn: "Phone", labelAr: t.crm.phoneNumber },
    { id: "customer", icon: Users, labelEn: "Customer", labelAr: t.crm.client },
  ] as const;
  
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && inputValue === "" && tokens.length > 0) {
      // Remove last token
      onChange(tokens.slice(0, -1));
    } else if (inputValue.trim().length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % SEARCH_FIELDS.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + SEARCH_FIELDS.length) % SEARCH_FIELDS.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleAddToken(SEARCH_FIELDS[selectedIndex]);
      }
    }
  };

  const handleAddToken = (fieldDef: typeof SEARCH_FIELDS[number]) => {
    if (!inputValue.trim()) return;
    
    const newToken: SearchFilterToken = {
      id: Math.random().toString(36).substring(7),
      field: fieldDef.id as SearchFilterToken["field"],
      fieldLabel: isRtl ? fieldDef.labelAr : fieldDef.labelEn,
      value: inputValue.trim()
    };
    
    onChange([...tokens, newToken]);
    setInputValue("");
    setIsFocused(false);
    setSelectedIndex(0);
  };

  const removeToken = (idToRemove: string) => {
    onChange(tokens.filter(t => t.id !== idToRemove));
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-64 md:w-80 lg:w-96 z-50">
      <div 
        className={`flex items-center flex-wrap gap-1.5 min-h-[32px] px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg transition-colors cursor-text ${
          isFocused ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 dark:border-slate-800"
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 ms-1 flex-shrink-0" />
        
        {/* Render Tokens */}
        {tokens.map((token) => (
          <span 
            key={token.id} 
            className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-xs font-medium border border-blue-200 dark:border-blue-800/50"
          >
            <span className="opacity-70">{token.fieldLabel}:</span>
            <span>{token.value}</span>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToken(token.id);
              }}
              className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors ms-1"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSelectedIndex(0);
            setIsFocused(true);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={tokens.length === 0 ? (isRtl ? t.crm.multipleSearch : "Multi search...") : ""}
          className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 h-6"
        />
      </div>

      {/* Dropdown Suggestions */}
      {isFocused && inputValue.trim().length > 0 && (
        <div className="absolute top-full start-0 end-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden py-1">
          {SEARCH_FIELDS.map((field, idx) => {
            const label = isRtl ? field.labelAr : field.labelEn;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={field.id}
                type="button"
                className={`w-full text-start px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                  isSelected ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
                onClick={() => handleAddToken(field)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <field.icon className={`w-4 h-4 ${isSelected ? "text-blue-500" : "text-slate-400"}`} />
                <span>
                  {isRtl ? t.crm.searchFor : "Search for"} <strong>"{inputValue}"</strong> {isRtl ? t.crm.in : "in"} <span className="font-semibold">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
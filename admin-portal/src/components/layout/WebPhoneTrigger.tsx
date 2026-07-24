"use client";

import { Phone } from "lucide-react";
import { useWebPhoneTrigger, UseWebPhoneTriggerProps } from "./hooks/useWebPhoneTrigger";

export function WebPhoneTrigger(props: UseWebPhoneTriggerProps) {
  const { isConnected, handleToggle, title } = useWebPhoneTrigger(props);

  return (
    <button
      onClick={handleToggle}
      className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
      title={title}
    >
      <Phone className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
      
      {/* Connected SIP Status Indicator Dot */}
      <span className="absolute bottom-1.5 end-1.5 flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isConnected ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isConnected ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
      </span>
    </button>
  );
}

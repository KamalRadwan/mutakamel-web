"use client";

import { useState } from "react";
import { 
  X, 
  CheckSquare, 
  Phone, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Tag
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityCardRecord } from "../../models/pipeline-types";

export type ActivityType = "call" | "meeting" | "task" | "reminder";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  dueDate: string;
  dueTime: string;
  assignedTo: string;
  priority: "high" | "medium" | "low";
  notes?: string;
  isCompleted: boolean;
}

interface OpportunityActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: OpportunityCardRecord | null;
}

const initialActivitiesMock: Record<string, ActivityItem[]> = {
  "opp-1": [
    {
      id: "act-1",
      type: "call",
      title: "Follow-up call for the technical and financial offer",
      dueDate: "2026-07-29",
      dueTime: "14:00",
      assignedTo: "Ahmed Abdullah",
      priority: "high",
      notes: "Make sure to review the first three items with the CTO",
      isCompleted: false,
    },
    {
      id: "act-2",
      type: "meeting",
      title: "Security assessment presentation meeting",
      dueDate: "2026-07-30",
      dueTime: "11:30",
      assignedTo: "Ahmed Abdullah",
      priority: "medium",
      notes: "Prepare a scope and cost summary slide",
      isCompleted: false,
    },
  ],
  "opp-2": [
    {
      id: "act-3",
      type: "task",
      title: "Send the final contract form for signature",
      dueDate: "2026-07-29",
      dueTime: "16:30",
      assignedTo: "Kamal Radwan",
      priority: "high",
      notes: "Coordination with Legal Affairs before sending",
      isCompleted: false,
    },
  ],
};

export function OpportunityActivitiesModal({
  isOpen,
  onClose,
  opportunity,
}: OpportunityActivitiesModalProps) {
  const { lang } = useI18n();

  const [activitiesMap, setActivitiesMap] = useState<Record<string, ActivityItem[]>>(initialActivitiesMock);

  // Form State
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>("call");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("10:00");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [notes, setNotes] = useState("");

  if (!isOpen || !opportunity) return null;

  const currentActivities = activitiesMap[opportunity.id] || [
    {
      id: `act-default-${opportunity.id}`,
      type: "call",
      title: lang === "ar" ? "Follow up call on client requirements" : "Follow-up call with customer",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "12:00",
      assignedTo: opportunity.ownerDisplayName || "Admin",
      priority: "medium",
      isCompleted: false,
    },
  ];

  const handleToggleCompleted = (actId: string) => {
    setActivitiesMap((prev) => {
      const list = prev[opportunity.id] || currentActivities;
      const updated = list.map((act) =>
        act.id === actId ? { ...act, isCompleted: !act.isCompleted } : act
      );
      return { ...prev, [opportunity.id]: updated };
    });
  };

  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      type,
      title: title.trim(),
      dueDate,
      dueTime,
      assignedTo: opportunity.ownerDisplayName || "Admin",
      priority,
      notes: notes.trim(),
      isCompleted: false,
    };

    setActivitiesMap((prev) => ({
      ...prev,
      [opportunity.id]: [newAct, ...(prev[opportunity.id] || currentActivities)],
    }));

    // Reset Form
    setTitle("");
    setNotes("");
  };

  const getTypeIcon = (actType: ActivityType) => {
    switch (actType) {
      case "call":
        return <Phone className="w-3.5 h-3.5 text-blue-500" />;
      case "meeting":
        return <CalendarIcon className="w-3.5 h-3.5 text-purple-500" />;
      case "task":
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />;
      case "reminder":
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[85vh] max-h-[700px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              {lang === "ar" ? "Managing activities and tasks" : "Activities & Tasks Management"}
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-0.5">
              <span>{opportunity.title}</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ({opportunity.customerCompanyName})
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Side Main Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x rtl:md:divide-x-reverse divide-slate-200 dark:divide-slate-800">
          {/* Left Side (Opened Activities) */}
          <div className="md:col-span-7 p-5 flex flex-col min-h-0 bg-slate-50/30 dark:bg-slate-950/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-500" />
                <span>{lang === "ar" ? "Open and registered activities" : "Open & Recorded Activities"}</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {currentActivities.filter(a => !a.isCompleted).length} {lang === "ar" ? "remaining" : "Open"}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pe-1 custom-scrollbar">
              {currentActivities.map((act) => (
                <div
                  key={act.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    act.isCompleted
                      ? "bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleCompleted(act.id)}
                        className={`mt-0.5 p-1 rounded-lg transition-colors cursor-pointer ${
                          act.isCompleted
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                            : "text-slate-300 hover:text-blue-500"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-slate-100 dark:bg-slate-800">
                            {getTypeIcon(act.type)}
                          </span>
                          <h4 className={`text-xs font-bold truncate ${act.isCompleted ? "line-through text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>
                            {act.title}
                          </h4>
                        </div>

                        {act.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                            {act.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {act.dueDate} ({act.dueTime})
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {act.assignedTo}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                      act.priority === "high"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                        : act.priority === "medium"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {act.priority}
                    </span>
                  </div>
                </div>
              ))}

              {currentActivities.length === 0 && (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                  <CheckSquare className="w-8 h-8 opacity-40" />
                  <span>{lang === "ar" ? "There are no registered activities yet" : "No activities recorded yet"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Side (Create New Activity) */}
          <div className="md:col-span-5 p-5 flex flex-col min-h-0 bg-white dark:bg-slate-900">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>{lang === "ar" ? "Add a new activity" : "Create New Activity"}</span>
            </h3>

            <form onSubmit={handleCreateActivity} className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto custom-scrollbar pe-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {lang === "ar" ? "Activity title" : "Activity Title"} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={lang === "ar" ? "Example: Contact the customer to follow up on the offer" : "e.g., Call customer for follow-up"}
                  className="w-full h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === "ar" ? "Type of activity" : "Activity Type"}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ActivityType)}
                    className="w-full h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="call">{lang === "ar" ? "Call" : "Call"}</option>
                    <option value="meeting">{lang === "ar" ? "meeting" : "Meeting"}</option>
                    <option value="task">{lang === "ar" ? "a task" : "Task"}</option>
                    <option value="reminder">{lang === "ar" ? "reminder" : "Reminder"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === "ar" ? "Priority" : "Priority"}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "high" | "medium" | "low")}
                    className="w-full h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="high">{lang === "ar" ? "High" : "High"}</option>
                    <option value="medium">{lang === "ar" ? "Medium" : "Medium"}</option>
                    <option value="low">{lang === "ar" ? "Low" : "Low"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === "ar" ? "due date" : "Due Date"}
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === "ar" ? "the time" : "Time"}
                  </label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {lang === "ar" ? "Detailed notes" : "Notes / Description"}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === "ar" ? "Enter any details or requirements to continue..." : "Add any details or follow-up notes..."}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              <div className="mt-auto pt-2">
                <button
                  type="submit"
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === "ar" ? "Save and add activity" : "Save & Create Activity"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Sparkles, FolderGit2, Kanban, Clock, UserCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export interface NotificationItem {
  id: string;
  type: "lead" | "pipeline" | "reminder" | "assignment";
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  timestamp: string;
  isRead: boolean;
}

const initialNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    type: "lead",
    titleAr: "تعيين عميل محتمل جديد",
    titleEn: "New Lead Assigned",
    descriptionAr: "تم تعيين العميل شركة الحلول المتقدمة لإدارتك",
    descriptionEn: "Lead 'Advanced Solutions Co.' was assigned to you",
    timestamp: "قبل 5 دقائق",
    isRead: false,
  },
  {
    id: "notif-2",
    type: "pipeline",
    titleAr: "تغيير مرحلة الفرصة",
    titleEn: "Opportunity Stage Changed",
    descriptionAr: "انتقلت فرصة 'تحديث البنية التحتية' إلى مرحلة التفاوض",
    descriptionEn: "Opportunity 'IT Upgrade' moved to Negotiation stage",
    timestamp: "قبل 30 دقيقة",
    isRead: false,
  },
  {
    id: "notif-3",
    type: "reminder",
    titleAr: "تذكير بموعد مكالمة",
    titleEn: "Call Reminder",
    descriptionAr: "مكالمة متابعة العقد مع مدير تقنية المعلومات",
    descriptionEn: "Follow-up contract call with IT Director at 4:00 PM",
    timestamp: "قبل ساعتين",
    isRead: false,
  },
];

export function NotificationsDropdown() {
  const { lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
  };

  const getTypeIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "lead":
        return <FolderGit2 className="w-3.5 h-3.5 text-amber-500" />;
      case "pipeline":
        return <Kanban className="w-3.5 h-3.5 text-purple-500" />;
      case "reminder":
        return <Clock className="w-3.5 h-3.5 text-rose-500" />;
      case "assignment":
        return <UserCheck className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button with Red Pulse Light & Shaking Bell */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
        title={lang === "ar" ? "الإشعارات" : "Notifications"}
      >
        <Bell
          className={`w-4 h-4 origin-top transition-transform ${
            unreadCount > 0
              ? "animate-bell-ring text-rose-600 dark:text-rose-400"
              : ""
          }`}
        />
        
        {/* Smaller Red Flash Dot */}
        {unreadCount > 0 && (
          <span className="absolute top-0.5 end-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full mt-1.5 end-0 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "مركز الإشعارات والتنبيهات" : "Notifications Center"}
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                  {unreadCount} {lang === "ar" ? "جديد" : "New"}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {lang === "ar" ? "تحديد الكل كقروء" : "Mark all read"}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 custom-scrollbar">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggleRead(item.id)}
                className={`p-3 transition-colors cursor-pointer flex items-start gap-3 ${
                  !item.isRead
                    ? "bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60 dark:hover:bg-rose-950/30"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                  {getTypeIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className={`text-xs font-bold truncate ${!item.isRead ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                      {lang === "ar" ? item.titleAr : item.titleEn}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0">{item.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {lang === "ar" ? item.descriptionAr : item.descriptionEn}
                  </p>
                </div>

                {!item.isRead && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5"></span>
                )}
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                {lang === "ar" ? "لا توجد إشعارات حالياً" : "No notifications available"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

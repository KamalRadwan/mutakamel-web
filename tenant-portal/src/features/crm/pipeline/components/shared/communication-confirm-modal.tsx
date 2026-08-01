"use client";

import { MessageCircle, Phone, Send, X, ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export type CommActionType = "whatsapp" | "phone" | "telegram";

interface CommunicationConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: CommActionType | null;
  customerName: string;
  phoneCode: string;
  phoneNumber: string;
  onConfirmPhoneCall?: (fullPhone: string) => void;
}

export function CommunicationConfirmModal({
  isOpen,
  onClose,
  actionType,
  customerName,
  phoneCode,
  phoneNumber,
  onConfirmPhoneCall,
}: CommunicationConfirmModalProps) {
  const { lang } = useI18n();

  if (!isOpen || !actionType) return null;

  const fullPhoneRaw = `${phoneCode}${phoneNumber}`.replace(/\s+/g, "");
  const cleanPhone = fullPhoneRaw.replace(/\+/g, "").replace(/\D/g, "");
  const displayPhone = `${phoneCode} ${phoneNumber}`.trim();

  const handleExecuteAction = () => {
    if (actionType === "whatsapp") {
      const url = `https://wa.me/${cleanPhone}`;
      window.open(url, "_blank");
    } else if (actionType === "telegram") {
      const url = `https://t.me/+${cleanPhone}`;
      window.open(url, "_blank");
    } else if (actionType === "phone") {
      if (onConfirmPhoneCall) {
        onConfirmPhoneCall(`+${cleanPhone}`);
      } else {
        window.location.href = `tel:+${cleanPhone}`;
      }
    }
    onClose();
  };

  const getActionDetails = () => {
    switch (actionType) {
      case "whatsapp":
        return {
          title: lang === "ar" ? "Confirm sending a WhatsApp message" : "Confirm WhatsApp Message",
          subtitle: lang === "ar" ? "The WhatsApp application will open to message the customer" : "Will open WhatsApp to message customer",
          icon: MessageCircle,
          iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
          buttonBg: "bg-emerald-600 hover:bg-emerald-500 text-white",
          buttonText: lang === "ar" ? "Open WhatsApp now" : "Open WhatsApp Now",
        };
      case "telegram":
        return {
          title: lang === "ar" ? "Confirm sending a Telegram message" : "Confirm Telegram Message",
          subtitle: lang === "ar" ? "The Telegram application will open to message the client" : "Will open Telegram to message customer",
          icon: Send,
          iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
          buttonBg: "bg-sky-600 hover:bg-sky-500 text-white",
          buttonText: lang === "ar" ? "Open Telegram now" : "Open Telegram Now",
        };
      case "phone":
      default:
        return {
          title: lang === "ar" ? "Confirm a phone call" : "Confirm Phone Call",
          subtitle: lang === "ar" ? "Communication with the client will be launched via phone/WebRTC" : "Will start phone call via WebRTC or native phone app",
          icon: Phone,
          iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
          buttonBg: "bg-blue-600 hover:bg-blue-500 text-white",
          buttonText: lang === "ar" ? "Start connecting now" : "Start Call Now",
        };
    }
  };

  const details = getActionDetails();
  const Icon = details.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${details.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {details.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {details.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Card */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {lang === "ar" ? "Customer name" : "Customer Name:"}
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {customerName}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {lang === "ar" ? "phone number:" : "Phone Number:"}
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                {displayPhone}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            {lang === "ar" ? "cancellation" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleExecuteAction}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer ${details.buttonBg}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{details.buttonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

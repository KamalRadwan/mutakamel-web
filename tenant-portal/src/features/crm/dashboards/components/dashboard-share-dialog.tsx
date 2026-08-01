"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Shield, UserPlus, X } from "lucide-react";

interface DashboardShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
}

export function DashboardShareDialog({ open, onOpenChange, dashboardId }: DashboardShareDialogProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [accessLevel, setAccessLevel] = useState<"VIEW" | "EDIT">("VIEW");
  const [email, setEmail] = useState("");

  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate share API call
    console.log("Sharing dashboard", dashboardId, "with", email, "as", accessLevel);
    setEmail("");
  };

  const title = isRtl ? "Share the painting" : "Share Dashboard";

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} title={title}>
      <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
        <form onSubmit={handleShare} className="flex gap-2">
          <input 
            type="email" 
            required
            placeholder={isRtl ? "User email..." : "User email..."}
            className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select 
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={accessLevel}
            onChange={(e) => setAccessLevel(e.target.value as "VIEW" | "EDIT")}
          >
            <option value="VIEW">{isRtl ? "View only" : "View Only"}</option>
            <option value="EDIT">{isRtl ? "amendment" : "Can Edit"}</option>
          </select>
          <Button type="submit">{isRtl ? "invitation" : "Invite"}</Button>
        </form>

        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-3">{isRtl ? "People who have access" : "People with access"}</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                  ME
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Admin User (You)</p>
                  <p className="text-xs text-gray-500">admin@example.com</p>
                </div>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Owner</span>
            </div>
            
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 font-medium">
                  JS
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">John Smith</p>
                  <p className="text-xs text-gray-500">john@example.com</p>
                </div>
              </div>
              <select className="text-xs border-none bg-transparent text-gray-500 cursor-pointer focus:ring-0 px-0">
                <option value="VIEW">{isRtl ? "View only" : "View Only"}</option>
                <option value="EDIT">{isRtl ? "amendment" : "Can Edit"}</option>
                <option value="REMOVE" className="text-red-500">{isRtl ? "removal" : "Remove"}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

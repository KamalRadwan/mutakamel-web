"use client";

import { usePathname } from "next/navigation";
import {
  WebRTCPhoneWidget,
  WebphoneProvider,
  webphoneCopy,
  type WebphoneCopy,
  type WebphoneLanguage,
} from "@mutakamel/webphone";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";

const ADMIN_WEBPHONE_BASE_PATH = "/api/admin/webphone/v1";

const adminWebphoneCopy: Record<WebphoneLanguage, WebphoneCopy> = {
  ar: { ...webphoneCopy.ar, phoneName: "هاتف الإدارة" },
  en: { ...webphoneCopy.en, phoneName: "Admin Phone" },
};

/**
 * Binds the shared WebPhone to the admin portal: its Gateway base path, its
 * HTTP client, its session gate, and its copy.
 */
export function AdminWebPhone() {
  const { isAuthenticated } = useAuth();
  const { lang } = useI18n();
  const pathname = usePathname();

  return (
    <WebphoneProvider
      basePath={ADMIN_WEBPHONE_BASE_PATH}
      http={axiosClient}
      active={isAuthenticated && pathname !== "/login"}
      copy={adminWebphoneCopy[lang]}
    >
      <WebRTCPhoneWidget />
    </WebphoneProvider>
  );
}

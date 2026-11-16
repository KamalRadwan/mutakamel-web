import { act, render } from "@testing-library/react";
import { ToastProvider, TooltipProvider } from "@/design-system";
import { I18nProvider, type Language } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import type { AccessMode } from "@/lib/access-mode";
import { TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import TaxesPage from "./page";

export function installTaxesTestPolyfills(): void {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
    HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }
}

export interface MockTaxesAuthUser {
  id: string;
  isTenantOwner: boolean;
  permissions: string[];
  permissionScopes?: Record<string, PermissionScope>;
  accessibleCompanies?: string[];
  accessMode?: AccessMode;
}

export const TAXES_COMPANIES_PATH = "/api/tenant/core/v1/organization/companies";

export function taxesPageEnvelope(rows: unknown[], limit = 20): AxiosResponse<unknown> {
  return {
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    data: {
      success: true,
      status: "SUCCESS",
      statusCode: 200,
      data: rows,
      meta: {
        page: 1,
        limit,
        total: rows.length,
        totalPages: rows.length === 0 ? 0 : 1,
        hasNext: false,
        hasPrev: false,
      },
    },
  };
}

export function taxesRowEnvelope(data: unknown, status = 200): AxiosResponse<unknown> {
  return {
    status,
    statusText: status === 204 ? "No Content" : "OK",
    headers: new Headers(),
    data: status === 204 ? "" : { success: true, status: "SUCCESS", statusCode: status, data },
  };
}

export function taxesApiError(
  status: number,
  errorCode: string,
  message: string,
): TenantApiClientError {
  return new TenantApiClientError(message, {
    status,
    statusText: "Error",
    headers: new Headers(),
    data: {
      success: false,
      status: "ERROR",
      statusCode: status,
      errorCode,
      message,
    },
  });
}

export function taxesProvidersUi(lang: Language) {
  return (
    <I18nProvider initialLanguage={lang}>
      <TooltipProvider>
        <ToastProvider>
          <TaxesPage />
        </ToastProvider>
      </TooltipProvider>
    </I18nProvider>
  );
}

export async function renderTaxesScreen(lang: Language = "en") {
  await act(async () => {
    await setLanguage(lang);
  });
  return render(taxesProvidersUi(lang));
}

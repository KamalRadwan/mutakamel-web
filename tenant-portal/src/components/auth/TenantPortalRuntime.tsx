import { ToastProvider } from "@/design-system";
import { TenantAuthProvider } from "@/context/AuthContext";
import { TenantRealtimeProvider } from "@/context/TenantRealtimeProvider";
import { I18nProvider } from "@/i18n/I18nContext";
import { TenantAuthGuard } from "./TenantAuthGuard";
import { TenantHostAdmission } from "./TenantHostAdmission";

export function TenantPortalRuntime({ children }: { children: React.ReactNode }) {
  return (
    <TenantHostAdmission>
      <I18nProvider>
        <ToastProvider>
          <TenantAuthProvider>
            <TenantRealtimeProvider>
              <TenantAuthGuard>{children}</TenantAuthGuard>
            </TenantRealtimeProvider>
          </TenantAuthProvider>
        </ToastProvider>
      </I18nProvider>
    </TenantHostAdmission>
  );
}

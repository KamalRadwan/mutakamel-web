import { ReactNode } from "react";
import { SettingsSidebar } from "./components/SettingsSidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3">
      <SettingsSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

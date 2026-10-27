"use client";

import { EmailConfigWorkspace } from "./components/email-workspace";
import { EmailSuppressionSection } from "./components/EmailSuppressionSection";

export default function EmailConfigPage() {
  return (
    <div className="space-y-4">
      <EmailConfigWorkspace />
      <EmailSuppressionSection />
    </div>
  );
}

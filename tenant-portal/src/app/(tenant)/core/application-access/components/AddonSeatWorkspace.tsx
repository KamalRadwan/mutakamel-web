"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { AddonAssignments } from "./AddonAssignments";
import { AddonAssignmentOptions } from "./AddonAssignmentOptions";

export function AddonSeatWorkspace({ userId }: { userId: string }) {
  const { t, dir } = useI18n();
  return <Tabs key={userId} defaultValue="assignments" dir={dir}>
    <TabsList aria-label={t.addonAssignments.title}>
      <TabsTrigger value="assignments">{t.addonAssignmentOptions.assignedTab}</TabsTrigger>
      <TabsTrigger value="options">{t.addonAssignmentOptions.optionsTab}</TabsTrigger>
    </TabsList>
    <TabsContent value="assignments"><AddonAssignments userId={userId} /></TabsContent>
    <TabsContent value="options"><AddonAssignmentOptions userId={userId} /></TabsContent>
  </Tabs>;
}

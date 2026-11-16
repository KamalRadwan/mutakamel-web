"use client";
import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { templateAuthoringHostCopy } from "@/i18n/template-authoring-host-copy";
import { PageManagement } from "../../pages/components/PageManagement";
import type { PageController } from "../../pages/page-controller";
import { TemplateDialogContent } from "../../feedback/TemplateDialogContent";
import { useDesignerPageDialog } from "../hooks/useDesignerPageDialog";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";

export function DesignerPageManagementHost({ editor, controller }: { editor: ReturnType<typeof useTemplateDesignEditor>; controller: PageController }) {
  const dialog = useDesignerPageDialog(editor.localSessions), { lang } = useI18n(), c = templateAuthoringHostCopy[lang];
  const title = editor.t.quotationPdf.pageSettings;
  return <Dialog open={dialog.open} onOpenChange={dialog.change}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={!editor.pageBridge.context().canRead || editor.localSessions.hasOther("pages")}>{title}</Button></DialogTrigger>
    <TemplateDialogContent><DialogTitle>{title}</DialogTitle><DialogDescription>{c.closePageHelp}</DialogDescription>
      {dialog.open && <PageManagement controller={controller} interlock={editor.localSessions.richText} locale={({ ar: "ar-EG", en: "en-US" } as const)[lang]} />}
      {dialog.confirmClose && <div className="space-y-2"><p role="alert">{c.closePage}</p><div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={dialog.keepEditing}>{c.keepEditing}</Button>
        <Button type="button" variant="outline" onClick={dialog.close}>{c.close}</Button>
      </div></div>}
    </TemplateDialogContent>
  </Dialog>;
}

"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, Download } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function NoteGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [title, setTitle] = useState(t.crm.notesOfLastMeetingAndTech);
  const [targetType, setTargetType] = useState("deal");
  const [targetName, setTargetName] = useState(t.crm.alHayatHospitalDeal);
  const [noteContent, setNoteContent] = useState(t.crm.itWasAgreedToProvideA5);
  const [attachmentName, setAttachmentName] = useState("Technical_Proposal_v2.pdf");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directEditingOfNoteAndAtt}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateTheNoteTextAndDirec}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.noteTitle} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.crm.entityType}
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            options={[
              { label: t.crm.deal, value: "deal" },
              { label: t.crm.lead, value: "lead" },
            ]}
          />
          <Input label={t.crm.entityName} value={targetName} onChange={(e) => setTargetName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{t.crm.noteContent}</label>
          <textarea
            rows={4}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>
        <Input label={t.crm.nameOfTheAttachedFile} value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} required />

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>{t.crm.saveLiveEdits}</span>
          </Button>

          <Button type="button" variant="secondary">
            <Download className="w-4 h-4" />
            <span>{t.crm.downloadTheAttachedFile}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

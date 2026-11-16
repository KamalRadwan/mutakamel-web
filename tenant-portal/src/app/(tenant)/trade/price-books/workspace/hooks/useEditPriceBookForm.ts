"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { type PriceBookDetail, type PriceBookStatus, type UpdatePriceBookInput } from "../../pricing-contract";

export interface EditPriceBookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PriceBookDetail;
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (patch: UpdatePriceBookInput) => Promise<boolean>;
}



export function useEditPriceBookForm({
  open,
  onOpenChange,
  detail,
  isSubmitting,
  error,
  onSubmit,
}: EditPriceBookModalProps) {
  const { t } = useI18n();
  const { book } = detail;

  const [nameAr, setNameAr] = useState(book.localizedNames?.ar ?? "");
  const [nameEn, setNameEn] = useState(book.localizedNames?.en ?? "");
  const [name, setName] = useState(book.name ?? "");
  const [description, setDescription] = useState(book.description ?? "");
  const [status, setStatus] = useState<PriceBookStatus>(
    book.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  );

  const isDirty =
    nameAr !== (book.localizedNames?.ar ?? "") ||
    nameEn !== (book.localizedNames?.en ?? "") ||
    name !== (book.name ?? "") ||
    description !== (book.description ?? "") ||
    status !== book.status;

  const cannotDeactivate = book.isCompanyDefault && status === "INACTIVE";

  
  const submit = () => {
        void onSubmit({
          name: name.trim(),
          localizedNames: {
            ar: nameAr.trim(),
            en: nameEn.trim(),
          },
          description: description.trim(),
          status,
        });
      };
  return { open, onOpenChange, isSubmitting, error, t, book, nameAr, setNameAr, nameEn, setNameEn, name, setName, description, setDescription, status, setStatus, isDirty, cannotDeactivate, submit };
}

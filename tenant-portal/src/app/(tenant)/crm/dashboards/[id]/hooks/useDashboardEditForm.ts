"use client";
import { useState } from "react";
export function useDashboardEditForm(initialName: string, initialDescription: string, blocked: boolean, onSubmit: (name: string, description: string) => void) {
  const [name, setName] = useState(initialName); const [description, setDescription] = useState(initialDescription);
  const dirty = name !== initialName || description !== initialDescription;
  return { name, setName, description, setDescription, dirty, disabled: blocked || !name.trim() || !dirty,
    submit: () => { if (!blocked && dirty && name.trim()) onSubmit(name, description); } };
}

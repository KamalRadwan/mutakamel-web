"use client";
import { useState } from "react";
import type { CreateDashboardInput } from "./useDashboards";
import type { DashboardTemplateKey } from "../dashboard-contract";
export function useDashboardCreateForm(onSubmit: (input: CreateDashboardInput) => void, allowed: boolean, blocked: boolean) {
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [templateKey, setTemplateKey] = useState("__blank__"); const [touched, setTouched] = useState(false);
  return { name, description, templateKey, nameInvalid: touched && !name.trim(),
    dirty: !!name || !!description || templateKey !== "__blank__",
    disabled: blocked || !name.trim() || (templateKey !== "__blank__" && !allowed),
    changeName: (value: string) => { setTouched(true); setName(value); }, setDescription, setTemplateKey,
    submit: () => { setTouched(true); if (!name.trim() || blocked || (templateKey !== "__blank__" && !allowed)) return;
      onSubmit({ name, description, templateKey: templateKey === "__blank__" ? null : templateKey as DashboardTemplateKey }); } };
}

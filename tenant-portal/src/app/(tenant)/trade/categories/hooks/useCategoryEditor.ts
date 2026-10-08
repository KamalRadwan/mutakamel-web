"use client";

import { useState } from "react";
import { generateUUIDv7 } from "@/lib/uuid";
import type { CategoryCommand } from "../category-api";
import type { CategoryDetail, CategoryIntent } from "../category-contract";

// Mirror the owning Category text normalization before measuring Unicode scalars.
function validText(value: string, maximum = 160) {
  const normalized = value.normalize("NFC").replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "").replace(/ +/gu, " ");
  return !/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ud800-\udfff]/u.test(value)
    && Array.from(normalized).length > 0 && Array.from(normalized).length <= maximum;
}

export interface CategoryEditorRequest {
  action: CategoryCommand["action"];
  source: CategoryDetail | null;
  treeVersion: number;
  parent?: CategoryDetail | null;
}

export function useCategoryEditor(editor: CategoryEditorRequest, submit: (command: CategoryCommand) => Promise<void>) {
  const { source, action, treeVersion, parent } = editor;
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState(source?.displayName ?? "");
  const [names, setNames] = useState(() => Object.entries(source?.localizedNames ?? { en: "", ar: "" })
    .map(([locale, name]) => ({ key: generateUUIDv7(), locale, name })));
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<CategoryIntent>(() => action === "create"
    ? parent ? { kind: "selected", id: parent.id } : { kind: "none" }
    : { kind: "unresolved" });
  const [attempted, setAttempted] = useState(false);
  const [initial] = useState(() => ({ displayName, names: JSON.stringify(names), target: JSON.stringify(target) }));
  const dirty = Boolean(code || reason || displayName !== (source?.displayName ?? "")
    || displayName !== initial.displayName || JSON.stringify(target) !== initial.target || JSON.stringify(names) !== initial.names);
  const localizedNames = Object.fromEntries(names.filter((entry) => entry.name.trim()).map(({ locale, name }) => [locale, name]));
  const metadata = action === "create" || action === "update";
  const issues = {
    code: action === "create" && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(code.replace(/^ +| +$/gu, "")),
    displayName: metadata && !validText(displayName),
    localizedNames: metadata && (Object.keys(localizedNames).length === 0 || names.length > 20
      || new Set(names.map((entry) => entry.locale)).size !== names.length
      || names.some((entry) => !/^[a-z]{2}(?:-[A-Z]{2})?$/u.test(entry.locale) || (entry.name.trim() && !validText(entry.name)))
      || new TextEncoder().encode(JSON.stringify(localizedNames)).byteLength > 16_384),
    reason: (action === "status" || action === "delete") && !validText(reason, 500),
    target: (action === "move" || action === "reorder" || action === "create") && target.kind === "unresolved",
    status: action === "status" && source?.status !== "ACTIVE" && source?.status !== "INACTIVE",
  };
  const invalid = attempted && Object.values(issues).some(Boolean);
  const save = async () => {
    setAttempted(true);
    if (Object.values(issues).some(Boolean)) return;
    const destination = target.kind === "selected" ? target.id : null;
    if (action === "create") {
      await submit({ action, body: { code, displayName, localizedNames, parentId: destination, expectedTreeVersion: treeVersion } }); return;
    }
    if (!source) return;
    const existing = { id: source.id, version: source.version };
    const expectedTreeVersion = source.treeVersion;
    if (action === "update") await submit({ action, ...existing, body: { displayName, localizedNames } });
    if (action === "move") await submit({ action, ...existing, body: { parentId: destination, expectedTreeVersion } });
    if (action === "reorder") await submit({ action, ...existing, body: { beforeId: destination, expectedTreeVersion } });
    if (action === "status") await submit({ action, ...existing, body: { status: source.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason, expectedTreeVersion } });
    if (action === "delete") await submit({ action, ...existing, body: { reason, expectedTreeVersion } });
  };
  return { code, setCode, displayName, setDisplayName, names, reason, setReason, target, setTarget, invalid, issues, attempted, dirty, save,
    changeName: (key: string, patch: { locale?: string; name?: string }) => setNames((current) => current.map((entry) => entry.key === key ? { ...entry, ...patch } : entry)),
    removeName: (key: string) => setNames((current) => current.filter((entry) => entry.key !== key)),
    addName: () => { if (names.length < 20) setNames((current) => [...current, { key: generateUUIDv7(), locale: "", name: "" }]); },
  };
}

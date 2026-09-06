"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { CommandPalette, type CommandGroupDef } from "../primitives/CommandPalette";
import { useNavTree } from "./useNavTree";

/**
 * Ctrl/Cmd+K over the **permission-filtered** nav tree — every app, always.
 *
 * The tree comes from `useNavTree()`, so a route the user cannot reach is not
 * offered here either. That is the whole reason this wiring lives in the shell
 * rather than in the primitive: the palette itself is generic and takes groups
 * as a prop.
 *
 * Deliberately NOT app-scoped, which is why it consumes `useNavTree()`
 * directly rather than `useNavApps()` the way the global nav does. Scoping the
 * nav makes twelve of the fifteen sections invisible at any moment; a
 * palette that hid them too would mean finding a Trade screen from CRM
 * required knowing to switch apps first. "Jump anywhere by name" is the one
 * affordance that should not care which app you are standing in.
 *
 * Route labels come from the dictionary at this layer, so the palette can stay
 * a dictionary-free primitive. Both the Arabic and English labels are added to
 * `keywords`, which is what lets an Arabic-speaking user who knows the English
 * product word still find the screen.
 */
export function NavCommandPalette() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const sections = useNavTree();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // metaKey for macOS, ctrlKey elsewhere. `event.key` is layout-dependent,
      // so an Arabic keyboard layout produces "ن" rather than "k" — `code`
      // is the physical key and is what actually works in both.
      if (event.code !== "KeyK" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const groups: CommandGroupDef[] = sections.map((section) => ({
    id: section.id,
    // Falls back to the short menu label so the two headingless sections —
    // Workspace and Account — stop arriving as unlabelled groups. Before
    // `menuLabelKey` existed there was nothing to fall back to.
    heading: t.nav[(section.labelKey ?? section.menuLabelKey) as keyof typeof t.nav],
    items: section.items.map((item) => ({
      id: item.href,
      label: t.nav[item.labelKey as keyof typeof t.nav],
      keywords: [item.href],
      icon: item.icon,
      onSelect: () => {
        setOpen(false);
        router.push(item.href);
      },
    })),
  }));

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      groups={groups}
      labels={t.commandPalette}
    />
  );
}

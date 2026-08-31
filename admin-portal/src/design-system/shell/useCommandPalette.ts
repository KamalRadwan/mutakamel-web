"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavTree } from "./useNavTree";

/** Ctrl/⌘+K search across every route the signed-in user can see — reuses useNavTree's already-filtered sections. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { sections } = useNavTree();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return { open, setOpen, sections, navigate };
}

"use client";

import { useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { canPerformTradeAction, TRADE_PERMISSIONS } from "../../trade-scope";
import type { Item } from "../item-contract";
import type { ItemImageChange } from "../item-image-contract";
import { useItemImageCommands } from "./useItemImageCommands";
import { useItemImageFile } from "./useItemImageFile";

interface UseItemImageManagerOptions {
  item: Item;
  /** Applies the new Item version and image, so the next write's `If-Match` is current. */
  onChanged: (change: ItemImageChange) => void;
  /** Reloads the Item after `STALE_VERSION`. */
  onStale: () => void;
}

/**
 * Replace and remove an existing Item's image (LLD 02b §19 Edit flow).
 *
 * Image changes are their own commands: they never submit the Item form, and
 * the Item form never submits them. A `STALE_VERSION` keeps the picked file,
 * reloads the Item and asks the user to confirm again with a new key.
 */
export function useItemImageManager({ item, onChanged, onStale }: UseItemImageManagerOptions) {
  const { user } = useTenantAuth();
  // Writes are `trade.catalog_master.manage` at exact TENANT; reads need only
  // the Item. Advisory: the backend refuses with `TRADE.AUTH.TARGET_DENIED`.
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.catalogMasterManage);
  const file = useItemImageFile();
  const commands = useItemImageCommands();
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const target = { itemId: item.id, version: item.version };

  const settle = (result: Awaited<ReturnType<typeof commands.upload>>): boolean => {
    if (result.ok) onChanged(result.change);
    else if (result.stale) onStale();
    return result.ok;
  };

  return {
    canManage,
    pending: file.pending,
    error: file.error ?? commands.error,
    status: commands.status,
    isUploading: commands.isUploading,
    isRemoving: commands.isRemoving,
    isBusy: commands.isUploading || commands.isRemoving,
    tileScreening: file.tileScreening,
    choose: (picked: File) => {
      commands.setError(null);
      void file.choose(picked);
    },
    cancelPending: file.clear,
    confirmPending: async () => {
      if (!file.pending || commands.isUploading) return;
      if (settle(await commands.upload(target, file.pending.file))) file.clear();
    },
    isRemoveOpen,
    openRemove: () => setIsRemoveOpen(true),
    closeRemove: () => {
      if (!commands.isRemoving) setIsRemoveOpen(false);
    },
    confirmRemove: async () => {
      if (commands.isRemoving) return;
      settle(await commands.remove(target));
      setIsRemoveOpen(false);
    },
    isPreviewOpen,
    setPreviewOpen: setIsPreviewOpen,
  };
}

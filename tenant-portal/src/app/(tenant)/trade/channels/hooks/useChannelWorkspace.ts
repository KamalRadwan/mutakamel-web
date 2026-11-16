"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { CHANNEL_UI_COPY } from "../channel-catalogue-metadata";
import { isChannelType, type Channel, type ChannelType } from "../channel-contract";
import { useChannels } from "./useChannels";

export function useChannelWorkspace() {
  const { t, lang, dir } = useI18n();
  const channels = useChannels();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ChannelType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [inspecting, setInspecting] = useState<Channel | null>(null);
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(lang);
    return channels.items.filter((item) =>
      (typeFilter === "ALL" || item.channelType === typeFilter) &&
      (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? item.status === "ACTIVE" : item.status !== "ACTIVE")) &&
      (!query || [item.code, item.name, item.channelType, isChannelType(item.channelType) ? t.trade[`channelType_${item.channelType}`] : item.channelType]
        .some((value) => value.toLocaleLowerCase(lang).includes(query))),
    );
  }, [channels.items, lang, searchQuery, statusFilter, t, typeFilter]);
  const stats = useMemo(() => ({
    total: channels.items.length,
    active: channels.items.filter((item) => item.status === "ACTIVE").length,
    types: new Set(channels.items.map((item) => item.channelType)).size,
    digital: channels.items.filter((item) => ["ECOMMERCE", "B2B_PORTAL", "MARKETPLACE", "API"].includes(item.channelType)).length,
  }), [channels.items]);
  return { t, lang, dir, copy: CHANNEL_UI_COPY[lang], channels, stats, filteredItems,
    searchQuery, setSearchQuery, typeFilter, setTypeFilter, statusFilter, setStatusFilter,
    viewMode, setViewMode, inspecting, setInspecting };
}

export type ChannelWorkspace = ReturnType<typeof useChannelWorkspace>;

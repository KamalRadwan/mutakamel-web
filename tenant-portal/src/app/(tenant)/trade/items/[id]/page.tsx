"use client";

import { use } from "react";
import { ItemDetailScreen } from "../components/item-detail-screen";

export default function TradeItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ItemDetailScreen id={id} />;
}

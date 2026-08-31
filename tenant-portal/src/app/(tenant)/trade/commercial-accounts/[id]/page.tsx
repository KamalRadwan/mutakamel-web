"use client";

import { use } from "react";
import { AccountDetailScreen } from "../components/account-detail-screen";

export default function TradeCommercialAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AccountDetailScreen id={id} />;
}

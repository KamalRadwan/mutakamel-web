"use client";

import { useState } from "react";

export interface UseWebPhoneTriggerProps {
  onToggle?: () => void;
  isConnected?: boolean;
}

export function useWebPhoneTrigger(props: UseWebPhoneTriggerProps = {}) {
  const [isConnected] = useState(props.isConnected ?? true);

  const handleToggle = () => {
    props.onToggle?.();
  };

  return {
    isConnected,
    handleToggle,
    title: "الهاتف المرئي (WebPhone)",
  };
}

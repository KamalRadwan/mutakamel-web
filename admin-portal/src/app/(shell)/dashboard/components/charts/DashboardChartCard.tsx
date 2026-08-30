"use client";

import type { CSSProperties, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system";

interface DashboardChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function DashboardChartCard({
  title,
  subtitle,
  action,
  className = "",
  style,
  children,
}: DashboardChartCardProps) {
  return (
    <Card data-dashboard-chart-card className={className} style={style}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

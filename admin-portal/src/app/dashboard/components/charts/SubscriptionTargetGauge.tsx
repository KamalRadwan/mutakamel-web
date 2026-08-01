"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface Props {
  actualARR: number;
  targetARR: number;
  height?: number;
}

export function SubscriptionTargetGauge({ actualARR, targetARR, height = 250 }: Props) {
  const percentage =
    targetARR > 0
      ? Math.min(100, Math.max(0, (actualARR / targetARR) * 100))
      : 0;
  
  // Data for the semi-circle gauge (active vs empty)
  const data = [
    { name: "Achieved", value: percentage },
    { name: "Remaining", value: 100 - percentage },
  ];

  // Colors: primary gradient/solid vs empty track
  const COLORS = ["#10b981", "currentColor"]; 

  const cx = "50%";
  const cy = "75%";
  const iR = 60;
  const oR = 90;

  return (
    <div style={{ height, width: "100%" }} className="relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            dataKey="value"
            startAngle={180}
            endAngle={0}
            data={data}
            cx={cx}
            cy={cy}
            innerRadius={iR}
            outerRadius={oR}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]} 
                className={index === 1 ? "text-slate-100 dark:text-slate-800" : ""}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      
      {/* Absolute positioned text in the center */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-[10%]">
        <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tighter">
          {percentage.toFixed(1)}%
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
          ARR Target
        </span>
      </div>
    </div>
  );
}

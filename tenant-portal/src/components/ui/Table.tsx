"use client";

import React from "react";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyText?: string;
}

export function Table<T extends { id?: string | number }>({
  columns,
  data,
  emptyText = "لا توجد بيانات للعرض",
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-start border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 h-11 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            {columns.map((col, idx) => (
              <th key={idx} className="px-4 text-start font-bold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 font-medium">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr key={row.id ?? rowIdx} className="h-11 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-slate-800 dark:text-slate-200">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-4 py-2.5 whitespace-nowrap">
                    {col.cell ? col.cell(row) : (col.accessorKey ? String(row[col.accessorKey] ?? "") : "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

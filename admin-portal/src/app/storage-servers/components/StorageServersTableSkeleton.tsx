"use client";

import React from "react";

export function StorageServersTableSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-12" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="w-28 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="w-28 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Table Skeleton Rows */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 h-10" />
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4 h-14">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="space-y-1">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-32" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded w-44" />
                </div>
              </div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24 hidden sm:block" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 hidden md:block" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20 hidden lg:block" />
              <div className="flex gap-1">
                <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

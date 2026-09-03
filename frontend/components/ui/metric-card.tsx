"use client";

import React from "react";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface MetricCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
  tooltip?: string;
}

export function MetricCard({ icon, label, value, detail, emphasis, tooltip }: MetricCardProps) {
  return (
    <div
      title={tooltip}
      className={cn(
        "rounded-xl border shadow-sm p-6 flex flex-col justify-between transition-all",
        emphasis
          ? "bg-slate-900 text-white border-slate-800"
          : "bg-white text-gray-900 border-gray-200"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className={cn("text-sm font-medium", emphasis ? "text-slate-300" : "text-gray-500")}>
            {label}
          </h3>
          {tooltip && (
            <span className={cn("text-[11px] cursor-help opacity-60 hover:opacity-100", emphasis ? "text-slate-400" : "text-gray-400")}>
              ⓘ
            </span>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center",
              emphasis ? "bg-slate-800 text-blue-400" : "bg-blue-50 text-blue-600"
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <p className={cn("text-xs", emphasis ? "text-slate-400" : "text-gray-500")}>
          {detail}
        </p>
      </div>
    </div>
  );
}

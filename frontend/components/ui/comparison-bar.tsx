"use client";

import React from "react";

interface ComparisonBarProps {
  label: string;
  baselineValue: number;
  reviveValue: number;
  formatValue: (v: number) => string;
}

export function ComparisonBar({ label, baselineValue, reviveValue, formatValue }: ComparisonBarProps) {
  const maxVal = Math.max(baselineValue, reviveValue, 1);
  const baselineWidth = `${(baselineValue / maxVal) * 100}%`;
  const reviveWidth = `${(reviveValue / maxVal) * 100}%`;

  return (
    <div className="flex flex-col gap-2 w-full py-2">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-20 text-xs text-gray-500 text-right">Baseline</div>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex items-center">
            <div 
              className="h-full bg-amber-400 opacity-60 rounded-full"
              style={{ width: baselineWidth }}
            />
          </div>
          <div className="w-20 text-xs font-medium text-gray-700">{formatValue(baselineValue)}</div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-20 text-xs text-blue-600 font-medium text-right flex items-center justify-end gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
            </svg>
            Revive
          </div>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex items-center">
            <div 
              className="h-full bg-blue-600 rounded-full"
              style={{ width: reviveWidth }}
            />
          </div>
          <div className="w-20 text-xs font-bold text-gray-900">{formatValue(reviveValue)}</div>
        </div>
      </div>
    </div>
  );
}

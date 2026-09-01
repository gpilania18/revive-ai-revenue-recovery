"use client";

import React from "react";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  description: string;
  color?: "blue" | "red" | "amber" | "emerald" | "gray";
}

const colorMaps = {
  blue: "bg-blue-50 text-blue-600",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  gray: "bg-gray-100 text-gray-600",
};

export function StatCard({ icon, label, value, description, color = "blue" }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center", colorMaps[color])}>
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-500">{label}</h4>
        <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  );
}

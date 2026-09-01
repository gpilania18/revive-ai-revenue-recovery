"use client";

import React from "react";
import { formatStatusLabel } from "@/lib/format";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export type StatusType =
  | "recovered"
  | "captured"
  | "waiting"
  | "blocked"
  | "escalated"
  | "failed"
  | "success"
  | "pending"
  | "authorized"
  | "created"
  | "skipped"
  | "approved"
  | "rejected"
  | "resolved";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  recovered: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  captured: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  resolved: "bg-blue-50 text-blue-700 border border-blue-200",
  waiting: "bg-amber-50 text-amber-700 border border-amber-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  authorized: "bg-amber-50 text-amber-700 border border-amber-200",
  created: "bg-gray-100 text-gray-700 border border-gray-200",
  blocked: "bg-red-50 text-red-700 border border-red-200",
  failed: "bg-red-50 text-red-700 border border-red-200",
  rejected: "bg-gray-100 text-gray-700 border border-gray-300",
  escalated: "bg-blue-50 text-blue-700 border border-blue-200",
  skipped: "bg-gray-100 text-gray-600 border border-gray-200",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || "pending").toLowerCase();
  const label = formatStatusLabel(normalized);
  const style = statusStyles[normalized] || "bg-gray-100 text-gray-700 border border-gray-200";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}

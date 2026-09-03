"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRecovery } from "@/context/recovery-context";
import { API_URL } from "@/lib/api";

export function Sidebar() {
  const pathname = usePathname();
  const { pendingReviewCount } = useRecovery();
  const displayHost = API_URL.replace(/^https?:\/\//, "");

  const navItems = [
    { name: "Overview", href: "/", icon: <path d="M4 9h4v11H4zm12-9h4v20h-4zM10 4h4v16h-4z" /> },
    { name: "Transactions", href: "/transactions", icon: <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" /> },
    { name: "Recovery", href: "/recovery", icon: <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /> },
    {
      name: "Human Review",
      href: "/review",
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
      icon: (
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      ),
    },
    { name: "Analytics", href: "/analytics", icon: <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" /> },
  ];

  const systemItems = [
    { name: "Settings", href: "/settings", icon: <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87a.49.49 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /> },
  ];

  return (
    <div className="flex h-full w-60 flex-col bg-white border-r border-gray-200">
      {/* Top: REVIVE logo area */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-wider text-gray-900">REVIVE</span>
          <span className="text-[10px] tracking-widest text-gray-400 uppercase">Recovery Intelligence</span>
        </div>
      </div>

      {/* Navigation links */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-6 py-2 text-sm ${
                  isActive
                    ? "border-l-2 border-blue-600 bg-blue-50/50 text-blue-600 font-medium"
                    : "border-l-2 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                  <span>{item.name}</span>
                </div>
                {item.badge != null && (
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.2 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="mt-8 px-6 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">System</h3>
          </div>
          {systemItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-2 text-sm ${
                  isActive
                    ? "border-l-2 border-blue-600 bg-blue-50/50 text-blue-600 font-medium"
                    : "border-l-2 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Evaluation Environment widget */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Evaluation Environment
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-amber-500"></div>
          <span className="text-xs font-medium text-gray-700">API Connected</span>
        </div>
        <div className="text-xs text-gray-400 pl-4 font-mono truncate">{displayHost}</div>
      </div>
    </div>
  );
}

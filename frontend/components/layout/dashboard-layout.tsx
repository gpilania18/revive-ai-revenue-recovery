"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  onRefresh?: () => void;
}

export function DashboardLayout({ children, title, onRefresh }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:ml-60 min-h-screen">
        <TopBar 
          title={title} 
          onRefresh={onRefresh} 
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 p-6">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3 text-xs text-gray-400">
          <div>REVIVE &middot; AI-assisted payment recovery &middot; Evaluation environment</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
            <span>All systems operational</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

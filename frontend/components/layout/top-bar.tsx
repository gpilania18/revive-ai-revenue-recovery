"use client";

interface TopBarProps {
  title: string;
  onRefresh?: () => void;
  onMenuClick?: () => void;
}

export function TopBar({ title, onRefresh, onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-[52px] items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6 py-3">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1 -ml-1 text-gray-500 hover:bg-gray-100 rounded-md"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="flex items-center text-sm">
          <span className="text-gray-400">REVIVE</span>
          <span className="mx-2 text-gray-300">&gt;</span>
          <span className="font-medium text-gray-900">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
          <span className="text-xs font-medium text-emerald-700">Live</span>
        </div>
        
        <div className="hidden sm:flex items-center rounded-full bg-gray-100 px-2.5 py-1">
          <span className="text-xs font-medium text-gray-600"># seed 42</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 border border-gray-200">
          <svg className="h-4 w-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>
    </header>
  );
}

import { Bell, RefreshCw, Settings } from 'lucide-react';
import { Button } from '../ui/Button';
import { SearchInput } from '../ui/Input';
import { useState } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  mobileSubtitle?: string | React.ReactNode; // Optional shorter subtitle for mobile
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function Header({ title, subtitle, mobileSubtitle, onRefresh, isLoading }: HeaderProps) {
  const [notifications] = useState(3);
  
  return (
    <header className="min-h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 py-2 sm:py-0">
      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{title}</h1>
        {/* Mobile subtitle (shorter) */}
        {mobileSubtitle && <p className="sm:hidden text-xs text-slate-500 truncate">{mobileSubtitle}</p>}
        {/* Desktop subtitle (full) */}
        {subtitle && <p className="hidden sm:block text-sm text-slate-500">{subtitle}</p>}
        {/* Fallback if no mobileSubtitle provided */}
        {!mobileSubtitle && subtitle && <p className="sm:hidden text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Search - hidden on mobile */}
        <div className="hidden sm:block w-64">
          <SearchInput placeholder="Search SKUs, products..." />
        </div>
        
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            isLoading={isLoading}
            className="hidden sm:flex"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync
          </Button>
        )}
        
        <button className="relative p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>
        
        <button className="hidden sm:block p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

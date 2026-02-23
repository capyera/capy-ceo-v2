import { ChevronDown, Package, FileText, Palette, Users, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface WorkspaceHeaderProps {
  userName: string;
}

const workspaces = [
  { id: 'operations', name: 'Operations', icon: Package, available: true, url: null },
  { id: 'content', name: 'Content', icon: FileText, available: true, url: 'https://capy-content-dashboard-production.up.railway.app' },
  { id: 'creative', name: 'Creative', icon: Palette, available: false, url: null },
  { id: 'influencer', name: 'Influencer', icon: Users, available: false, url: null },
];

export function WorkspaceHeader({ userName }: WorkspaceHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { currentWorkspace, setCurrentWorkspace, user } = useAuth();
  
  const currentWs = workspaces.find(w => w.id === currentWorkspace) || workspaces[0];
  const CurrentIcon = currentWs.icon;

  const handleSelect = (wsId: string) => {
    const ws = workspaces.find(w => w.id === wsId);
    if (ws?.available) {
      if (ws.url) {
        window.open(ws.url, '_blank');
        setIsOpen(false);
        return;
      }
      setCurrentWorkspace(wsId);
    }
    setIsOpen(false);
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 pl-16 md:pl-6 flex items-center justify-between shrink-0">
      {/* Mobile: Empty space (hamburger is in MobileMenuButton) */}
      <div className="md:hidden" />
      
      {/* Desktop: Full Workspace Selector */}
      <div className="relative hidden md:block">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <CurrentIcon className="w-4 h-4 text-amber-600" />
          <span className="font-medium text-slate-900 text-sm">{currentWs.name} Workspace</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 animate-slide-up">
              <div className="px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Workspaces
              </div>
              {workspaces.map((ws) => {
                const Icon = ws.icon;
                const hasAccess = user?.workspaces.includes(ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSelect(ws.id)}
                    disabled={!ws.available || !hasAccess}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                      ws.id === currentWorkspace
                        ? 'bg-amber-50 text-amber-700'
                        : ws.available && hasAccess
                        ? 'hover:bg-slate-50 text-slate-700'
                        : 'text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${
                      ws.id === currentWorkspace ? 'text-amber-600' : 'text-slate-400'
                    }`} />
                    <span className="flex-1">{ws.name}</span>
                    {ws.url && ws.available && (
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    )}
                    {!ws.available && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                    {ws.available && !hasAccess && !ws.url && (
                      <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">
                        No Access
                      </span>
                    )}
                    {ws.id === currentWorkspace && !ws.url && (
                      <span className="text-amber-600 text-xs">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Right side - Hidden on mobile */}
      <div className="hidden md:block text-sm text-slate-500">
        Welcome back, <span className="font-medium text-slate-900">{userName}</span>
      </div>
    </header>
  );
}

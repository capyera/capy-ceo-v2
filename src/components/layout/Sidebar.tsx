import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  DollarSign, 
  ClipboardList, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Settings,
  HelpCircle,
  BarChart3,
  Warehouse,
  Brain,
  Target,
  Calendar,
  Database,
  LogOut,
  Shield,
  Truck,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface MenuSection {
  id: string;
  label: string;
  items: MenuItem[];
}

// Standalone items (no section)
const standaloneItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'revenue-planner-new', label: 'Revenue Planner', icon: Target, badge: 'NEW' },
  { id: 'sales-analytics', label: 'Sales Analytics', icon: TrendingUp },
  { id: 'category-mix', label: 'Category Mix', icon: BarChart3 },
];

// Grouped menu sections
const menuSections: MenuSection[] = [
  {
    id: 'catalog',
    label: 'CATALOG',
    items: [
      { id: 'products', label: 'Products', icon: Database },
      { id: 'bundles', label: 'Bundles', icon: Layers },
    ],
  },
  {
    id: 'inventory',
    label: 'INVENTORY',
    items: [
      { id: 'inventory', label: 'Stock Levels', icon: Package },
      { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
    ],
  },
  {
    id: 'supply-chain',
    label: 'SUPPLY CHAIN',
    items: [
      { id: 'purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
      { id: 'inbounds', label: 'Inbounds', icon: Truck },
      { id: 'suppliers', label: 'Suppliers', icon: Users },
    ],
  },
  {
    id: 'planning',
    label: 'PLANNING',
    items: [
      { id: 'inventory-runway', label: 'Inventory Runway', icon: Calendar },
      { id: 'revenue-waterfall', label: 'Revenue Planner', icon: TrendingUp },
    ],
  },
  {
    id: 'ops',
    label: 'OPS',
    items: [
      { id: 'ops-calendar', label: 'Ops Calendar', icon: Calendar },
    ],
  },
];

const bottomItems: MenuItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

// Get default collapsed state - expand sections with active items
function getDefaultCollapsed(activeTab: string): Record<string, boolean> {
  const collapsed: Record<string, boolean> = {};
  menuSections.forEach(section => {
    // Collapse by default, but expand if contains active tab
    const hasActiveItem = section.items.some(item => item.id === activeTab);
    collapsed[section.id] = !hasActiveItem;
  });
  return collapsed;
}

export function Sidebar({ activeTab, onTabChange, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  
  // Handle tab change on mobile - close menu after selection
  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    if (onMobileClose) {
      onMobileClose();
    }
  };
  
  // Load collapsed state from localStorage or use defaults
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return getDefaultCollapsed(activeTab);
      }
    }
    return getDefaultCollapsed(activeTab);
  });
  
  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsedSections));
  }, [collapsedSections]);
  
  // When active tab changes, expand its section
  useEffect(() => {
    menuSections.forEach(section => {
      if (section.items.some(item => item.id === activeTab)) {
        setCollapsedSections(prev => ({ ...prev, [section.id]: false }));
      }
    });
  }, [activeTab]);
  
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  return (
    <aside className={cn(
      "w-60 bg-white border-r border-slate-200 flex flex-col h-full",
      // Mobile: fixed overlay, hidden by default
      "fixed md:relative inset-y-0 left-0 z-40",
      "transform transition-transform duration-200 ease-in-out",
      // Mobile visibility
      isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-base">🦫</span>
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 text-[15px]">Capy Inventory</h1>
            <p className="text-[11px] text-slate-500">Operations</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Standalone items */}
        {standaloneItems.map((item) => (
          <NavItem 
            key={item.id} 
            item={item} 
            isActive={activeTab === item.id}
            onClick={() => handleTabChange(item.id)}
          />
        ))}
        
        {/* Grouped sections */}
        {menuSections.map((section) => (
          <div key={section.id} className="mt-4">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors"
            >
              {collapsedSections[section.id] ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {section.label}
            </button>
            
            {/* Section items */}
            {!collapsedSections[section.id] && (
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <NavItem 
                    key={item.id} 
                    item={item} 
                    isActive={activeTab === item.id}
                    onClick={() => handleTabChange(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      
      {/* Bottom items */}
      <div className="px-3 py-3 border-t border-slate-100 space-y-0.5">
        {user?.role === 'admin' && (
          <button
            onClick={() => handleTabChange('admin')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              activeTab === 'admin'
                ? "bg-violet-50 text-violet-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Shield className={cn("w-[18px] h-[18px]", activeTab === 'admin' ? "text-violet-600" : "text-slate-400")} />
            Admin
          </button>
        )}
        {bottomItems.map((item) => (
          <NavItem 
            key={item.id} 
            item={item} 
            isActive={activeTab === item.id}
            onClick={() => handleTabChange(item.id)}
          />
        ))}
      </div>
      
      {/* User */}
      <div className="px-3 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-amber-700 font-medium text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.role === 'admin' ? 'Admin' : 'Member'}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}

interface NavItemProps {
  item: MenuItem;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ item, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
        isActive
          ? "bg-amber-50 text-amber-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <item.icon className={cn(
        "w-[18px] h-[18px]",
        isActive ? "text-amber-600" : "text-slate-400"
      )} />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span className={cn(
          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
          item.badge === 'PRO' 
            ? "bg-violet-100 text-violet-700"
            : "bg-emerald-100 text-emerald-700"
        )}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

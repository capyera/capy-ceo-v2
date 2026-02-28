import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Target, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, Clock,
  Link2, BarChart3, X, Layers, Activity, User, Calendar, Plus, Search,
  Users, FolderKanban, Settings, Trash2, Edit2, MoreHorizontal, Share2,
  Eye, ArrowRight, Building2, GitBranch, ZoomIn, ZoomOut, Maximize2,
  Minimize2, Filter, TrendingUp, TrendingDown, Minus, Flag, CircleDot, PenTool,
  Home, LineChart, FileText, Lightbulb, ChevronUp, ArrowUpDown, Lock, Globe,
  Star, MessageSquare, AlertCircle, ExternalLink, History, GitMerge, MoreVertical,
  Circle, List, LayoutGrid, GripVertical
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StrategyCanvas } from './StrategyCanvas';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============ TYPES ============
interface Team {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  parent_team_id?: string;
  owner_name?: string;
  owner_avatar?: string;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  type: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  parent_plan_id?: string;
  team_id?: string;
  owner_name?: string;
  owner_avatar?: string;
  created_at: string;
}

interface FocusArea {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  commences?: string;
  retires?: string;
  sort_order?: number;
  created_at: string;
}

interface PlanFocusArea {
  id: string;
  plan_id: string;
  focus_area_id: string;
}

interface Objective {
  id: string;
  title: string;
  description?: string;
  focus_area_id?: string;
  plan_id?: string;
  status: string;
  progress: number;
  owner_name?: string;
  owner_avatar?: string;
  start_date?: string;
  end_date?: string;
  sort_order?: number;
  created_at: string;
}

interface Action {
  id: string;
  title: string;
  description?: string;
  objective_id: string;
  status: string;
  progress: number;
  owner_name?: string;
  due_date?: string;
  created_at: string;
}

interface Measure {
  id: string;
  name: string;
  description?: string;
  objective_id: string;
  current_value?: number;
  target_value?: number;
  unit?: string;
  trend: string;
  created_at: string;
}

interface SuccessCriteria {
  id: string;
  objective_id: string;
  name: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  weight?: number;
  created_at: string;
}

interface Update {
  id: string;
  objective_id: string;
  content: string;
  author_name?: string;
  created_at: string;
}

interface Risk {
  id: string;
  objective_id: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'mitigated' | 'resolved';
  created_at: string;
}

interface RecentlyViewed {
  id: string;
  type: 'plan' | 'team' | 'focus_area';
  name: string;
  owner?: string;
  icon?: string;
  timestamp: number;
}

type MainView = 'home' | 'plans-teams' | 'metrics' | 'reports' | 'insights' | 'canvas';
type PlanTeamsTab = 'plans' | 'teams' | 'focus-areas';
type PlannerTab = 'planner' | 'timeline';
type PlannerViewMode = 'list' | 'grid';
type ObjectiveDetailTab = 'details' | 'success-criteria' | 'updates' | 'risks' | 'relationships' | 'activity';
type SortField = 'name' | 'team' | 'parent' | 'focus_areas' | 'objectives' | 'created_at';
type SortDirection = 'asc' | 'desc';

// ============ CASCADE DESIGN TOKENS ============
const cascade = {
  // Typography
  font: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  // Colors - Cascade exact values
  colors: {
    primary: '#6366f1',      // Cascade indigo
    primaryHover: '#4f46e5', // Darker indigo on hover
    primaryLight: '#eef2ff', // Light indigo bg
    
    text: {
      primary: '#111827',    // gray-900
      secondary: '#374151',  // gray-700
      muted: '#6b7280',      // gray-500
      light: '#9ca3af',      // gray-400
    },
    
    bg: {
      main: '#ffffff',
      subtle: '#f9fafb',     // gray-50
      card: '#ffffff',
    },
    
    border: {
      default: '#e5e7eb',    // gray-200
      light: '#f3f4f6',      // gray-100
    },
    
    sidebar: {
      bg: '#1e1b4b',         // indigo-950 - solid like Cascade
      selected: 'rgba(255,255,255,0.1)',
      text: '#e0e7ff',       // indigo-100
      textActive: '#ffffff',
    },
  },
  // Spacing
  spacing: {
    sidebarWidth: '220px',
    cardPadding: '16px',
    tableRowHeight: '52px',
  },
  // Radii
  radius: {
    card: '8px',
    button: '6px',
    full: '9999px',
  },
  // Shadows
  shadow: {
    card: '0 1px 2px rgba(0,0,0,0.05)',
    cardHover: '0 4px 6px -1px rgba(0,0,0,0.1)',
  },
};

// ============ STATUS CONFIG ============
const statusConfig: Record<string, { label: string; color: string; bg: string; bgDark: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-500', bg: 'bg-gray-100', bgDark: 'bg-gray-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-100', bgDark: 'bg-blue-500' },
  on_track: { label: 'On Track', color: 'text-emerald-600', bg: 'bg-emerald-100', bgDark: 'bg-emerald-500' },
  behind: { label: 'Behind', color: 'text-amber-600', bg: 'bg-amber-100', bgDark: 'bg-amber-500' },
  at_risk: { label: 'At Risk', color: 'text-red-600', bg: 'bg-red-100', bgDark: 'bg-red-500' },
  done: { label: 'Done', color: 'text-emerald-600', bg: 'bg-emerald-100', bgDark: 'bg-emerald-500' },
  blocked: { label: 'Blocked', color: 'text-red-600', bg: 'bg-red-100', bgDark: 'bg-red-500' },
};

const planTypeOptions = [
  { value: 'strategic', label: 'Strategic Plan' },
  { value: 'operational', label: 'Operational Plan' },
  { value: 'tactical', label: 'Tactical Plan' },
  { value: 'departmental', label: 'Department Plan' },
];

const colorOptions = [
  { name: 'emerald', bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  { name: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  { name: 'amber', bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  { name: 'pink', bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  { name: 'green', bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  { name: 'red', bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
  { name: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
];

const iconOptions = ['🎯', '🚀', '💡', '📈', '🛡️', '🌱', '⚡', '🔧', '👥', '💰', '🏆', '🧸', '🚚', '🎨', '📊'];

const getColorClasses = (colorName: string) => {
  return colorOptions.find(c => c.name === colorName) || colorOptions[0];
};

// ============ PLANNER VIEW MODE HELPERS ============
const PLANNER_VIEW_MODE_KEY = 'strategy_planner_view_mode';

const getPlannerViewMode = (): PlannerViewMode => {
  try {
    const stored = localStorage.getItem(PLANNER_VIEW_MODE_KEY);
    return (stored === 'grid') ? 'grid' : 'list';
  } catch {
    return 'list';
  }
};

const setPlannerViewModeStorage = (mode: PlannerViewMode) => {
  try {
    localStorage.setItem(PLANNER_VIEW_MODE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
};

// ============ RECENTLY VIEWED HELPERS ============
const RECENTLY_VIEWED_KEY = 'strategy_recently_viewed';
const MAX_RECENT_ITEMS = 6;

const getRecentlyViewed = (): RecentlyViewed[] => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addToRecentlyViewed = (item: Omit<RecentlyViewed, 'timestamp'>) => {
  const recent = getRecentlyViewed().filter(r => !(r.id === item.id && r.type === item.type));
  const newItem: RecentlyViewed = { ...item, timestamp: Date.now() };
  const updated = [newItem, ...recent].slice(0, MAX_RECENT_ITEMS);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  return updated;
};

// ============ DATE HELPERS ============
const getQuarterInfo = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return null;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  const quarter = Math.floor(start.getMonth() / 3) + 1;
  const year = start.getFullYear();
  
  const monthsToGo = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  
  return {
    label: `Q${quarter} ${year}`,
    range: `${formatDate(start)} - ${formatDate(end)}`,
    timeLeft: monthsToGo === 1 ? '1 month to go' : `${monthsToGo} months to go`
  };
};

// ============ UTILITY COMPONENTS ============
function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.not_started;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.not_started;
  return <div className={`w-2.5 h-2.5 rounded-full ${config.bgDark}`} />;
}

// Cascade-style circular progress indicator
function CircularProgress({ progress, size = 24, strokeWidth = 3 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  const getColor = () => {
    if (progress >= 100) return '#10b981'; // emerald-500
    if (progress >= 50) return '#10b981'; // emerald-500
    return '#e5e7eb'; // gray-200 (empty state)
  };
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        {progress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      {progress >= 100 && (
        <CheckCircle2 className="absolute inset-0 m-auto w-3 h-3 text-emerald-500" />
      )}
    </div>
  );
}

function ProgressBar({ progress, color = 'emerald', size = 'sm' }: { progress: number; color?: string; size?: 'sm' | 'md' }) {
  const colorClass = getColorClasses(color);
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  return (
    <div className={`w-full ${height} bg-gray-200 rounded-full overflow-hidden`}>
      <div 
        className={`h-full ${colorClass.bg} rounded-full transition-all duration-300`} 
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
      />
    </div>
  );
}

function TrendIndicator({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

// Cascade-style Avatar with exact sizing
function Avatar({ name, avatar, size = 'sm' }: { name?: string; avatar?: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  // Cascade uses 32px for contributor avatars
  const sizeClass = size === 'xs' ? 'w-5 h-5 text-[10px]' : size === 'sm' ? 'w-8 h-8 text-xs' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base';
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  
  if (avatar) {
    return <img src={avatar} alt={name} className={`${sizeClass} rounded-full object-cover`} />;
  }
  return (
    <div 
      className={`${sizeClass} rounded-full flex items-center justify-center font-medium text-white`}
      style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)' }}
    >
      {initials}
    </div>
  );
}

// Cascade-style Avatar Stack with -8px overlap
function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  const displayed = names.slice(0, max);
  const remaining = names.length - max;
  
  return (
    <div className="flex" style={{ marginLeft: 0 }}>
      {displayed.map((name, i) => (
        <div 
          key={i} 
          className="ring-2 ring-white rounded-full"
          style={{ marginLeft: i === 0 ? 0 : '-8px', zIndex: displayed.length - i }}
        >
          <Avatar name={name} size="sm" />
        </div>
      ))}
      {remaining > 0 && (
        <div 
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 ring-2 ring-white"
          style={{ marginLeft: '-8px', zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, description, action, onAction, icon: Icon = Target }: { 
  title: string; 
  description: string; 
  action: string;
  onAction: () => void;
  icon?: any;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: cascade.colors.primaryLight }}
      >
        <Icon className="w-8 h-8" style={{ color: cascade.colors.primary }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: cascade.colors.text.primary }}>
        {title}
      </h3>
      <p className="mb-4 max-w-sm" style={{ color: cascade.colors.text.muted }}>
        {description}
      </p>
      <button
        onClick={onAction}
        className="flex items-center gap-2 px-4 py-2 text-white font-medium transition-colors"
        style={{ 
          backgroundColor: cascade.colors.primary,
          borderRadius: cascade.radius.button,
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primaryHover}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primary}
      >
        <Plus className="w-4 h-4" />
        {action}
      </button>
    </div>
  );
}

function ConfirmDialog({ 
  open, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Delete',
  danger = true 
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  danger?: boolean;
}) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div 
        className="bg-white shadow-xl w-full max-w-md p-6"
        style={{ borderRadius: cascade.radius.card }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2" style={{ color: cascade.colors.text.primary }}>
          {title}
        </h3>
        <p className="mb-6" style={{ color: cascade.colors.text.muted }}>
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ borderRadius: cascade.radius.button }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white"
            style={{ 
              backgroundColor: danger ? '#ef4444' : cascade.colors.primary,
              borderRadius: cascade.radius.button,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ SORTABLE TABLE HEADER - Cascade Style ============
function SortableHeader({ 
  label, 
  field, 
  currentSort, 
  currentDirection, 
  onSort 
}: { 
  label: string; 
  field: SortField; 
  currentSort: SortField; 
  currentDirection: SortDirection; 
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;
  return (
    <th 
      className="text-left px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
      style={{ 
        fontSize: '12px',
        fontWeight: 500,
        color: cascade.colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <div className="flex flex-col">
          {isActive ? (
            currentDirection === 'asc' ? 
              <ChevronUp className="w-3 h-3" style={{ color: cascade.colors.primary }} /> : 
              <ChevronDown className="w-3 h-3" style={{ color: cascade.colors.primary }} />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-300" />
          )}
        </div>
      </div>
    </th>
  );
}

// ============ MODAL COMPONENTS ============

// Create/Edit Plan Modal
function PlanModal({ 
  open, 
  onClose, 
  onSave, 
  plan,
  teams,
  plans 
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Plan>) => void;
  plan?: Plan | null;
  teams: Team[];
  plans: Plan[];
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'strategic',
    description: '',
    team_id: '',
    parent_plan_id: '',
    owner_name: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        type: plan.type || 'strategic',
        description: plan.description || '',
        team_id: plan.team_id || '',
        parent_plan_id: plan.parent_plan_id || '',
        owner_name: plan.owner_name || '',
        start_date: plan.start_date || '',
        end_date: plan.end_date || '',
      });
    } else {
      setFormData({
        name: '',
        type: 'strategic',
        description: '',
        team_id: '',
        parent_plan_id: '',
        owner_name: '',
        start_date: '',
        end_date: '',
      });
    }
  }, [plan, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      team_id: formData.team_id || null,
      parent_plan_id: formData.parent_plan_id || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: cascade.radius.card }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: cascade.colors.border.default }}>
          <h2 className="text-lg font-semibold" style={{ color: cascade.colors.text.primary }}>
            {plan ? 'Edit Plan' : 'Create New Plan'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Plan Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default, '--tw-ring-color': cascade.colors.primary } as any}
              placeholder="e.g., Q1 2026 Growth Plan"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Plan Type
            </label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
            >
              {planTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Owning Team
            </label>
            <select
              value={formData.team_id}
              onChange={e => setFormData({ ...formData, team_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
            >
              <option value="">No team assigned</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.icon} {team.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Parent Plan
            </label>
            <select
              value={formData.parent_plan_id}
              onChange={e => setFormData({ ...formData, parent_plan_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
            >
              <option value="">No parent (top-level)</option>
              {plans.filter(p => p.id !== plan?.id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Owner
            </label>
            <input
              type="text"
              value={formData.owner_name}
              onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="e.g., James"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              rows={3}
              placeholder="What is this plan about?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              style={{ borderRadius: cascade.radius.button }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white"
              style={{ backgroundColor: cascade.colors.primary, borderRadius: cascade.radius.button }}
            >
              {plan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create/Edit Team Modal
function TeamModal({ 
  open, 
  onClose, 
  onSave, 
  team,
  teams 
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Team>) => void;
  team?: Team | null;
  teams: Team[];
}) {
  const [formData, setFormData] = useState({
    name: '',
    icon: '👥',
    color: 'indigo',
    description: '',
    vision: '',
    mission: '',
    parent_team_id: '',
    owner_name: '',
  });

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        icon: team.icon || '👥',
        color: team.color || 'indigo',
        description: team.description || '',
        vision: team.vision || '',
        mission: team.mission || '',
        parent_team_id: team.parent_team_id || '',
        owner_name: team.owner_name || '',
      });
    } else {
      setFormData({
        name: '',
        icon: '👥',
        color: 'indigo',
        description: '',
        vision: '',
        mission: '',
        parent_team_id: '',
        owner_name: '',
      });
    }
  }, [team, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      parent_team_id: formData.parent_team_id || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: cascade.radius.card }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: cascade.colors.border.default }}>
          <h2 className="text-lg font-semibold" style={{ color: cascade.colors.text.primary }}>
            {team ? 'Edit Team' : 'Create New Team'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Team Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
                placeholder="e.g., Product Development"
                required
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Icon
              </label>
              <div className="flex flex-wrap gap-1 p-2 border rounded-lg max-w-[200px]" style={{ borderColor: cascade.colors.border.default }}>
                {iconOptions.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
                      formData.icon === icon ? 'bg-indigo-100 ring-2 ring-indigo-500' : ''
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.name })}
                    className={`w-8 h-8 rounded-full ${color.bg} ${
                      formData.color === color.name ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Parent Team
            </label>
            <select
              value={formData.parent_team_id}
              onChange={e => setFormData({ ...formData, parent_team_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
            >
              <option value="">No parent (top-level)</option>
              {teams.filter(t => t.id !== team?.id).map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Owner
            </label>
            <input
              type="text"
              value={formData.owner_name}
              onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="Team lead name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              rows={2}
              placeholder="What does this team do?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Vision
            </label>
            <textarea
              value={formData.vision}
              onChange={e => setFormData({ ...formData, vision: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              rows={2}
              placeholder="Where is this team heading?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Mission
            </label>
            <textarea
              value={formData.mission}
              onChange={e => setFormData({ ...formData, mission: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              rows={2}
              placeholder="What is this team's purpose?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              style={{ borderRadius: cascade.radius.button }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white"
              style={{ backgroundColor: cascade.colors.primary, borderRadius: cascade.radius.button }}
            >
              {team ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create/Edit Focus Area Modal
function FocusAreaModal({ 
  open, 
  onClose, 
  onSave, 
  focusArea 
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<FocusArea>) => void;
  focusArea?: FocusArea | null;
}) {
  const [formData, setFormData] = useState({
    name: '',
    icon: '🎯',
    color: 'indigo',
    description: '',
    commences: '',
    retires: '',
  });

  useEffect(() => {
    if (focusArea) {
      setFormData({
        name: focusArea.name || '',
        icon: focusArea.icon || '🎯',
        color: focusArea.color || 'indigo',
        description: focusArea.description || '',
        commences: focusArea.commences || '',
        retires: focusArea.retires || '',
      });
    } else {
      setFormData({
        name: '',
        icon: '🎯',
        color: 'indigo',
        description: '',
        commences: '',
        retires: '',
      });
    }
  }, [focusArea, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Include id for updates
    onSave(focusArea?.id ? { ...formData, id: focusArea.id } : formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white shadow-xl w-full max-w-lg"
        style={{ borderRadius: cascade.radius.card }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: cascade.colors.border.default }}>
          <h2 className="text-lg font-semibold" style={{ color: cascade.colors.text.primary }}>
            {focusArea ? 'Edit Focus Area' : 'Create Focus Area'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="e.g., Customer Experience"
              required
            />
          </div>

          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Icon
              </label>
              <div className="flex flex-wrap gap-1 p-2 border rounded-lg max-w-[200px]" style={{ borderColor: cascade.colors.border.default }}>
                {iconOptions.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
                      formData.icon === icon ? 'bg-indigo-100 ring-2 ring-indigo-500' : ''
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.name })}
                    className={`w-8 h-8 rounded-full ${color.bg} ${
                      formData.color === color.name ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              rows={2}
              placeholder="What does this focus area cover?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Commences
              </label>
              <input
                type="date"
                value={formData.commences}
                onChange={e => setFormData({ ...formData, commences: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Retires
              </label>
              <input
                type="date"
                value={formData.retires}
                onChange={e => setFormData({ ...formData, retires: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              style={{ borderRadius: cascade.radius.button }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white"
              style={{ backgroundColor: cascade.colors.primary, borderRadius: cascade.radius.button }}
            >
              {focusArea ? 'Save Changes' : 'Create Focus Area'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create/Edit Objective Modal
function ObjectiveModal({ 
  open, 
  onClose, 
  onSave, 
  objective,
  focusAreas,
  plans,
  defaultPlanId,
  defaultFocusAreaId
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Objective>) => void;
  objective?: Objective | null;
  focusAreas: FocusArea[];
  plans: Plan[];
  defaultPlanId?: string;
  defaultFocusAreaId?: string;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    focus_area_id: '',
    plan_id: '',
    status: 'not_started',
    progress: 0,
    owner_name: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (objective) {
      setFormData({
        title: objective.title || '',
        description: objective.description || '',
        focus_area_id: objective.focus_area_id || '',
        plan_id: objective.plan_id || '',
        status: objective.status || 'not_started',
        progress: objective.progress || 0,
        owner_name: objective.owner_name || '',
        start_date: objective.start_date || '',
        end_date: objective.end_date || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        focus_area_id: defaultFocusAreaId || '',
        plan_id: defaultPlanId || '',
        status: 'not_started',
        progress: 0,
        owner_name: '',
        start_date: '',
        end_date: '',
      });
    }
  }, [objective, open, defaultPlanId, defaultFocusAreaId]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saveData = {
      ...formData,
      focus_area_id: formData.focus_area_id || null,
      plan_id: formData.plan_id || null,
      progress: Number(formData.progress),
    };
    // Include id for updates
    onSave(objective?.id ? { ...saveData, id: objective.id } : saveData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: cascade.radius.card }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: cascade.colors.border.default }}>
          <h2 className="text-lg font-semibold" style={{ color: cascade.colors.text.primary }}>
            {objective ? 'Edit Objective' : 'Create Objective'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="e.g., Launch Amazon Store"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Plan
            </label>
            <select
              value={formData.plan_id}
              onChange={e => setFormData({ ...formData, plan_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
            >
              <option value="">No plan</option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Focus Area
            </label>
            <select
              value={formData.focus_area_id}
              onChange={e => setFormData({ ...formData, focus_area_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
            >
              <option value="">No focus area</option>
              {focusAreas.map(fa => (
                <option key={fa.id} value={fa.id}>{fa.icon} {fa.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Progress ({formData.progress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progress}
                onChange={e => setFormData({ ...formData, progress: Number(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Owner
            </label>
            <input
              type="text"
              value={formData.owner_name}
              onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="Who owns this objective?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              rows={3}
              placeholder="What do we want to achieve?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              style={{ borderRadius: cascade.radius.button }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white"
              style={{ backgroundColor: cascade.colors.primary, borderRadius: cascade.radius.button }}
            >
              {objective ? 'Save Changes' : 'Create Objective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Action Modal
function ActionModal({ 
  open, 
  onClose, 
  onSave, 
  action,
  objectiveId
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Action>) => void;
  action?: Action | null;
  objectiveId: string;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'not_started',
    progress: 0,
    owner_name: '',
    due_date: '',
  });

  useEffect(() => {
    if (action) {
      setFormData({
        title: action.title || '',
        description: action.description || '',
        status: action.status || 'not_started',
        progress: action.progress || 0,
        owner_name: action.owner_name || '',
        due_date: action.due_date || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'not_started',
        progress: 0,
        owner_name: '',
        due_date: '',
      });
    }
  }, [action, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      objective_id: objectiveId,
      progress: Number(formData.progress),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white shadow-xl w-full max-w-md"
        style={{ borderRadius: cascade.radius.card }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: cascade.colors.border.default }}>
          <h2 className="text-lg font-semibold" style={{ color: cascade.colors.text.primary }}>
            {action ? 'Edit Action' : 'Add Action'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Owner
            </label>
            <input
              type="text"
              value={formData.owner_name}
              onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="Who's responsible?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Progress ({formData.progress}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.progress}
              onChange={e => setFormData({ ...formData, progress: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              style={{ borderRadius: cascade.radius.button }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white"
              style={{ backgroundColor: cascade.colors.primary, borderRadius: cascade.radius.button }}
            >
              {action ? 'Save' : 'Add Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Measure Modal (now Success Criteria Modal)
function MeasureModal({ 
  open, 
  onClose, 
  onSave, 
  measure,
  objectiveId
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Measure>) => void;
  measure?: Measure | null;
  objectiveId: string;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    current_value: 0,
    target_value: 100,
    unit: '',
    trend: 'flat',
  });

  useEffect(() => {
    if (measure) {
      setFormData({
        name: measure.name || '',
        description: measure.description || '',
        current_value: measure.current_value || 0,
        target_value: measure.target_value || 100,
        unit: measure.unit || '',
        trend: measure.trend || 'flat',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        current_value: 0,
        target_value: 100,
        unit: '',
        trend: 'flat',
      });
    }
  }, [measure, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      objective_id: objectiveId,
      current_value: Number(formData.current_value),
      target_value: Number(formData.target_value),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white shadow-xl w-full max-w-md"
        style={{ borderRadius: cascade.radius.card }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: cascade.colors.border.default }}>
          <h2 className="text-lg font-semibold" style={{ color: cascade.colors.text.primary }}>
            {measure ? 'Edit Success Criteria' : 'Add Success Criteria'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
              style={{ borderColor: cascade.colors.border.default }}
              placeholder="e.g., Revenue Growth"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Current Value
              </label>
              <input
                type="number"
                value={formData.current_value}
                onChange={e => setFormData({ ...formData, current_value: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Target Value
              </label>
              <input
                type="number"
                value={formData.target_value}
                onChange={e => setFormData({ ...formData, target_value: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Unit
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
                placeholder="e.g., %, $, units"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>
                Trend
              </label>
              <select
                value={formData.trend}
                onChange={e => setFormData({ ...formData, trend: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 bg-white"
                style={{ borderColor: cascade.colors.border.default }}
              >
                <option value="up">↑ Up</option>
                <option value="down">↓ Down</option>
                <option value="flat">→ Flat</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              style={{ borderRadius: cascade.radius.button }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white"
              style={{ backgroundColor: cascade.colors.primary, borderRadius: cascade.radius.button }}
            >
              {measure ? 'Save' : 'Add Success Criteria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ CASCADE-STYLE OBJECTIVE DETAIL PANEL ============
function ObjectiveDetailPanel({
  objective,
  actions,
  measures,
  onClose,
  onEditObjective,
  onDeleteObjective,
  onAddAction,
  onEditAction,
  onDeleteAction,
  onAddMeasure,
  onEditMeasure,
  onDeleteMeasure,
}: {
  objective: Objective;
  actions: Action[];
  measures: Measure[];
  onClose: () => void;
  onEditObjective: () => void;
  onDeleteObjective: () => void;
  onAddAction: () => void;
  onEditAction: (action: Action) => void;
  onDeleteAction: (id: string) => void;
  onAddMeasure: () => void;
  onEditMeasure: (measure: Measure) => void;
  onDeleteMeasure: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<ObjectiveDetailTab>('details');
  const [comment, setComment] = useState('');
  
  const quarterInfo = getQuarterInfo(objective.start_date, objective.end_date);
  
  const tabs: { id: ObjectiveDetailTab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'success-criteria', label: 'Success criteria' },
    { id: 'updates', label: 'Updates' },
    { id: 'risks', label: 'Risks' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white flex flex-col rounded-lg shadow-2xl max-h-[90vh] overflow-hidden"
        style={{ 
          width: '600px',
          maxWidth: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header */}
      <div className="p-4" style={{ borderBottom: `1px solid ${cascade.colors.border.default}` }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span 
              className="text-xs font-medium uppercase"
              style={{ color: cascade.colors.text.muted, letterSpacing: '0.05em' }}
            >
              Objective
            </span>
            <button 
              className="text-xs flex items-center gap-1"
              style={{ color: cascade.colors.primary }}
            >
              <ExternalLink className="w-3 h-3" />
              Goal hub
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEditObjective} className="p-1.5 hover:bg-gray-100 rounded">
              <Edit2 className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
            </button>
            <button onClick={onDeleteObjective} className="p-1.5 hover:bg-red-50 rounded">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
              <X className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
            </button>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold mb-3" style={{ color: cascade.colors.text.primary }}>
          {objective.title}
        </h2>
        
        {/* Date Range - Cascade Style */}
        {quarterInfo && (
          <div className="flex items-center gap-2 text-sm" style={{ color: cascade.colors.text.muted }}>
            <Calendar className="w-4 h-4" />
            <span className="font-medium" style={{ color: cascade.colors.primary }}>{quarterInfo.label}</span>
            <span>·</span>
            <span>{quarterInfo.range}</span>
            <span style={{ color: cascade.colors.text.light }}>({quarterInfo.timeLeft})</span>
          </div>
        )}
      </div>

      {/* Success Criteria Alert - Cascade Style */}
      {measures.length === 0 && (
        <div 
          className="mx-4 mt-4 p-3 rounded-lg"
          style={{ 
            backgroundColor: '#fffbeb',
            border: '1px solid #fcd34d',
          }}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800">
                To display progress you must add at least one success criteria
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Success Criteria Button */}
      <div className="px-4 py-3">
        <button
          onClick={onAddMeasure}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium transition-colors"
          style={{ 
            backgroundColor: cascade.colors.primary,
            borderRadius: cascade.radius.button,
          }}
        >
          <Plus className="w-4 h-4" />
          Add success criteria
        </button>
      </div>

      {/* Tabs - Cascade Style */}
      <div style={{ borderBottom: `1px solid ${cascade.colors.border.default}` }}>
        <div className="flex px-4 gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="whitespace-nowrap transition-colors"
              style={{
                padding: '10px 12px',
                paddingBottom: '8px',
                marginBottom: '-1px',
                fontSize: '14px',
                fontWeight: 500,
                color: activeTab === tab.id ? cascade.colors.primary : cascade.colors.text.muted,
                borderBottom: activeTab === tab.id 
                  ? `2px solid ${cascade.colors.primary}` 
                  : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'details' && (
          <div className="p-4 space-y-4">
            {/* Progress */}
            <div className="rounded-lg p-4" style={{ backgroundColor: cascade.colors.bg.subtle }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: cascade.colors.text.secondary }}>
                  Progress
                </span>
                <span className="text-sm font-semibold" style={{ color: cascade.colors.text.primary }}>
                  {objective.progress}%
                </span>
              </div>
              <ProgressBar progress={objective.progress} size="md" color="indigo" />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-3" style={{ backgroundColor: cascade.colors.bg.subtle }}>
                <span className="text-xs block mb-1" style={{ color: cascade.colors.text.muted }}>Status</span>
                <StatusBadge status={objective.status} />
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: cascade.colors.bg.subtle }}>
                <span className="text-xs block mb-1" style={{ color: cascade.colors.text.muted }}>Owner</span>
                <div className="flex items-center gap-2">
                  <Avatar name={objective.owner_name} size="sm" />
                  <span className="text-sm font-medium">{objective.owner_name || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            {objective.description && (
              <div>
                <h4 className="text-sm font-medium mb-2" style={{ color: cascade.colors.text.secondary }}>
                  Description
                </h4>
                <p className="text-sm" style={{ color: cascade.colors.text.muted }}>
                  {objective.description}
                </p>
              </div>
            )}

            {/* Actions Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 
                  className="text-sm font-medium flex items-center gap-2"
                  style={{ color: cascade.colors.text.secondary }}
                >
                  <Flag className="w-4 h-4" />
                  Actions ({actions.length})
                </h4>
                <button
                  onClick={onAddAction}
                  className="text-xs flex items-center gap-1"
                  style={{ color: cascade.colors.primary }}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {actions.length === 0 ? (
                  <p 
                    className="text-sm text-center py-4 rounded-lg"
                    style={{ backgroundColor: cascade.colors.bg.subtle, color: cascade.colors.text.muted }}
                  >
                    No actions yet
                  </p>
                ) : (
                  actions.map(action => (
                    <div 
                      key={action.id} 
                      className="p-3 rounded-lg group"
                      style={{ backgroundColor: cascade.colors.bg.subtle }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <StatusDot status={action.status} />
                          <div>
                            <div 
                              className="font-medium text-sm"
                              style={{ color: cascade.colors.text.primary }}
                            >
                              {action.title}
                            </div>
                            <div 
                              className="text-xs flex items-center gap-2 mt-1"
                              style={{ color: cascade.colors.text.muted }}
                            >
                              {action.owner_name && <span>{action.owner_name}</span>}
                              {action.due_date && <span>Due {new Date(action.due_date).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEditAction(action)} className="p-1 hover:bg-gray-200 rounded">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => onDeleteAction(action.id)} className="p-1 hover:bg-red-100 text-red-600 rounded">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 ml-6">
                        <ProgressBar progress={action.progress} size="sm" color="blue" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'success-criteria' && (
          <div className="p-4">
            {/* Weighting Toggle */}
            <div 
              className="flex items-center justify-between mb-4 p-3 rounded-lg"
              style={{ backgroundColor: cascade.colors.bg.subtle }}
            >
              <span className="text-sm" style={{ color: cascade.colors.text.secondary }}>Weighted evenly</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-gray-300 peer-checked:bg-indigo-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
              </label>
            </div>

            {/* Success Criteria List */}
            <div className="space-y-3">
              {measures.length === 0 ? (
                <div 
                  className="text-center py-8 rounded-lg"
                  style={{ backgroundColor: cascade.colors.bg.subtle }}
                >
                  <BarChart3 className="w-10 h-10 mx-auto mb-2" style={{ color: cascade.colors.border.default }} />
                  <p className="text-sm" style={{ color: cascade.colors.text.muted }}>No success criteria defined</p>
                  <button
                    onClick={onAddMeasure}
                    className="mt-3 text-sm font-medium"
                    style={{ color: cascade.colors.primary }}
                  >
                    + Add your first success criteria
                  </button>
                </div>
              ) : (
                measures.map(measure => {
                  const percentage = measure.target_value ? Math.round((measure.current_value || 0) / measure.target_value * 100) : 0;
                  return (
                    <div 
                      key={measure.id} 
                      className="p-4 rounded-lg group"
                      style={{ backgroundColor: cascade.colors.bg.subtle }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: cascade.colors.text.primary }}>
                            {measure.name}
                          </span>
                          <TrendIndicator trend={measure.trend} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {measure.current_value}{measure.unit} / {measure.target_value}{measure.unit}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onEditMeasure(measure)} className="p-1 hover:bg-gray-200 rounded">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => onDeleteMeasure(measure.id)} className="p-1 hover:bg-red-100 text-red-600 rounded">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <ProgressBar progress={percentage} size="sm" color="indigo" />
                      <div 
                        className="text-xs mt-1 text-right"
                        style={{ color: cascade.colors.text.muted }}
                      >
                        {percentage}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {measures.length > 0 && (
              <button
                onClick={onAddMeasure}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg transition-colors"
                style={{ 
                  borderColor: cascade.colors.border.default,
                  color: cascade.colors.text.muted,
                }}
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            )}
          </div>
        )}

        {activeTab === 'updates' && (
          <div className="p-4">
            <div 
              className="text-center py-8 rounded-lg"
              style={{ backgroundColor: cascade.colors.bg.subtle }}
            >
              <History className="w-10 h-10 mx-auto mb-2" style={{ color: cascade.colors.border.default }} />
              <p className="text-sm" style={{ color: cascade.colors.text.muted }}>No updates yet</p>
              <p className="text-xs mt-1" style={{ color: cascade.colors.text.light }}>
                Updates will appear here as they're added
              </p>
            </div>
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="p-4">
            <div 
              className="text-center py-8 rounded-lg"
              style={{ backgroundColor: cascade.colors.bg.subtle }}
            >
              <AlertTriangle className="w-10 h-10 mx-auto mb-2" style={{ color: cascade.colors.border.default }} />
              <p className="text-sm" style={{ color: cascade.colors.text.muted }}>No risks identified</p>
              <button 
                className="mt-3 text-sm font-medium"
                style={{ color: cascade.colors.primary }}
              >
                + Add a risk
              </button>
            </div>
          </div>
        )}

        {activeTab === 'relationships' && (
          <div className="p-4">
            <div 
              className="text-center py-8 rounded-lg"
              style={{ backgroundColor: cascade.colors.bg.subtle }}
            >
              <GitMerge className="w-10 h-10 mx-auto mb-2" style={{ color: cascade.colors.border.default }} />
              <p className="text-sm" style={{ color: cascade.colors.text.muted }}>No relationships defined</p>
              <p className="text-xs mt-1" style={{ color: cascade.colors.text.light }}>
                Link this objective to other goals
              </p>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-4">
            <div 
              className="text-center py-8 rounded-lg"
              style={{ backgroundColor: cascade.colors.bg.subtle }}
            >
              <Activity className="w-10 h-10 mx-auto mb-2" style={{ color: cascade.colors.border.default }} />
              <p className="text-sm" style={{ color: cascade.colors.text.muted }}>No activity yet</p>
              <p className="text-xs mt-1" style={{ color: cascade.colors.text.light }}>
                Activity will be logged here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="p-4" style={{ borderTop: `1px solid ${cascade.colors.border.default}` }}>
        <h4 
          className="text-sm font-medium mb-3 flex items-center gap-2"
          style={{ color: cascade.colors.text.secondary }}
        >
          <MessageSquare className="w-4 h-4" />
          Comments
        </h4>
        <div className="flex gap-2">
          <Avatar name="You" size="sm" />
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: cascade.colors.border.default }}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

// ============ RECENTLY VIEWED CARD - Cascade Style ============
function RecentlyViewedCard({ item, onClick }: { item: RecentlyViewed; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 hover:shadow-md transition-all cursor-pointer min-w-[200px]"
      style={{ 
        border: `1px solid ${cascade.colors.border.default}`,
        borderRadius: cascade.radius.card,
        boxShadow: cascade.shadow.card,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Purple icon circle - Cascade style */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: cascade.colors.primary }}
        >
          {item.type === 'plan' ? (
            <Users className="w-5 h-5 text-white" />
          ) : item.type === 'team' ? (
            <span className="text-lg">{item.icon || '👥'}</span>
          ) : (
            <span className="text-lg">{item.icon || '🎯'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div 
            className="font-medium truncate"
            style={{ color: cascade.colors.text.primary, fontSize: '14px' }}
          >
            {item.name}
          </div>
          <div 
            className="capitalize mt-0.5"
            style={{ color: cascade.colors.text.muted, fontSize: '12px' }}
          >
            {item.type.replace('_', ' ')}
          </div>
          {/* + Assign to team link */}
          <button 
            className="mt-2 text-xs font-medium"
            style={{ color: cascade.colors.primary }}
            onClick={(e) => e.stopPropagation()}
          >
            + Assign to team
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ SORTABLE OBJECTIVE ITEM ============
function SortableObjectiveItem({
  objective,
  onSelectObjective,
  onEditObjective,
  isDragging,
  isExpanded,
  actions,
}: {
  objective: Objective;
  onSelectObjective: (obj: Objective) => void;
  onEditObjective?: (obj: Objective) => void;
  isDragging?: boolean;
  isExpanded?: boolean;
  actions?: Action[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({ id: objective.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSorting ? 0.5 : 1,
    zIndex: isSorting ? 1000 : 'auto',
  };

  const isOnTrack = objective.status === 'on_track' || objective.status === 'done';
  const isAtRisk = objective.status === 'at_risk' || objective.status === 'blocked';
  
  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return null;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
    if (start) return `From ${formatDate(start)}`;
    if (end) return `Until ${formatDate(end)}`;
    return null;
  };

  const dateRange = formatDateRange(objective.start_date, objective.end_date);
  
  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className="cursor-pointer transition-all group"
      onClick={() => onSelectObjective(objective)}
    >
      {/* Cascade-style objective row - clean, simple, no heavy borders */}
      <div
        className="flex items-center gap-3 py-2.5 px-4 hover:bg-slate-50 transition-colors border-b"
        style={{ 
          borderColor: cascade.colors.border.light,
          opacity: isSorting ? 0.6 : 1,
        }}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" style={{ color: cascade.colors.text.light }} />
        </div>
        
        {/* Small amber dot indicator */}
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: isOnTrack ? '#22c55e' : isAtRisk ? '#ef4444' : '#f59e0b' }}
        />
        
        {/* Left side: Title + Category label */}
        <div className="flex-1 min-w-0">
          <div 
            className="truncate"
            style={{ color: cascade.colors.text.primary, fontSize: '14px', fontWeight: 400 }}
          >
            {objective.title}
          </div>
          <div 
            className="flex items-center gap-1 mt-0.5"
            style={{ color: cascade.colors.text.muted, fontSize: '11px' }}
          >
            <span>📋</span>
            <span>Corporate objective</span>
          </div>
        </div>
        
        {/* Strategy Cycle Badge */}
        {dateRange && (
          <span 
            className="px-2.5 py-1 rounded text-xs flex-shrink-0 hidden lg:inline-flex items-center gap-1"
            style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '11px' }}
          >
            <Calendar className="w-3 h-3" />
            {dateRange}
          </span>
        )}
        
        {/* Settings/Link icon */}
        <button 
          onClick={(e) => { e.stopPropagation(); onEditObjective?.(objective); }}
          className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
        >
          <Settings className="w-4 h-4" style={{ color: cascade.colors.text.light }} />
        </button>
        
        {/* Owner Avatar */}
        <div className="flex-shrink-0">
          <Avatar name={objective.owner_name || 'Unassigned'} size="sm" />
        </div>
        
        {/* Status Badge */}
        <span 
          className="px-2.5 py-1 rounded text-xs font-medium flex-shrink-0"
          style={{ 
            backgroundColor: isOnTrack ? '#dcfce7' : isAtRisk ? '#fee2e2' : '#f3f4f6',
            color: isOnTrack ? '#166534' : isAtRisk ? '#991b1b' : '#6b7280',
          }}
        >
          {isOnTrack ? 'On Track' : isAtRisk ? 'Behind' : 'In Progress'}
        </span>
        
        {/* Progress Bar with percentage */}
        <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '100px' }}>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, Math.max(0, objective.progress))}%`,
                backgroundColor: isOnTrack ? '#22c55e' : isAtRisk ? '#ef4444' : '#6366f1'
              }}
            />
          </div>
          <span 
            className="text-xs font-medium"
            style={{ color: cascade.colors.text.muted, minWidth: '32px', textAlign: 'right' }}
          >
            {objective.progress}%
          </span>
        </div>
        
        {/* Expand/Collapse Chevron */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
          )}
        </div>
      </div>
      
      {/* Expanded Actions List - Asana-style subtasks with drag handles */}
      {isExpanded && actions && actions.length > 0 && (
        <div className="ml-10 mt-1 space-y-1">
          {actions.map(action => {
            const actionDone = action.status === 'done' || action.status === 'completed';
            return (
              <div
                key={action.id}
                className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-gray-50 transition-colors group/action"
                style={{ 
                  backgroundColor: '#fafafa',
                  border: `1px solid ${cascade.colors.border.light}`,
                }}
              >
                {/* Drag Handle */}
                <div 
                  className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 opacity-0 group-hover/action:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-3 h-3" style={{ color: cascade.colors.text.light }} />
                </div>
                
                {/* Checkbox circle */}
                <div 
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ 
                    borderColor: actionDone ? '#22c55e' : '#d1d5db',
                    backgroundColor: actionDone ? '#22c55e' : 'transparent',
                  }}
                >
                  {actionDone && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                
                {/* Action title */}
                <span 
                  className="flex-1 text-sm"
                  style={{ 
                    color: actionDone ? cascade.colors.text.light : cascade.colors.text.secondary,
                    textDecoration: actionDone ? 'line-through' : 'none',
                  }}
                >
                  {action.title}
                </span>
                
                {/* Due date if exists */}
                {action.due_date && (
                  <span 
                    className="text-xs flex-shrink-0"
                    style={{ color: cascade.colors.text.light }}
                  >
                    {new Date(action.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                
                {/* Owner avatar */}
                {action.owner_name && (
                  <Avatar name={action.owner_name} size="xs" />
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Show "No actions" message if expanded but empty */}
      {isExpanded && (!actions || actions.length === 0) && (
        <div 
          className="ml-10 mt-1 py-2 px-3 text-sm italic"
          style={{ color: cascade.colors.text.light }}
        >
          No actions yet
        </div>
      )}
    </div>
  );
}

// ============ SORTABLE FOCUS AREA WRAPPER ============
function SortableFocusAreaWrapper({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };
  
  return (
    <div ref={setNodeRef} style={style as React.CSSProperties}>
      {typeof children === 'function' 
        ? (children as (props: { dragHandleProps: Record<string, unknown>; isDragging: boolean }) => React.ReactNode)({ 
            dragHandleProps: { ...attributes, ...listeners }, 
            isDragging 
          })
        : children}
    </div>
  );
}

// ============ CASCADE-STYLE FOCUS AREA ACCORDION ============
function FocusAreaAccordion({
  focusArea,
  objectives,
  expanded,
  onToggle,
  onAddObjective,
  onSelectObjective,
  onEditObjective,
  onEditFocusArea,
  plan,
  onReorderObjectives,
  dragHandleProps,
  isDragging,
  expandedObjectives,
  getActionsByObjective,
}: {
  focusArea: FocusArea;
  objectives: Objective[];
  expanded: boolean;
  onToggle: () => void;
  onAddObjective: () => void;
  onSelectObjective: (obj: Objective) => void;
  onEditObjective?: (obj: Objective) => void;
  onEditFocusArea: () => void;
  plan?: Plan | null;
  onReorderObjectives?: (focusAreaId: string, objectives: Objective[]) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  expandedObjectives?: Set<string>;
  getActionsByObjective?: (id: string) => Action[];
}) {
  // Calculate status counts for badges
  const onTrackCount = objectives.filter(o => o.status === 'on_track' || o.status === 'done').length;
  const atRiskCount = objectives.filter(o => o.status === 'at_risk' || o.status === 'blocked').length;
  const currentCount = objectives.filter(o => o.status === 'in_progress' || o.status === 'not_started').length;
  
  // Format date range for objectives
  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return null;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
    if (start) return `From ${formatDate(start)}`;
    if (end) return `Until ${formatDate(end)}`;
    return null;
  };
  
  // Get a color for the focus area based on status
  const focusAreaColor = atRiskCount > 0 ? '#ef4444' : onTrackCount > 0 ? '#22c55e' : '#f59e0b';
  
  return (
    <div className="overflow-hidden mb-2">
      {/* Focus Area Header - Cascade style with colored left border */}
      <div 
        className="flex items-center justify-between py-3 px-4 cursor-pointer transition-colors group bg-white hover:bg-slate-50"
        style={{ 
          borderLeft: `4px solid ${focusAreaColor}`,
          borderTop: `1px solid ${cascade.colors.border.default}`,
          borderRight: `1px solid ${cascade.colors.border.default}`,
          borderBottom: expanded ? 'none' : `1px solid ${cascade.colors.border.default}`,
          borderRadius: expanded ? '6px 6px 0 0' : '6px',
          boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : 'none',
        }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Drag Handle */}
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
            </div>
          )}
          
          {/* Focus Area Icon - smaller, matches border color */}
          <div 
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: focusAreaColor + '20' }}
          >
            <span style={{ fontSize: '14px' }}>{focusArea.icon}</span>
          </div>
          
          {/* Focus Area Name - BOLD and larger */}
          <span 
            className="truncate"
            style={{ color: cascade.colors.text.primary, fontSize: '15px', fontWeight: 600 }}
          >
            {focusArea.name}
          </span>
          
          {/* Status Badge - Cascade Style */}
          <span 
            className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
            style={{ 
              backgroundColor: atRiskCount > 0 ? '#fee2e2' : onTrackCount > 0 ? '#dcfce7' : '#f3f4f6',
              color: atRiskCount > 0 ? '#991b1b' : onTrackCount > 0 ? '#166534' : '#6b7280',
            }}
          >
            {atRiskCount > 0 ? 'At Risk' : onTrackCount > 0 ? 'On Track' : 'Current'}
          </span>
        </div>
        
        {/* Right side - Add button, Settings, Chevron */}
        <div className="flex items-center gap-1">
          {/* Green + Button in header */}
          <button 
            onClick={(e) => { e.stopPropagation(); onAddObjective(); }}
            className="flex items-center justify-center w-6 h-6 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            style={{ backgroundColor: '#22c55e', color: 'white' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEditFocusArea(); }}
            className="p-1.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Settings className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
          </button>
          <button className="p-0.5">
            {expanded ? (
              <ChevronDown className="w-5 h-5" style={{ color: cascade.colors.text.muted }} />
            ) : (
              <ChevronRight className="w-5 h-5" style={{ color: cascade.colors.text.muted }} />
            )}
          </button>
        </div>
      </div>

      {/* Objectives List - Cascade style with left border connection */}
      {expanded && (
        <div 
          className="bg-white"
          style={{ 
            borderLeft: `4px solid ${focusAreaColor}`,
            borderRight: `1px solid ${cascade.colors.border.default}`,
            borderBottom: `1px solid ${cascade.colors.border.default}`,
            borderRadius: '0 0 6px 6px',
            marginLeft: '0',
          }}
        >
          <div className="py-1">
            {onReorderObjectives ? (
              <SortableContext
                items={objectives.map(o => o.id)}
                strategy={verticalListSortingStrategy}
              >
                {objectives.map(obj => (
                  <SortableObjectiveItem
                    key={obj.id}
                    objective={obj}
                    onSelectObjective={onSelectObjective}
                    onEditObjective={onEditObjective}
                    isExpanded={expandedObjectives?.has(obj.id)}
                    actions={getActionsByObjective?.(obj.id)}
                  />
                ))}
              </SortableContext>
            ) : (
              objectives.map(obj => (
                <SortableObjectiveItem
                  key={obj.id}
                  objective={obj}
                  onSelectObjective={onSelectObjective}
                  onEditObjective={onEditObjective}
                  isExpanded={expandedObjectives?.has(obj.id)}
                  actions={getActionsByObjective?.(obj.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ FOCUS AREA GRID CARD (for Grid View) ============
function FocusAreaGridCard({
  focusArea,
  objectives,
  onAddObjective,
  onSelectObjective,
  onEditObjective,
  onEditFocusArea,
  onReorderObjectives,
  dragHandleProps,
  isDragging,
  expandedObjectives,
  getActionsByObjective,
}: {
  focusArea: FocusArea;
  objectives: Objective[];
  onAddObjective: () => void;
  onSelectObjective: (obj: Objective) => void;
  onEditObjective?: (obj: Objective) => void;
  onEditFocusArea: () => void;
  onReorderObjectives?: (focusAreaId: string, objectives: Objective[]) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  expandedObjectives?: Set<string>;
  getActionsByObjective?: (id: string) => Action[];
}) {
  return (
    <div 
      className="flex flex-col overflow-hidden group"
      style={{ 
        border: `1px solid ${cascade.colors.border.default}`,
        borderRadius: cascade.radius.card,
        boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : cascade.shadow.card,
        opacity: isDragging ? 0.9 : 1,
      }}
    >
      {/* Header - Muted gray background like Cascade */}
      <div 
        className="flex items-start justify-between p-4"
        style={{ backgroundColor: '#f7f7f8' }}
      >
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
            </div>
          )}
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#f59e0b' }}
          >
            <span className="text-white text-base">{focusArea.icon}</span>
          </div>
          <span 
            className="font-medium line-clamp-2"
            style={{ color: cascade.colors.text.primary, fontSize: '15px', fontWeight: 500 }}
          >
            {focusArea.name}
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onEditFocusArea(); }}
          className="p-1 hover:bg-gray-200 rounded opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <Settings className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
        </button>
      </div>

      {/* Objectives List - WHITE background */}
      <div className="flex-1 p-3 bg-white">
        <div className="space-y-2 mb-3">
          {objectives.length === 0 ? (
            <p className="text-sm py-2" style={{ color: cascade.colors.text.light }}>
              No objectives yet
            </p>
          ) : (
            objectives.map(obj => {
              const isOnTrack = obj.status === 'on_track' || obj.status === 'done';
              const isAtRisk = obj.status === 'at_risk' || obj.status === 'blocked';
              const isExpanded = expandedObjectives?.has(obj.id);
              const objActions = getActionsByObjective?.(obj.id) || [];
              return (
                <div key={obj.id}>
                  <div
                    className="w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-gray-50 transition-colors group"
                    style={{ 
                      border: `1px solid ${cascade.colors.border.light}`,
                    }}
                  >
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#f59e0b' }}
                    >
                      <Circle className="w-2.5 h-2.5 text-white fill-current" />
                    </div>
                    <span 
                      className="text-sm truncate flex-1 cursor-pointer hover:text-indigo-600"
                      style={{ color: cascade.colors.text.secondary }}
                      onClick={() => onEditObjective?.(obj)}
                    >
                      {obj.title}
                    </span>
                    <span 
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ 
                        backgroundColor: isOnTrack ? '#dcfce7' : isAtRisk ? '#fee2e2' : '#f3f4f6',
                        color: isOnTrack ? '#166534' : isAtRisk ? '#991b1b' : '#6b7280',
                      }}
                    >
                      {obj.progress}%
                    </span>
                    <button
                      onClick={() => onSelectObjective(obj)}
                      className="p-0.5"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: cascade.colors.text.muted }} />
                      ) : (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: cascade.colors.text.muted }} />
                      )}
                    </button>
                  </div>
                  {/* Expanded Actions */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {objActions.length > 0 ? objActions.map(action => {
                        const actionDone = action.status === 'done' || action.status === 'completed';
                        return (
                          <div
                            key={action.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded text-sm hover:bg-gray-100 group/action cursor-pointer transition-colors"
                            style={{ backgroundColor: '#fafafa' }}
                            onClick={() => onEditObjective?.(obj)}
                            title="Click to edit objective and actions"
                          >
                            {/* Drag Handle */}
                            <div 
                              className="cursor-grab active:cursor-grabbing opacity-0 group-hover/action:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-3 h-3" style={{ color: cascade.colors.text.light }} />
                            </div>
                            <div 
                              className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                              style={{ 
                                borderColor: actionDone ? '#22c55e' : '#d1d5db',
                                backgroundColor: actionDone ? '#22c55e' : 'transparent',
                              }}
                            />
                            <span 
                              className="flex-1 truncate"
                              style={{ 
                                color: actionDone ? cascade.colors.text.light : cascade.colors.text.secondary,
                                textDecoration: actionDone ? 'line-through' : 'none',
                                fontSize: '13px',
                              }}
                            >
                              {action.title}
                            </span>
                          </div>
                        );
                      }) : (
                        <p className="text-xs py-1 px-2 italic" style={{ color: cascade.colors.text.light }}>
                          No actions yet
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Objective Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddObjective(); }}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: cascade.colors.primary }}
        >
          <Plus className="w-4 h-4" />
          Add Objective
        </button>
      </div>
    </div>
  );
}

// ============ MOBILE OBJECTIVE DETAIL SHEET ============
function MobileObjectiveSheet({
  objective,
  actions,
  measures,
  onClose,
  onEditObjective,
  onDeleteObjective,
  onAddAction,
  onEditAction,
  onDeleteAction,
  onAddMeasure,
  onEditMeasure,
  onDeleteMeasure,
}: {
  objective: Objective;
  actions: Action[];
  measures: Measure[];
  onClose: () => void;
  onEditObjective: () => void;
  onDeleteObjective: () => void;
  onAddAction: () => void;
  onEditAction: (action: Action) => void;
  onDeleteAction: (id: string) => void;
  onAddMeasure: () => void;
  onEditMeasure: (measure: Measure) => void;
  onDeleteMeasure: (id: string) => void;
}) {
  const quarterInfo = getQuarterInfo(objective.start_date, objective.end_date);

  return (
    <div 
      className="fixed inset-0 z-50 md:hidden"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b" style={{ borderColor: cascade.colors.border.default }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase" style={{ color: cascade.colors.text.muted }}>
              Objective
            </span>
            <div className="flex items-center gap-2">
              <button onClick={onEditObjective} className="p-2 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                <Edit2 className="w-5 h-5" style={{ color: cascade.colors.text.muted }} />
              </button>
              <button onClick={onDeleteObjective} className="p-2 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5" style={{ color: cascade.colors.text.muted }} />
              </button>
            </div>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: cascade.colors.text.primary }}>
            {objective.title}
          </h2>
          {quarterInfo && (
            <div className="flex items-center gap-2 text-xs mt-1" style={{ color: cascade.colors.text.muted }}>
              <Calendar className="w-3 h-3" />
              <span style={{ color: cascade.colors.primary }}>{quarterInfo.label}</span>
              <span>({quarterInfo.timeLeft})</span>
            </div>
          )}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Progress */}
          <div className="rounded-lg p-4" style={{ backgroundColor: cascade.colors.bg.subtle }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: cascade.colors.text.secondary }}>
                Progress
              </span>
              <span className="text-sm font-semibold" style={{ color: cascade.colors.text.primary }}>
                {objective.progress}%
              </span>
            </div>
            <ProgressBar progress={objective.progress} size="md" color="indigo" />
          </div>

          {/* Status & Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ backgroundColor: cascade.colors.bg.subtle }}>
              <span className="text-xs block mb-1" style={{ color: cascade.colors.text.muted }}>Status</span>
              <StatusBadge status={objective.status} />
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: cascade.colors.bg.subtle }}>
              <span className="text-xs block mb-1" style={{ color: cascade.colors.text.muted }}>Owner</span>
              <div className="flex items-center gap-2">
                <Avatar name={objective.owner_name} size="sm" />
                <span className="text-sm font-medium truncate">{objective.owner_name || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {objective.description && (
            <div>
              <h4 className="text-sm font-medium mb-1" style={{ color: cascade.colors.text.secondary }}>Description</h4>
              <p className="text-sm" style={{ color: cascade.colors.text.muted }}>{objective.description}</p>
            </div>
          )}

          {/* Success Criteria */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium" style={{ color: cascade.colors.text.secondary }}>
                Success Criteria ({measures.length})
              </h4>
              <button onClick={onAddMeasure} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" style={{ color: cascade.colors.primary }}>
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {measures.length === 0 ? (
              <p className="text-sm text-center py-3 rounded-lg" style={{ backgroundColor: cascade.colors.bg.subtle, color: cascade.colors.text.muted }}>
                No success criteria
              </p>
            ) : (
              <div className="space-y-2">
                {measures.map(m => {
                  const pct = m.target_value ? Math.round((m.current_value || 0) / m.target_value * 100) : 0;
                  return (
                    <div key={m.id} className="p-3 rounded-lg" style={{ backgroundColor: cascade.colors.bg.subtle }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{m.name}</span>
                        <span className="text-xs">{m.current_value}{m.unit} / {m.target_value}{m.unit}</span>
                      </div>
                      <ProgressBar progress={pct} size="sm" color="indigo" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium" style={{ color: cascade.colors.text.secondary }}>
                Actions ({actions.length})
              </h4>
              <button onClick={onAddAction} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" style={{ color: cascade.colors.primary }}>
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {actions.length === 0 ? (
              <p className="text-sm text-center py-3 rounded-lg" style={{ backgroundColor: cascade.colors.bg.subtle, color: cascade.colors.text.muted }}>
                No actions yet
              </p>
            ) : (
              <div className="space-y-2">
                {actions.map(a => (
                  <div key={a.id} className="p-3 rounded-lg" style={{ backgroundColor: cascade.colors.bg.subtle }}>
                    <div className="flex items-start gap-3">
                      <StatusDot status={a.status} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{a.title}</div>
                        {a.owner_name && <div className="text-xs mt-0.5" style={{ color: cascade.colors.text.muted }}>{a.owner_name}</div>}
                      </div>
                    </div>
                    <div className="mt-2 ml-5">
                      <ProgressBar progress={a.progress} size="sm" color="blue" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MOBILE FOCUS AREA CARD ============
function MobileFocusAreaCard({
  focusArea,
  objectives,
  expanded,
  onToggle,
  onAddObjective,
  onSelectObjective,
}: {
  focusArea: FocusArea;
  objectives: Objective[];
  expanded: boolean;
  onToggle: () => void;
  onAddObjective: () => void;
  onSelectObjective: (obj: Objective) => void;
}) {
  const doneCount = objectives.filter(o => o.status === 'done' || o.progress >= 100).length;
  const onTrackCount = objectives.filter(o => o.status === 'on_track' || o.status === 'done').length;
  const atRiskCount = objectives.filter(o => o.status === 'at_risk' || o.status === 'blocked').length;

  return (
    <div className="overflow-hidden">
      {/* Focus Area Header - LIGHT PURPLE/LAVENDER background */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 min-h-[64px] rounded-xl active:opacity-90"
        style={{ 
          backgroundColor: '#f7f7f8',
          border: `1px solid ${cascade.colors.border.default}`,
          marginBottom: expanded ? '8px' : '0',
        }}
      >
        {/* Amber Circle Icon */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#f59e0b' }}
        >
          <span className="text-white text-lg">{focusArea.icon}</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-medium truncate" style={{ color: cascade.colors.text.primary, fontSize: '16px' }}>
            {focusArea.name}
          </div>
          {/* Status badges */}
          <div className="flex items-center gap-1.5 mt-1">
            {onTrackCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                {onTrackCount} On Track
              </span>
            )}
            {atRiskCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                {atRiskCount} At Risk
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Green + button */}
          <div
            onClick={(e) => { e.stopPropagation(); onAddObjective(); }}
            className="flex items-center justify-center w-6 h-6 rounded-full"
            style={{ backgroundColor: '#22c55e', color: 'white' }}
          >
            <Plus className="w-4 h-4" />
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5" style={{ color: cascade.colors.text.muted }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: cascade.colors.text.muted }} />
          )}
        </div>
      </button>

      {/* Expanded Content - Each Objective as its own card */}
      {expanded && (
        <div className="space-y-2 pl-2">
          {/* Removed standalone Green + Add Button - now in header */}
          <div className="hidden pl-8 py-1">
            <button
              onClick={(e) => { e.stopPropagation(); onAddObjective(); }}
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{ backgroundColor: '#22c55e', color: 'white' }}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {objectives.map(obj => {
            const isOnTrack = obj.status === 'on_track' || obj.status === 'done';
            const isAtRisk = obj.status === 'at_risk' || obj.status === 'blocked';
            
            return (
              <button
                key={obj.id}
                onClick={() => onSelectObjective(obj)}
                className="w-full flex items-start gap-3 p-3 min-h-[60px] active:bg-gray-50 rounded-lg text-left"
                style={{ 
                  backgroundColor: 'white',
                  border: `1px solid ${cascade.colors.border.default}`,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                {/* Small amber circle */}
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: '#f59e0b' }}
                >
                  <Circle className="w-3 h-3 text-white fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block" style={{ color: cascade.colors.text.primary }}>
                    {obj.title}
                  </span>
                  <span className="text-xs block mt-0.5" style={{ color: cascade.colors.text.muted }}>
                    📋 Corporate objective
                  </span>
                  {/* Progress bar row */}
                  <div className="flex items-center gap-2 mt-2">
                    <span 
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ 
                        backgroundColor: isOnTrack ? '#dcfce7' : isAtRisk ? '#fee2e2' : '#f3f4f6',
                        color: isOnTrack ? '#166534' : isAtRisk ? '#991b1b' : '#6b7280',
                      }}
                    >
                      {isOnTrack ? 'On Track' : isAtRisk ? 'Behind' : 'In Progress'}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${obj.progress}%`, 
                          backgroundColor: isOnTrack ? '#22c55e' : isAtRisk ? '#ef4444' : '#6366f1'
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: cascade.colors.text.muted }}>
                      {obj.progress}%
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: cascade.colors.border.default }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ MOBILE BOTTOM ACTION BAR ============
function MobileBottomBar({
  onAdd,
  onFilter,
  onMore,
}: {
  onAdd: () => void;
  onFilter: () => void;
  onMore: () => void;
}) {
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-40"
      style={{ 
        borderColor: cascade.colors.border.default,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around py-2">
        <button
          onClick={onAdd}
          className="flex flex-col items-center gap-1 px-6 py-2 min-h-[56px] min-w-[80px]"
          style={{ color: cascade.colors.primary }}
        >
          <Plus className="w-6 h-6" />
          <span className="text-xs font-medium">Add</span>
        </button>
        <button
          onClick={onFilter}
          className="flex flex-col items-center gap-1 px-6 py-2 min-h-[56px] min-w-[80px]"
          style={{ color: cascade.colors.text.muted }}
        >
          <Filter className="w-6 h-6" />
          <span className="text-xs font-medium">Filter</span>
        </button>
        <button
          onClick={onMore}
          className="flex flex-col items-center gap-1 px-6 py-2 min-h-[56px] min-w-[80px]"
          style={{ color: cascade.colors.text.muted }}
        >
          <MoreHorizontal className="w-6 h-6" />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
    </div>
  );
}

// ============ MAIN STRATEGY VIEW ============
interface StrategyViewProps {
  initialView?: MainView;
}

export default function StrategyView({ initialView = 'plans-teams' }: StrategyViewProps) {
  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [planFocusAreas, setPlanFocusAreas] = useState<PlanFocusArea[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewed[]>([]);

  // Navigation state - use initialView prop
  const [mainView, setMainView] = useState<MainView>(initialView);
  const [planTeamsTab, setPlanTeamsTab] = useState<PlanTeamsTab>('plans');
  const [plannerTab, setPlannerTab] = useState<PlannerTab>('planner');
  const [selectedPlan, setSelectedPlanState] = useState<Plan | null>(null);
  
  // Wrapper to persist selectedPlan to localStorage
  const setSelectedPlan = (plan: Plan | null) => {
    setSelectedPlanState(plan);
    if (plan) {
      localStorage.setItem('strategy_selected_plan_id', plan.id);
    } else {
      localStorage.removeItem('strategy_selected_plan_id');
    }
  };
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  
  const toggleObjectiveExpand = (objectiveId: string) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(objectiveId)) {
        next.delete(objectiveId);
      } else {
        next.add(objectiveId);
      }
      return next;
    });
  };
  const [bookmarked, setBookmarked] = useState(false);

  // Mobile state (removed - navigation handled by main Capy Command sidebar)

  // Table state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showFocusAreaModal, setShowFocusAreaModal] = useState(false);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [currentObjectiveId, setCurrentObjectiveId] = useState<string>('');

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Planner state
  const [expandedFocusAreas, setExpandedFocusAreas] = useState<Set<string>>(new Set());
  const [defaultPlanId, setDefaultPlanId] = useState<string>('');
  const [defaultFocusAreaId, setDefaultFocusAreaId] = useState<string>('');
  const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>('list');

  // Drag and drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<'focusArea' | 'objective' | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start dragging after 8px of movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load recently viewed and view mode on mount
  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
    setPlannerViewMode(getPlannerViewMode());
  }, []);

  // Sync mainView with initialView prop when it changes
  useEffect(() => {
    setMainView(initialView);
  }, [initialView]);

  // ============ DATA FETCHING ============
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, plansRes, focusAreasRes, planFocusAreasRes, objectivesRes, actionsRes, measuresRes] = await Promise.all([
        supabase.from('strategy_teams').select('*').order('name'),
        supabase.from('strategy_plans').select('*').order('created_at', { ascending: false }),
        supabase.from('strategy_focus_areas').select('*').order('sort_order').order('name'),
        supabase.from('strategy_plan_focus_areas').select('*'),
        supabase.from('strategy_objectives').select('*').order('sort_order').order('created_at', { ascending: false }),
        supabase.from('strategy_actions').select('*').order('created_at', { ascending: false }),
        supabase.from('strategy_measures').select('*').order('created_at', { ascending: false }),
      ]);

      if (teamsRes.data) setTeams(teamsRes.data);
      if (plansRes.data) {
        setPlans(plansRes.data);
        // Restore selected plan from localStorage
        const savedPlanId = localStorage.getItem('strategy_selected_plan_id');
        if (savedPlanId) {
          const savedPlan = plansRes.data.find((p: Plan) => p.id === savedPlanId);
          if (savedPlan) setSelectedPlanState(savedPlan);
        }
      }
      if (focusAreasRes.data) {
        setFocusAreas(focusAreasRes.data);
        // Expand all focus areas by default
        setExpandedFocusAreas(new Set(focusAreasRes.data.map((fa: FocusArea) => fa.id)));
      }
      if (planFocusAreasRes.data) setPlanFocusAreas(planFocusAreasRes.data);
      if (objectivesRes.data) setObjectives(objectivesRes.data);
      if (actionsRes.data) setActions(actionsRes.data);
      if (measuresRes.data) setMeasures(measuresRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============ CRUD OPERATIONS ============
  const savePlan = async (data: Partial<Plan>) => {
    if (editingItem?.id) {
      const { error } = await supabase.from('strategy_plans').update(data).eq('id', editingItem.id);
      if (!error) {
        setPlans(prev => prev.map(p => p.id === editingItem.id ? { ...p, ...data } : p));
        if (selectedPlan?.id === editingItem.id) {
          setSelectedPlan({ ...selectedPlan, ...data } as Plan);
        }
      }
    } else {
      const { data: newPlan, error } = await supabase.from('strategy_plans').insert(data).select().single();
      if (!error && newPlan) {
        setPlans(prev => [newPlan, ...prev]);
      }
    }
    setShowPlanModal(false);
    setEditingItem(null);
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from('strategy_plans').delete().eq('id', id);
    if (!error) {
      setPlans(prev => prev.filter(p => p.id !== id));
      setObjectives(prev => prev.filter(o => o.plan_id !== id));
      if (selectedPlan?.id === id) {
        setSelectedPlan(null);
      }
    }
  };

  const saveTeam = async (data: Partial<Team>) => {
    if (editingItem?.id) {
      const { error } = await supabase.from('strategy_teams').update(data).eq('id', editingItem.id);
      if (!error) {
        setTeams(prev => prev.map(t => t.id === editingItem.id ? { ...t, ...data } : t));
        if (selectedTeam?.id === editingItem.id) {
          setSelectedTeam({ ...selectedTeam, ...data } as Team);
        }
      }
    } else {
      const { data: newTeam, error } = await supabase.from('strategy_teams').insert(data).select().single();
      if (!error && newTeam) {
        setTeams(prev => [newTeam, ...prev]);
      }
    }
    setShowTeamModal(false);
    setEditingItem(null);
  };

  const deleteTeam = async (id: string) => {
    const { error } = await supabase.from('strategy_teams').delete().eq('id', id);
    if (!error) {
      setTeams(prev => prev.filter(t => t.id !== id));
      setPlans(prev => prev.map(p => p.team_id === id ? { ...p, team_id: undefined } : p));
      if (selectedTeam?.id === id) {
        setSelectedTeam(null);
      }
    }
  };

  const saveFocusArea = async (data: Partial<FocusArea>) => {
    const updateId = data.id || editingItem?.id;
    if (updateId) {
      // Remove id from data before update (Supabase doesn't want id in the update payload)
      const { id: _, ...updateData } = data;
      const { error } = await supabase.from('strategy_focus_areas').update(updateData).eq('id', updateId);
      if (!error) {
        setFocusAreas(prev => prev.map(fa => fa.id === updateId ? { ...fa, ...updateData } : fa));
      }
    } else {
      const { data: newFA, error } = await supabase.from('strategy_focus_areas').insert(data).select().single();
      if (!error && newFA) {
        setFocusAreas(prev => [newFA, ...prev]);
        setExpandedFocusAreas(prev => new Set([...prev, newFA.id]));
      }
    }
    setShowFocusAreaModal(false);
    setEditingItem(null);
  };

  const deleteFocusArea = async (id: string) => {
    const { error } = await supabase.from('strategy_focus_areas').delete().eq('id', id);
    if (!error) {
      setFocusAreas(prev => prev.filter(fa => fa.id !== id));
      setPlanFocusAreas(prev => prev.filter(pfa => pfa.focus_area_id !== id));
      setObjectives(prev => prev.map(o => o.focus_area_id === id ? { ...o, focus_area_id: undefined } : o));
    }
  };

  const saveObjective = async (data: Partial<Objective>) => {
    const updateId = data.id || editingItem?.id;
    if (updateId) {
      // Remove id from data before update
      const { id: _, ...updateData } = data;
      const { error } = await supabase.from('strategy_objectives').update(updateData).eq('id', updateId);
      if (!error) {
        setObjectives(prev => prev.map(o => o.id === updateId ? { ...o, ...updateData } : o));
        if (selectedObjective?.id === updateId) {
          setSelectedObjective({ ...selectedObjective, ...updateData } as Objective);
        }
      }
    } else {
      const { data: newObj, error } = await supabase.from('strategy_objectives').insert(data).select().single();
      if (!error && newObj) {
        setObjectives(prev => [newObj, ...prev]);
      }
    }
    setShowObjectiveModal(false);
    setEditingItem(null);
  };

  const deleteObjective = async (id: string) => {
    const { error } = await supabase.from('strategy_objectives').delete().eq('id', id);
    if (!error) {
      setObjectives(prev => prev.filter(o => o.id !== id));
      setActions(prev => prev.filter(a => a.objective_id !== id));
      setMeasures(prev => prev.filter(m => m.objective_id !== id));
      if (selectedObjective?.id === id) {
        setSelectedObjective(null);
      }
    }
  };

  const saveAction = async (data: Partial<Action>) => {
    console.log('saveAction called with:', data);
    // Clean data - convert empty strings to null for date fields
    const cleanedData = {
      ...data,
      due_date: data.due_date === '' ? null : data.due_date,
    };
    if (editingItem?.id) {
      const { error } = await supabase.from('strategy_actions').update(cleanedData).eq('id', editingItem.id);
      if (error) {
        console.error('Error updating action:', error);
        alert('Failed to update action: ' + error.message);
        return;
      }
      setActions(prev => prev.map(a => a.id === editingItem.id ? { ...a, ...cleanedData } : a));
    } else {
      if (!cleanedData.objective_id) {
        console.error('No objective_id provided for new action');
        alert('Error: No objective selected. Please try again.');
        return;
      }
      const { data: newAction, error } = await supabase.from('strategy_actions').insert(cleanedData).select().single();
      if (error) {
        console.error('Error creating action:', error);
        alert('Failed to create action: ' + error.message);
        return;
      }
      if (newAction) {
        setActions(prev => [newAction, ...prev]);
      }
    }
    setShowActionModal(false);
    setEditingItem(null);
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from('strategy_actions').delete().eq('id', id);
    if (!error) {
      setActions(prev => prev.filter(a => a.id !== id));
    }
  };

  const saveMeasure = async (data: Partial<Measure>) => {
    if (editingItem?.id) {
      const { error } = await supabase.from('strategy_measures').update(data).eq('id', editingItem.id);
      if (!error) {
        setMeasures(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...data } : m));
      }
    } else {
      const { data: newMeasure, error } = await supabase.from('strategy_measures').insert(data).select().single();
      if (!error && newMeasure) {
        setMeasures(prev => [newMeasure, ...prev]);
      }
    }
    setShowMeasureModal(false);
    setEditingItem(null);
  };

  const deleteMeasure = async (id: string) => {
    const { error } = await supabase.from('strategy_measures').delete().eq('id', id);
    if (!error) {
      setMeasures(prev => prev.filter(m => m.id !== id));
    }
  };

  // ============ COMPUTED VALUES ============
  const getTeamById = (id: string) => teams.find(t => t.id === id);
  const getPlanFocusAreas = (planId: string) => {
    const faIds = planFocusAreas.filter(pfa => pfa.plan_id === planId).map(pfa => pfa.focus_area_id);
    return focusAreas.filter(fa => faIds.includes(fa.id));
  };
  const getObjectivesByPlan = (planId: string) => objectives.filter(o => o.plan_id === planId);
  const getObjectivesByFocusArea = (focusAreaId: string, planId?: string) => {
    return objectives.filter(o => {
      if (planId) {
        return o.focus_area_id === focusAreaId && o.plan_id === planId;
      }
      return o.focus_area_id === focusAreaId;
    });
  };
  const getObjectivesWithoutFocusArea = (planId: string) => {
    return objectives.filter(o => o.plan_id === planId && !o.focus_area_id);
  };
  const getActionsByObjective = (objectiveId: string) => actions.filter(a => a.objective_id === objectiveId);
  const getMeasuresByObjective = (objectiveId: string) => measures.filter(m => m.objective_id === objectiveId);
  const getPlansByTeam = (teamId: string) => plans.filter(p => p.team_id === teamId);
  const getPlanById = (id: string) => plans.find(p => p.id === id);

  const calculatePlanProgress = (planId: string) => {
    const planObjectives = getObjectivesByPlan(planId);
    if (planObjectives.length === 0) return 0;
    return Math.round(planObjectives.reduce((sum, o) => sum + o.progress, 0) / planObjectives.length);
  };

  // Get contributors for a plan (objective owners + plan owner)
  const getPlanContributors = (planId: string): string[] => {
    const plan = getPlanById(planId);
    const objOwners = getObjectivesByPlan(planId)
      .map(o => o.owner_name)
      .filter((n): n is string => !!n);
    const all = plan?.owner_name ? [plan.owner_name, ...objOwners] : objOwners;
    return [...new Set(all)];
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Toggle focus area expansion
  const toggleFocusArea = (faId: string) => {
    setExpandedFocusAreas(prev => {
      const next = new Set(prev);
      if (next.has(faId)) {
        next.delete(faId);
      } else {
        next.add(faId);
      }
      return next;
    });
  };

  // Toggle planner view mode (list/grid)
  const togglePlannerViewMode = (mode: PlannerViewMode) => {
    setPlannerViewMode(mode);
    setPlannerViewModeStorage(mode);
  };

  // ============ DRAG AND DROP HANDLERS ============
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    
    // Determine if we're dragging a focus area or an objective
    const isFocusArea = focusAreas.some(fa => fa.id === id);
    setActiveDragId(id);
    setActiveDragType(isFocusArea ? 'focusArea' : 'objective');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveDragId(null);
    setActiveDragType(null);
    
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a focus area
    const isFocusAreaDrag = focusAreas.some(fa => fa.id === activeId);
    
    if (isFocusAreaDrag) {
      // Reorder focus areas
      const oldIndex = focusAreas.findIndex(fa => fa.id === activeId);
      const newIndex = focusAreas.findIndex(fa => fa.id === overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(focusAreas, oldIndex, newIndex);
        setFocusAreas(reordered);
        
        // Persist to database with new sort_order values
        const updates = reordered.map((fa, index) => ({
          id: fa.id,
          sort_order: index,
        }));
        
        // Batch update sort_order
        try {
          for (const update of updates) {
            await supabase
              .from('strategy_focus_areas')
              .update({ sort_order: update.sort_order })
              .eq('id', update.id);
          }
          console.log('Focus area order saved');
        } catch (err) {
          console.error('Error saving focus area order:', err);
        }
      }
    } else {
      // Reorder objectives within the same focus area
      const activeObj = objectives.find(o => o.id === activeId);
      const overObj = objectives.find(o => o.id === overId);
      
      if (activeObj && overObj && activeObj.focus_area_id === overObj.focus_area_id) {
        // Same focus area - reorder within
        const focusAreaId = activeObj.focus_area_id;
        const planId = activeObj.plan_id;
        
        // Get all objectives for this focus area in current plan
        const faObjectives = objectives.filter(o => 
          o.focus_area_id === focusAreaId && o.plan_id === planId
        );
        
        const oldIndex = faObjectives.findIndex(o => o.id === activeId);
        const newIndex = faObjectives.findIndex(o => o.id === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(faObjectives, oldIndex, newIndex);
          
          // Update local state
          const otherObjectives = objectives.filter(o => 
            !(o.focus_area_id === focusAreaId && o.plan_id === planId)
          );
          setObjectives([...otherObjectives, ...reordered]);
          
          // Persist to database
          const updates = reordered.map((obj, index) => ({
            id: obj.id,
            sort_order: index,
          }));
          
          try {
            for (const update of updates) {
              await supabase
                .from('strategy_objectives')
                .update({ sort_order: update.sort_order })
                .eq('id', update.id);
            }
            console.log('Objective order saved');
          } catch (err) {
            console.error('Error saving objective order:', err);
          }
        }
      }
    }
  };
  
  // Handler for reordering objectives within a focus area (from SortableContext)
  const handleObjectiveReorder = async (focusAreaId: string, reorderedObjectives: Objective[]) => {
    // Update local state
    const otherObjectives = objectives.filter(o => o.focus_area_id !== focusAreaId);
    setObjectives([...otherObjectives, ...reorderedObjectives]);
    
    // Save to database
    try {
      for (let i = 0; i < reorderedObjectives.length; i++) {
        await supabase
          .from('strategy_objectives')
          .update({ sort_order: i })
          .eq('id', reorderedObjectives[i].id);
      }
      console.log('Objectives reordered and saved');
    } catch (err) {
      console.error('Error saving objective order:', err);
    }
  };

  // Get sorted focus areas for the current plan
  const getSortedFocusAreasForPlan = useCallback((planId: string) => {
    // Get focus areas that have objectives for this plan
    const faIdsWithObjectives = new Set(
      objectives
        .filter(o => o.plan_id === planId && o.focus_area_id)
        .map(o => o.focus_area_id as string)
    );
    
    // Also include focus areas linked to this plan via plan_focus_areas
    const linkedFaIds = new Set(
      planFocusAreas
        .filter(pfa => pfa.plan_id === planId)
        .map(pfa => pfa.focus_area_id)
    );
    
    return focusAreas.filter(fa => 
      faIdsWithObjectives.has(fa.id) || linkedFaIds.has(fa.id)
    );
  }, [focusAreas, objectives, planFocusAreas]);

  // Get sorted objectives for a focus area
  const getSortedObjectivesForFocusArea = useCallback((focusAreaId: string, planId: string) => {
    return objectives
      .filter(o => o.focus_area_id === focusAreaId && o.plan_id === planId)
      .sort((a, b) => {
        // Sort by sort_order if available, otherwise by created_at
        if (a.sort_order !== undefined && b.sort_order !== undefined) {
          return a.sort_order - b.sort_order;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [objectives]);

  // Filtered and sorted plans
  const filteredPlans = useMemo(() => {
    let result = plans.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'team':
          const teamA = getTeamById(a.team_id || '')?.name || '';
          const teamB = getTeamById(b.team_id || '')?.name || '';
          comparison = teamA.localeCompare(teamB);
          break;
        case 'parent':
          const parentA = getPlanById(a.parent_plan_id || '')?.name || '';
          const parentB = getPlanById(b.parent_plan_id || '')?.name || '';
          comparison = parentA.localeCompare(parentB);
          break;
        case 'focus_areas':
          comparison = getPlanFocusAreas(a.id).length - getPlanFocusAreas(b.id).length;
          break;
        case 'objectives':
          comparison = getObjectivesByPlan(a.id).length - getObjectivesByPlan(b.id).length;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [plans, searchQuery, sortField, sortDirection, teams, focusAreas, planFocusAreas, objectives]);

  const filteredTeams = useMemo(() => {
    return teams.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teams, searchQuery]);

  const filteredFocusAreas = useMemo(() => {
    return focusAreas.filter(fa => 
      fa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fa.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [focusAreas, searchQuery]);

  // Add to recently viewed
  const trackRecentlyViewed = (item: Omit<RecentlyViewed, 'timestamp'>) => {
    const updated = addToRecentlyViewed(item);
    setRecentlyViewed(updated);
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white">
        <div style={{ color: cascade.colors.text.muted }}>Loading strategy data...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex bg-white" style={{ fontFamily: cascade.font.family }}>
      {/* MAIN CONTENT - Navigation handled by main Capy Command sidebar */}
      <div 
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ backgroundColor: cascade.colors.bg.subtle }}
      >
        {/* PLANS & TEAMS VIEW */}
        {mainView === 'plans-teams' && !selectedPlan && !selectedTeam && (
          <>
            {/* Header with Tabs - Mobile + Desktop */}
            <div 
              className="bg-white px-4 md:px-6 py-2 md:py-3"
              style={{ borderBottom: `1px solid ${cascade.colors.border.default}` }}
            >
              {/* Mobile Header Row */}
              <div className="flex md:hidden items-center gap-3 mb-3">
                <h1 className="text-lg font-semibold flex-1 truncate" style={{ color: cascade.colors.text.primary }}>
                  Plans and teams
                </h1>
              </div>

              {/* Desktop Title */}
              <h1 
                className="hidden md:block mb-4"
                style={{ 
                  fontSize: '28px',
                  fontWeight: 600,
                  color: cascade.colors.text.primary,
                }}
              >
                Plans and teams
              </h1>
              
              {/* Tabs - Horizontal scroll on mobile */}
              <div className="flex items-center gap-4 md:gap-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
                {[
                  { tab: 'plans' as PlanTeamsTab, label: 'All plans' },
                  { tab: 'teams' as PlanTeamsTab, label: 'All teams' },
                  { tab: 'focus-areas' as PlanTeamsTab, label: 'Focus areas' },
                ].map(item => (
                  <button
                    key={item.tab}
                    onClick={() => { setPlanTeamsTab(item.tab); setSearchQuery(''); }}
                    className="transition-colors whitespace-nowrap min-h-[44px] flex items-center"
                    style={{ 
                      fontSize: '14px',
                      fontWeight: 500,
                      paddingBottom: '8px',
                      borderBottom: planTeamsTab === item.tab 
                        ? `2px solid ${cascade.colors.primary}` 
                        : '2px solid transparent',
                      color: planTeamsTab === item.tab 
                        ? cascade.colors.primary 
                        : cascade.colors.text.muted,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
              {/* Recently Viewed Section - Hidden on mobile for space, shown on desktop */}
              {recentlyViewed.length > 0 && (
                <div className="hidden md:block mb-8">
                  {/* Section header - 14px, 600 weight, #374151 */}
                  <h2 
                    className="uppercase mb-3"
                    style={{ 
                      fontSize: '14px',
                      fontWeight: 600,
                      color: cascade.colors.text.secondary,
                      letterSpacing: '0.05em',
                    }}
                  >
                    Recently viewed
                  </h2>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {recentlyViewed.map(item => (
                      <RecentlyViewedCard 
                        key={`${item.type}-${item.id}`} 
                        item={item}
                        onClick={() => {
                          if (item.type === 'plan') {
                            const plan = plans.find(p => p.id === item.id);
                            if (plan) {
                              setSelectedPlan(plan);
                              trackRecentlyViewed({ id: plan.id, type: 'plan', name: plan.name, owner: plan.owner_name });
                            }
                          } else if (item.type === 'team') {
                            const team = teams.find(t => t.id === item.id);
                            if (team) {
                              setSelectedTeam(team);
                              trackRecentlyViewed({ id: team.id, type: 'team', name: team.name, icon: team.icon, owner: team.owner_name });
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ALL PLANS TAB */}
              {planTeamsTab === 'plans' && (
                <>
                  {/* Mobile: Search + Add */}
                  <div className="flex md:hidden items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: cascade.colors.text.light }} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                        style={{ borderColor: cascade.colors.border.default }}
                      />
                    </div>
                    <button
                      onClick={() => { setEditingItem(null); setShowPlanModal(true); }}
                      className="p-2 text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                      style={{ backgroundColor: cascade.colors.primary }}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  {/* Desktop header */}
                  <div className="hidden md:flex items-center justify-between mb-4">
                    {/* Section header - 14px, 600 weight, #374151 */}
                    <h2 
                      className="uppercase"
                      style={{ 
                        fontSize: '14px',
                        fontWeight: 600,
                        color: cascade.colors.text.secondary,
                        letterSpacing: '0.05em',
                      }}
                    >
                      All plans
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: cascade.colors.text.light }} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search plans..."
                          className="pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 w-64"
                          style={{ 
                            borderColor: cascade.colors.border.default,
                            fontSize: '14px',
                          }}
                        />
                      </div>
                      <button 
                        className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg"
                        style={{ 
                          borderColor: cascade.colors.border.default,
                          color: cascade.colors.text.muted,
                          borderRadius: cascade.radius.button,
                        }}
                      >
                        <Filter className="w-4 h-4" />
                        Filters
                      </button>
                      {/* "+ New plan" button - Cascade exact styling */}
                      <button
                        onClick={() => { setEditingItem(null); setShowPlanModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 text-white transition-colors"
                        style={{ 
                          backgroundColor: cascade.colors.primary,
                          borderRadius: cascade.radius.button,
                          fontSize: '14px',
                          fontWeight: 500,
                          padding: '8px 16px',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primaryHover}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primary}
                      >
                        <Plus className="w-4 h-4" />
                        New plan
                      </button>
                    </div>
                  </div>

                  {filteredPlans.length === 0 ? (
                    <EmptyState
                      title="No plans yet"
                      description="Create your first strategic plan to start aligning your team's efforts."
                      action="Create Plan"
                      onAction={() => setShowPlanModal(true)}
                      icon={FolderKanban}
                    />
                  ) : (
                    <>
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredPlans.map(plan => {
                          const team = plan.team_id ? getTeamById(plan.team_id) : null;
                          const objectiveCount = getObjectivesByPlan(plan.id).length;
                          const progress = calculatePlanProgress(plan.id);
                          
                          return (
                            <button
                              key={plan.id}
                              onClick={() => { 
                                setSelectedPlan(plan);
                                trackRecentlyViewed({ id: plan.id, type: 'plan', name: plan.name, owner: plan.owner_name });
                              }}
                              className="w-full bg-white p-4 rounded-xl text-left active:bg-gray-50"
                              style={{ border: `1px solid ${cascade.colors.border.default}` }}
                            >
                              <div className="flex items-start gap-3">
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: cascade.colors.primaryLight }}
                                >
                                  <Users className="w-5 h-5" style={{ color: cascade.colors.primary }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate" style={{ color: cascade.colors.text.primary }}>
                                    {plan.name}
                                  </div>
                                  {team && (
                                    <div className="text-xs mt-0.5 truncate" style={{ color: cascade.colors.text.muted }}>
                                      {team.icon} {team.name}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-3 mt-2">
                                    <div className="flex items-center gap-1 text-xs" style={{ color: cascade.colors.text.muted }}>
                                      <Target className="w-3 h-3" />
                                      {objectiveCount} objectives
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-indigo-500 rounded-full" 
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium" style={{ color: cascade.colors.text.muted }}>
                                        {progress}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: cascade.colors.border.default }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <div 
                        className="hidden md:block bg-white overflow-hidden"
                        style={{ 
                          borderRadius: cascade.radius.card,
                          border: `1px solid ${cascade.colors.border.default}`,
                        }}
                      >
                        <table className="w-full">
                        {/* Table headers - 12px, 500 weight, #6b7280, uppercase */}
                        <thead style={{ backgroundColor: cascade.colors.bg.subtle, borderBottom: `1px solid ${cascade.colors.border.default}` }}>
                          <tr>
                            <SortableHeader label="Plan" field="name" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader label="Team" field="team" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader label="Parent Plan" field="parent" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                            <th 
                              className="text-left px-4 py-3"
                              style={{ 
                                fontSize: '12px',
                                fontWeight: 500,
                                color: cascade.colors.text.muted,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <Settings className="w-3 h-3" />
                                Focus Areas
                              </div>
                            </th>
                            <th 
                              className="text-left px-4 py-3"
                              style={{ 
                                fontSize: '12px',
                                fontWeight: 500,
                                color: cascade.colors.text.muted,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <Circle className="w-3 h-3" />
                                Objectives
                              </div>
                            </th>
                            <th 
                              className="text-left px-4 py-3"
                              style={{ 
                                fontSize: '12px',
                                fontWeight: 500,
                                color: cascade.colors.text.muted,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              Contributors
                            </th>
                            <th 
                              className="text-left px-4 py-3"
                              style={{ 
                                fontSize: '12px',
                                fontWeight: 500,
                                color: cascade.colors.text.muted,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              Access
                            </th>
                          </tr>
                        </thead>
                        {/* Table body - 14px, 400 weight, #111827, row height 52px */}
                        <tbody>
                          {filteredPlans.map(plan => {
                            const team = plan.team_id ? getTeamById(plan.team_id) : null;
                            const parentPlan = plan.parent_plan_id ? getPlanById(plan.parent_plan_id) : null;
                            const focusAreaCount = getPlanFocusAreas(plan.id).length;
                            const objectiveCount = getObjectivesByPlan(plan.id).length;
                            const contributors = getPlanContributors(plan.id);

                            return (
                              <tr 
                                key={plan.id} 
                                className="cursor-pointer transition-colors"
                                style={{ 
                                  height: cascade.spacing.tableRowHeight,
                                  borderBottom: `1px solid ${cascade.colors.border.light}`,
                                }}
                                onClick={() => { 
                                  setSelectedPlan(plan);
                                  trackRecentlyViewed({ id: plan.id, type: 'plan', name: plan.name, owner: plan.owner_name });
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.bg.subtle}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    {/* Purple people icon - Cascade style */}
                                    <div 
                                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                                      style={{ backgroundColor: cascade.colors.primaryLight }}
                                    >
                                      <Users className="w-4 h-4" style={{ color: cascade.colors.primary }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '14px', fontWeight: 400, color: cascade.colors.text.primary }}>
                                        {plan.name}
                                      </div>
                                      {plan.description && (
                                        <div 
                                          className="truncate max-w-xs"
                                          style={{ fontSize: '12px', color: cascade.colors.text.muted }}
                                        >
                                          {plan.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {team ? (
                                    <div className="flex items-center gap-2">
                                      <span>{team.icon}</span>
                                      <span style={{ fontSize: '14px', color: cascade.colors.text.muted }}>{team.name}</span>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '14px', color: cascade.colors.text.light }}>—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {parentPlan ? (
                                    <span style={{ fontSize: '14px', color: cascade.colors.text.muted }}>{parentPlan.name}</span>
                                  ) : (
                                    <span style={{ fontSize: '14px', color: cascade.colors.text.light }}>—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <Settings className="w-4 h-4" style={{ color: cascade.colors.text.light }} />
                                    <span style={{ fontSize: '14px', color: cascade.colors.text.muted }}>
                                      {focusAreaCount}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <Circle className="w-4 h-4" style={{ color: cascade.colors.text.light }} />
                                    <span style={{ fontSize: '14px', color: cascade.colors.text.muted }}>
                                      {objectiveCount}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {contributors.length > 0 ? (
                                    <AvatarStack names={contributors} max={3} />
                                  ) : (
                                    <span style={{ fontSize: '14px', color: cascade.colors.text.light }}>—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                  <button className="p-1.5 hover:bg-gray-100 rounded">
                                    <MoreVertical className="w-4 h-4" style={{ color: cascade.colors.text.light }} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ALL TEAMS TAB */}
              {planTeamsTab === 'teams' && (
                <>
                  {/* Mobile: Search + Add */}
                  <div className="flex md:hidden items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: cascade.colors.text.light }} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                        style={{ borderColor: cascade.colors.border.default }}
                      />
                    </div>
                    <button
                      onClick={() => { setEditingItem(null); setShowTeamModal(true); }}
                      className="p-2 text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                      style={{ backgroundColor: cascade.colors.primary }}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  {/* Desktop Header */}
                  <div className="hidden md:flex items-center justify-between mb-4">
                    <h2 
                      className="uppercase"
                      style={{ 
                        fontSize: '14px',
                        fontWeight: 600,
                        color: cascade.colors.text.secondary,
                        letterSpacing: '0.05em',
                      }}
                    >
                      All teams
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: cascade.colors.text.light }} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search teams..."
                          className="pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 w-64"
                          style={{ borderColor: cascade.colors.border.default }}
                        />
                      </div>
                      <button
                        onClick={() => { setEditingItem(null); setShowTeamModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 text-white transition-colors"
                        style={{ 
                          backgroundColor: cascade.colors.primary,
                          borderRadius: cascade.radius.button,
                          fontSize: '14px',
                          fontWeight: 500,
                          padding: '8px 16px',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primaryHover}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primary}
                      >
                        <Plus className="w-4 h-4" />
                        New team
                      </button>
                    </div>
                  </div>

                  {filteredTeams.length === 0 ? (
                    <EmptyState
                      title="No teams yet"
                      description="Create teams to organize your strategic planning efforts."
                      action="Create Team"
                      onAction={() => setShowTeamModal(true)}
                      icon={Users}
                    />
                  ) : (
                    <>
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredTeams.map(team => {
                          const colorClasses = getColorClasses(team.color);
                          const teamPlans = getPlansByTeam(team.id);
                          return (
                            <button
                              key={team.id}
                              onClick={() => { 
                                setSelectedTeam(team);
                                trackRecentlyViewed({ id: team.id, type: 'team', name: team.name, icon: team.icon, owner: team.owner_name });
                              }}
                              className="w-full bg-white p-4 rounded-xl text-left active:bg-gray-50"
                              style={{ border: `1px solid ${cascade.colors.border.default}` }}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 ${colorClasses.bg} rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0`}>
                                  {team.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate" style={{ color: cascade.colors.text.primary }}>
                                    {team.name}
                                  </div>
                                  {team.owner_name && (
                                    <div className="text-xs mt-0.5" style={{ color: cascade.colors.text.muted }}>
                                      Owner: {team.owner_name}
                                    </div>
                                  )}
                                  <div className="text-xs mt-1" style={{ color: cascade.colors.text.muted }}>
                                    {teamPlans.length} plans
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: cascade.colors.border.default }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {/* Desktop Table */}
                      <div 
                        className="hidden md:block bg-white overflow-hidden"
                        style={{ 
                          borderRadius: cascade.radius.card,
                          border: `1px solid ${cascade.colors.border.default}`,
                        }}
                      >
                        <table className="w-full">
                          <thead style={{ backgroundColor: cascade.colors.bg.subtle, borderBottom: `1px solid ${cascade.colors.border.default}` }}>
                            <tr>
                              <th className="text-left px-4 py-3" style={{ fontSize: '12px', fontWeight: 500, color: cascade.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team</th>
                              <th className="text-left px-4 py-3" style={{ fontSize: '12px', fontWeight: 500, color: cascade.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                              <th className="text-left px-4 py-3" style={{ fontSize: '12px', fontWeight: 500, color: cascade.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner</th>
                              <th className="text-left px-4 py-3" style={{ fontSize: '12px', fontWeight: 500, color: cascade.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plans</th>
                              <th className="text-left px-4 py-3" style={{ fontSize: '12px', fontWeight: 500, color: cascade.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTeams.map(team => {
                              const colorClasses = getColorClasses(team.color);
                              const teamPlans = getPlansByTeam(team.id);
                              return (
                                <tr 
                                  key={team.id} 
                                  className="cursor-pointer transition-colors"
                                  style={{ height: cascade.spacing.tableRowHeight, borderBottom: `1px solid ${cascade.colors.border.light}` }}
                                  onClick={() => { 
                                    setSelectedTeam(team);
                                    trackRecentlyViewed({ id: team.id, type: 'team', name: team.name, icon: team.icon, owner: team.owner_name });
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.bg.subtle}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 ${colorClasses.bg} rounded-lg flex items-center justify-center text-white text-lg`}>
                                        {team.icon}
                                      </div>
                                      <span style={{ fontSize: '14px', fontWeight: 500, color: cascade.colors.text.primary }}>{team.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="truncate max-w-xs block" style={{ fontSize: '14px', color: cascade.colors.text.muted }}>{team.description || '—'}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <Avatar name={team.owner_name} size="sm" />
                                      <span style={{ fontSize: '14px', color: cascade.colors.text.muted }}>{team.owner_name || 'Unassigned'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span style={{ fontSize: '14px', color: cascade.colors.text.muted }}>{teamPlans.length}</span>
                                  </td>
                                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <button className="p-1.5 hover:bg-gray-100 rounded">
                                      <MoreVertical className="w-4 h-4" style={{ color: cascade.colors.text.light }} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ALL FOCUS AREAS TAB */}
              {planTeamsTab === 'focus-areas' && (
                <>
                  {/* Mobile: Search + Add */}
                  <div className="flex md:hidden items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: cascade.colors.text.light }} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                        style={{ borderColor: cascade.colors.border.default }}
                      />
                    </div>
                    <button
                      onClick={() => { setEditingItem(null); setShowFocusAreaModal(true); }}
                      className="p-2 text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                      style={{ backgroundColor: cascade.colors.primary }}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  {/* Desktop header */}
                  <div className="hidden md:flex items-center justify-between mb-4">
                    <h2 
                      className="uppercase"
                      style={{ 
                        fontSize: '14px',
                        fontWeight: 600,
                        color: cascade.colors.text.secondary,
                        letterSpacing: '0.05em',
                      }}
                    >
                      All focus areas
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: cascade.colors.text.light }} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search focus areas..."
                          className="pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 w-64"
                          style={{ borderColor: cascade.colors.border.default }}
                        />
                      </div>
                      <button
                        onClick={() => { setEditingItem(null); setShowFocusAreaModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 text-white transition-colors"
                        style={{ 
                          backgroundColor: cascade.colors.primary,
                          borderRadius: cascade.radius.button,
                          fontSize: '14px',
                          fontWeight: 500,
                          padding: '8px 16px',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primaryHover}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primary}
                      >
                        <Plus className="w-4 h-4" />
                        New focus area
                      </button>
                    </div>
                  </div>

                  {filteredFocusAreas.length === 0 ? (
                    <EmptyState
                      title="No focus areas yet"
                      description="Focus areas help organize your objectives into strategic themes."
                      action="Create Focus Area"
                      onAction={() => setShowFocusAreaModal(true)}
                      icon={Layers}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                      {filteredFocusAreas.map(fa => {
                        const colorClasses = getColorClasses(fa.color);
                        const objectiveCount = getObjectivesByFocusArea(fa.id).length;
                        const planCount = planFocusAreas.filter(pfa => pfa.focus_area_id === fa.id).length;
                        
                        return (
                          <div 
                            key={fa.id}
                            className="bg-white p-4"
                            style={{ 
                              border: `1px solid ${cascade.colors.border.default}`,
                              borderRadius: cascade.radius.card,
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 md:w-12 md:h-12 ${colorClasses.bg} rounded-xl flex items-center justify-center text-xl md:text-2xl text-white flex-shrink-0`}>
                                {fa.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-semibold truncate ${colorClasses.text}`}>{fa.name}</h3>
                                {fa.description && (
                                  <p className="text-sm mt-1 line-clamp-2" style={{ color: cascade.colors.text.muted }}>{fa.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs md:text-sm" style={{ color: cascade.colors.text.muted }}>
                                  <span>{objectiveCount} objectives</span>
                                  <span>{planCount} plans</span>
                                </div>
                              </div>
                              <button className="p-2 hover:bg-gray-100 rounded min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0">
                                <MoreVertical className="w-4 h-4" style={{ color: cascade.colors.text.light }} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* CASCADE-STYLE PLAN DETAIL VIEW */}
        {mainView === 'plans-teams' && selectedPlan && (
          <div className="flex-1 flex overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Plan Header - Mobile + Desktop */}
              <div className="bg-white px-4 md:px-6 py-3 md:py-4" style={{ borderBottom: `1px solid ${cascade.colors.border.default}` }}>
                {/* Mobile Header */}
                <div className="flex md:hidden items-center gap-2 mb-2">
                  <button 
                    onClick={() => setSelectedPlan(null)}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" style={{ color: cascade.colors.text.muted }} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base font-semibold truncate" style={{ color: cascade.colors.text.primary }}>
                      {selectedPlan.name}
                    </h1>
                    {selectedPlan.team_id && (
                      <div className="text-xs truncate" style={{ color: cascade.colors.text.muted }}>
                        {getTeamById(selectedPlan.team_id)?.icon} {getTeamById(selectedPlan.team_id)?.name}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setBookmarked(!bookmarked)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    style={{ color: bookmarked ? '#f59e0b' : cascade.colors.border.default }}
                  >
                    <Star className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
                  </button>
                  <button 
                    onClick={() => { setEditingItem(selectedPlan); setShowPlanModal(true); }}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    style={{ color: cascade.colors.text.muted }}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                {/* Desktop Breadcrumb */}
                <div className="hidden md:flex items-center gap-2 text-sm mb-2" style={{ color: cascade.colors.text.muted }}>
                  <button 
                    onClick={() => { setSelectedPlan(null); setSelectedObjective(null); }}
                    style={{ color: cascade.colors.primary }}
                    className="hover:underline"
                  >
                    Plans and teams
                  </button>
                  <ChevronRight className="w-4 h-4" />
                  <span className="truncate">{selectedPlan.name}</span>
                </div>
                
                {/* Desktop Title & Actions */}
                <div className="hidden md:flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setBookmarked(!bookmarked)}
                      className="p-1 rounded"
                      style={{ color: bookmarked ? '#f59e0b' : cascade.colors.border.default }}
                    >
                      <Star className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
                    </button>
                    <h1 style={{ fontSize: '28px', fontWeight: 600, color: cascade.colors.text.primary }}>
                      {selectedPlan.name}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setEditingItem(selectedPlan); setShowPlanModal(true); }}
                      className="px-3 py-1.5 text-sm hover:bg-gray-100 rounded-lg flex items-center gap-1"
                      style={{ color: cascade.colors.text.muted }}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button 
                      className="px-3 py-1.5 text-sm text-white rounded-lg flex items-center gap-1"
                      style={{ backgroundColor: cascade.colors.primary }}
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </div>

                

                {/* EDITORS Section + Assigned Team - Cascade Style */}
                <div className="hidden md:flex items-center justify-between mt-2">
                  <div className="flex items-center gap-6">
                    {/* EDITORS */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: cascade.colors.text.muted }}>
                        EDITORS
                      </span>
                      <span className="text-xs" style={{ color: cascade.colors.text.light }}>
                        Owners and collaborators
                      </span>
                      <AvatarStack names={getPlanContributors(selectedPlan.id).length > 0 ? getPlanContributors(selectedPlan.id) : [selectedPlan.owner_name || 'Owner']} max={4} />
                    </div>
                    
                    {/* Assigned Team */}
                    {selectedPlan.team_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: cascade.colors.text.muted }}>
                          assigned team
                        </span>
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
                        >
                          <Users className="w-3 h-3" />
                          {getTeamById(selectedPlan.team_id)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Planner / Timeline Tabs */}
                <div className="flex items-center gap-4 mt-2 md:mt-2 -mb-3 md:-mb-3 overflow-x-auto scrollbar-hide" style={{ borderBottom: `1px solid ${cascade.colors.border.default}` }}>
                  {[
                    { tab: 'planner' as PlannerTab, label: 'Planner' },
                    { tab: 'timeline' as PlannerTab, label: 'Timeline' },
                  ].map(item => (
                    <button
                      key={item.tab}
                      onClick={() => setPlannerTab(item.tab)}
                      className="transition-colors whitespace-nowrap min-h-[44px] flex items-center"
                      style={{
                        paddingBottom: '12px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: plannerTab === item.tab ? cascade.colors.primary : cascade.colors.text.muted,
                        borderBottom: plannerTab === item.tab ? `2px solid ${cascade.colors.primary}` : '2px solid transparent',
                        marginBottom: '-1px',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Planner Content */}
              {plannerTab === 'planner' && (
                <div className="flex-1 overflow-auto pb-24 md:pb-6">
                  {/* Filter Toolbar - Cascade Style */}
                  <div 
                    className="hidden md:flex items-center justify-between px-6 py-3"
                    style={{ backgroundColor: cascade.colors.bg.subtle, borderBottom: `1px solid ${cascade.colors.border.default}` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Hide Completed Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm" style={{ color: cascade.colors.text.secondary }}>
                          Hide completed
                        </span>
                      </label>
                      
                      {/* To Dropdown */}
                      <select 
                        className="text-sm border rounded-lg px-3 py-1.5 bg-white"
                        style={{ borderColor: cascade.colors.border.default, color: cascade.colors.text.secondary }}
                      >
                        <option>To</option>
                        <option>All</option>
                        <option>Me</option>
                        <option>My Team</option>
                      </select>

                      {/* View Toggle - List/Grid */}
                      <div 
                        className="flex items-center rounded-lg overflow-hidden"
                        style={{ border: `1px solid ${cascade.colors.border.default}` }}
                      >
                        <button
                          onClick={() => togglePlannerViewMode('list')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                          style={{ 
                            backgroundColor: plannerViewMode === 'list' ? cascade.colors.primary : 'white',
                            color: plannerViewMode === 'list' ? 'white' : cascade.colors.text.muted,
                          }}
                          title="List view"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => togglePlannerViewMode('grid')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                          style={{ 
                            backgroundColor: plannerViewMode === 'grid' ? cascade.colors.primary : 'white',
                            color: plannerViewMode === 'grid' ? 'white' : cascade.colors.text.muted,
                            borderLeft: `1px solid ${cascade.colors.border.default}`,
                          }}
                          title="Grid view"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* + Add Button - Purple */}
                      <button
                        onClick={() => {
                          setDefaultPlanId(selectedPlan.id);
                          setDefaultFocusAreaId('');
                          setEditingItem(null);
                          setShowObjectiveModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{ backgroundColor: cascade.colors.primary }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primaryHover}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = cascade.colors.primary}
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                      
                      {/* Strategy Cycle Dropdown */}
                      <select 
                        className="text-sm border rounded-lg px-3 py-1.5 bg-white max-w-[280px]"
                        style={{ borderColor: cascade.colors.border.default, color: cascade.colors.text.secondary }}
                      >
                        <option>
                          {selectedPlan.start_date && selectedPlan.end_date 
                            ? `Strategy Cycle ${new Date(selectedPlan.start_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} - ${new Date(selectedPlan.end_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                            : '26-27 Strategy Cycle Jan 01, 2026 - Dec 31, 2027'
                          }
                        </option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Focus Areas - Mobile Cards / Desktop List or Grid */}
                  <div className="p-4 md:p-6">
                    {/* Mobile: Always show card list */}
                    <div className="md:hidden space-y-3">
                      {focusAreas.map(fa => {
                        const faObjectives = getObjectivesByFocusArea(fa.id, selectedPlan.id);
                        if (faObjectives.length === 0 && !planFocusAreas.some(pfa => pfa.plan_id === selectedPlan.id && pfa.focus_area_id === fa.id)) {
                          return null;
                        }
                        
                        return (
                          <MobileFocusAreaCard
                            key={fa.id}
                            focusArea={fa}
                            objectives={faObjectives}
                            expanded={expandedFocusAreas.has(fa.id)}
                            onToggle={() => toggleFocusArea(fa.id)}
                            onAddObjective={() => {
                              setDefaultPlanId(selectedPlan.id);
                              setDefaultFocusAreaId(fa.id);
                              setEditingItem(null);
                              setShowObjectiveModal(true);
                            }}
                            onSelectObjective={(obj) => toggleObjectiveExpand(obj.id)}
                          />
                        );
                      })}
                    </div>

                    {/* Desktop: Drag & Drop enabled views */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      {/* Desktop: List View */}
                      {plannerViewMode === 'list' && (
                        <div className="hidden md:block space-y-4">
                          <SortableContext
                            items={getSortedFocusAreasForPlan(selectedPlan.id).map(fa => fa.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {getSortedFocusAreasForPlan(selectedPlan.id).map(fa => {
                              const faObjectives = getSortedObjectivesForFocusArea(fa.id, selectedPlan.id);
                              
                              return (
                                <SortableFocusAreaWrapper key={fa.id} id={fa.id}>
                                  {({ dragHandleProps, isDragging }) => (
                                    <FocusAreaAccordion
                                      focusArea={fa}
                                      objectives={faObjectives}
                                      expanded={expandedFocusAreas.has(fa.id)}
                                      onToggle={() => toggleFocusArea(fa.id)}
                                      onAddObjective={() => {
                                        setDefaultPlanId(selectedPlan.id);
                                        setDefaultFocusAreaId(fa.id);
                                        setEditingItem(null);
                                        setShowObjectiveModal(true);
                                      }}
                                      onSelectObjective={(obj) => toggleObjectiveExpand(obj.id)}
                                      onEditObjective={(obj) => setSelectedObjective(obj)}
                                      onEditFocusArea={() => { setEditingItem(fa); setShowFocusAreaModal(true); }}
                                      plan={selectedPlan}
                                      onReorderObjectives={handleObjectiveReorder}
                                      dragHandleProps={dragHandleProps}
                                      isDragging={isDragging}
                                      expandedObjectives={expandedObjectives}
                                      getActionsByObjective={getActionsByObjective}
                                    />
                                  )}
                                </SortableFocusAreaWrapper>
                              );
                            })}
                          </SortableContext>
                        </div>
                      )}

                      {/* Desktop: Grid View */}
                      {plannerViewMode === 'grid' && (
                        <div className="hidden md:grid md:grid-cols-2 gap-4">
                          <SortableContext
                            items={getSortedFocusAreasForPlan(selectedPlan.id).map(fa => fa.id)}
                            strategy={rectSortingStrategy}
                          >
                            {getSortedFocusAreasForPlan(selectedPlan.id).map(fa => {
                              const faObjectives = getSortedObjectivesForFocusArea(fa.id, selectedPlan.id);
                              
                              return (
                                <SortableFocusAreaWrapper key={fa.id} id={fa.id}>
                                  {({ dragHandleProps, isDragging }) => (
                                    <FocusAreaGridCard
                                      focusArea={fa}
                                      objectives={faObjectives}
                                      onAddObjective={() => {
                                        setDefaultPlanId(selectedPlan.id);
                                        setDefaultFocusAreaId(fa.id);
                                        setEditingItem(null);
                                        setShowObjectiveModal(true);
                                      }}
                                      onSelectObjective={(obj) => toggleObjectiveExpand(obj.id)}
                                      onEditObjective={(obj) => setSelectedObjective(obj)}
                                      onEditFocusArea={() => { setEditingItem(fa); setShowFocusAreaModal(true); }}
                                      onReorderObjectives={handleObjectiveReorder}
                                      dragHandleProps={dragHandleProps}
                                      isDragging={isDragging}
                                      expandedObjectives={expandedObjectives}
                                      getActionsByObjective={getActionsByObjective}
                                    />
                                  )}
                                </SortableFocusAreaWrapper>
                              );
                            })}
                          </SortableContext>
                        </div>
                      )}
                    </DndContext>

                    {/* Objectives without Focus Area */}
                    {getObjectivesWithoutFocusArea(selectedPlan.id).length > 0 && (
                      <>
                        {/* Mobile Version */}
                        <div className="md:hidden mt-3">
                          <MobileFocusAreaCard
                            focusArea={{ id: 'uncategorized', name: 'Uncategorized', icon: '📋', color: 'gray', created_at: '' }}
                            objectives={getObjectivesWithoutFocusArea(selectedPlan.id)}
                            expanded={expandedFocusAreas.has('uncategorized')}
                            onToggle={() => toggleFocusArea('uncategorized')}
                            onAddObjective={() => {
                              setDefaultPlanId(selectedPlan.id);
                              setDefaultFocusAreaId('');
                              setEditingItem(null);
                              setShowObjectiveModal(true);
                            }}
                            onSelectObjective={(obj) => toggleObjectiveExpand(obj.id)}
                          />
                        </div>
                        
                        {/* Desktop List View - Uncategorized */}
                        {plannerViewMode === 'list' && (
                          <div 
                            className="hidden md:block overflow-hidden bg-white mt-4"
                            style={{ 
                              border: `1px solid ${cascade.colors.border.default}`,
                              borderRadius: cascade.radius.card,
                            }}
                          >
                            <div 
                              className="flex items-center justify-between px-4"
                              style={{ 
                                height: cascade.spacing.tableRowHeight,
                                backgroundColor: cascade.colors.bg.subtle,
                                borderBottom: `1px solid ${cascade.colors.border.default}`,
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                                  <Target className="w-4 h-4" style={{ color: cascade.colors.text.muted }} />
                                </div>
                                <span className="font-medium" style={{ color: cascade.colors.text.secondary }}>Uncategorized</span>
                                <span className="text-sm" style={{ color: cascade.colors.text.muted }}>({getObjectivesWithoutFocusArea(selectedPlan.id).length})</span>
                              </div>
                            </div>
                            <div>
                              {getObjectivesWithoutFocusArea(selectedPlan.id).map(obj => (
                                <div
                                  key={obj.id}
                                  onClick={() => setSelectedObjective(obj)}
                                  className="flex items-center gap-4 px-4 cursor-pointer transition-colors"
                                  style={{ 
                                    height: cascade.spacing.tableRowHeight,
                                    paddingLeft: '56px',
                                    borderBottom: `1px solid ${cascade.colors.border.light}`,
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.bg.subtle}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                  <CircularProgress progress={obj.progress} size={24} />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate" style={{ color: cascade.colors.text.primary, fontSize: '14px' }}>{obj.title}</div>
                                    {obj.owner_name && (
                                      <div className="mt-0.5" style={{ color: cascade.colors.text.muted, fontSize: '12px' }}>{obj.owner_name}</div>
                                    )}
                                  </div>
                                  <ChevronRight className="w-4 h-4" style={{ color: cascade.colors.border.default }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Desktop Grid View - Uncategorized Card */}
                        {plannerViewMode === 'grid' && (
                          <div className="hidden md:block mt-4">
                            <FocusAreaGridCard
                              focusArea={{ id: 'uncategorized', name: 'Uncategorized', icon: '📋', color: 'gray', created_at: '' }}
                              objectives={getObjectivesWithoutFocusArea(selectedPlan.id)}
                              onAddObjective={() => {
                                setDefaultPlanId(selectedPlan.id);
                                setDefaultFocusAreaId('');
                                setEditingItem(null);
                                setShowObjectiveModal(true);
                              }}
                              onSelectObjective={(obj) => toggleObjectiveExpand(obj.id)}
                              onEditFocusArea={() => {}}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Add Focus Area / Objective Buttons - Desktop only */}
                    <div className={`hidden md:flex gap-4 pt-4 ${plannerViewMode === 'grid' ? 'col-span-2' : ''}`}>
                      <button
                        onClick={() => { setEditingItem(null); setShowFocusAreaModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm border-2 border-dashed rounded-lg transition-colors"
                        style={{ borderColor: cascade.colors.border.default, color: cascade.colors.text.muted }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Focus Area
                      </button>
                      <button
                        onClick={() => {
                          setDefaultPlanId(selectedPlan.id);
                          setDefaultFocusAreaId('');
                          setEditingItem(null);
                          setShowObjectiveModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm border-2 border-dashed rounded-lg transition-colors"
                        style={{ borderColor: cascade.colors.border.default, color: cascade.colors.text.muted }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Objective
                      </button>
                    </div>
                  </div>

                  {/* Mobile Bottom Action Bar */}
                  <MobileBottomBar
                    onAdd={() => {
                      setDefaultPlanId(selectedPlan.id);
                      setDefaultFocusAreaId('');
                      setEditingItem(null);
                      setShowObjectiveModal(true);
                    }}
                    onFilter={() => {}}
                    onMore={() => { setEditingItem(null); setShowFocusAreaModal(true); }}
                  />
                </div>
              )}

              {/* Timeline Content */}
              {plannerTab === 'timeline' && (
                <div className="flex-1 overflow-auto p-6">
                  <div 
                    className="bg-white p-8 text-center"
                    style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.card }}
                  >
                    <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: cascade.colors.border.default }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: cascade.colors.text.secondary }}>Timeline view coming soon</h3>
                    <p style={{ color: cascade.colors.text.muted }}>Visualize your objectives on a timeline.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Objective Detail (Desktop Only) */}
            {selectedObjective && (
              <div className="hidden md:block">
                <ObjectiveDetailPanel
                  objective={selectedObjective}
                  actions={getActionsByObjective(selectedObjective.id)}
                  measures={getMeasuresByObjective(selectedObjective.id)}
                  onClose={() => setSelectedObjective(null)}
                  onEditObjective={() => { setEditingItem(selectedObjective); setShowObjectiveModal(true); }}
                  onDeleteObjective={() => {
                    setConfirmDialog({
                      open: true,
                      title: 'Delete Objective',
                      message: `Are you sure you want to delete "${selectedObjective.title}"?`,
                      onConfirm: () => { 
                        deleteObjective(selectedObjective.id); 
                        setConfirmDialog(prev => ({ ...prev, open: false }));
                      }
                    });
                  }}
                  onAddAction={() => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(null); setShowActionModal(true); }}
                  onEditAction={(action) => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(action); setShowActionModal(true); }}
                  onDeleteAction={(id) => deleteAction(id)}
                  onAddMeasure={() => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(null); setShowMeasureModal(true); }}
                  onEditMeasure={(measure) => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(measure); setShowMeasureModal(true); }}
                  onDeleteMeasure={(id) => deleteMeasure(id)}
                />
              </div>
            )}

            {/* Mobile Objective Sheet */}
            {selectedObjective && (
              <MobileObjectiveSheet
                objective={selectedObjective}
                actions={getActionsByObjective(selectedObjective.id)}
                measures={getMeasuresByObjective(selectedObjective.id)}
                onClose={() => setSelectedObjective(null)}
                onEditObjective={() => { setEditingItem(selectedObjective); setShowObjectiveModal(true); }}
                onDeleteObjective={() => {
                  setConfirmDialog({
                    open: true,
                    title: 'Delete Objective',
                    message: `Are you sure you want to delete "${selectedObjective.title}"?`,
                    onConfirm: () => { 
                      deleteObjective(selectedObjective.id); 
                      setConfirmDialog(prev => ({ ...prev, open: false }));
                    }
                  });
                }}
                onAddAction={() => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(null); setShowActionModal(true); }}
                onEditAction={(action) => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(action); setShowActionModal(true); }}
                onDeleteAction={(id) => deleteAction(id)}
                onAddMeasure={() => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(null); setShowMeasureModal(true); }}
                onEditMeasure={(measure) => { setCurrentObjectiveId(selectedObjective.id); setEditingItem(measure); setShowMeasureModal(true); }}
                onDeleteMeasure={(id) => deleteMeasure(id)}
              />
            )}
          </div>
        )}

        {/* TEAM DETAIL VIEW */}
        {mainView === 'plans-teams' && selectedTeam && (
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              <div>
                <button 
                  onClick={() => setSelectedTeam(null)}
                  className="text-sm hover:underline mb-2 flex items-center gap-1"
                  style={{ color: cascade.colors.primary }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Teams
                </button>
              </div>
              
              <div 
                className="bg-white p-6"
                style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.card }}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 ${getColorClasses(selectedTeam.color).bg} rounded-xl flex items-center justify-center text-3xl text-white`}>
                    {selectedTeam.icon}
                  </div>
                  <div className="flex-1">
                    <h2 style={{ fontSize: '28px', fontWeight: 600, color: cascade.colors.text.primary }}>{selectedTeam.name}</h2>
                    {selectedTeam.description && <p className="mt-1" style={{ color: cascade.colors.text.muted }}>{selectedTeam.description}</p>}
                    {selectedTeam.owner_name && (
                      <div className="flex items-center gap-2 mt-2 text-sm" style={{ color: cascade.colors.text.muted }}>
                        <User className="w-4 h-4" />
                        Owner: {selectedTeam.owner_name}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => { setEditingItem(selectedTeam); setShowTeamModal(true); }}
                    className="px-3 py-1.5 text-sm hover:bg-gray-100 rounded-lg flex items-center gap-1"
                    style={{ color: cascade.colors.text.muted }}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                </div>

                {(selectedTeam.vision || selectedTeam.mission) && (
                  <div className="grid md:grid-cols-2 gap-6 mt-6 pt-6" style={{ borderTop: `1px solid ${cascade.colors.border.default}` }}>
                    {selectedTeam.vision && (
                      <div>
                        <h4 className="text-sm font-semibold uppercase mb-2" style={{ color: cascade.colors.text.muted }}>Vision</h4>
                        <p style={{ color: cascade.colors.text.secondary }}>{selectedTeam.vision}</p>
                      </div>
                    )}
                    {selectedTeam.mission && (
                      <div>
                        <h4 className="text-sm font-semibold uppercase mb-2" style={{ color: cascade.colors.text.muted }}>Mission</h4>
                        <p style={{ color: cascade.colors.text.secondary }}>{selectedTeam.mission}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Team's Plans */}
              <div>
                <h3 className="font-semibold mb-4" style={{ color: cascade.colors.text.primary }}>Plans ({getPlansByTeam(selectedTeam.id).length})</h3>
                {getPlansByTeam(selectedTeam.id).length === 0 ? (
                  <div 
                    className="bg-white p-8 text-center"
                    style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.card, color: cascade.colors.text.muted }}
                  >
                    No plans assigned to this team yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getPlansByTeam(selectedTeam.id).map(plan => (
                      <div 
                        key={plan.id}
                        className="bg-white p-4 cursor-pointer transition-colors"
                        style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.button }}
                        onClick={() => { setSelectedPlan(plan); setSelectedTeam(null); }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = cascade.colors.bg.subtle}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FolderKanban className="w-5 h-5" style={{ color: cascade.colors.primary }} />
                            <span className="font-medium" style={{ color: cascade.colors.text.primary }}>{plan.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-24">
                              <ProgressBar progress={calculatePlanProgress(plan.id)} size="sm" color="indigo" />
                            </div>
                            <span className="text-sm" style={{ color: cascade.colors.text.muted }}>{calculatePlanProgress(plan.id)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HOME VIEW */}
        {mainView === 'home' && (
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {/* Mobile Header */}
            <div className="flex md:hidden items-center gap-3 mb-4">
              <h1 className="text-xl font-semibold" style={{ color: cascade.colors.text.primary }}>
                Welcome back!
              </h1>
            </div>
            {/* Desktop Title */}
            <h1 className="hidden md:block mb-6" style={{ fontSize: '28px', fontWeight: 600, color: cascade.colors.text.primary }}>Welcome back!</h1>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              {[
                { label: 'Total Plans', value: plans.length },
                { label: 'Total Teams', value: teams.length },
                { label: 'Objectives', value: objectives.length },
                { label: 'Focus Areas', value: focusAreas.length },
              ].map(stat => (
                <div 
                  key={stat.label}
                  className="bg-white p-3 md:p-4"
                  style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.card }}
                >
                  <div className="text-xs md:text-sm mb-1" style={{ color: cascade.colors.text.muted }}>{stat.label}</div>
                  <div className="text-2xl md:text-3xl font-bold" style={{ color: cascade.colors.text.primary }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            {recentlyViewed.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4" style={{ color: cascade.colors.text.primary }}>Recently viewed</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {recentlyViewed.slice(0, 3).map(item => (
                    <RecentlyViewedCard 
                      key={`${item.type}-${item.id}`} 
                      item={item}
                      onClick={() => {
                        if (item.type === 'plan') {
                          const plan = plans.find(p => p.id === item.id);
                          if (plan) {
                            setMainView('plans-teams');
                            setSelectedPlan(plan);
                          }
                        } else if (item.type === 'team') {
                          const team = teams.find(t => t.id === item.id);
                          if (team) {
                            setMainView('plans-teams');
                            setSelectedTeam(team);
                          }
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold mb-4" style={{ color: cascade.colors.text.primary }}>Quick actions</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => { setMainView('plans-teams'); setPlanTeamsTab('plans'); setShowPlanModal(true); }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ backgroundColor: cascade.colors.primaryLight, color: cascade.colors.primary }}
                >
                  <Plus className="w-5 h-5" />
                  Create new plan
                </button>
                <button
                  onClick={() => { setMainView('plans-teams'); setPlanTeamsTab('teams'); setShowTeamModal(true); }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ backgroundColor: cascade.colors.primaryLight, color: cascade.colors.primary }}
                >
                  <Plus className="w-5 h-5" />
                  Create new team
                </button>
              </div>
            </div>
          </div>
        )}

        {/* METRICS VIEW */}
        {mainView === 'metrics' && (
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {/* Mobile Header */}
            <div className="flex md:hidden items-center gap-3 mb-4">
              <h1 className="text-xl font-semibold" style={{ color: cascade.colors.text.primary }}>Metrics</h1>
            </div>
            <h1 className="hidden md:block mb-6" style={{ fontSize: '28px', fontWeight: 600, color: cascade.colors.text.primary }}>Metrics</h1>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-white p-3 md:p-4 col-span-2 md:col-span-1" style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.card }}>
                <div className="text-xs md:text-sm" style={{ color: cascade.colors.text.muted }}>Total Objectives</div>
                <div className="text-2xl md:text-3xl font-bold mt-1" style={{ color: cascade.colors.text.primary }}>{objectives.length}</div>
              </div>
              <div className="p-3 md:p-4" style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: cascade.radius.card }}>
                <div className="text-xs md:text-sm text-emerald-600">On Track</div>
                <div className="text-2xl md:text-3xl font-bold text-emerald-600 mt-1">
                  {objectives.filter(o => o.status === 'on_track' || o.status === 'done').length}
                </div>
              </div>
              <div className="p-3 md:p-4" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: cascade.radius.card }}>
                <div className="text-xs md:text-sm text-blue-600">In Progress</div>
                <div className="text-2xl md:text-3xl font-bold text-blue-600 mt-1">
                  {objectives.filter(o => o.status === 'in_progress').length}
                </div>
              </div>
              <div className="p-3 md:p-4" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: cascade.radius.card }}>
                <div className="text-xs md:text-sm text-amber-600">Behind</div>
                <div className="text-2xl md:text-3xl font-bold text-amber-600 mt-1">
                  {objectives.filter(o => o.status === 'behind').length}
                </div>
              </div>
              <div className="p-3 md:p-4" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: cascade.radius.card }}>
                <div className="text-xs md:text-sm text-red-600">At Risk</div>
                <div className="text-2xl md:text-3xl font-bold text-red-600 mt-1">
                  {objectives.filter(o => o.status === 'at_risk' || o.status === 'blocked').length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS VIEW */}
        {mainView === 'reports' && (
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {/* Mobile Header */}
            <div className="flex md:hidden items-center gap-3 mb-4">
              <h1 className="text-xl font-semibold" style={{ color: cascade.colors.text.primary }}>Reports</h1>
            </div>
            <h1 className="hidden md:block mb-6" style={{ fontSize: '28px', fontWeight: 600, color: cascade.colors.text.primary }}>Reports</h1>
            <div 
              className="bg-white p-8 text-center"
              style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.card }}
            >
              <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: cascade.colors.border.default }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: cascade.colors.text.secondary }}>Reports coming soon</h3>
              <p style={{ color: cascade.colors.text.muted }}>Generate strategy reports and track progress over time.</p>
            </div>
          </div>
        )}

        {/* INSIGHTS VIEW */}
        {mainView === 'insights' && (
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {/* Mobile Header */}
            <div className="flex md:hidden items-center gap-3 mb-4">
              <h1 className="text-xl font-semibold" style={{ color: cascade.colors.text.primary }}>Insights</h1>
            </div>
            <h1 className="hidden md:block mb-6" style={{ fontSize: '28px', fontWeight: 600, color: cascade.colors.text.primary }}>Insights</h1>
            <div 
              className="bg-white p-8 text-center"
              style={{ border: `1px solid ${cascade.colors.border.default}`, borderRadius: cascade.radius.card }}
            >
              <Lightbulb className="w-12 h-12 mx-auto mb-4" style={{ color: cascade.colors.border.default }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: cascade.colors.text.secondary }}>AI Insights coming soon</h3>
              <p style={{ color: cascade.colors.text.muted }}>Get AI-powered recommendations to improve your strategy execution.</p>
            </div>
          </div>
        )}

        {/* CANVAS VIEW */}
        {mainView === 'canvas' && (
          <div className="flex-1 overflow-hidden">
            <StrategyCanvas onBack={() => setMainView('plans-teams')} />
          </div>
        )}
      </div>

      {/* MODALS */}
      <PlanModal
        open={showPlanModal}
        onClose={() => { setShowPlanModal(false); setEditingItem(null); }}
        onSave={savePlan}
        plan={editingItem}
        teams={teams}
        plans={plans}
      />

      <TeamModal
        open={showTeamModal}
        onClose={() => { setShowTeamModal(false); setEditingItem(null); }}
        onSave={saveTeam}
        team={editingItem}
        teams={teams}
      />

      <FocusAreaModal
        open={showFocusAreaModal}
        onClose={() => { setShowFocusAreaModal(false); setEditingItem(null); }}
        onSave={saveFocusArea}
        focusArea={editingItem}
      />

      <ObjectiveModal
        open={showObjectiveModal}
        onClose={() => { setShowObjectiveModal(false); setEditingItem(null); }}
        onSave={saveObjective}
        objective={editingItem}
        focusAreas={focusAreas}
        plans={plans}
        defaultPlanId={defaultPlanId}
        defaultFocusAreaId={defaultFocusAreaId}
      />

      <ActionModal
        open={showActionModal}
        onClose={() => { setShowActionModal(false); setEditingItem(null); }}
        onSave={saveAction}
        action={editingItem}
        objectiveId={currentObjectiveId}
      />

      <MeasureModal
        open={showMeasureModal}
        onClose={() => { setShowMeasureModal(false); setEditingItem(null); }}
        onSave={saveMeasure}
        measure={editingItem}
        objectiveId={currentObjectiveId}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
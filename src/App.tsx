import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Home, Calendar, Clock, Sun, Moon, ListTodo, FolderKanban, 
  ChevronLeft, ChevronRight, ChevronDown, Plus, Check, Circle, Play,
  Building2, Target, Settings, X, Trash2, Edit2, GripVertical, AlertCircle,
  User, Flag, LogOut, Shield, Users, UserPlus, Menu, Compass,
  BarChart3, FileText, Lightbulb, PenTool
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StrategyView from './components/StrategyView';
import { 
  Organization, Project, SubProject, Task, DailyPlan, CeoUser, OrgMember, TeamMember,
  fetchOrganizations, fetchProjects, fetchSubProjects, fetchTasks, fetchDailyPlans,
  upsertTask, upsertDailyPlan, upsertOrganization, upsertProject, upsertSubProject,
  deleteTask, deleteDailyPlan,
  signInWithGoogle, signOut, getCurrentUser, createOrUpdateUser,
  fetchAllUsers, fetchOrgMembers, fetchUserOrgIds, addOrgMember, removeOrgMember, updateUserRole, updateUserProfile,
  fetchTeamMembers, fetchAllTeamMembers, addTeamMember, removeTeamMember
} from './lib/supabase';
import { supabase, Session } from './lib/supabase';

// ============ TYPES ============
type View = 'home' | 'today' | 'focus' | 'backlog' | 'projects' | 'orgs' | 'subproject' | 'admin' | 'settings' | 'strategy';
type StrategySubView = 'plans-teams' | 'metrics' | 'reports' | 'insights' | 'canvas';
type ModalType = 'none' | 'org' | 'project' | 'subproject' | 'task';

// ============ DATE HELPERS ============
function formatDate(date: Date, format: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  if (format === 'EEE') return days[date.getDay()];
  if (format === 'EEEE') return dayNames[date.getDay()];
  if (format === 'd') return date.getDate().toString();
  if (format === 'MMMM yyyy') return `${months[date.getMonth()]} ${date.getFullYear()}`;
  if (format === 'MMMM d') return `${months[date.getMonth()]} ${date.getDate()}`;
  if (format === 'yyyy-MM-dd') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return date.toDateString();
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && 
         a.getMonth() === b.getMonth() && 
         a.getDate() === b.getDate();
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============ CONSTANTS ============
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am to 10pm
const COLORS = ['emerald', 'blue', 'purple', 'pink', 'orange', 'red', 'yellow', 'cyan'];
const EMOJIS = ['🎨', '📊', '🚀', '💡', '🎯', '📦', '💬', '🛠️', '📱', '🌟', '🦄', '🎉'];

// ============ STANDALONE CARD COMPONENTS (outside App to prevent re-creation) ============

// Compact table header for card view
const CardTableHeaderStandalone = () => (
  <div className="grid grid-cols-[1fr,70px,55px,55px,55px,40px] items-center gap-1 px-2 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50 font-medium">
    <span>Task</span>
    <span className="text-center">Assignee</span>
    <span className="text-center">Start</span>
    <span className="text-center">Due</span>
    <span className="text-center">Status</span>
    <span className="text-center">Pri</span>
  </div>
);

// Project sub-projects grid with drag-drop - MUST be outside App
const ProjectSubProjectsGrid = ({
  projectId,
  subProjects,
  tasks,
  users,
  hideCompleted,
  onReorder,
  onToggleTask,
  onUpdateTask,
  onSelectTask,
  onSelectSubProject,
  onEditSubProject,
  onAddTask,
  onAddSubProject,
}: {
  projectId: string;
  subProjects: SubProject[];
  tasks: Task[];
  users: CeoUser[];
  hideCompleted?: boolean;
  onReorder: (projectId: string, ids: string[]) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (task: Partial<Task> & { id: string }) => void;
  onSelectTask: (task: Task) => void;
  onSelectSubProject: (id: string) => void;
  onEditSubProject: (sp: SubProject) => void;
  onAddTask: (spId: string) => void;
  onAddSubProject: () => void;
}) => {
  const subProjectIds = subProjects.map(sp => sp.id);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = subProjectIds.indexOf(active.id as string);
      const newIndex = subProjectIds.indexOf(over.id as string);
      const newOrder = arrayMove(subProjectIds, oldIndex, newIndex);
      onReorder(projectId, newOrder);
    }
  };
  
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={subProjectIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subProjects.map(sp => (
            <SortableSubProjectCardStandalone 
              key={sp.id} 
              sp={sp}
              tasks={tasks}
              onToggleTask={onToggleTask}
              onUpdateTask={onUpdateTask}
              onSelectTask={onSelectTask}
              onSelectSubProject={onSelectSubProject}
              onEditSubProject={onEditSubProject}
              onAddTask={onAddTask}
              users={users}
            />
          ))}
          {subProjects.length === 0 && (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <FolderKanban className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-3">No sub-projects yet</p>
              <button 
                onClick={onAddSubProject}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Create your first sub-project
              </button>
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
};

// Sortable sub-project card - MUST be outside App for stability
const SortableSubProjectCardStandalone = ({ 
  sp, 
  tasks,
  onToggleTask,
  onUpdateTask,
  onSelectTask,
  onSelectSubProject,
  onEditSubProject,
  onAddTask,
  users
}: { 
  sp: SubProject;
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onUpdateTask: (task: Partial<Task> & { id: string }) => void;
  onSelectTask: (task: Task) => void;
  onSelectSubProject: (id: string) => void;
  onEditSubProject: (sp: SubProject) => void;
  onAddTask: (spId: string) => void;
  users: CeoUser[];
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sp.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
  };
  
  const spTasks = tasks.filter(t => t.sub_project_id === sp.id);
  const doneTasks = spTasks.filter(t => t.status === 'done').length;
  const progress = spTasks.length > 0 ? Math.round((doneTasks / spTasks.length) * 100) : 0;
  
  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="flex flex-col overflow-hidden border border-gray-200 rounded-lg bg-white"
    >
      {/* Card Header with drag handle */}
      <div 
        className="flex items-center justify-between p-3"
        style={{ backgroundColor: '#f7f7f8' }}
      >
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <button 
            {...attributes} 
            {...listeners}
            className="p-1 cursor-grab hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onSelectSubProject(sp.id)}
          >
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#f59e0b' }}
            >
              <span className="text-white text-xs">{sp.organization?.emoji || '📁'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-900 text-sm hover:text-indigo-600">
                {sp.name}
              </span>
              <p className="text-[10px] text-gray-500">{sp.organization?.name} · {spTasks.length} tasks</p>
            </div>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onEditSubProject(sp); }}
          className="p-1 hover:bg-gray-200 rounded opacity-60 hover:opacity-100"
        >
          <Settings className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-3 py-1.5 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span>{doneTasks}/{spTasks.length} done</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Tasks table */}
      <div className="flex-1 bg-white">
        {spTasks.length > 0 && <CardTableHeaderStandalone />}
        <div className="max-h-[200px] overflow-y-auto">
          {spTasks.slice(0, 8).map(task => (
            <CardTaskRowStandalone 
              key={task.id} 
              task={task} 
              onToggle={() => onToggleTask(task.id)}
              onUpdate={onUpdateTask}
              onClick={() => onSelectTask(task)}
              users={users}
            />
          ))}
        </div>
        {spTasks.length > 8 && (
          <p className="text-[10px] text-gray-400 px-2 py-1 text-center border-t border-gray-50">
            +{spTasks.length - 8} more tasks
          </p>
        )}
        {spTasks.length === 0 && (
          <p className="text-xs py-3 text-gray-400 text-center">No tasks yet</p>
        )}
        
        {/* Add Task button */}
        <button
          onClick={() => onAddTask(sp.id)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-t border-gray-100"
        >
          <Plus className="w-3 h-3" />
          Add Task
        </button>
      </div>
    </div>
  );
};

// Compact task row for card view
const CardTaskRowStandalone = ({ task, onToggle, onUpdate, onClick, users }: {
  task: Task;
  onToggle: () => void;
  onUpdate: (task: Partial<Task> & { id: string }) => void;
  onClick: () => void;
  users: CeoUser[];
}) => {
  const [editingField, setEditingField] = useState<'assignee' | 'start_date' | 'due_date' | 'status' | 'priority' | null>(null);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500'];
    return colors[name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length];
  };
  
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const statusConfig = {
    todo: { label: 'To Do', bg: 'bg-gray-100', text: 'text-gray-600' },
    in_progress: { label: 'In Prog', bg: 'bg-blue-100', text: 'text-blue-600' },
    done: { label: 'Done', bg: 'bg-emerald-100', text: 'text-emerald-600' },
    blocked: { label: 'Block', bg: 'bg-red-100', text: 'text-red-600' },
  };
  
  return (
    <div className="grid grid-cols-[1fr,70px,55px,55px,55px,40px] items-center gap-1 px-2 py-1.5 hover:bg-gray-50 group/task border-b border-gray-50 text-xs">
      {/* Task name with status toggle */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex-shrink-0"
        >
          {task.status === 'done' ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : task.status === 'in_progress' ? (
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-gray-300 hover:text-emerald-500" />
          )}
        </button>
        <span 
          className={`truncate cursor-pointer hover:text-indigo-600 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}
          onClick={onClick}
        >
          {task.title}
        </span>
      </div>
      
      {/* Assignee */}
      {editingField === 'assignee' ? (
        <select
          value={task.assigned_to_user_id || ''}
          onChange={(e) => {
            e.stopPropagation();
            const userId = e.target.value || null;
            const user = users.find(u => u.id === userId);
            if (userId) {
              onUpdate({ id: task.id, assigned_to_user_id: userId, assignee: user?.display_name || null });
            }
            setEditingField(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full px-1 py-0.5 text-[10px] border border-indigo-400 rounded bg-white outline-none z-50"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Unassigned</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
          ))}
        </select>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingField('assignee'); }}
          className="flex items-center justify-center"
        >
          {task.assignee ? (
            <div className={`w-5 h-5 rounded-full ${getAvatarColor(task.assignee)} flex items-center justify-center text-white text-[9px] font-medium`} title={task.assignee}>
              {getInitials(task.assignee)}
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400">
              <User className="w-2.5 h-2.5" />
            </div>
          )}
        </button>
      )}
      
      {/* Start date */}
      {editingField === 'start_date' ? (
        <input
          type="date"
          value={task.start_date || ''}
          onChange={(e) => {
            e.stopPropagation();
            onUpdate({ id: task.id, start_date: e.target.value || null });
            setEditingField(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full px-0.5 py-0.5 text-[10px] border border-indigo-400 rounded bg-white outline-none z-50"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingField('start_date'); }}
          className={`text-[10px] text-center ${task.start_date ? 'text-gray-500' : 'text-gray-300 hover:text-gray-500'}`}
        >
          {formatDate(task.start_date)}
        </button>
      )}
      
      {/* Due date */}
      {editingField === 'due_date' ? (
        <input
          type="date"
          value={task.due_date || ''}
          onChange={(e) => {
            e.stopPropagation();
            onUpdate({ id: task.id, due_date: e.target.value || null });
            setEditingField(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full px-0.5 py-0.5 text-[10px] border border-indigo-400 rounded bg-white outline-none z-50"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingField('due_date'); }}
          className={`text-[10px] text-center ${
            task.due_date 
              ? isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'
              : 'text-gray-300 hover:text-gray-500'
          }`}
        >
          {formatDate(task.due_date)}
        </button>
      )}
      
      {/* Status */}
      {editingField === 'status' ? (
        <select
          value={task.status}
          onChange={(e) => {
            e.stopPropagation();
            onUpdate({ id: task.id, status: e.target.value as Task['status'] });
            setEditingField(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full px-0.5 py-0.5 text-[9px] border border-indigo-400 rounded bg-white outline-none z-50"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingField('status'); }}
          className={`px-1 py-0.5 rounded text-[9px] font-medium ${statusConfig[task.status].bg} ${statusConfig[task.status].text}`}
        >
          {statusConfig[task.status].label}
        </button>
      )}
      
      {/* Priority */}
      {editingField === 'priority' ? (
        <div className="flex gap-0.5 justify-center" onClick={(e) => e.stopPropagation()}>
          {(['high', 'medium', 'low'] as const).map(p => (
            <button
              key={p}
              onClick={() => { onUpdate({ id: task.id, priority: p }); setEditingField(null); }}
              className={`w-3 h-3 rounded-full ${p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`}
              title={p}
            />
          ))}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingField('priority'); }}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium mx-auto ${
            task.priority === 'high' ? 'bg-red-50 text-red-600' :
            task.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
            'bg-gray-100 text-gray-500'
          }`}
        >
          {task.priority === 'high' ? 'H' : task.priority === 'medium' ? 'M' : 'L'}
        </button>
      )}
    </div>
  );
};

// ============ PROJECT TIMELINE VIEW ============
const ProjectTimelineView = ({
  tasks,
  subProjects,
  users,
  onUpdateTask,
  onSelectTask,
}: {
  tasks: Task[];
  subProjects: SubProject[];
  users: CeoUser[];
  onUpdateTask: (task: Partial<Task> & { id: string }) => void;
  onSelectTask: (task: Task) => void;
}) => {
  const mainScrollRef = useRef<HTMLDivElement>(null);
  
  // State for collapsible sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // State for zoom level
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('day');
  
  // State for date offset (for navigation)
  const [dateOffset, setDateOffset] = useState(0);
  
  // State for hovering row
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  
  // State for dragging to resize
  const [resizing, setResizing] = useState<{ taskId: string; edge: 'start' | 'end'; initialX: number; initialDate: string } | null>(null);
  
  // State for assignee filter
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);
  
  // Calculate day width based on zoom
  const DAY_WIDTH = zoomLevel === 'day' ? 50 : zoomLevel === 'week' ? 24 : 10;
  const ROW_HEIGHT = 36;
  const LEFT_PANEL_WIDTH = 420; // Expanded to fit more columns
  
  // Calculate date range based on zoom and offset
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysToShow = zoomLevel === 'day' ? 35 : zoomLevel === 'week' ? 63 : 120;
  const daysBefore = zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 14 : 30;
  
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - daysBefore + dateOffset);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysToShow);
  
  // Generate array of dates
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  const TIMELINE_WIDTH = dates.length * DAY_WIDTH;
  
  // Get unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    tasks.forEach(t => {
      if (t.assignee) assignees.add(t.assignee);
    });
    return Array.from(assignees).sort();
  }, [tasks]);
  
  // Toggle assignee filter
  const toggleAssignee = (assignee: string) => {
    setSelectedAssignees(prev => {
      const next = new Set(prev);
      if (next.has(assignee)) next.delete(assignee);
      else next.add(assignee);
      return next;
    });
  };
  
  // Clear all assignee filters
  const clearAssigneeFilter = () => {
    setSelectedAssignees(new Set());
  };
  
  // Group tasks by sub-project (with assignee filter)
  const tasksBySubProject = subProjects.map(sp => {
    let spTasks = tasks.filter(t => t.sub_project_id === sp.id);
    
    // Apply assignee filter
    if (selectedAssignees.size > 0) {
      spTasks = spTasks.filter(t => t.assignee && selectedAssignees.has(t.assignee));
    }
    
    spTasks = spTasks.sort((a, b) => {
      const aStart = a.start_date || a.due_date || '9999';
      const bStart = b.start_date || b.due_date || '9999';
      return aStart.localeCompare(bStart);
    });
    const doneTasks = spTasks.filter(t => t.status === 'done').length;
    const progress = spTasks.length > 0 ? Math.round((doneTasks / spTasks.length) * 100) : 0;
    return { subProject: sp, tasks: spTasks, progress };
  }).filter(g => g.tasks.length > 0);
  
  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500'];
    return colors[name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length];
  };
  
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const statusColors: Record<string, string> = {
    todo: 'bg-gray-400',
    in_progress: 'bg-blue-500',
    done: 'bg-emerald-500',
    blocked: 'bg-red-500',
  };
  
  const getTaskPosition = (task: Task) => {
    const taskStart = task.start_date ? new Date(task.start_date) : task.due_date ? new Date(task.due_date) : null;
    const taskEnd = task.due_date ? new Date(task.due_date) : taskStart;
    
    if (!taskStart || !taskEnd) return null;
    
    const startOffset = Math.floor((taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const endOffset = Math.floor((taskEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, endOffset - startOffset + 1);
    
    return { startOffset, duration };
  };
  
  // Scroll to today
  const scrollToToday = () => {
    setDateOffset(0);
    setTimeout(() => {
      if (mainScrollRef.current) {
        const todayOffset = daysBefore;
        mainScrollRef.current.scrollLeft = Math.max(0, todayOffset * DAY_WIDTH - 300);
      }
    }, 50);
  };
  
  // Handle drag resize
  const handleResizeStart = (e: React.MouseEvent, taskId: string, edge: 'start' | 'end', currentDate: string) => {
    e.stopPropagation();
    setResizing({ taskId, edge, initialX: e.clientX, initialDate: currentDate });
  };
  
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const deltaX = e.clientX - resizing.initialX;
    const deltaDays = Math.round(deltaX / DAY_WIDTH);
    if (deltaDays !== 0) {
      const task = tasks.find(t => t.id === resizing.taskId);
      if (task) {
        const initialDate = new Date(resizing.initialDate);
        const newDate = new Date(initialDate);
        newDate.setDate(newDate.getDate() + deltaDays);
        const newDateStr = newDate.toISOString().split('T')[0];
        
        if (resizing.edge === 'start') {
          onUpdateTask({ id: task.id, start_date: newDateStr });
        } else {
          onUpdateTask({ id: task.id, due_date: newDateStr });
        }
        setResizing({ ...resizing, initialX: e.clientX, initialDate: newDateStr });
      }
    }
  }, [resizing, tasks, DAY_WIDTH, onUpdateTask]);
  
  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);
  
  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);
  
  // Scroll to today on mount
  useEffect(() => {
    scrollToToday();
  }, []);
  
  // Get months for header
  const months = useMemo(() => {
    const result: { month: string; startIndex: number; days: number }[] = [];
    let currentMonth = '';
    let startIndex = 0;
    dates.forEach((date, i) => {
      const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (monthStr !== currentMonth) {
        if (currentMonth) {
          result.push({ month: currentMonth, startIndex, days: i - startIndex });
        }
        currentMonth = monthStr;
        startIndex = i;
      }
    });
    if (currentMonth) {
      result.push({ month: currentMonth, startIndex, days: dates.length - startIndex });
    }
    return result;
  }, [dates]);
  
  // Calculate total rows for grid background
  const totalRows = tasksBySubProject.reduce((acc, g) => {
    const isCollapsed = collapsedSections.has(g.subProject.id);
    return acc + 1 + (isCollapsed ? 0 : g.tasks.length); // 1 for header + tasks
  }, 0);
  
  return (
    <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden">
      {/* Toolbar - stays fixed at top */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDateOffset(prev => prev - (zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 14 : 30))}
              className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToToday}
              className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 font-medium"
            >
              Today
            </button>
            <button
              onClick={() => setDateOffset(prev => prev + (zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 14 : 30))}
              className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          {/* Status legend */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 border-l pl-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />To Do</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Blocked</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Assignee filter */}
          <div className="relative">
            <button
              onClick={() => setShowAssigneeFilter(!showAssigneeFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border ${
                selectedAssignees.size > 0 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Assignee</span>
              {selectedAssignees.size > 0 && (
                <span className="bg-indigo-500 text-white text-[10px] px-1.5 rounded-full">{selectedAssignees.size}</span>
              )}
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showAssigneeFilter && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[200px] py-1">
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Filter by Assignee</span>
                  {selectedAssignees.size > 0 && (
                    <button onClick={clearAssigneeFilter} className="text-[10px] text-indigo-600 hover:underline">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {uniqueAssignees.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">No assignees found</div>
                  ) : (
                    uniqueAssignees.map(assignee => (
                      <label
                        key={assignee}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAssignees.has(assignee)}
                          onChange={() => toggleAssignee(assignee)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className={`w-5 h-5 rounded-full ${getAvatarColor(assignee)} flex items-center justify-center text-white text-[8px] font-medium`}>
                          {getInitials(assignee)}
                        </div>
                        <span className="text-xs text-gray-700">{assignee}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Zoom controls */}
          <div className="flex bg-gray-200 rounded p-0.5">
            {(['day', 'week', 'month'] as const).map(level => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={`px-3 py-1 text-xs rounded font-medium capitalize ${
                  zoomLevel === level ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main scrollable area - SINGLE scroll container for everything */}
      <div 
        ref={mainScrollRef}
        className="flex-1 overflow-auto"
      >
        {/* Inner container with total width = left panel + timeline */}
        <div style={{ minWidth: LEFT_PANEL_WIDTH + TIMELINE_WIDTH }}>
          {/* Month header row */}
          <div className="flex border-b bg-indigo-50 sticky top-0 z-30">
            <div 
              className="border-r bg-indigo-50 flex-shrink-0 sticky left-0 z-40" 
              style={{ width: LEFT_PANEL_WIDTH, minWidth: LEFT_PANEL_WIDTH }}
            />
            <div className="flex" style={{ width: TIMELINE_WIDTH }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="text-xs font-semibold text-indigo-700 px-2 py-1 border-r border-indigo-200"
                  style={{ width: m.days * DAY_WIDTH }}
                >
                  {m.month}
                </div>
              ))}
            </div>
          </div>
          
          {/* Date header row */}
          <div className="flex border-b bg-gray-50 sticky top-[25px] z-30">
            <div 
              className="grid grid-cols-[1fr,70px,70px,55px,55px] items-center px-3 py-1 border-r bg-gray-50 font-medium text-[10px] text-gray-500 uppercase tracking-wide flex-shrink-0 sticky left-0 z-40"
              style={{ width: LEFT_PANEL_WIDTH, minWidth: LEFT_PANEL_WIDTH }}
            >
              <span>Task</span>
              <span className="text-center">Assignee</span>
              <span className="text-center">Status</span>
              <span className="text-center">Start</span>
              <span className="text-center">Due</span>
            </div>
            <div className="flex" style={{ width: TIMELINE_WIDTH }}>
              {dates.map((date, i) => {
                const isToday = date.toDateString() === today.toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isSunday = date.getDay() === 0;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center py-1 border-r transition-colors ${
                      isToday ? 'bg-amber-500 text-white font-bold' : 
                      isSunday ? 'bg-violet-100 text-violet-600' :
                      isWeekend ? 'bg-purple-50 text-purple-500' : 
                      'bg-sky-50 text-gray-600'
                    }`}
                    style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                  >
                    <span className={`text-[11px] ${isToday ? 'font-bold' : ''}`}>{date.getDate()}</span>
                    {zoomLevel !== 'month' && (
                      <span className="text-[9px]">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Task rows */}
          {tasksBySubProject.map(({ subProject, tasks: spTasks, progress }) => {
            const isCollapsed = collapsedSections.has(subProject.id);
            return (
              <div key={subProject.id}>
                {/* Sub-project header - clickable to collapse */}
                <div 
                  className="flex bg-gradient-to-r from-slate-100 to-slate-50 border-b cursor-pointer hover:from-slate-200 hover:to-slate-100 transition-colors"
                  onClick={() => toggleSection(subProject.id)}
                >
                  <div 
                    className="px-3 py-2 border-r bg-gradient-to-r from-slate-100 to-slate-50 flex-shrink-0 sticky left-0 z-20"
                    style={{ width: LEFT_PANEL_WIDTH, minWidth: LEFT_PANEL_WIDTH }}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                      <span className="text-sm">{subProject.organization?.emoji || '📁'}</span>
                      <span className="text-sm font-semibold text-gray-800 truncate">{subProject.name}</span>
                      <span className="text-[10px] text-gray-400">({spTasks.length})</span>
                      {/* Progress bar */}
                      <div className="flex-1" />
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                          style={{ width: `${progress}%` }} 
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 w-8 text-right">{progress}%</span>
                    </div>
                  </div>
                  {/* Timeline grid background for sub-project header */}
                  <div className="relative" style={{ width: TIMELINE_WIDTH }}>
                    {dates.map((date, i) => {
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isSunday = date.getDay() === 0;
                      const isToday = date.toDateString() === today.toDateString();
                      return (
                        <div
                          key={i}
                          className={`absolute top-0 bottom-0 border-r ${
                            isToday ? 'bg-amber-100/60' : 
                            isSunday ? 'bg-violet-100/40' :
                            isWeekend ? 'bg-purple-50/50' : 
                            'bg-sky-50/20 border-sky-100/30'
                          }`}
                          style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                        />
                      );
                    })}
                    {/* Today line on header too */}
                    {(() => {
                      const todayOffset = daysBefore - dateOffset;
                      if (todayOffset >= 0 && todayOffset < dates.length) {
                        return (
                          <div
                            className="absolute top-0 bottom-0 w-[2px] bg-amber-500 z-10"
                            style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 - 1 }}
                          />
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                
                {/* Tasks - collapsible */}
                {!isCollapsed && spTasks.map(task => {
                  const pos = getTaskPosition(task);
                  const isHovered = hoveredTaskId === task.id;
                  return (
                    <div 
                      key={task.id} 
                      className={`flex border-b transition-colors ${isHovered ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                      style={{ height: ROW_HEIGHT }}
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                    >
                      {/* Task info - sticky left column with columns */}
                      <div 
                        className={`grid grid-cols-[1fr,70px,70px,55px,55px] items-center px-3 border-r cursor-pointer flex-shrink-0 sticky left-0 z-20 ${
                          isHovered ? 'bg-indigo-50' : 'bg-white'
                        }`}
                        style={{ width: LEFT_PANEL_WIDTH, minWidth: LEFT_PANEL_WIDTH, height: ROW_HEIGHT }}
                        onClick={() => onSelectTask(task)}
                      >
                        {/* Task name */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[task.status]}`} />
                          <span className={`text-xs truncate ${isHovered ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>
                            {task.title}
                          </span>
                        </div>
                        
                        {/* Assignee */}
                        <div className="flex items-center justify-center">
                          {task.assignee ? (
                            <div className="flex items-center gap-1" title={task.assignee}>
                              <div className={`w-5 h-5 rounded-full ${getAvatarColor(task.assignee)} flex items-center justify-center text-white text-[8px] font-medium`}>
                                {getInitials(task.assignee)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-300">—</span>
                          )}
                        </div>
                        
                        {/* Status */}
                        <div className="flex items-center justify-center">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            task.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            task.status === 'blocked' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {task.status === 'in_progress' ? 'Active' : task.status === 'todo' ? 'To Do' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                          </span>
                        </div>
                        
                        {/* Start date */}
                        <div className="text-center">
                          <span className="text-[10px] text-gray-500">
                            {task.start_date ? new Date(task.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </span>
                        </div>
                        
                        {/* Due date */}
                        <div className="text-center">
                          <span className={`text-[10px] ${
                            task.due_date && new Date(task.due_date) < today && task.status !== 'done' 
                              ? 'text-red-500 font-medium' 
                              : 'text-gray-500'
                          }`}>
                            {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Timeline bar area */}
                      <div className="relative" style={{ width: TIMELINE_WIDTH, height: ROW_HEIGHT }}>
                        {/* Day grid lines with colored backgrounds */}
                        {dates.map((date, i) => {
                          const isToday = date.toDateString() === today.toDateString();
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          const isSunday = date.getDay() === 0;
                          return (
                            <div
                              key={i}
                              className={`absolute top-0 bottom-0 border-r ${
                                isToday ? 'bg-amber-100/80 border-amber-300' : 
                                isSunday ? 'bg-violet-100/50 border-violet-200' :
                                isWeekend ? 'bg-purple-50/60 border-purple-100' : 
                                'bg-sky-50/30 border-sky-100/50'
                              }`}
                              style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                            />
                          );
                        })}
                        
                        {/* Today line - prominent amber/orange line */}
                        {(() => {
                          const todayOffset = daysBefore - dateOffset;
                          if (todayOffset >= 0 && todayOffset < dates.length) {
                            return (
                              <div
                                className="absolute top-0 bottom-0 w-[2px] bg-amber-500 z-10 shadow-sm"
                                style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 - 1 }}
                              />
                            );
                          }
                          return null;
                        })()}
                        
                        {/* Task bar with resize handles */}
                        {pos && (
                          <div
                            className={`absolute top-1 rounded-md ${statusColors[task.status]} cursor-pointer transition-all group shadow-sm ${
                              isHovered ? 'ring-2 ring-indigo-400 ring-offset-1 shadow-md scale-[1.02]' : 'hover:shadow-md'
                            }`}
                            style={{
                              left: Math.max(0, pos.startOffset * DAY_WIDTH + 2),
                              width: Math.max(DAY_WIDTH - 4, pos.duration * DAY_WIDTH - 4),
                              height: ROW_HEIGHT - 10,
                            }}
                            onClick={() => onSelectTask(task)}
                            title={`${task.title}\n${task.start_date || 'No start'} → ${task.due_date || 'No due date'}\nStatus: ${task.status}`}
                          >
                            {/* Left resize handle */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-l"
                              onMouseDown={(e) => task.start_date && handleResizeStart(e, task.id, 'start', task.start_date)}
                            />
                            {/* Task title */}
                            <span className="text-[10px] text-white font-medium px-2 truncate block leading-[26px] drop-shadow-sm">
                              {task.title}
                            </span>
                            {/* Right resize handle */}
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-r"
                              onMouseDown={(e) => task.due_date && handleResizeStart(e, task.id, 'end', task.due_date)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          
          {tasksBySubProject.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              No tasks with dates to display. Add start/due dates to see them here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ MAIN APP ============
export default function App() {
  // Auth state
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CeoUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userOrgIds, setUserOrgIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<CeoUser[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [myTeamMembers, setMyTeamMembers] = useState<TeamMember[]>([]); // People I manage
  const [allTeamMembers, setAllTeamMembers] = useState<TeamMember[]>([]); // All manager->member relationships
  const [viewingAsUser, setViewingAsUser] = useState<CeoUser | null>(null); // Admin viewing another user's data
  const [viewingAsUserId, setViewingAsUserId] = useState<string | null>(() => {
    return localStorage.getItem('capy-ceo-viewing-as-user-id');
  });
  
  // State - persist view in localStorage
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem('capy-ceo-view');
    return (saved as View) || 'today';
  });
  const [calendarMode, setCalendarMode] = useState<'board' | '1day' | '3day' | 'week'>(() => {
    const saved = localStorage.getItem('capy-ceo-calendar-mode');
    return (saved as 'board' | '1day' | '3day' | 'week') || 'week';
  });
  
  // Sidebar collapse state
  const [projectsExpanded, setProjectsExpanded] = useState(() => {
    return localStorage.getItem('capy-ceo-projects-expanded') !== 'false';
  });
  const [orgsExpanded, setOrgsExpanded] = useState(() => {
    return localStorage.getItem('capy-ceo-orgs-expanded') !== 'false';
  });
  const [strategyExpanded, setStrategyExpanded] = useState(() => {
    return localStorage.getItem('capy-ceo-strategy-expanded') !== 'false';
  });
  const [strategySubView, setStrategySubView] = useState<StrategySubView>('plans-teams');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subProjects, setSubProjects] = useState<SubProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [modalType, setModalType] = useState<ModalType>('none');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => localStorage.getItem('capy-ceo-selected-project'));
  const [selectedSubProjectId, setSelectedSubProjectId] = useState<string | null>(() => localStorage.getItem('capy-ceo-selected-subproject'));
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => localStorage.getItem('capy-ceo-selected-org'));
  const [projectViewMode, setProjectViewMode] = useState<'cards' | 'timeline'>(() => (localStorage.getItem('capy-ceo-project-view-mode') as 'cards' | 'timeline') || 'cards');
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => localStorage.getItem('capy-ceo-hide-completed') === 'true');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [editingSubProject, setEditingSubProject] = useState<SubProject | null>(null);
  
  // Drag and drop state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedPlan, setDraggedPlan] = useState<DailyPlan | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ day: string; hour: number } | null>(null);
  
  // Live drag preview state (for smooth visual feedback)
  const [dragPreview, setDragPreview] = useState<{ day: string; startTime: string; endTime: string } | null>(null);
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartDay, setDragStartDay] = useState<string | null>(null);
  const didDragMoveRef = useRef(false); // Track if actual drag movement occurred
  
  // Resize state
  const [resizingPlan, setResizingPlan] = useState<DailyPlan | null>(null);
  const [resizeStartY, setResizeStartY] = useState<number>(0);
  const [resizeStartEndHour, setResizeStartEndHour] = useState<number>(0);

  // Derived - dynamic based on calendar mode
  const weekStart = startOfWeek(selectedDate);
  const displayDays = useMemo(() => {
    if (calendarMode === '1day') return [selectedDate];
    if (calendarMode === '3day') return Array.from({ length: 3 }, (_, i) => addDays(selectedDate, i));
    // week or board
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [calendarMode, selectedDate, weekStart]);
  const weekDays = displayDays; // Alias for compatibility
  const dateStr = formatDate(selectedDate, 'yyyy-MM-dd');
  
  // ============ PERSIST STATE TO LOCALSTORAGE ============
  useEffect(() => { localStorage.setItem('capy-ceo-view', view); }, [view]);
  useEffect(() => { localStorage.setItem('capy-ceo-calendar-mode', calendarMode); }, [calendarMode]);
  useEffect(() => { localStorage.setItem('capy-ceo-projects-expanded', String(projectsExpanded)); }, [projectsExpanded]);
  useEffect(() => { localStorage.setItem('capy-ceo-orgs-expanded', String(orgsExpanded)); }, [orgsExpanded]);
  useEffect(() => { localStorage.setItem('capy-ceo-strategy-expanded', String(strategyExpanded)); }, [strategyExpanded]);
  useEffect(() => { 
    if (selectedProjectId) localStorage.setItem('capy-ceo-selected-project', selectedProjectId);
    else localStorage.removeItem('capy-ceo-selected-project');
  }, [selectedProjectId]);
  useEffect(() => { 
    if (selectedSubProjectId) localStorage.setItem('capy-ceo-selected-subproject', selectedSubProjectId);
    else localStorage.removeItem('capy-ceo-selected-subproject');
  }, [selectedSubProjectId]);
  useEffect(() => { 
    if (selectedOrgId) localStorage.setItem('capy-ceo-selected-org', selectedOrgId);
    else localStorage.removeItem('capy-ceo-selected-org');
  }, [selectedOrgId]);
  useEffect(() => { 
    localStorage.setItem('capy-ceo-project-view-mode', projectViewMode);
  }, [projectViewMode]);
  useEffect(() => { 
    localStorage.setItem('capy-ceo-hide-completed', String(hideCompleted));
  }, [hideCompleted]);
  useEffect(() => { 
    if (viewingAsUserId) localStorage.setItem('capy-ceo-viewing-as-user-id', viewingAsUserId);
    else localStorage.removeItem('capy-ceo-viewing-as-user-id');
  }, [viewingAsUserId]);
  
  // Restore viewingAsUser from allUsers when they load
  useEffect(() => {
    if (viewingAsUserId && allUsers.length > 0 && !viewingAsUser) {
      const user = allUsers.find(u => u.id === viewingAsUserId);
      if (user) setViewingAsUser(user);
    }
  }, [viewingAsUserId, allUsers, viewingAsUser]);
  
  // ============ AUTH EFFECTS ============
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        handleUserLogin(session.user);
      } else {
        setAuthLoading(false);
      }
    }).catch((err) => {
      console.error('Error getting session:', err);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && session?.user) {
        handleUserLogin(session.user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUserOrgIds([]);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
  
  const handleUserLogin = async (authUser: any) => {
    try {
      const ceoUser = await createOrUpdateUser(authUser);
      setCurrentUser(ceoUser);
      
      // Load user's org memberships
      if (ceoUser.role !== 'admin') {
        const orgIds = await fetchUserOrgIds(ceoUser.id);
        setUserOrgIds(orgIds);
      }
      
      // Load all users, org members, and team members
      const [users, members, myTeam, allTeams] = await Promise.all([
        fetchAllUsers(),
        fetchOrgMembers(),
        fetchTeamMembers(ceoUser.id),
        ceoUser.role === 'admin' ? fetchAllTeamMembers() : Promise.resolve([])
      ]);
      setAllUsers(users);
      setOrgMembers(members);
      setMyTeamMembers(myTeam);
      setAllTeamMembers(allTeams);
    } catch (err) {
      console.error('Error setting up user:', err);
    } finally {
      setAuthLoading(false);
    }
  };
  
  const handleSignOut = async () => {
    await signOut();
    setCurrentUser(null);
    setSession(null);
  };
  
  // Check if user is admin (must be after currentUser state is set up)
  const isAdmin = currentUser?.role === 'admin';
  
  // Refresh admin data
  const refreshAdminData = useCallback(async () => {
    if (!currentUser) return;
    const [users, members, myTeam, allTeams] = await Promise.all([
      fetchAllUsers(),
      fetchOrgMembers(),
      fetchTeamMembers(currentUser.id),
      currentUser.role === 'admin' ? fetchAllTeamMembers() : Promise.resolve([])
    ]);
    setAllUsers(users);
    setOrgMembers(members);
    setMyTeamMembers(myTeam);
    setAllTeamMembers(allTeams);
  }, [currentUser]);
  
  // NOTE: visibleDailyPlans, todayPlans, myTasks, backlogTasks moved below visibleTasks definition

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDailyPlans();
  }, [dateStr]);

  // Resize effect - track mouse movement during resize (15-min increments)
  useEffect(() => {
    if (!resizingPlan) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - resizeStartY;
      // 64px per hour, snap to 5-minute increments
      const deltaMinutes = Math.round(deltaY / 64 * 60 / 5) * 5;
      
      // Calculate new end time
      const startTime = resizingPlan.start_time || '09:00';
      const [startH, startM] = startTime.split(':').map(Number);
      const startTotalMins = startH * 60 + startM;
      const originalEndMins = resizeStartEndHour * 60;
      const newEndMins = Math.max(startTotalMins + 15, Math.min(22 * 60, originalEndMins + deltaMinutes));
      
      const newEndH = Math.floor(newEndMins / 60);
      const newEndM = newEndMins % 60;
      const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;
      
      // Update local state for visual feedback
      setDailyPlans(prev => prev.map(p => 
        p.id === resizingPlan.id 
          ? { ...p, end_time: newEndTime }
          : p
      ));
    };
    
    const handleEnd = async () => {
      // Save the final end_time to database and sync task duration
      const plan = dailyPlans.find(p => p.id === resizingPlan.id);
      if (plan && plan.start_time && plan.end_time) {
        try {
          await upsertDailyPlan({
            id: plan.id,
            task_id: plan.task_id,
            plan_date: plan.plan_date,
            user_id: plan.user_id || 'james',
            start_time: plan.start_time,
            end_time: plan.end_time,
            completed: plan.completed,
          });
          
          // Calculate duration and sync to task
          const [startH, startM] = plan.start_time.split(':').map(Number);
          const [endH, endM] = plan.end_time.split(':').map(Number);
          const durationMins = (endH * 60 + endM) - (startH * 60 + startM);
          
          await upsertTask({ 
            id: plan.task_id, 
            estimated_minutes: durationMins 
          });
          setTasks(prev => prev.map(t => t.id === plan.task_id ? { 
            ...t, 
            estimated_minutes: durationMins 
          } : t));
        } catch (err) {
          console.error('Failed to save resize:', err);
        }
      }
      setResizingPlan(null);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [resizingPlan, resizeStartY, resizeStartEndHour, dailyPlans]);

  // Live drag effect - track mouse movement when dragging a calendar block
  useEffect(() => {
    if (!isDraggingBlock || !draggedPlan) return;
    
    const handleMove = (e: MouseEvent) => {
      // Find which day column the mouse is over
      const dayColumns = document.querySelectorAll('[data-day-column]');
      let targetDay: string | null = null;
      let targetTime: number | null = null;
      
      dayColumns.forEach(col => {
        const rect = col.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          targetDay = col.getAttribute('data-day-column');
          // Calculate time based on Y position (64px per hour, starting at 7am)
          const relativeY = e.clientY - rect.top;
          const totalMinutes = Math.floor(relativeY / 64 * 60 / 5) * 5 + (7 * 60); // 5-min snap
          targetTime = Math.max(7 * 60, Math.min(22 * 60, totalMinutes));
        }
      });
      
      if (targetDay && targetTime !== null) {
        didDragMoveRef.current = true; // Mark that actual drag movement occurred
        const startH = Math.floor(targetTime / 60);
        const startM = targetTime % 60;
        const duration = draggedPlan.end_time && draggedPlan.start_time
          ? (parseInt(draggedPlan.end_time.split(':')[0]) * 60 + parseInt(draggedPlan.end_time.split(':')[1] || '0')) -
            (parseInt(draggedPlan.start_time.split(':')[0]) * 60 + parseInt(draggedPlan.start_time.split(':')[1] || '0'))
          : 60;
        const endTime = targetTime + duration;
        const endH = Math.floor(endTime / 60);
        const endM = endTime % 60;
        
        setDragPreview({
          day: targetDay,
          startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
          endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        });
      }
    };
    
    const handleEnd = async (e: MouseEvent) => {
      if (dragPreview && draggedPlan) {
        try {
          // Save the new position
          await upsertDailyPlan({
            id: draggedPlan.id,
            task_id: draggedPlan.task_id,
            plan_date: dragPreview.day,
            user_id: draggedPlan.user_id || 'james',
            start_time: dragPreview.startTime,
            end_time: dragPreview.endTime,
            completed: draggedPlan.completed,
          });
          
          // Update local state
          setDailyPlans(prev => prev.map(p => 
            p.id === draggedPlan.id 
              ? { ...p, plan_date: dragPreview.day, start_time: dragPreview.startTime, end_time: dragPreview.endTime }
              : p
          ));
          
          // Also sync to task
          const [startH, startM] = dragPreview.startTime.split(':').map(Number);
          const [endH, endM] = dragPreview.endTime.split(':').map(Number);
          const durationMins = (endH * 60 + endM) - (startH * 60 + startM);
          
          await upsertTask({
            id: draggedPlan.task_id,
            due_date: dragPreview.day,
            start_time: dragPreview.startTime,
            estimated_minutes: durationMins,
          });
          
          setTasks(prev => prev.map(t => 
            t.id === draggedPlan.task_id 
              ? { ...t, due_date: dragPreview.day, start_time: dragPreview.startTime, estimated_minutes: durationMins }
              : t
          ));
        } catch (err) {
          console.error('Failed to move block:', err);
        }
      } else if (!didDragMoveRef.current && draggedPlan?.task) {
        // No actual drag movement occurred - treat as a click to open task detail
        setSelectedTask(draggedPlan.task);
      }
      
      setIsDraggingBlock(false);
      setDraggedPlan(null);
      setDraggedTask(null);
      setDragPreview(null);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
    };
  }, [isDraggingBlock, draggedPlan, dragPreview]);

  async function loadData() {
    setLoading(true);
    try {
      const [orgs, projs, subs, tsks] = await Promise.all([
        fetchOrganizations(),
        fetchProjects(),
        fetchSubProjects(),
        fetchTasks(),
      ]);
      setOrganizations(orgs);
      setProjects(projs);
      setSubProjects(subs);
      setTasks(tsks);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDailyPlans() {
    try {
      // Load plans for all days in the visible week
      const allPlans: DailyPlan[] = [];
      for (const day of weekDays) {
        const dayStr = formatDate(day, 'yyyy-MM-dd');
        const plans = await fetchDailyPlans(dayStr);
        allPlans.push(...plans);
      }
      setDailyPlans(allPlans);
    } catch (err) {
      console.error('Failed to load daily plans:', err);
    }
  }
  
  // ============ ACCESS FILTERING ============
  // Admins see everything, regular users see only their assigned orgs
  const visibleOrganizations = useMemo(() => {
    if (isAdmin) return organizations;
    return organizations.filter(org => userOrgIds.includes(org.id));
  }, [organizations, userOrgIds, isAdmin]);
  
  const visibleSubProjects = useMemo(() => {
    if (isAdmin) return subProjects;
    const visibleOrgIds = new Set(visibleOrganizations.map(o => o.id));
    return subProjects.filter(sp => visibleOrgIds.has(sp.organization_id));
  }, [subProjects, visibleOrganizations, isAdmin]);
  
  const visibleProjects = useMemo(() => {
    if (isAdmin) return projects;
    // Show projects that have at least one visible subproject
    const projectIdsWithVisibleSubprojects = new Set(visibleSubProjects.map(sp => sp.project_id));
    return projects.filter(p => projectIdsWithVisibleSubprojects.has(p.id));
  }, [projects, visibleSubProjects, isAdmin]);
  
  const visibleTasks = useMemo(() => {
    if (isAdmin) return tasks;
    const visibleSubProjectIds = new Set(visibleSubProjects.map(sp => sp.id));
    return tasks.filter(t => visibleSubProjectIds.has(t.sub_project_id || ''));
  }, [tasks, visibleSubProjects, isAdmin]);

  // myTasks - for daily planning, show tasks assigned to current user (or viewingAsUser for admins)
  const effectiveUser = viewingAsUser || currentUser;
  const myTasks = useMemo(() => {
    if (!effectiveUser) return [];
    return visibleTasks.filter(t => 
      t.assigned_to_user_id === effectiveUser.id ||
      t.assignee?.toLowerCase() === effectiveUser.display_name?.toLowerCase() ||
      t.assignee?.toLowerCase() === effectiveUser.email?.split('@')[0].toLowerCase()
    );
  }, [visibleTasks, effectiveUser]);

  // Filter daily plans to only show plans for MY tasks (respects viewingAsUser)
  const visibleDailyPlans = useMemo(() => {
    const myTaskIds = new Set(myTasks.map(t => t.id));
    return dailyPlans.filter(p => myTaskIds.has(p.task_id));
  }, [dailyPlans, myTasks]);

  const todayPlans = useMemo(() => {
    return visibleDailyPlans.filter(p => p.plan_date === dateStr);
  }, [visibleDailyPlans, dateStr]);

  const backlogTasks = useMemo(() => {
    // Show ALL tasks assigned to current user that are not completed
    return myTasks.filter(t => t.status !== 'done');
  }, [myTasks]);

  // Tasks that are NOT scheduled in any daily plan (for the calendar sidebar)
  const unscheduledTasks = useMemo(() => {
    const allPlannedTaskIds = new Set(visibleDailyPlans.map(p => p.task_id));
    return myTasks.filter(t => !allPlannedTaskIds.has(t.id) && t.status !== 'done');
  }, [myTasks, visibleDailyPlans]);

  // ============ CRUD HANDLERS ============
  
  // Organizations
  async function handleCreateOrg(data: { name: string; emoji: string; color: string; description: string }) {
    const id = generateId('org');
    const org = await upsertOrganization({
      id,
      name: data.name,
      emoji: data.emoji || '🏢',
      color: data.color || 'emerald',
      description: data.description,
      sort_order: organizations.length,
    });
    setOrganizations(prev => [...prev, org]);
    
    // Auto-add creator as member of the new org
    if (currentUser) {
      await addOrgMember(id, currentUser.id);
      setOrgMembers(prev => [...prev, { organization_id: id, user_id: currentUser.id }]);
    }
    
    setModalType('none');
  }

  async function handleDeleteOrg(id: string) {
    if (!confirm('Delete this organization? All linked sub-projects and tasks will be deleted.')) return;
    const { error } = await supabase.from('ceo_sandbox_organizations').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    setOrganizations(prev => prev.filter(o => o.id !== id));
    setSubProjects(prev => prev.filter(sp => sp.organization_id !== id));
  }

  // Projects
  async function handleCreateProject(data: { name: string; description: string }) {
    const id = generateId('proj');
    const project = await upsertProject({
      id,
      name: data.name,
      description: data.description,
      status: 'active',
      sort_order: projects.length,
    });
    setProjects(prev => [...prev, project]);
    setModalType('none');
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('Delete this project? All sub-projects and tasks will be deleted.')) return;
    const { error } = await supabase.from('ceo_sandbox_projects').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    setProjects(prev => prev.filter(p => p.id !== id));
    setSubProjects(prev => prev.filter(sp => sp.project_id !== id));
  }

  // Sub-Projects (assign org to project)
  async function handleCreateSubProject(data: { projectId: string; organizationId: string; name: string }) {
    const id = generateId('subproj');
    try {
      const sp = await upsertSubProject({
        id,
        project_id: data.projectId,
        organization_id: data.organizationId || null,
        name: data.name,
        status: 'active',
        sort_order: 0,
      });
      // Reload to get joined data
      const subs = await fetchSubProjects();
      setSubProjects(subs);
      setModalType('none');
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        alert('This organization is already assigned to this project!');
      } else {
        alert('Error: ' + err.message);
      }
    }
  }

  async function handleDeleteSubProject(id: string) {
    if (!confirm('Delete this sub-project? All tasks under it will be deleted.')) return;
    const { error } = await supabase.from('ceo_sandbox_subprojects').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    setSubProjects(prev => prev.filter(sp => sp.id !== id));
    // If viewing this sub-project, go back to projects view
    if (selectedSubProjectId === id) {
      setSelectedSubProjectId(null);
      setView('projects');
    }
  }

  async function handleUpdateSubProject(id: string, updates: { name?: string; organization_id?: string | null }) {
    const { error } = await supabase.from('ceo_sandbox_subprojects').update(updates).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    setSubProjects(prev => prev.map(sp => {
      if (sp.id !== id) return sp;
      const updatedSp = { ...sp, ...updates };
      // Update linked organization if changed
      if (updates.organization_id !== undefined) {
        updatedSp.organization = organizations.find(o => o.id === updates.organization_id) || null;
      }
      return updatedSp;
    }));
    setEditingSubProject(null);
  }

  // Reorder sub-projects (for drag-and-drop)
  async function handleReorderSubProjects(projectId: string, reorderedIds: string[]) {
    // Update sort_order in database for each sub-project
    const updates = reorderedIds.map((id, index) => 
      supabase.from('ceo_sandbox_subprojects').update({ sort_order: index }).eq('id', id)
    );
    await Promise.all(updates);
    
    // Update local state
    setSubProjects(prev => {
      const projectSps = prev.filter(sp => sp.project_id === projectId);
      const otherSps = prev.filter(sp => sp.project_id !== projectId);
      const reordered = reorderedIds.map((id, index) => {
        const sp = projectSps.find(s => s.id === id);
        return sp ? { ...sp, sort_order: index } : null;
      }).filter(Boolean) as SubProject[];
      return [...otherSps, ...reordered].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    });
  }

  // Tasks
  async function handleCreateTask(data: { 
    subProjectId: string; 
    title: string; 
    description: string; 
    priority: string;
    dueDate?: string;
    assigneeUserId?: string;
    assigneeName?: string;
  }) {
    const id = generateId('task');
    const task = await upsertTask({
      id,
      sub_project_id: data.subProjectId,
      title: data.title,
      description: data.description,
      priority: data.priority as 'high' | 'medium' | 'low',
      status: 'todo',
      sort_order: tasks.length,
      due_date: data.dueDate || null,
      assigned_to_user_id: data.assigneeUserId || null,
      assignee: data.assigneeName || null,
    });
    // Reload to get joined data
    const tsks = await fetchTasks();
    setTasks(tsks);
    setModalType('none');
  }

  async function handleToggleTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await upsertTask({ id: taskId, status: newStatus });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    
    // Also update in daily plans if present
    setDailyPlans(prev => prev.map(p => 
      p.task_id === taskId && p.task 
        ? { ...p, task: { ...p.task, status: newStatus } }
        : p
    ));
  }

  async function handleUpdateTask(updatedTask: Partial<Task> & { id: string }) {
    await upsertTask(updatedTask);
    const refreshedTasks = await fetchTasks();
    setTasks(refreshedTasks);
    
    // Auto-create calendar entry if due_date and start_time are set
    if (updatedTask.due_date && updatedTask.start_time) {
      const task = refreshedTasks.find(t => t.id === updatedTask.id);
      const durationMins = task?.estimated_minutes || 60;
      
      // Parse start time and calculate end time
      const [startH, startM] = updatedTask.start_time.split(':').map(Number);
      const endMins = startH * 60 + startM + durationMins;
      const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
      
      // Check if plan already exists for this task on this date
      const existingPlan = dailyPlans.find(p => p.task_id === updatedTask.id && p.plan_date === updatedTask.due_date);
      
      try {
        await upsertDailyPlan({
          id: existingPlan?.id, // Update existing or create new
          task_id: updatedTask.id,
          plan_date: updatedTask.due_date,
          user_id: 'james',
          start_time: updatedTask.start_time,
          end_time: endTime,
          completed: existingPlan?.completed || false,
        });
        await loadDailyPlans();
      } catch (err) {
        console.error('Failed to create calendar entry:', err);
      }
    }
    
    setSelectedTask(null);
  }

  async function handleDeleteTask(id: string) {
    if (!confirm('Delete this task?')) return;
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setDailyPlans(prev => prev.filter(p => p.task_id !== id));
  }

  // Daily Planning
  async function handlePlanTask(taskId: string, startTime: string) {
    const endHour = parseInt(startTime.split(':')[0]) + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;
    
    try {
      await upsertDailyPlan({
        task_id: taskId,
        plan_date: dateStr,
        user_id: 'james',
        start_time: startTime,
        end_time: endTime,
        completed: false,
      });
      await loadDailyPlans();
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        alert('This task is already planned for today!');
      } else {
        alert('Error: ' + err.message);
      }
    }
  }

  async function handleUnplanTask(planId: string) {
    await deleteDailyPlan(planId);
    setDailyPlans(prev => prev.filter(p => p.id !== planId));
  }

  async function handleTogglePlanComplete(planId: string) {
    const plan = dailyPlans.find(p => p.id === planId);
    if (!plan) return;
    
    await upsertDailyPlan({
      ...plan,
      completed: !plan.completed,
    });
    setDailyPlans(prev => prev.map(p => 
      p.id === planId ? { ...p, completed: !p.completed } : p
    ));
  }

  // Handle drag and drop onto calendar (with full time string for 15-min precision)
  async function handleDropOnCalendarWithTime(dayStr: string, startTime: string, taskId: string) {
    if (!taskId) return;
    
    // Calculate end time (default 1 hour duration)
    const [startH, startM] = startTime.split(':').map(Number);
    const endMins = startH * 60 + startM + 60; // +60 mins default
    const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
    
    // Clear state
    setDraggedTask(null);
    setHoveredSlot(null);
    
    try {
      // Create the daily plan and get the returned data
      const newPlan = await upsertDailyPlan({
        task_id: taskId,
        plan_date: dayStr,
        user_id: 'james',
        start_time: startTime,
        end_time: endTime,
        completed: false,
      });
      
      // Also update the task to match the scheduled date/time/duration
      const durationMins = 60; // default 1 hour
      const existingTask = tasks.find(t => t.id === taskId);
      if (existingTask) {
        // Strip nested objects before upserting
        const { sub_project, ...taskData } = existingTask;
        await upsertTask({ 
          ...taskData,
          due_date: dayStr,
          start_time: startTime,
          estimated_minutes: durationMins
        });
        
        // Optimistically add plan to state immediately (with task data)
        const planWithTask = { ...newPlan, task: { ...existingTask, due_date: dayStr, start_time: startTime, estimated_minutes: durationMins } };
        setDailyPlans(prev => [...prev.filter(p => p.task_id !== taskId || p.plan_date !== dayStr), planWithTask]);
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        due_date: dayStr,
        start_time: startTime,
        estimated_minutes: durationMins
      } : t));
      
      // Also reload to ensure consistency
      await loadDailyPlans();
    } catch (err: any) {
      console.error('Drop failed:', err);
      if (err.message?.includes('duplicate') || err.code === '23505') {
        alert('This task is already planned for this day!');
      } else {
        alert('Error scheduling task: ' + err.message);
      }
    }
  }

  // ============ LOGIN SCREEN ============
  const LoginScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-700 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🦫</div>
          <h1 className="text-2xl font-bold text-white mb-2">Capy Command</h1>
          <p className="text-slate-400">Your CEO Command Center</p>
        </div>
        
        <button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
        
        <p className="text-center text-slate-500 text-sm mt-6">
          Sign in with your work Google account to get started.
        </p>
      </div>
    </div>
  );
  
  // ============ ADMIN PANEL ============
  const AdminPanel = () => {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [showAddTeamMember, setShowAddTeamMember] = useState<string | null>(null); // userId for whom we're adding
    
    const handleToggleOrgMembership = async (orgId: string, userId: string) => {
      const existing = orgMembers.find(m => m.organization_id === orgId && m.user_id === userId);
      try {
        if (existing) {
          await removeOrgMember(orgId, userId);
        } else {
          await addOrgMember(orgId, userId);
        }
        await refreshAdminData();
      } catch (err) {
        console.error('Failed to update org membership:', err);
      }
    };
    
    const handleToggleAdmin = async (userId: string, currentRole: string) => {
      try {
        await updateUserRole(userId, currentRole === 'admin' ? 'member' : 'admin');
        await refreshAdminData();
      } catch (err) {
        console.error('Failed to update user role:', err);
      }
    };
    
    const getUserOrgIds = (userId: string) => {
      return orgMembers.filter(m => m.user_id === userId).map(m => m.organization_id);
    };
    
    // Get team members for a specific manager
    const getTeamMembersFor = (managerId: string) => {
      return allTeamMembers
        .filter(tm => tm.manager_id === managerId)
        .map(tm => allUsers.find(u => u.id === tm.member_id))
        .filter(Boolean) as CeoUser[];
    };
    
    // Get users available to add as team members (not already managed by this user)
    const getAvailableTeamMembers = (managerId: string) => {
      const currentTeamIds = allTeamMembers.filter(tm => tm.manager_id === managerId).map(tm => tm.member_id);
      return allUsers.filter(u => u.id !== managerId && !currentTeamIds.includes(u.id));
    };
    
    const handleAddTeamMember = async (managerId: string, memberId: string) => {
      try {
        await addTeamMember(managerId, memberId);
        await refreshAdminData();
        setShowAddTeamMember(null);
      } catch (err) {
        console.error('Failed to add team member:', err);
      }
    };
    
    const handleRemoveTeamMember = async (managerId: string, memberId: string) => {
      try {
        await removeTeamMember(managerId, memberId);
        await refreshAdminData();
      } catch (err) {
        console.error('Failed to remove team member:', err);
      }
    };
    
    return (
      <div className="flex-1 bg-slate-50 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 z-10 p-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
          </div>
          <p className="text-slate-500 mt-1">Manage users and organization access</p>
        </div>
        
        <div className="p-6 max-w-4xl">
          {/* Users Section */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-600" />
                <h2 className="font-semibold text-slate-900">Team Members</h2>
                <span className="text-sm text-slate-500">({allUsers.length})</span>
              </div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {allUsers.map(user => {
                const userOrgs = getUserOrgIds(user.id);
                const isExpanded = selectedUserId === user.id;
                
                return (
                  <div key={user.id} className="p-4">
                    <div 
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => setSelectedUserId(isExpanded ? null : user.id)}
                    >
                      {/* Avatar */}
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-medium">
                          {user.display_name?.charAt(0) || user.email.charAt(0)}
                        </div>
                      )}
                      
                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{user.display_name || user.email}</span>
                          {user.role === 'admin' && (
                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Admin</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                      
                      {/* Org count */}
                      <div className="text-sm text-slate-500">
                        {user.role === 'admin' ? 'All orgs' : `${userOrgs.length} org${userOrgs.length !== 1 ? 's' : ''}`}
                      </div>
                      
                      <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                    
                    {/* Expanded - Org assignments */}
                    {isExpanded && (
                      <div className="mt-4 ml-13 space-y-3">
                        {/* Admin toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-700">Admin Access</p>
                            <p className="text-sm text-slate-500">Full access to all organizations</p>
                          </div>
                          <button
                            onClick={() => handleToggleAdmin(user.id, user.role)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              user.role === 'admin'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {user.role === 'admin' ? 'Admin' : 'Member'}
                          </button>
                        </div>
                        
                        {/* Team Members (who this person manages) */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700">Team Members (manages)</p>
                            <button
                              onClick={() => setShowAddTeamMember(user.id)}
                              className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                            >
                              + Add
                            </button>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {getTeamMembersFor(user.id).map(member => (
                              <div key={member.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                                <div className="flex items-center gap-2">
                                  {member.avatar_url ? (
                                    <img src={member.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs">
                                      {member.display_name?.charAt(0) || member.email.charAt(0)}
                                    </div>
                                  )}
                                  <span className="text-slate-700">{member.display_name || member.email}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveTeamMember(user.id, member.id)}
                                  className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            {getTeamMembersFor(user.id).length === 0 && (
                              <div className="p-3 text-sm text-slate-400 text-center">
                                No team members assigned
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Org assignments (only show if not admin) */}
                        {user.role !== 'admin' && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-200">
                              <p className="text-sm font-medium text-slate-700">Organization Access</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {organizations.map(org => {
                                const hasAccess = userOrgs.includes(org.id);
                                return (
                                  <div key={org.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                                    <div className="flex items-center gap-2">
                                      <span>{org.emoji}</span>
                                      <span className="text-slate-700">{org.name}</span>
                                    </div>
                                    <button
                                      onClick={() => handleToggleOrgMembership(org.id, user.id)}
                                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                        hasAccess
                                          ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700'
                                          : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                                      }`}
                                    >
                                      {hasAccess ? 'Remove' : 'Add'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Add Team Member Modal */}
                    {showAddTeamMember === user.id && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddTeamMember(null)}>
                        <div className="bg-white rounded-xl p-4 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                          <h3 className="font-semibold text-slate-900 mb-3">Add team member for {user.display_name || user.email}</h3>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {getAvailableTeamMembers(user.id).map(member => (
                              <button
                                key={member.id}
                                onClick={() => handleAddTeamMember(user.id, member.id)}
                                className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded text-left"
                              >
                                {member.avatar_url ? (
                                  <img src={member.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs">
                                    {member.display_name?.charAt(0) || member.email.charAt(0)}
                                  </div>
                                )}
                                <span className="text-sm text-slate-700">{member.display_name || member.email}</span>
                              </button>
                            ))}
                            {getAvailableTeamMembers(user.id).length === 0 && (
                              <p className="text-sm text-slate-400 text-center py-2">No more users to add</p>
                            )}
                          </div>
                          <button
                            onClick={() => setShowAddTeamMember(null)}
                            className="mt-3 w-full py-2 text-sm text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {allUsers.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No users yet</p>
                  <p className="text-sm mt-1">Users will appear here once they sign in</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Invite hint */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <UserPlus className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Invite Team Members</p>
                <p className="text-sm text-blue-700 mt-1">
                  Share the app URL with your team. When they sign in with Google, they'll appear here.
                  Then you can assign them to specific organizations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ MODAL COMPONENT ============
  const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );

  // ============ FORM COMPONENTS ============
  const OrgForm = () => {
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('🏢');
    const [color, setColor] = useState('emerald');
    const [description, setDescription] = useState('');
    
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleCreateOrg({ name, emoji, color, description }); }}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Emoji</label>
              <select
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Color</label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team do?"
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Organization
          </button>
        </div>
      </form>
    );
  };

  const ProjectForm = () => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleCreateProject({ name, description }); }}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Spring Collection Launch"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Project
          </button>
        </div>
      </form>
    );
  };

  const SubProjectForm = () => {
    const [name, setName] = useState('');
    const [projectId, setProjectId] = useState(selectedProjectId || '');
    const [organizationId, setOrganizationId] = useState('');
    const [assignee, setAssignee] = useState('');
    
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleCreateSubProject({ projectId, organizationId, name }); }}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Sub-project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Tasks, Social Media Content"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.emoji || '📁'} {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Link to Organization</label>
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">None (optional)</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>
                  {o.emoji} {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Assign to Person</label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="e.g., James, Chia Yee"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || !projectId}
            className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Sub-project
          </button>
        </div>
      </form>
    );
  };

  const TaskForm = () => {
    const [subProjectId, setSubProjectId] = useState(selectedSubProjectId || '');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');
    const [assigneeUserId, setAssigneeUserId] = useState('');
    
    // Group sub-projects by project for better UX
    const groupedSubProjects = useMemo(() => {
      const groups: Record<string, SubProject[]> = {};
      subProjects.forEach(sp => {
        const projName = sp.project?.name || 'Unknown';
        if (!groups[projName]) groups[projName] = [];
        groups[projName].push(sp);
      });
      return groups;
    }, [subProjects]);
    
    // Get org members for the selected sub-project
    const selectedSp = subProjects.find(sp => sp.id === subProjectId);
    const selectedOrgId = selectedSp?.organization_id;
    const orgUserIds = selectedOrgId ? orgMembers.filter(m => m.organization_id === selectedOrgId).map(m => m.user_id) : [];
    const availableAssignees = allUsers.filter(u => orgUserIds.includes(u.id));
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const assignee = assigneeUserId ? allUsers.find(u => u.id === assigneeUserId) : null;
      handleCreateTask({ 
        subProjectId, 
        title, 
        description, 
        priority,
        dueDate: dueDate || undefined,
        assigneeUserId: assigneeUserId || undefined,
        assigneeName: assignee?.display_name || assignee?.email?.split('@')[0] || undefined,
      });
    };
    
    return (
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Design hero banner"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project & Team *</label>
            <select
              value={subProjectId}
              onChange={(e) => setSubProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="">Select where this task belongs...</option>
              {Object.entries(groupedSubProjects).map(([projName, sps]) => (
                <optgroup key={projName} label={projName}>
                  {sps.map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.organization?.emoji} {sp.organization?.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {subProjects.length === 0 && (
              <p className="mt-1 text-xs text-amber-400">
                ⚠️ No sub-projects yet. First assign an organization to a project.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Assignee</label>
              <select
                value={assigneeUserId}
                onChange={(e) => setAssigneeUserId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                disabled={!subProjectId}
              >
                <option value="">Unassigned</option>
                {availableAssignees.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.email?.split('@')[0]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!title.trim() || !subProjectId}
            className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Task
          </button>
        </div>
      </form>
    );
  };

  // ============ TASK EDIT MODAL (Asana-style) ============
  const TaskEditModal = ({ task, onClose, onSave, onDelete }: { 
    task: Task; 
    onClose: () => void; 
    onSave: (task: Partial<Task> & { id: string }) => void; 
    onDelete: (id: string) => void; 
  }) => {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [status, setStatus] = useState(task.status || 'todo');
    const [priority, setPriority] = useState(task.priority || 'medium');
    const [dueDate, setDueDate] = useState(task.due_date || '');
    const [startTime, setStartTime] = useState(task.start_time || '');
    const [assignedUserId, setAssignedUserId] = useState(task.assigned_to_user_id || '');
    const [assignee, setAssignee] = useState(task.assignee || '');
    const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes || 30);
    const [showDelete, setShowDelete] = useState(false);
    
    // Get users assigned to this task's organization
    const taskSubProject = subProjects.find(sp => sp.id === task.sub_project_id);
    const taskOrgId = taskSubProject?.organization_id;
    const orgUserIds = taskOrgId ? orgMembers.filter(m => m.organization_id === taskOrgId).map(m => m.user_id) : [];
    const orgUsers = allUsers.filter(u => orgUserIds.includes(u.id));

    const statusOptions = [
      { value: 'todo', label: 'To Do', icon: <Circle className="w-4 h-4 text-slate-400" /> },
      { value: 'in_progress', label: 'In Progress', icon: <Clock className="w-4 h-4 text-blue-400" /> },
      { value: 'done', label: 'Done', icon: <Check className="w-4 h-4 text-emerald-400" /> },
      { value: 'blocked', label: 'Blocked', icon: <AlertCircle className="w-4 h-4 text-red-400" /> },
    ];

    const handleSave = () => {
      // Preserve required fields and update changed ones
      onSave({
        id: task.id,
        sub_project_id: task.sub_project_id, // Keep required field
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate || null,
        start_time: startTime || null,
        assigned_to_user_id: assignedUserId || null,
        assignee: assignee || null,
        estimated_minutes: estimatedMinutes,
      });
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-slate-900 rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <span className="font-semibold text-white">Edit Task</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSave}
                disabled={!title.trim()}
                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showDelete ? (
            <div className="p-5 space-y-4">
              <p className="text-slate-300 text-center">Delete this task?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDelete(false)} className="flex-1 py-2 text-slate-300 bg-slate-800 rounded-lg">Cancel</button>
                <button onClick={() => { onDelete(task.id); onClose(); }} className="flex-1 py-2 bg-red-600 text-white rounded-lg">Delete</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Task name"
                  className="w-full text-lg font-medium text-white bg-transparent border-none outline-none placeholder-slate-500"
                  autoFocus
                />
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                <span className="text-sm text-slate-400 w-20">Status</span>
                <div className="flex gap-2">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        status === opt.value 
                          ? 'bg-slate-700 text-white' 
                          : 'text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                <span className="text-sm text-slate-400 w-20">Priority</span>
                <div className="flex gap-2">
                  {['high', 'medium', 'low'].map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        priority === p 
                          ? 'bg-slate-700 text-white' 
                          : 'text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <Flag className={`w-3 h-3 ${p === 'high' ? 'text-red-400' : p === 'medium' ? 'text-yellow-400' : 'text-slate-500'}`} />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time (for time blocking) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <label className="text-sm text-slate-400 block mb-2">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <label className="text-sm text-slate-400 block mb-2">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="p-3 bg-slate-800 rounded-lg">
                <label className="text-sm text-slate-400 block mb-2">Estimated Duration</label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      onClick={() => setEstimatedMinutes(mins)}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        estimatedMinutes === mins 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500' 
                          : 'bg-slate-900 text-slate-400 border border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee */}
              <div className="p-3 bg-slate-800 rounded-lg">
                <label className="text-sm text-slate-400 block mb-2">Assignee</label>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <select
                    value={assignedUserId}
                    onChange={e => {
                      const userId = e.target.value || '';
                      const user = allUsers.find(u => u.id === userId);
                      setAssignedUserId(userId);
                      setAssignee(user?.display_name || user?.email?.split('@')[0] || '');
                    }}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {orgUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.display_name || user.email?.split('@')[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 bg-slate-800 rounded-lg">
                <label className="text-sm text-slate-400 block mb-2">Notes</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add notes..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Delete */}
              <button 
                onClick={() => setShowDelete(true)}
                className="w-full py-2 text-red-400 text-sm hover:bg-red-500/10 rounded-lg"
              >
                Delete Task
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============ SUB-PROJECT EDIT MODAL ============
  const SubProjectEditModal = ({ subProject, onClose }: { subProject: SubProject; onClose: () => void }) => {
    const [name, setName] = useState(subProject.name);
    const [organizationId, setOrganizationId] = useState(subProject.organization_id || '');

    const handleSave = () => {
      if (!name.trim()) return;
      handleUpdateSubProject(subProject.id, { 
        name: name.trim(), 
        organization_id: organizationId || null 
      });
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-slate-800 rounded-xl w-full max-w-md m-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <span className="font-semibold text-white">Edit Sub-Project</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Organization</label>
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">None</option>
                {organizations.map(o => (
                  <option key={o.id} value={o.id}>{o.emoji} {o.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ TASK ROW (ClickUp-style table with inline editing) ============
  const TaskRow = ({ task, onToggle, onUpdate, onDelete, onClick }: {
    task: Task;
    onToggle: () => void;
    onUpdate: (task: Partial<Task> & { id: string }) => void;
    onDelete: () => void;
    onClick: () => void;
  }) => {
    const [editingField, setEditingField] = useState<'assignee' | 'date' | 'priority' | null>(null);
    const [tempAssignee, setTempAssignee] = useState(task.assignee || '');
    const [tempDate, setTempDate] = useState(task.due_date || '');

    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

    const handleSaveAssignee = () => {
      onUpdate({ id: task.id, assignee: tempAssignee || null });
      setEditingField(null);
    };

    const handleSaveDate = () => {
      onUpdate({ id: task.id, due_date: tempDate || null });
      setEditingField(null);
    };

    const handleSetPriority = (p: string) => {
      onUpdate({ id: task.id, priority: p as 'high' | 'medium' | 'low' });
      setEditingField(null);
    };

    const priorityConfig = {
      high: { label: 'High', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
      medium: { label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
      low: { label: 'Low', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
    };

    const getInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getAvatarColor = (name: string) => {
      const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-cyan-500'];
      const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
      return colors[index];
    };

    return (
      <div className="grid grid-cols-[1fr,100px,90px,90px,32px] items-center gap-2 px-4 py-2 hover:bg-gray-50 group/task border-b border-slate-100">
        {/* Task name with status */}
        <div className="flex items-center gap-2 min-w-0">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="flex-shrink-0"
          >
            {task.status === 'done' ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : task.status === 'in_progress' ? (
              <Clock className="w-4 h-4 text-blue-500" />
            ) : task.status === 'blocked' ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <Circle className="w-4 h-4 text-gray-400 hover:text-emerald-500" />
            )}
          </button>
          <span 
            className={`text-sm truncate cursor-pointer hover:text-indigo-600 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}
            onClick={onClick}
          >
            {task.title}
          </span>
        </div>

        {/* Assignee - avatar style */}
        {editingField === 'assignee' ? (
          <input
            type="text"
            value={tempAssignee}
            onChange={(e) => setTempAssignee(e.target.value)}
            onBlur={handleSaveAssignee}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveAssignee()}
            placeholder="Name"
            className="w-full px-2 py-1 text-xs bg-white border border-indigo-500 rounded-lg text-gray-800 outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setTempAssignee(task.assignee || ''); setEditingField('assignee'); }}
            className="flex items-center justify-center"
          >
            {task.assignee ? (
              <div className={`w-7 h-7 rounded-full ${getAvatarColor(task.assignee)} flex items-center justify-center text-white text-xs font-medium`} title={task.assignee}>
                {getInitials(task.assignee)}
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500">
                <User className="w-3 h-3" />
              </div>
            )}
          </button>
        )}

        {/* Due date */}
        {editingField === 'date' ? (
          <input
            type="date"
            value={tempDate}
            onChange={(e) => { setTempDate(e.target.value); handleSaveDate(); }}
            onBlur={() => setEditingField(null)}
            className="w-full px-1 py-1 text-xs bg-white border border-indigo-500 rounded-lg text-gray-800 outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setTempDate(task.due_date || ''); setEditingField('date'); }}
            className={`text-xs text-center ${
              task.due_date 
                ? isOverdue ? 'text-red-500' : 'text-gray-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {task.due_date 
              ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </button>
        )}

        {/* Priority - badge style */}
        {editingField === 'priority' ? (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {['high', 'medium', 'low'].map(p => (
              <button
                key={p}
                onClick={() => handleSetPriority(p)}
                className={`w-2 h-5 rounded ${p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`}
                title={p}
              />
            ))}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingField('priority'); }}
            className={`px-2 py-0.5 text-xs rounded-lg font-medium ${
              task.priority === 'high' ? 'bg-red-50 text-red-600' :
              task.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
              'bg-gray-100 text-gray-500'
            }`}
          >
            {priorityConfig[task.priority || 'medium'].label}
          </button>
        )}

        {/* Actions */}
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-gray-400 hover:text-red-500 rounded-lg opacity-0 group-hover/task:opacity-100 justify-self-center"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  // ============ TABLE HEADER ============
  const TableHeader = () => (
    <div className="grid grid-cols-[1fr,100px,90px,90px,32px] items-center gap-2 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-slate-100 bg-gray-50 font-medium">
      <span>Name</span>
      <span className="text-center">Assignee</span>
      <span className="text-center">Due date</span>
      <span className="text-center">Priority</span>
      <span></span>
    </div>
  );

  // ============ COMPACT TABLE HEADER (for card view) ============
  const CardTableHeader = () => (
    <div className="grid grid-cols-[1fr,70px,70px,60px] items-center gap-1 px-2 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50 font-medium">
      <span>Task</span>
      <span className="text-center">Assignee</span>
      <span className="text-center">Due</span>
      <span className="text-center">Priority</span>
    </div>
  );

  // ============ COMPACT TASK ROW (for card view) ============
  const CardTaskRow = ({ task, onToggle, onUpdate, onClick, users }: {
    task: Task;
    onToggle: () => void;
    onUpdate: (task: Partial<Task> & { id: string }) => void;
    onClick: () => void;
    users: CeoUser[];
  }) => {
    const [editingField, setEditingField] = useState<'assignee' | 'date' | 'priority' | null>(null);
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
    
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const getAvatarColor = (name: string) => {
      const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500'];
      return colors[name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length];
    };
    
    return (
      <div className="grid grid-cols-[1fr,70px,70px,60px] items-center gap-1 px-2 py-1.5 hover:bg-gray-50 group/task border-b border-gray-50 text-xs">
        {/* Task name with status toggle */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="flex-shrink-0"
          >
            {task.status === 'done' ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : task.status === 'in_progress' ? (
              <Clock className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-gray-300 hover:text-emerald-500" />
            )}
          </button>
          <span 
            className={`truncate cursor-pointer hover:text-indigo-600 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}
            onClick={onClick}
          >
            {task.title}
          </span>
        </div>
        
        {/* Assignee */}
        {editingField === 'assignee' ? (
          <select
            value={task.assigned_to_user_id || ''}
            onChange={(e) => {
              const userId = e.target.value || null;
              const user = users.find(u => u.id === userId);
              onUpdate({ id: task.id, assigned_to_user_id: userId, assignee: user?.display_name || null });
              setEditingField(null);
            }}
            className="w-full px-1 py-0.5 text-[10px] border border-indigo-400 rounded bg-white outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingField('assignee'); }}
            className="flex items-center justify-center"
          >
            {task.assignee ? (
              <div className={`w-5 h-5 rounded-full ${getAvatarColor(task.assignee)} flex items-center justify-center text-white text-[9px] font-medium`} title={task.assignee}>
                {getInitials(task.assignee)}
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400">
                <User className="w-2.5 h-2.5" />
              </div>
            )}
          </button>
        )}
        
        {/* Due date */}
        {editingField === 'date' ? (
          <input
            type="date"
            value={task.due_date || ''}
            onChange={(e) => {
              onUpdate({ id: task.id, due_date: e.target.value || null });
              setEditingField(null);
            }}
            className="w-full px-0.5 py-0.5 text-[10px] border border-indigo-400 rounded bg-white outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingField('date'); }}
            className={`text-[10px] text-center ${
              task.due_date 
                ? isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'
                : 'text-gray-300 hover:text-gray-500'
            }`}
          >
            {task.due_date 
              ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </button>
        )}
        
        {/* Priority */}
        {editingField === 'priority' ? (
          <div className="flex gap-0.5 justify-center" onClick={(e) => e.stopPropagation()}>
            {['high', 'medium', 'low'].map(p => (
              <button
                key={p}
                onClick={() => { onUpdate({ id: task.id, priority: p as 'high' | 'medium' | 'low' }); setEditingField(null); }}
                className={`w-3 h-3 rounded-full ${p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`}
                title={p}
              />
            ))}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingField('priority'); }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium mx-auto ${
              task.priority === 'high' ? 'bg-red-50 text-red-600' :
              task.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
              'bg-gray-100 text-gray-500'
            }`}
          >
            {task.priority === 'high' ? 'H' : task.priority === 'medium' ? 'M' : 'L'}
          </button>
        )}
      </div>
    );
  };

  // Helper to navigate and close sidebar on mobile
  const navigateTo = (newView: View) => {
    setView(newView);
    setSidebarOpen(false);
  };

  // ============ SIDEBAR ============
  const Sidebar = () => (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <aside className={`
        fixed md:relative z-50 w-64 md:w-56 flex flex-col h-screen
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ background: '#1e1b4b' }}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🦫</span>
            Capy Command
          </h1>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 text-indigo-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Navigation - scrollable */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavItem icon={Home} label="Home" active={view === 'home'} onClick={() => navigateTo('home')} />
        <NavItem icon={Sun} label="Today" active={view === 'today'} onClick={() => navigateTo('today')} />
        <NavItem icon={ListTodo} label="My Tasks" active={view === 'backlog'} onClick={() => navigateTo('backlog')} badge={backlogTasks.length.toString()} />
        
        {/* Projects Section - Collapsible */}
        <div className="pt-4 pb-2 flex items-center justify-between">
          <button 
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-indigo-200 uppercase tracking-wide hover:text-white transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${projectsExpanded ? '' : '-rotate-90'}`} />
            Projects
          </button>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => { setSelectedProjectId(null); setSelectedOrgId(null); navigateTo('projects'); }}
              className="p-1 hover:bg-white/10 rounded text-indigo-200 hover:text-white text-xs"
              title="View all projects"
            >
              •••
            </button>
            {isAdmin && (
              <button 
                onClick={() => setModalType('project')}
                className="p-1 hover:bg-white/10 rounded text-indigo-200 hover:text-white"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {projectsExpanded && (
          <>
            {visibleProjects.map(project => (
              <button
                key={project.id}
                onClick={() => { setSelectedProjectId(project.id); setSelectedOrgId(null); navigateTo('projects'); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedProjectId === project.id && view === 'projects'
                    ? 'bg-white/10 text-white' 
                    : 'text-indigo-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className={`w-3 h-3 rounded-sm bg-${project.color || 'emerald'}-500`} 
                     style={{ backgroundColor: project.color ? undefined : '#10b981' }} />
                <span className="flex-1 text-left truncate">{project.name}</span>
              </button>
            ))}
            {visibleProjects.length > 8 && (
              <button 
                onClick={() => navigateTo('projects')}
                className="w-full px-3 py-1 text-xs text-indigo-200 hover:text-white text-left"
              >
                View all {visibleProjects.length} projects →
              </button>
            )}
          </>
        )}
        
        {/* Organizations Section - Collapsible */}
        <div className="pt-4 pb-2 flex items-center justify-between">
          <button 
            onClick={() => setOrgsExpanded(!orgsExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-indigo-200 uppercase tracking-wide hover:text-white transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${orgsExpanded ? '' : '-rotate-90'}`} />
            Organizations
          </button>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => { setSelectedProjectId(null); setSelectedOrgId(null); navigateTo('orgs'); }}
              className="p-1 hover:bg-white/10 rounded text-indigo-200 hover:text-white text-xs"
              title="View all organizations"
            >
              •••
            </button>
            {isAdmin && (
              <button 
                onClick={() => setModalType('org')}
                className="p-1 hover:bg-white/10 rounded text-indigo-200 hover:text-white"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {orgsExpanded && visibleOrganizations.map(org => (
          <button
            key={org.id}
            onClick={() => { setSelectedOrgId(org.id); setSelectedProjectId(null); navigateTo('projects'); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedOrgId === org.id
                ? 'bg-white/10 text-white' 
                : 'text-indigo-100 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 text-center">{org.emoji || '🏢'}</span>
            <span className="flex-1 text-left truncate">{org.name}</span>
            <ChevronRight className="w-3 h-3 text-indigo-300" />
          </button>
        ))}
        
        {/* Strategy Section - Collapsible */}
        <div className="pt-4 pb-2 flex items-center justify-between">
          <button 
            onClick={() => setStrategyExpanded(!strategyExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-indigo-200 uppercase tracking-wide hover:text-white transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${strategyExpanded ? '' : '-rotate-90'}`} />
            Strategy
          </button>
        </div>
        {strategyExpanded && (
          <>
            <button
              onClick={() => { setStrategySubView('plans-teams'); navigateTo('strategy'); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                view === 'strategy' && strategySubView === 'plans-teams'
                  ? 'bg-white/10 text-white' 
                  : 'text-indigo-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Target className="w-4 h-4" />
              <span className="flex-1 text-left">Plans and teams</span>
            </button>



            <button
              onClick={() => { setStrategySubView('canvas'); navigateTo('strategy'); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                view === 'strategy' && strategySubView === 'canvas'
                  ? 'bg-white/10 text-white' 
                  : 'text-indigo-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span className="flex-1 text-left">Canvas</span>
            </button>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {isAdmin && (
          <NavItem icon={Shield} label="Admin" active={view === 'admin'} onClick={() => navigateTo('admin')} />
        )}
        <NavItem icon={Settings} label="Settings" active={view === 'settings'} onClick={() => navigateTo('settings')} />
        
        {/* User Profile */}
        {currentUser && (
          <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3 px-2 py-2">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-medium">
                  {currentUser.display_name?.charAt(0) || currentUser.email.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{currentUser.display_name || currentUser.email.split('@')[0]}</p>
                <p className="text-xs text-indigo-200 truncate">{currentUser.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );

  const NavItem = ({ icon: Icon, label, active, badge, onClick }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    active?: boolean;
    badge?: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active 
          ? 'bg-white/10 text-white' 
          : 'text-indigo-100 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className={`text-xs px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-white/10'}`}>
          {badge}
        </span>
      )}
    </button>
  );

  // ============ WEEKLY CALENDAR ============
  const WeeklyCalendar = () => (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const step = (calendarMode === 'week' || calendarMode === 'board') ? 7 : calendarMode === '3day' ? 3 : 1;
              setSelectedDate(d => addDays(d, -step));
            }}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              const step = (calendarMode === 'week' || calendarMode === 'board') ? 7 : calendarMode === '3day' ? 3 : 1;
              setSelectedDate(d => addDays(d, step));
            }}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded ml-2"
          >
            Today
          </button>
          <span className="ml-2 font-medium text-slate-900">{formatDate(selectedDate, 'MMMM yyyy')}</span>
          {/* Viewing As Banner */}
          {viewingAsUser && (
            <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-amber-100 border border-amber-300 rounded-full">
              <span className="text-amber-800 text-xs font-medium">
                Viewing: {viewingAsUser.display_name || viewingAsUser.email?.split('@')[0]}
              </span>
              <button
                onClick={() => { setViewingAsUser(null); setViewingAsUserId(null); }}
                className="text-amber-600 hover:text-amber-800"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Team Member Selector (if you have team members) */}
          {myTeamMembers.length > 0 && (
            <select
              value={viewingAsUser?.id || ''}
              onChange={(e) => {
                const userId = e.target.value;
                if (!userId) {
                  setViewingAsUser(null);
                  setViewingAsUserId(null);
                } else {
                  const user = allUsers.find(u => u.id === userId);
                  if (user) {
                    setViewingAsUser(user);
                    setViewingAsUserId(user.id);
                  }
                }
              }}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">My Calendar</option>
              {myTeamMembers.map(tm => tm.member && (
                <option key={tm.member.id} value={tm.member.id}>
                  {tm.member.display_name || tm.member.email?.split('@')[0]}
                </option>
              ))}
            </select>
          )}
          
          {/* View Mode Selector */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {[
              { mode: 'board' as const, label: 'Board' },
              { mode: '1day' as const, label: '1 Day' },
              { mode: '3day' as const, label: '3 Day' },
              { mode: 'week' as const, label: 'Week' },
            ].map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => setCalendarMode(mode)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  calendarMode === mode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setModalType('task')}
            className="px-3 py-1.5 text-sm bg-violet-500 text-white rounded-lg hover:bg-violet-600 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </header>

      {/* Week/Day header - adjust columns based on mode (hidden in Board view) */}
      {calendarMode !== 'board' && (
        <div className={`grid border-b border-slate-200 bg-white ${
          calendarMode === '1day' ? 'grid-cols-2' :
          calendarMode === '3day' ? 'grid-cols-4' :
          'grid-cols-8'
        }`} style={{ gridTemplateColumns: calendarMode === '1day' ? '60px 1fr' : calendarMode === '3day' ? '60px repeat(3, 1fr)' : '60px repeat(7, 1fr)' }}>
          <div className="p-2 text-xs text-slate-500"></div>
          {weekDays.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDate(day)}
              className={`p-2 text-center border-l border-slate-200 transition-colors ${
                isSameDay(day, selectedDate) 
                  ? 'bg-emerald-50' 
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="text-xs text-slate-500 uppercase">{formatDate(day, 'EEE')}</div>
              <div className={`text-lg font-semibold ${
                isSameDay(day, new Date()) 
                  ? 'text-emerald-500' 
                  : isSameDay(day, selectedDate) 
                    ? 'text-slate-900' 
                    : 'text-slate-600'
              }`}>
                {formatDate(day, 'd')}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Board View */}
      {calendarMode === 'board' && (
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(200px, 1fr))` }}>
            {weekDays.map((day, dayIdx) => {
              const dayStr = formatDate(day, 'yyyy-MM-dd');
              const dayPlans = visibleDailyPlans.filter(p => p.plan_date === dayStr);
              const plannedTaskIds = new Set(dayPlans.map(p => p.task_id));
              
              // Get tasks that span this day (start_date <= day <= due_date)
              // Also include tasks with only due_date matching
              const spanningTasks = myTasks.filter(t => {
                if (plannedTaskIds.has(t.id)) return false; // Skip if already in daily_plans
                if (t.status === 'done') return false; // Skip completed tasks
                
                const startDate = t.start_date || t.due_date;
                const endDate = t.due_date || t.start_date;
                
                if (!startDate && !endDate) return false;
                
                // Check if this day falls within the task's date range
                return dayStr >= (startDate || '0000-00-00') && dayStr <= (endDate || '9999-99-99');
              }).map(task => {
                // Determine the position of this day relative to task dates
                const startDate = task.start_date || task.due_date;
                const endDate = task.due_date || task.start_date;
                const isStartDay = dayStr === startDate;
                const isEndDay = dayStr === endDate;
                const isMiddleDay = !isStartDay && !isEndDay;
                const isSingleDay = startDate === endDate;
                
                return { task, isStartDay, isEndDay, isMiddleDay, isSingleDay };
              });
              
              return (
                <div 
                  key={dayIdx}
                  data-day-column={dayStr}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col max-h-[calc(100vh-200px)]"
                >
                  {/* Day header */}
                  <div className={`p-3 border-b border-slate-100 ${isSameDay(day, new Date()) ? 'bg-emerald-50' : ''}`}>
                    <div className="text-xs text-slate-500 uppercase">{formatDate(day, 'EEEE')}</div>
                    <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {formatDate(day, 'MMMM d')}
                    </div>
                  </div>
                  
                  {/* Tasks */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {/* Scheduled tasks (from daily_plans) */}
                    {dayPlans.map(plan => (
                      <div
                        key={plan.id}
                        onClick={() => plan.task && setSelectedTask(plan.task)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          plan.completed || plan.task?.status === 'done'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-violet-50 hover:bg-violet-100 border border-violet-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`font-medium text-sm ${plan.task?.status === 'done' ? 'line-through' : 'text-slate-900'}`}>
                            {plan.task?.title}
                          </span>
                          {plan.task?.priority === 'high' && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">High</span>
                          )}
                        </div>
                        {plan.start_time && (
                          <div className="text-xs text-slate-500 mt-1">
                            {plan.start_time.slice(0, 5)} - {plan.end_time?.slice(0, 5)}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Tasks spanning this day */}
                    {spanningTasks.map(({ task, isStartDay, isEndDay, isMiddleDay, isSingleDay }) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          isSingleDay
                            ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200'
                            : isStartDay
                              ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                              : isEndDay
                                ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`font-medium text-sm text-slate-900 ${isMiddleDay ? 'opacity-60' : ''}`}>
                            {task.title}
                          </span>
                          {task.priority === 'high' && !isMiddleDay && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">High</span>
                          )}
                        </div>
                        <div className={`text-xs mt-1 ${
                          isSingleDay ? 'text-amber-600' :
                          isStartDay ? 'text-emerald-600' :
                          isEndDay ? 'text-amber-600' :
                          'text-slate-400'
                        }`}>
                          {isSingleDay ? '📅 Due today' :
                           isStartDay ? '🚀 Starts' :
                           isEndDay ? '🏁 Due' :
                           '⏳ In progress'}
                        </div>
                      </div>
                    ))}
                    
                    {dayPlans.length === 0 && spanningTasks.length === 0 && (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time grid (Calendar views) */}
      {calendarMode !== 'board' && (
      <div className="flex-1 overflow-auto bg-white">
        <div className="min-h-full" style={{ display: 'grid', gridTemplateColumns: calendarMode === '1day' ? '60px 1fr' : calendarMode === '3day' ? '60px repeat(3, 1fr)' : '60px repeat(7, 1fr)' }}>
          {/* Time labels */}
          <div className="border-r border-slate-200">
            {HOURS.map(hour => (
              <div key={hour} className="h-16 flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-slate-400">
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => {
            const dayStr = formatDate(day, 'yyyy-MM-dd');
            const dayPlans = visibleDailyPlans.filter(p => p.plan_date === dayStr);
            
            return (
              <div 
                key={dayIdx} 
                data-day-column={dayStr}
                className="border-l border-slate-200 relative"
                onDragOver={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const totalMinutes = Math.floor(y / 64 * 60) + 7 * 60;
                  const snappedMinutes = Math.floor(totalMinutes / 5) * 5;
                  const hour = Math.min(21, Math.max(7, Math.floor(snappedMinutes / 60)));
                  setHoveredSlot({ day: dayStr, hour });
                }}
                onDragLeave={() => setHoveredSlot(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTask) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const totalMinutes = Math.floor(y / 64 * 60) + 7 * 60;
                    const snappedMinutes = Math.floor(totalMinutes / 5) * 5;
                    const hour = Math.floor(snappedMinutes / 60);
                    const mins = snappedMinutes % 60;
                    const startTime = `${String(Math.min(21, Math.max(7, hour))).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                    handleDropOnCalendarWithTime(dayStr, startTime, draggedTask.id);
                  }
                }}
                onMouseUp={async (e) => {
                  // Handle drop via mouseUp (15-min increments)
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const totalMinutes = Math.floor(y / 64 * 60) + 7 * 60;
                  const snappedMinutes = Math.floor(totalMinutes / 5) * 5;
                  const hour = Math.floor(snappedMinutes / 60);
                  const mins = snappedMinutes % 60;
                  const startTime = `${String(Math.min(21, Math.max(7, hour))).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                  
                  if (draggedPlan) {
                    // Moving an existing plan - preserve duration
                    const oldStart = draggedPlan.start_time || '09:00';
                    const oldEnd = draggedPlan.end_time || '10:00';
                    const [oldStartH, oldStartM] = oldStart.split(':').map(Number);
                    const [oldEndH, oldEndM] = oldEnd.split(':').map(Number);
                    const durationMins = (oldEndH * 60 + oldEndM) - (oldStartH * 60 + oldStartM);
                    
                    const newStartMins = hour * 60 + mins;
                    const newEndMins = newStartMins + durationMins;
                    const newEndH = Math.floor(newEndMins / 60);
                    const newEndM = newEndMins % 60;
                    const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;
                    
                    try {
                      await upsertDailyPlan({
                        id: draggedPlan.id,
                        task_id: draggedPlan.task_id,
                        plan_date: dayStr,
                        user_id: draggedPlan.user_id || 'james',
                        start_time: startTime,
                        end_time: newEndTime,
                        completed: draggedPlan.completed,
                      });
                      
                      // Also update the task to match the new scheduled date/time/duration
                      await upsertTask({ 
                        id: draggedPlan.task_id, 
                        due_date: dayStr,
                        start_time: startTime,
                        estimated_minutes: durationMins
                      });
                      setTasks(prev => prev.map(t => t.id === draggedPlan.task_id ? { 
                        ...t, 
                        due_date: dayStr,
                        start_time: startTime,
                        estimated_minutes: durationMins
                      } : t));
                      
                      await loadDailyPlans();
                    } catch (err) {
                      console.error('Failed to move plan:', err);
                    }
                    setDraggedPlan(null);
                    setDraggedTask(null);
                  } else if (draggedTask) {
                    // New task from sidebar
                    handleDropOnCalendarWithTime(dayStr, startTime, draggedTask.id);
                  }
                }}
              >
                {HOURS.map(hour => {
                  const isHovered = hoveredSlot?.day === dayStr && hoveredSlot?.hour === hour;
                  return (
                    <div 
                      key={hour} 
                      className={`h-16 border-b border-slate-100 transition-colors cursor-pointer ${
                        isHovered ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedDate(day)}
                    >
                      {isHovered && draggedTask && (
                        <div className="h-full flex items-center justify-center pointer-events-none">
                          <span className="text-xs text-emerald-400 font-medium">Drop here</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Render planned tasks for this day */}
                {dayPlans.map(plan => {
                  if (!plan.start_time || !plan.task) return null;
                  const startHour = parseInt(plan.start_time.split(':')[0]);
                  const startMin = parseInt(plan.start_time.split(':')[1] || '0');
                  const endHour = plan.end_time ? parseInt(plan.end_time.split(':')[0]) : startHour + 1;
                  const endMin = plan.end_time ? parseInt(plan.end_time.split(':')[1] || '0') : 0;
                  const top = (startHour - 7) * 64 + (startMin / 60) * 64;
                  const startTotalMins = startHour * 60 + startMin;
                  const endTotalMins = endHour * 60 + endMin;
                  const height = ((endTotalMins - startTotalMins) / 60) * 64;
                  
                  // Check if this block is being dragged and has a preview position
                  const isBeingDragged = isDraggingBlock && draggedPlan?.id === plan.id;
                  const previewOnThisDay = isBeingDragged && dragPreview?.day === dayStr;
                  
                  // If dragging and preview is on different day, hide original
                  if (isBeingDragged && dragPreview && dragPreview.day !== dayStr) {
                    return null;
                  }
                  
                  // Use preview position if available
                  const displayStartTime = previewOnThisDay && dragPreview ? dragPreview.startTime : plan.start_time;
                  const displayEndTime = previewOnThisDay && dragPreview ? dragPreview.endTime : plan.end_time;
                  const displayStartHour = parseInt(displayStartTime!.split(':')[0]);
                  const displayStartMin = parseInt(displayStartTime!.split(':')[1] || '0');
                  const displayEndHour = displayEndTime ? parseInt(displayEndTime.split(':')[0]) : displayStartHour + 1;
                  const displayEndMin = displayEndTime ? parseInt(displayEndTime.split(':')[1] || '0') : 0;
                  const displayTop = (displayStartHour - 7) * 64 + (displayStartMin / 60) * 64;
                  const displayStartTotalMins = displayStartHour * 60 + displayStartMin;
                  const displayEndTotalMins = displayEndHour * 60 + displayEndMin;
                  const displayHeight = ((displayEndTotalMins - displayStartTotalMins) / 60) * 64;
                  
                  return (
                    <div
                      key={plan.id}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return; // Left click only
                        e.preventDefault();
                        didDragMoveRef.current = false; // Reset drag tracking
                        setDraggedPlan(plan);
                        setDraggedTask(plan.task!);
                        setIsDraggingBlock(true);
                        setDragStartY(e.clientY);
                        setDragStartDay(dayStr);
                      }}
                      className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 text-xs shadow-sm transition-all ${
                        plan.completed || plan.task.status === 'done'
                          ? 'bg-slate-200 text-slate-500 line-through' 
                          : isBeingDragged
                          ? 'bg-indigo-600 ring-2 ring-indigo-400 ring-offset-1 text-white scale-[1.02] shadow-lg z-50'
                          : resizingPlan?.id === plan.id
                          ? 'bg-indigo-600 ring-2 ring-indigo-400 text-white'
                          : 'bg-indigo-700 text-white hover:shadow-md'
                      } cursor-pointer active:cursor-grabbing select-none`}
                      style={{ 
                        top: `${displayTop}px`, 
                        height: `${Math.max(displayHeight - 2, 20)}px`,
                        transition: isBeingDragged ? 'top 0.05s ease-out, left 0.05s ease-out' : 'none'
                      }}
                      onClick={(e) => {
                        // Only open detail modal if no actual dragging occurred
                        if (!resizingPlan && !didDragMoveRef.current && plan.task) {
                          setSelectedTask(plan.task);
                        }
                      }}
                    >
                      <div className="font-medium truncate">{plan.task.title}</div>
                      <div className="text-[10px] opacity-80">
                        {plan.start_time?.slice(0, 5)} - {plan.end_time?.slice(0, 5)}
                      </div>
                      {/* Resize handle */}
                      <div 
                        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-white/20 rounded-b-md"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setResizingPlan(plan);
                          setResizeStartY(e.clientY);
                          setResizeStartEndHour(endHour + endMin / 60); // Store as decimal hours for precision
                        }}
                      />
                    </div>
                  );
                })}
                
                {/* Ghost preview when dragging to this day from another day */}
                {isDraggingBlock && dragPreview && dragPreview.day === dayStr && dragStartDay !== dayStr && draggedPlan?.task && (
                  (() => {
                    const previewStartHour = parseInt(dragPreview.startTime.split(':')[0]);
                    const previewStartMin = parseInt(dragPreview.startTime.split(':')[1] || '0');
                    const previewEndHour = parseInt(dragPreview.endTime.split(':')[0]);
                    const previewEndMin = parseInt(dragPreview.endTime.split(':')[1] || '0');
                    const previewTop = (previewStartHour - 7) * 64 + (previewStartMin / 60) * 64;
                    const previewStartTotalMins = previewStartHour * 60 + previewStartMin;
                    const previewEndTotalMins = previewEndHour * 60 + previewEndMin;
                    const previewHeight = ((previewEndTotalMins - previewStartTotalMins) / 60) * 64;
                    
                    return (
                      <div
                        className="absolute left-1 right-1 rounded-lg px-2 py-1.5 text-xs bg-indigo-600/80 text-white ring-2 ring-indigo-400 ring-offset-1 shadow-lg z-50 pointer-events-none"
                        style={{ 
                          top: `${previewTop}px`, 
                          height: `${Math.max(previewHeight - 2, 20)}px`,
                        }}
                      >
                        <div className="font-medium truncate">{draggedPlan.task.title}</div>
                        <div className="text-[10px] opacity-80">
                          {dragPreview.startTime} - {dragPreview.endTime}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );

  // ============ DAILY TASK PANEL ============
  const DailyTaskPanel = () => {
    const isToday = formatDate(selectedDate, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');
    
    return (
    <aside className="w-full md:w-80 bg-white md:border-l border-slate-200 flex flex-col h-full">
      {/* Header with navigation */}
      <header className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedDate(d => addDays(d, -1))}
            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900">{formatDate(selectedDate, 'EEEE')}</h2>
            <p className="text-sm text-slate-500">{formatDate(selectedDate, 'MMMM d')}</p>
          </div>
          <button 
            onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {!isToday && (
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="w-full mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            ← Back to Today
          </button>
        )}
      </header>

      {/* Add task */}
      <div className="p-3 border-b border-slate-200">
        <button 
          onClick={() => setModalType('task')}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add task
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {/* Scheduled tasks */}
        {todayPlans.length > 0 && (
          <>
            <div className="pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase">Scheduled ({todayPlans.length})</span>
            </div>
            {todayPlans.map(plan => plan.task && (
              <TaskCard 
                key={plan.id} 
                task={plan.task} 
                plan={plan}
                onToggle={() => handleToggleTask(plan.task!.id)}
                onUnplan={() => handleUnplanTask(plan.id)}
                onClick={() => setSelectedTask(plan.task!)}
              />
            ))}
          </>
        )}

        {/* Unscheduled tasks (not in any daily plan) */}
        {unscheduledTasks.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase">Unscheduled ({unscheduledTasks.length})</span>
            </div>
            {unscheduledTasks.map(task => {
              const isDragging = draggedTask?.id === task.id;
              return (
              <div
                key={task.id}
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', task.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedTask(task);
                }}
                onDragEnd={() => { 
                  setDraggedTask(null); 
                  setHoveredSlot(null); 
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.task-checkbox')) return;
                  setSelectedTask(task);
                }}
                className={`cursor-grab active:cursor-grabbing select-none bg-slate-50 rounded-lg border transition-all p-3 mb-2 ${
                  isDragging ? 'border-violet-400 opacity-50 scale-[1.02] shadow-md' : 'border-slate-200 hover:border-violet-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <button 
                    type="button"
                    className="flex-shrink-0 task-checkbox p-1 -m-1 rounded-full hover:bg-slate-200 active:bg-slate-300 transition-colors"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleToggleTask(task.id); }}
                  >
                    {task.status === 'done' ? (
                      <Check className="w-5 h-5 text-violet-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400 hover:text-violet-500" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                    {task.sub_project && (
                      <p className="text-xs text-slate-500 truncate">
                        {task.sub_project.project?.name}
                      </p>
                    )}
                  </div>
                  {task.priority === 'high' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-medium rounded flex-shrink-0">
                      High
                    </span>
                  )}
                </div>
              </div>
              );
            })}
            {/* All unscheduled tasks now visible - scroll to see more */}
          </>
        )}

        {todayPlans.length === 0 && unscheduledTasks.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No tasks yet</p>
            <button 
              onClick={() => setModalType('task')}
              className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm"
            >
              Create your first task
            </button>
          </div>
        )}
      </div>
    </aside>
  );
  };

  // ============ SIMPLE TASK CARD (fixed click handling) ============
  const TaskCard = ({ task, plan, onToggle, onPlan, onUnplan, onDelete, onClick }: { 
    task: Task; 
    plan?: DailyPlan;
    onToggle: () => void;
    onPlan?: (time: string) => void;
    onUnplan?: () => void;
    onDelete?: () => void;
    onClick?: () => void;
  }) => {
    const formatTime12 = (time: string) => {
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'pm' : 'am';
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${hour12}:${m} ${ampm}`;
    };

    const duration = task.estimated_minutes || 60;
    const durationStr = duration >= 60 ? `${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')}` : `0:${duration}`;

    // For unscheduled tasks - DRAGGABLE
    if (!plan && onPlan) {
      return (
        <div 
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', task.id);
            setTimeout(() => {
              const el = document.getElementById(`task-${task.id}`);
              if (el) el.style.opacity = '0.5';
            }, 0);
          }}
          onDragEnd={() => {
            const el = document.getElementById(`task-${task.id}`);
            if (el) el.style.opacity = '1';
          }}
          id={`task-${task.id}`}
          className="bg-slate-50 rounded-lg border border-slate-200 hover:border-violet-400 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-start p-3 gap-3">
            <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <button 
              className="mt-0.5 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              {task.status === 'done' ? (
                <Check className="w-5 h-5 text-violet-500" />
              ) : (
                <Circle className="w-5 h-5 text-slate-400 hover:text-violet-500" />
              )}
            </button>
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            >
              <p className={`text-sm font-medium hover:text-violet-600 ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
              {task.sub_project && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {task.sub_project.project?.name} • {task.sub_project.organization?.name}
                </p>
              )}
              {task.priority === 'high' && (
                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                  High Priority
                </span>
              )}
            </div>
            <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded flex-shrink-0">
              {durationStr}
            </span>
          </div>
        </div>
      );
    }

    // For scheduled tasks - compact mobile-friendly layout
    return (
      <div 
        className={`bg-violet-50 rounded-lg border border-violet-200 hover:border-violet-300 transition-colors ${
          task.status === 'done' ? 'opacity-60' : ''
        }`}
        onClick={() => onClick?.()}
      >
        <div className="flex items-center p-3 gap-2">
          <button 
            type="button"
            className="flex-shrink-0 task-checkbox p-1 -m-1 rounded-full hover:bg-violet-200 active:bg-violet-300 transition-colors"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(); }}
          >
            {task.status === 'done' ? (
              <Check className="w-5 h-5 text-violet-500" />
            ) : (
              <Circle className="w-5 h-5 text-violet-400 hover:text-violet-600" />
            )}
          </button>
          {plan?.start_time && (
            <span className="text-xs text-violet-600 font-semibold flex-shrink-0">
              {formatTime12(plan.start_time.slice(0, 5))}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {task.sub_project && (
                <span className="text-xs text-slate-500 truncate">
                  {task.sub_project.project?.name}
                </span>
              )}
              {task.priority === 'high' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium flex-shrink-0">
                  High
                </span>
              )}
            </div>
          </div>
          <span className="text-xs px-2 py-1 bg-violet-100 text-violet-700 rounded flex-shrink-0 font-medium">
            {durationStr}
          </span>
          {onUnplan && (
            <button 
              className="p-1 text-slate-400 hover:text-red-500 rounded flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); onUnplan(); }}
              title="Unschedule"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ============ BACKLOG VIEW (My Tasks - Grouped by Project) - STRATEGY STYLE ============
  const BacklogView = () => {
    // Group tasks by project
    const tasksByProject = useMemo(() => {
      const groups: { [key: string]: { project: typeof backlogTasks[0]['sub_project']['project'] | null; org: typeof backlogTasks[0]['sub_project']['organization'] | null; tasks: typeof backlogTasks } } = {};
      
      backlogTasks.forEach(task => {
        const projectId = task.sub_project?.project?.id || 'no-project';
        if (!groups[projectId]) {
          groups[projectId] = {
            project: task.sub_project?.project || null,
            org: task.sub_project?.organization || null,
            tasks: []
          };
        }
        groups[projectId].tasks.push(task);
      });
      
      // Sort: projects with tasks first, then no-project at end
      return Object.entries(groups).sort(([aId], [bId]) => {
        if (aId === 'no-project') return 1;
        if (bId === 'no-project') return -1;
        return 0;
      });
    }, [backlogTasks]);

    // Calculate overall progress
    const totalTasks = backlogTasks.length;
    const completedTasks = myTasks.filter(t => t.status === 'done').length;
    const allTasks = myTasks.length;
    const overallProgress = allTasks > 0 ? Math.round((completedTasks / allTasks) * 100) : 0;

    return (
      <div className="flex-1 bg-white overflow-auto">
        {/* Header - Strategy Style */}
        <div className="border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">My Tasks</h1>
                <p className="text-sm text-gray-500 mt-0.5">{totalTasks} incomplete · {overallProgress}% complete overall</p>
              </div>
              <button 
                onClick={() => setModalType('task')}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>
        
        {/* Two-column grid like Strategy - full width */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasksByProject.map(([projectId, group]) => {
              const groupTotal = group.tasks.length;
              const groupDone = group.tasks.filter(t => t.status === 'done').length;
              const groupProgress = groupTotal > 0 ? Math.round((groupDone / groupTotal) * 100) : 0;
              
              return (
                <div 
                  key={projectId} 
                  className="flex flex-col overflow-hidden border border-gray-200 rounded-lg"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  {/* Card Header - Gray background like Strategy */}
                  <div 
                    className="flex items-center justify-between p-4"
                    style={{ backgroundColor: '#f7f7f8' }}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#f59e0b' }}
                      >
                        <span className="text-white text-sm">{group.project?.emoji || '📋'}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-[15px]">
                        {group.project?.name || 'No Project'}
                      </span>
                    </div>
                    <button 
                      onClick={() => group.project && navigateTo('projects', { projectId: group.project.id })}
                      className="p-1 hover:bg-gray-200 rounded opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  {/* Tasks List - White background */}
                  <div className="flex-1 p-3 bg-white">
                    <div className="space-y-2">
                      {group.tasks.map(task => {
                        const isComplete = task.status === 'done';
                        return (
                          <div
                            key={task.id}
                            className="w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-gray-50 transition-colors border border-gray-100 group"
                          >
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id); }}
                              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: isComplete ? '#22c55e' : '#f59e0b' }}
                            >
                              {isComplete ? (
                                <Check className="w-3 h-3 text-white" />
                              ) : (
                                <Circle className="w-2.5 h-2.5 text-white fill-current" />
                              )}
                            </button>
                            <span 
                              className={`text-sm truncate flex-1 cursor-pointer hover:text-indigo-600 ${isComplete ? 'line-through text-gray-400' : 'text-gray-700'}`}
                              onClick={() => setSelectedTask(task)}
                            >
                              {task.title}
                            </span>
                            {/* Priority & Due Date inline */}
                            {task.priority === 'high' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">High</span>
                            )}
                            {task.due_date && (
                              <span className="text-xs text-gray-400">
                                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {/* Progress % badge like Strategy */}
                            <span 
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ 
                                backgroundColor: isComplete ? '#dcfce7' : '#f3f4f6',
                                color: isComplete ? '#166534' : '#6b7280',
                              }}
                            >
                              {isComplete ? '100%' : '0%'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          </div>
                        );
                      })}
                      {group.tasks.length === 0 && (
                        <p className="text-sm py-2 text-gray-400">No tasks yet</p>
                      )}
                    </div>
                    
                    {/* Add Task link like Strategy's "+ Add Objective" */}
                    <button
                      onClick={() => setModalType('task')}
                      className="flex items-center gap-1 mt-3 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Task
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {backlogTasks.length === 0 && (
            <div className="border border-gray-200 rounded-lg p-12 text-center" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">All caught up!</h3>
              <p className="text-sm text-gray-500 mb-4">You have no incomplete tasks</p>
              <button 
                onClick={() => setModalType('task')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
              >
                Create New Task
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============ PROJECTS VIEW ============
  const ProjectsView = () => {
    // Filter projects based on selection (use visible data for access control)
    const selectedProject = selectedProjectId ? visibleProjects.find(p => p.id === selectedProjectId) : null;
    const selectedOrg = selectedOrgId ? visibleOrganizations.find(o => o.id === selectedOrgId) : null;
    
    // Get filtered projects
    let filteredProjects = visibleProjects;
    if (selectedProjectId) {
      filteredProjects = visibleProjects.filter(p => p.id === selectedProjectId);
    } else if (selectedOrgId) {
      // Get projects that have sub-projects belonging to this org
      const orgSubProjects = visibleSubProjects.filter(sp => sp.organization_id === selectedOrgId);
      const projectIdsWithOrg = new Set(orgSubProjects.map(sp => sp.project_id));
      filteredProjects = visibleProjects.filter(p => projectIdsWithOrg.has(p.id));
    }
    
    const viewTitle = selectedProject?.name || selectedOrg?.name || 'Projects';
    
    // Calculate overall stats
    const totalSubProjects = visibleSubProjects.length;
    const totalProjectTasks = visibleTasks.length;
    const completedProjectTasks = visibleTasks.filter(t => t.status === 'done').length;
    const overallProgress = totalProjectTasks > 0 ? Math.round((completedProjectTasks / totalProjectTasks) * 100) : 0;
    
    return (
    <div className="flex-1 bg-white overflow-auto">
      {/* Header - Strategy Style */}
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(selectedProjectId || selectedOrgId) && (
                <button 
                  onClick={() => { setSelectedProjectId(null); setSelectedOrgId(null); }}
                  className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{viewTitle}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedOrg 
                    ? `${filteredProjects.length} projects in this organization`
                    : `${filteredProjects.length} projects · ${totalSubProjects} sub-projects · ${overallProgress}% complete`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* View toggle - only show when viewing a single project */}
              {selectedProjectId && (
                <>
                  <div className="flex bg-gray-100 rounded-md p-0.5 mr-2">
                    <button
                      onClick={() => setProjectViewMode('cards')}
                      className={`px-3 py-1 text-sm rounded ${projectViewMode === 'cards' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Cards
                    </button>
                    <button
                      onClick={() => setProjectViewMode('timeline')}
                      className={`px-3 py-1 text-sm rounded ${projectViewMode === 'timeline' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Timeline
                    </button>
                  </div>
                  <button
                    onClick={() => setHideCompleted(!hideCompleted)}
                    className={`px-3 py-1.5 text-sm rounded-md mr-2 flex items-center gap-1.5 transition-colors ${
                      hideCompleted 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {hideCompleted ? 'Completed hidden' : 'Hide completed'}
                  </button>
                </>
              )}
              <button 
                onClick={() => setModalType('subproject')}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-4 h-4" />
                Sub-project
              </button>
              <button 
                onClick={() => setModalType('project')}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-4 h-4" />
                Project
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Full width content like Strategy */}
      <div className="px-6 py-6">
        
        {/* Single project view - Cards or Timeline */}
        {selectedProjectId && selectedProject && projectViewMode === 'cards' && <ProjectSubProjectsGrid 
          projectId={selectedProjectId}
          subProjects={visibleSubProjects.filter(sp => sp.project_id === selectedProjectId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
          tasks={hideCompleted ? visibleTasks.filter(t => t.status !== 'done') : visibleTasks}
          users={allUsers}
          hideCompleted={hideCompleted}
          onReorder={handleReorderSubProjects}
          onToggleTask={handleToggleTask}
          onUpdateTask={handleUpdateTask}
          onSelectTask={setSelectedTask}
          onSelectSubProject={(id) => { setSelectedSubProjectId(id); setView('subproject'); }}
          onEditSubProject={setEditingSubProject}
          onAddTask={(spId) => { setSelectedSubProjectId(spId); setModalType('task'); }}
          onAddSubProject={() => setModalType('subproject')}
        />}
        
        {/* Timeline view */}
        {selectedProjectId && selectedProject && projectViewMode === 'timeline' && (
          <div className="h-[calc(100vh-200px)]">
            <ProjectTimelineView
              tasks={visibleTasks.filter(t => visibleSubProjects.some(sp => sp.project_id === selectedProjectId && sp.id === t.sub_project_id))}
              subProjects={visibleSubProjects.filter(sp => sp.project_id === selectedProjectId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
              users={allUsers}
              onUpdateTask={handleUpdateTask}
              onSelectTask={setSelectedTask}
            />
          </div>
        )}
        
        {/* All projects view - show project cards */}
        {!selectedProjectId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjects.map(project => {
            const projectSubProjects = visibleSubProjects.filter(sp => sp.project_id === project.id);
            const projectTasks = visibleTasks.filter(t => projectSubProjects.some(sp => sp.id === t.sub_project_id));
            const doneTasks = projectTasks.filter(t => t.status === 'done').length;
            const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;
            const isExpanded = expandedProjectId === project.id;
            
            return (
              <div key={project.id} className={`bg-white rounded-xl border shadow-sm transition-all ${isExpanded ? 'border-indigo-400 col-span-full' : 'border-slate-200 hover:shadow-md'}`}>
                {/* Header - clickable to expand */}
                <div 
                  className="p-4 cursor-pointer group"
                  onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <button className="text-gray-400 hover:text-gray-700 transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-xl">{project.emoji || '📁'}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                      <p className="text-xs text-gray-500">
                        {projectSubProjects.length} teams · {projectTasks.length} tasks
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      project.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {project.status}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedProjectId(project.id); setModalType('subproject'); }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100"
                      title="Add sub-project"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100"
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-medium w-10 text-right">{progress}%</span>
                  </div>
                </div>
                
                {/* Expanded content - Asana-style task list */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Sub-projects with their tasks */}
                    {projectSubProjects.map(sp => {
                      const spTasks = visibleTasks.filter(t => t.sub_project_id === sp.id);
                      return (
                        <div key={sp.id} className="border-b border-slate-100 last:border-b-0">
                          {/* Sub-project header */}
                          <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{sp.organization?.emoji || '📋'}</span>
                              <span className="text-sm font-medium text-gray-700">{sp.name || sp.organization?.name}</span>
                              <span className="text-xs text-gray-400">({spTasks.length})</span>
                            </div>
                            <button 
                              onClick={() => { setSelectedSubProjectId(sp.id); setModalType('task'); }}
                              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg"
                              title="Add task"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Tasks - ClickUp-style table with inline editing */}
                          {spTasks.length > 0 && <TableHeader />}
                          <div>
                            {spTasks.map(task => (
                              <TaskRow 
                                key={task.id} 
                                task={task} 
                                onToggle={() => handleToggleTask(task.id)}
                                onUpdate={handleUpdateTask}
                                onDelete={() => handleDeleteTask(task.id)}
                                onClick={() => setSelectedTask(task)}
                              />
                            ))}
                            {spTasks.length === 0 && (
                              <div className="px-4 py-3 text-xs text-gray-400 italic">No tasks yet</div>
                            )}
                            {/* Add task button */}
                            <button 
                              onClick={() => { setSelectedSubProjectId(sp.id); setModalType('task'); }}
                              className="w-full px-4 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Add task
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {projectSubProjects.length === 0 && (
                      <div className="p-6 text-center">
                        <p className="text-xs text-gray-400 mb-2">No sub-projects yet</p>
                        <button 
                          onClick={() => { setSelectedProjectId(project.id); setModalType('subproject'); }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          + Add a sub-project
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Collapsed sub-project list */}
                {!isExpanded && projectSubProjects.length > 0 && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {projectSubProjects.slice(0, 3).map(sp => {
                      const spTasks = visibleTasks.filter(t => t.sub_project_id === sp.id);
                      const spDone = spTasks.filter(t => t.status === 'done').length;
                      const spProgress = spTasks.length > 0 ? Math.round((spDone / spTasks.length) * 100) : 0;
                      return (
                        <div key={sp.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{sp.organization?.emoji || '📋'}</span>
                            <span className="text-xs text-gray-700">{sp.name || sp.organization?.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{spDone}/{spTasks.length}</span>
                            <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${spProgress}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {projectSubProjects.length > 3 && (
                      <p className="text-xs text-gray-400 text-center pt-1">+{projectSubProjects.length - 3} more</p>
                    )}
                  </div>
                )}
                
                {!isExpanded && projectSubProjects.length === 0 && (
                  <div className="px-4 pb-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedProjectId(project.id); setModalType('subproject'); }}
                      className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:text-indigo-600 hover:border-indigo-400 transition-colors"
                    >
                      + Add a sub-project
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          
          {filteredProjects.length === 0 && (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <FolderKanban className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No projects yet</h3>
              <p className="text-sm text-gray-500 mb-4">Create your first project to get started</p>
              <button 
                onClick={() => setModalType('project')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Create First Project
              </button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
  };

  // ============ SUB-PROJECT VIEW (Asana-style table) ============
  const SubProjectView = () => {
    const sp = visibleSubProjects.find(s => s.id === selectedSubProjectId);
    if (!sp) return null;
    
    const spTasks = visibleTasks.filter(t => t.sub_project_id === sp.id);
    const project = visibleProjects.find(p => p.id === sp.project_id);
    
    // Calculate progress
    const doneTasks = spTasks.filter(t => t.status === 'done').length;
    const progress = spTasks.length > 0 ? Math.round((doneTasks / spTasks.length) * 100) : 0;
    
    // Get users assigned to this subproject's organization
    const orgUserIds = orgMembers.filter(m => m.organization_id === sp.organization_id).map(m => m.user_id);
    const orgUsers = allUsers.filter(u => orgUserIds.includes(u.id));
    
    // Inline update helper - supports multiple fields at once
    const updateTaskFields = async (taskId: string, updates: Record<string, any>) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const updated = { ...task, ...updates };
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      
      try {
        // Strip nested objects before upserting (sub_project is a join, not a column)
        const { sub_project, ...taskData } = updated;
        await upsertTask(taskData);
      } catch (err) {
        console.error('Failed to update task:', err);
        setTasks(prev => prev.map(t => t.id === taskId ? task : t)); // Revert on error
      }
    };
    
    return (
      <div className="flex-1 bg-gray-50 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <button 
                onClick={() => { setView('projects'); setSelectedSubProjectId(null); }}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <span className="text-lg">{sp.organization?.emoji || '📁'}</span>
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900">{sp.name}</h1>
                <p className="text-xs text-gray-500">{project?.name} · {sp.organization?.name}</p>
              </div>
              <div className="flex items-center gap-3 mr-4">
                <span className="text-xs text-gray-500">{doneTasks}/{spTasks.length} done</span>
                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700">{progress}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-12">
              <button 
                onClick={() => { setSelectedSubProjectId(sp.id); setModalType('task'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add task
              </button>
              <button 
                onClick={() => setEditingSubProject(sp)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                title="Edit sub-project"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button 
                onClick={() => handleDeleteSubProject(sp.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete sub-project"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
        
        {/* Task Table */}
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-slate-100 bg-gray-50">
                  <th className="py-3 pl-4 w-8"></th>
                  <th className="py-3 pl-2 font-medium">Name</th>
                  <th className="py-3 pl-2 w-36 font-medium">Assignee</th>
                  <th className="py-3 pl-2 w-32 font-medium">Due date</th>
                  <th className="py-3 pl-2 w-24 font-medium">Priority</th>
                  <th className="py-3 pl-2 w-28 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {spTasks.map(task => {
                  // Find assigned user for avatar
                  const assignedUser = allUsers.find(u => 
                    u.id === task.assigned_to_user_id || 
                    u.display_name?.toLowerCase() === task.assignee?.toLowerCase() ||
                    u.email?.split('@')[0].toLowerCase() === task.assignee?.toLowerCase()
                  );
                  
                  return (
                    <tr 
                      key={task.id} 
                      className="hover:bg-gray-50 group"
                    >
                      {/* Checkbox */}
                      <td className="py-3 pl-4">
                        <button 
                          onClick={() => handleToggleTask(task.id)}
                          className="p-1"
                        >
                          {task.status === 'done' ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400 group-hover:text-emerald-400" />
                          )}
                        </button>
                      </td>
                      
                      {/* Task Name - clickable to open detail */}
                      <td 
                        className={`py-3 pl-2 text-sm cursor-pointer hover:text-indigo-600 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}
                        onClick={() => setSelectedTask(task)}
                      >
                        {task.title}
                      </td>
                      
                      {/* Assignee Dropdown */}
                      <td className="py-3 pl-2">
                        <select
                          value={task.assigned_to_user_id || ''}
                          onChange={(e) => {
                            const userId = e.target.value || null;
                            const user = allUsers.find(u => u.id === userId);
                            // Update both fields at once to avoid race condition
                            updateTaskFields(task.id, {
                              assigned_to_user_id: userId,
                              assignee: user?.display_name || user?.email?.split('@')[0] || null
                            });
                          }}
                          className="w-full text-xs bg-transparent border-0 text-gray-600 cursor-pointer hover:bg-gray-100 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {orgUsers.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.display_name || user.email?.split('@')[0]}
                            </option>
                          ))}
                          {/* Show current assignee if not in org (legacy data) */}
                          {task.assignee && !orgUsers.find(u => 
                            u.display_name?.toLowerCase() === task.assignee?.toLowerCase() ||
                            u.id === task.assigned_to_user_id
                          ) && (
                            <option value={task.assigned_to_user_id || 'legacy'} disabled>
                              {task.assignee} (not in org)
                            </option>
                          )}
                        </select>
                      </td>
                      
                      {/* Due Date */}
                      <td className="py-3 pl-2">
                        <input
                          type="date"
                          value={task.due_date || ''}
                          onChange={(e) => updateTaskFields(task.id, { due_date: e.target.value || null })}
                          className="text-xs bg-transparent border-0 text-gray-500 cursor-pointer hover:bg-gray-100 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      
                      {/* Priority Dropdown */}
                      <td className="py-3 pl-2">
                        <select
                          value={task.priority || 'low'}
                          onChange={(e) => updateTaskFields(task.id, { priority: e.target.value })}
                          className={`text-xs font-medium rounded-lg px-2 py-1 cursor-pointer border-0 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                            task.priority === 'high' ? 'bg-red-50 text-red-600' :
                            task.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </td>
                      
                      {/* Status Dropdown */}
                      <td className="py-3 pl-2 pr-4">
                        <select
                          value={task.status || 'todo'}
                          onChange={(e) => updateTaskFields(task.id, { status: e.target.value })}
                          className={`text-xs font-medium rounded-lg px-2 py-1 cursor-pointer border-0 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                            task.status === 'done' ? 'bg-emerald-50 text-emerald-600' :
                            task.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                            task.status === 'blocked' ? 'bg-red-50 text-red-600' :
                            'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {spTasks.length === 0 && (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <ListTodo className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-2">No tasks yet</p>
                <button 
                  onClick={() => { setSelectedSubProjectId(sp.id); setModalType('task'); }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Create your first task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============ SETTINGS VIEW ============
  const SettingsView = () => {
    const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
    const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleSave = async () => {
      if (!currentUser) return;
      setSaving(true);
      try {
        const updated = await updateUserProfile(currentUser.id, {
          display_name: displayName,
          avatar_url: avatarUrl
        });
        setCurrentUser(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('Failed to update profile:', err);
        alert('Failed to save profile');
      } finally {
        setSaving(false);
      }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentUser) return;
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image must be less than 2MB');
        return;
      }
      
      setUploading(true);
      try {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, file, { upsert: true });
        
        if (error) throw error;
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        
        setAvatarUrl(urlData.publicUrl);
      } catch (err: any) {
        console.error('Upload failed:', err);
        // Fallback: convert to base64 data URL if storage isn't available
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setAvatarUrl(dataUrl);
        };
        reader.readAsDataURL(file);
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="flex-1 bg-slate-50 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
          
          {/* Profile Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile</h2>
            
            {/* Avatar */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
                <div className="flex gap-2 mb-2">
                  <label className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 cursor-pointer inline-flex items-center gap-1">
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      onClick={() => setAvatarUrl('')}
                      className="px-3 py-2 text-slate-600 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500">JPG, PNG or GIF. Max 2MB.</p>
              </div>
            </div>
            
            {/* Display Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            
            {/* Email (read-only) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={currentUser?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>
            
            {/* Save Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && (
                <span className="text-emerald-600 text-sm flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Saved!
                </span>
              )}
            </div>
          </div>
          
          {/* Account Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Account</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Role</span>
                <span className={`font-medium ${currentUser?.role === 'admin' ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {currentUser?.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">User ID</span>
                <span className="text-slate-400 font-mono text-xs">{currentUser?.id?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ TEAM VIEW (Admin only) ============
  const TeamView = () => {
    const [showAddMember, setShowAddMember] = useState(false);
    
    // My team members (people I manage)
    const myTeam = myTeamMembers.map(tm => tm.member).filter(Boolean) as CeoUser[];
    
    // Users not in my team (available to add)
    const availableUsers = allUsers.filter(u => 
      u.id !== currentUser?.id && 
      !myTeam.some(m => m.id === u.id)
    );
    
    // Get task stats for each user
    const getUserStats = (user: CeoUser) => {
      const userTasks = tasks.filter(t => 
        t.assigned_to_user_id === user.id ||
        t.assignee?.toLowerCase() === user.display_name?.toLowerCase()
      );
      const completedToday = userTasks.filter(t => t.status === 'done').length;
      const inProgress = userTasks.filter(t => t.status === 'in_progress').length;
      const highPriority = userTasks.filter(t => t.priority === 'high' && t.status !== 'done').length;
      
      const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
      const todayPlans = dailyPlans.filter(p => 
        p.plan_date === todayStr && 
        userTasks.some(t => t.id === p.task_id)
      );
      
      return { total: userTasks.length, completedToday, inProgress, highPriority, scheduledToday: todayPlans.length };
    };
    
    const handleAddTeamMember = async (userId: string) => {
      if (!currentUser) return;
      try {
        await addTeamMember(currentUser.id, userId);
        await refreshAdminData();
        setShowAddMember(false);
      } catch (err) {
        console.error('Failed to add team member:', err);
      }
    };
    
    const handleRemoveTeamMember = async (userId: string) => {
      if (!currentUser || !confirm('Remove this person from your team?')) return;
      try {
        await removeTeamMember(currentUser.id, userId);
        await refreshAdminData();
      } catch (err) {
        console.error('Failed to remove team member:', err);
      }
    };

    return (
      <div className="flex-1 bg-slate-50 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">My Team</h1>
              <p className="text-slate-500 text-sm">
                {myTeam.length} people you manage
              </p>
            </div>
            <button
              onClick={() => setShowAddMember(true)}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Team Member
            </button>
          </div>
          
          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddMember(false)}>
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Add Team Member</h2>
                <p className="text-sm text-slate-500 mb-4">Select people to add to your team. You'll be able to view their calendars and tasks.</p>
                
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {availableUsers.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No more users to add</p>
                  ) : (
                    availableUsers.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleAddTeamMember(user.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg text-left transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            user.display_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{user.display_name || user.email?.split('@')[0]}</div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </div>
                        <Plus className="w-5 h-5 text-emerald-500" />
                      </button>
                    ))
                  )}
                </div>
                
                <button
                  onClick={() => setShowAddMember(false)}
                  className="mt-4 w-full py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {/* Viewing As Banner */}
          {viewingAsUser && (
            <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <span className="text-amber-800">
                Viewing calendar as <strong>{viewingAsUser.display_name || viewingAsUser.email}</strong>
              </span>
              <button
                onClick={() => { setViewingAsUser(null); setViewingAsUserId(null); }}
                className="px-3 py-1 bg-amber-200 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-300"
              >
                Exit View
              </button>
            </div>
          )}
          
          {/* Empty State */}
          {myTeam.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No team members yet</h3>
              <p className="text-slate-500 mb-4">Add people to your team to view their calendars and monitor their progress.</p>
              <button
                onClick={() => setShowAddMember(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600"
              >
                Add Your First Team Member
              </button>
            </div>
          )}
          
          {/* Team Member Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myTeam.map(user => {
              const stats = getUserStats(user);
              const isViewing = viewingAsUser?.id === user.id;
              
              return (
                <div 
                  key={user.id}
                  className={`bg-white rounded-xl shadow-sm border p-4 transition-all hover:shadow-md ${
                    isViewing ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
                  }`}
                >
                  {/* User Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.display_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {user.display_name || user.email?.split('@')[0]}
                      </h3>
                      <p className="text-sm text-slate-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveTeamMember(user.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      title="Remove from team"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <div className="text-lg font-bold text-slate-900">{stats.scheduledToday}</div>
                      <div className="text-xs text-slate-500">Today</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{stats.inProgress}</div>
                      <div className="text-xs text-slate-500">Active</div>
                    </div>
                    <div className="text-center p-2 bg-emerald-50 rounded-lg">
                      <div className="text-lg font-bold text-emerald-600">{stats.completedToday}</div>
                      <div className="text-xs text-slate-500">Done</div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded-lg">
                      <div className="text-lg font-bold text-red-600">{stats.highPriority}</div>
                      <div className="text-xs text-slate-500">Urgent</div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <button
                    onClick={() => {
                      setViewingAsUser(user);
                      setViewingAsUserId(user.id);
                      setView('today');
                    }}
                    className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                      isViewing 
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isViewing ? 'Viewing' : 'View Calendar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ============ ORGANIZATIONS VIEW ============
  const OrganizationsView = () => {
    // Calculate overall stats
    const totalOrgTasks = visibleTasks.length;
    const completedOrgTasks = visibleTasks.filter(t => t.status === 'done').length;
    const overallOrgProgress = totalOrgTasks > 0 ? Math.round((completedOrgTasks / totalOrgTasks) * 100) : 0;
    
    return (
      <div className="flex-1 bg-gray-50 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Organizations</h1>
                  <p className="text-xs text-gray-500">{visibleOrganizations.length} teams · {totalOrgTasks} total tasks · {overallOrgProgress}% complete</p>
                </div>
              </div>
              <button 
                onClick={() => setModalType('org')}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-4 h-4" />
                New Organization
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleOrganizations.map(org => {
              const orgSubProjects = visibleSubProjects.filter(sp => sp.organization_id === org.id);
              const orgTasks = visibleTasks.filter(t => orgSubProjects.some(sp => sp.id === t.sub_project_id));
              const doneTasks = orgTasks.filter(t => t.status === 'done').length;
              const activeTasks = orgTasks.filter(t => t.status !== 'done').length;
              const progress = orgTasks.length > 0 ? Math.round((doneTasks / orgTasks.length) * 100) : 0;
              
              return (
                <div 
                  key={org.id}
                  className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{org.emoji || '🏢'}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{org.name}</h3>
                      <p className="text-xs text-gray-500">
                        {orgSubProjects.length} projects · {activeTasks} active
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteOrg(org.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete organization"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{doneTasks}/{orgTasks.length} done</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  
                  {org.description && (
                    <p className="text-xs text-gray-500 mb-3">{org.description}</p>
                  )}
                  
                  {orgSubProjects.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {orgSubProjects.slice(0, 4).map(sp => (
                        <span key={sp.id} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                          {sp.project?.emoji} {sp.project?.name}
                        </span>
                      ))}
                      {orgSubProjects.length > 4 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-400">
                          +{orgSubProjects.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {organizations.length === 0 && (
              <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No organizations yet</h3>
                <p className="text-sm text-gray-500 mb-4">Organizations represent your teams or departments</p>
                <button 
                  onClick={() => setModalType('org')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  Create First Organization
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============ RENDER ============
  // Auth loading
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦫</div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Not authenticated - show login
  if (!session || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-700 shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🦫</div>
            <h1 className="text-2xl font-bold text-white mb-2">Capy Command</h1>
            <p className="text-slate-400">Your CEO Command Center</p>
          </div>
          
          <button
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          
          <p className="text-center text-slate-500 text-sm mt-6">
            Sign in with your work Google account to get started.
          </p>
        </div>
      </div>
    );
  }
  
  // Data loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="text-4xl mb-4">🦫</div>
          <p className="text-slate-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-950 text-white overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-3" style={{ background: '#1e1b4b', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-indigo-200 hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🦫</span> Capy Command
        </h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
      
      <Sidebar />
      
      {view === 'admin' && isAdmin && <AdminPanel />}
      
      {view === 'today' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Calendar hidden on mobile, shown on md+ */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            <WeeklyCalendar />
          </div>
          {/* Task panel full-width on mobile */}
          <DailyTaskPanel />
        </div>
      )}
      
      {view === 'backlog' && <BacklogView />}
      {view === 'projects' && <ProjectsView />}
      {view === 'subproject' && <SubProjectView />}
      {view === 'orgs' && <OrganizationsView />}
      {view === 'settings' && <SettingsView />}
      {view === 'strategy' && <StrategyView initialView={strategySubView} />}
      
      {view === 'home' && (
        <div className="flex-1 bg-gray-50 overflow-auto">
          {/* Header */}
          <div className="bg-white border-b border-slate-200">
            <div className="max-w-5xl mx-auto px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Home className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {currentUser?.display_name?.split(' ')[0] || 'there'}! 🦫
                  </h1>
                  <p className="text-xs text-gray-500">{formatDate(new Date(), 'EEEE')}, {formatDate(new Date(), 'MMMM d')}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="max-w-5xl mx-auto px-6 py-6">
            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today's Scheduled Tasks */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-medium text-gray-900">Today's Schedule</h2>
                    <span className="text-xs text-gray-400">({todayPlans.filter(p => p.task?.status !== 'done').length} remaining)</span>
                  </div>
                  <button onClick={() => setView('today')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                    View Calendar →
                  </button>
                </div>
                <div className="p-4">
                  {todayPlans.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                        <Sun className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500">No tasks scheduled for today</p>
                      <button onClick={() => setView('today')} className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                        Plan your day →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {todayPlans.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(plan => plan.task && (
                        <div 
                          key={plan.id}
                          onClick={() => setSelectedTask(plan.task!)}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                            plan.task.status === 'done' ? 'bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <button onClick={(e) => { e.stopPropagation(); handleToggleTask(plan.task!.id); }}>
                            {plan.task.status === 'done' ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400 hover:text-emerald-500" />
                            )}
                          </button>
                          <span className="text-xs font-medium text-gray-400 w-12">{plan.start_time?.slice(0, 5)}</span>
                          <span className={`flex-1 text-sm ${plan.task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                            {plan.task.title}
                          </span>
                          {plan.task.priority === 'high' && plan.task.status !== 'done' && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">High</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Backlog Tasks */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-orange-500" />
                    <h2 className="text-sm font-medium text-gray-900">Backlog</h2>
                    <span className="text-xs text-gray-400">({backlogTasks.length} tasks)</span>
                  </div>
                  <button onClick={() => setView('backlog')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                    View All →
                  </button>
                </div>
                <div className="p-4">
                  {backlogTasks.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-xs text-gray-500">All caught up! 🎉</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {backlogTasks.slice(0, 6).map(task => (
                        <div 
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer group ${task.status === 'done' ? 'bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100'}`}
                        >
                          <button onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id); }}>
                            {task.status === 'done' ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400 hover:text-emerald-500" />
                            )}
                          </button>
                          <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</span>
                          {task.priority === 'high' && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">High</span>
                          )}
                          {task.sub_project?.project?.name && (
                            <span className="text-xs text-gray-400 hidden group-hover:inline">{task.sub_project.project.name}</span>
                          )}
                        </div>
                      ))}
                      {backlogTasks.length > 6 && (
                        <button onClick={() => setView('backlog')} className="w-full py-2 text-xs text-gray-400 hover:text-indigo-600 font-medium">
                          +{backlogTasks.length - 6} more tasks
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FolderKanban className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-gray-500">Projects</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{visibleProjects.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-gray-500">Teams</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{visibleOrganizations.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ListTodo className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-gray-500">Total Tasks</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{myTasks.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-gray-500">Completed</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{myTasks.filter(t => t.status === 'done').length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {view === 'focus' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h1 className="text-2xl font-bold mb-2">Focus Mode</h1>
            <p className="text-slate-500">Coming soon...</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {modalType === 'org' && (
        <Modal title="Create Organization" onClose={() => setModalType('none')}>
          <OrgForm />
        </Modal>
      )}
      {modalType === 'project' && (
        <Modal title="Create Project" onClose={() => setModalType('none')}>
          <ProjectForm />
        </Modal>
      )}
      {modalType === 'subproject' && (
        <Modal title="Create Sub-project" onClose={() => { setModalType('none'); setSelectedProjectId(null); }}>
          <SubProjectForm />
        </Modal>
      )}
      {modalType === 'task' && (
        <Modal title="Create Task" onClose={() => { setModalType('none'); setSelectedSubProjectId(null); }}>
          <TaskForm />
        </Modal>
      )}
      
      {/* Task Edit Modal (Asana-style) */}
      {selectedTask && (
        <TaskEditModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}

      {/* Sub-Project Edit Modal */}
      {editingSubProject && (
        <SubProjectEditModal
          subProject={editingSubProject}
          onClose={() => setEditingSubProject(null)}
        />
      )}
    </div>
  );
}

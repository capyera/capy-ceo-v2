import { useState, useEffect, useMemo } from 'react';
import { 
  Home, Calendar, Clock, Sun, Moon, ListTodo, FolderKanban, 
  ChevronLeft, ChevronRight, Plus, Check, Circle, Play,
  Building2, Target, Settings
} from 'lucide-react';
import { 
  Organization, Project, SubProject, Task, DailyPlan,
  fetchOrganizations, fetchProjects, fetchSubProjects, fetchTasks, fetchDailyPlans,
  upsertTask, upsertDailyPlan
} from './lib/supabase';

// ============ TYPES ============
type View = 'home' | 'today' | 'focus' | 'backlog' | 'projects' | 'orgs';

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

// ============ CONSTANTS ============
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am to 10pm

// ============ MAIN APP ============
export default function App() {
  // State
  const [view, setView] = useState<View>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subProjects, setSubProjects] = useState<SubProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dateStr = formatDate(selectedDate, 'yyyy-MM-dd');
  
  const todayTasks = useMemo(() => {
    return tasks.filter(t => t.status !== 'done');
  }, [tasks]);

  const backlogTasks = useMemo(() => {
    const plannedTaskIds = new Set(dailyPlans.map(p => p.task_id));
    return tasks.filter(t => !plannedTaskIds.has(t.id) && t.status !== 'done');
  }, [tasks, dailyPlans]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDailyPlans();
  }, [dateStr]);

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
      const plans = await fetchDailyPlans(dateStr);
      setDailyPlans(plans);
    } catch (err) {
      console.error('Failed to load daily plans:', err);
    }
  }

  // Actions
  async function handleToggleTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await upsertTask({ id: taskId, status: newStatus });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }

  async function handlePlanTask(taskId: string, startTime: string) {
    const endHour = parseInt(startTime.split(':')[0]) + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;
    
    await upsertDailyPlan({
      task_id: taskId,
      plan_date: dateStr,
      user_id: 'james',
      start_time: startTime,
      end_time: endTime,
    });
    await loadDailyPlans();
  }

  // ============ SIDEBAR ============
  const Sidebar = () => (
    <aside className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🦫</span>
          Capy Command
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <NavItem icon={Home} label="Home" active={view === 'home'} onClick={() => setView('home')} />
        <NavItem icon={Sun} label="Today" active={view === 'today'} onClick={() => setView('today')} />
        <NavItem icon={Clock} label="Focus" active={view === 'focus'} onClick={() => setView('focus')} badge="0:00" />
        
        <div className="pt-4 pb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Daily Rituals</span>
        </div>
        <NavItem icon={Play} label="Daily Planning" onClick={() => {}} />
        <NavItem icon={Moon} label="Daily Shutdown" onClick={() => {}} />
        
        <div className="pt-4 pb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Weekly Rituals</span>
        </div>
        <NavItem icon={Calendar} label="Weekly Planning" onClick={() => {}} />
        <NavItem icon={Target} label="Weekly Review" onClick={() => {}} />
        
        <div className="pt-4 pb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Work</span>
        </div>
        <NavItem icon={ListTodo} label="Backlog" active={view === 'backlog'} onClick={() => setView('backlog')} badge={backlogTasks.length.toString()} />
        <NavItem icon={FolderKanban} label="Projects" active={view === 'projects'} onClick={() => setView('projects')} />
        <NavItem icon={Building2} label="Organizations" active={view === 'orgs'} onClick={() => setView('orgs')} />
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700">
        <NavItem icon={Settings} label="Settings" onClick={() => {}} />
      </div>
    </aside>
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
          ? 'bg-emerald-500/20 text-emerald-400' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className={`text-xs px-1.5 py-0.5 rounded ${active ? 'bg-emerald-500/30' : 'bg-slate-700'}`}>
          {badge}
        </span>
      )}
    </button>
  );

  // ============ WEEKLY CALENDAR ============
  const WeeklyCalendar = () => (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSelectedDate(d => addDays(d, -7))}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSelectedDate(d => addDays(d, 7))}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-2 font-medium text-white">{formatDate(selectedDate, 'MMMM yyyy')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-1">
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </header>

      {/* Week header */}
      <div className="grid grid-cols-8 border-b border-slate-800 bg-slate-900">
        <div className="p-2 text-xs text-slate-500"></div>
        {weekDays.map((day, i) => (
          <button
            key={i}
            onClick={() => setSelectedDate(day)}
            className={`p-2 text-center border-l border-slate-800 transition-colors ${
              isSameDay(day, selectedDate) 
                ? 'bg-emerald-500/20' 
                : 'hover:bg-slate-800'
            }`}
          >
            <div className="text-xs text-slate-500 uppercase">{formatDate(day, 'EEE')}</div>
            <div className={`text-lg font-semibold ${
              isSameDay(day, new Date()) 
                ? 'text-emerald-400' 
                : isSameDay(day, selectedDate) 
                  ? 'text-white' 
                  : 'text-slate-400'
            }`}>
              {formatDate(day, 'd')}
            </div>
          </button>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 min-h-full">
          {/* Time labels */}
          <div className="border-r border-slate-800">
            {HOURS.map(hour => (
              <div key={hour} className="h-16 flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-slate-500">
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => (
            <div key={dayIdx} className="border-l border-slate-800 relative">
              {HOURS.map(hour => (
                <div 
                  key={hour} 
                  className="h-16 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                />
              ))}
              
              {/* Render planned tasks for this day */}
              {isSameDay(day, selectedDate) && dailyPlans.map(plan => {
                if (!plan.start_time || !plan.task) return null;
                const startHour = parseInt(plan.start_time.split(':')[0]);
                const startMin = parseInt(plan.start_time.split(':')[1] || '0');
                const endHour = plan.end_time ? parseInt(plan.end_time.split(':')[0]) : startHour + 1;
                const top = (startHour - 7) * 64 + (startMin / 60) * 64;
                const height = (endHour - startHour) * 64;
                
                return (
                  <div
                    key={plan.id}
                    className={`absolute left-1 right-1 rounded-md px-2 py-1 text-xs ${
                      plan.completed ? 'bg-emerald-500/30' : 'bg-emerald-500'
                    } text-white cursor-pointer hover:opacity-90`}
                    style={{ top: `${top}px`, height: `${Math.max(height - 2, 20)}px` }}
                  >
                    <div className="font-medium truncate">{plan.task.title}</div>
                    <div className="text-[10px] opacity-80">
                      {plan.start_time?.slice(0, 5)} - {plan.end_time?.slice(0, 5)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ============ DAILY TASK PANEL ============
  const DailyTaskPanel = () => (
    <aside className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col h-screen">
      {/* Header */}
      <header className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">{formatDate(selectedDate, 'EEEE')}</h2>
        <p className="text-sm text-slate-400">{formatDate(selectedDate, 'MMMM d')}</p>
      </header>

      {/* Add task */}
      <div className="p-3 border-b border-slate-700">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add task
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {dailyPlans.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No tasks planned for today</p>
            <p className="text-xs mt-1">Drag tasks from backlog or click to add</p>
          </div>
        ) : (
          dailyPlans.map(plan => plan.task && (
            <TaskCard 
              key={plan.id} 
              task={plan.task} 
              plan={plan}
              onToggle={() => handleToggleTask(plan.task!.id)}
            />
          ))
        )}

        {/* Unscheduled tasks */}
        {todayTasks.filter(t => !dailyPlans.some(p => p.task_id === t.id)).length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <span className="text-xs font-medium text-slate-500 uppercase">Unscheduled</span>
            </div>
            {todayTasks.filter(t => !dailyPlans.some(p => p.task_id === t.id)).slice(0, 5).map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onToggle={() => handleToggleTask(task.id)}
                onPlan={(time) => handlePlanTask(task.id, time)}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );

  const TaskCard = ({ task, plan, onToggle, onPlan }: { 
    task: Task; 
    plan?: DailyPlan;
    onToggle: () => void;
    onPlan?: (time: string) => void;
  }) => (
    <div className={`p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors ${
      task.status === 'done' ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start gap-2">
        <button onClick={onToggle} className="mt-0.5">
          {task.status === 'done' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Circle className="w-4 h-4 text-slate-500 hover:text-emerald-400" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
            {task.title}
          </p>
          {task.sub_project && (
            <p className="text-xs text-slate-500 mt-0.5">
              {task.sub_project.project?.name} → {task.sub_project.organization?.name}
            </p>
          )}
        </div>
        {plan?.start_time && (
          <span className="text-xs text-slate-500">{plan.start_time.slice(0, 5)}</span>
        )}
      </div>
      {task.priority === 'high' && (
        <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
          High Priority
        </span>
      )}
    </div>
  );

  // ============ BACKLOG VIEW ============
  const BacklogView = () => (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Backlog</h1>
        
        <div className="space-y-3">
          {backlogTasks.map(task => (
            <div 
              key={task.id}
              className="p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600"
            >
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggleTask(task.id)}>
                  <Circle className="w-5 h-5 text-slate-500 hover:text-emerald-400" />
                </button>
                <div className="flex-1">
                  <p className="font-medium text-white">{task.title}</p>
                  {task.sub_project && (
                    <p className="text-sm text-slate-500">
                      {task.sub_project.project?.emoji} {task.sub_project.project?.name} • {task.sub_project.organization?.name}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => handlePlanTask(task.id, '09:00')}
                  className="px-3 py-1 text-sm bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30"
                >
                  Plan Today
                </button>
              </div>
            </div>
          ))}
          
          {backlogTasks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <ListTodo className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No unplanned tasks</p>
              <p className="text-sm mt-1">All tasks are scheduled!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ============ PROJECTS VIEW ============
  const ProjectsView = () => (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Projects</h1>
        
        <div className="grid gap-4">
          {projects.map(project => {
            const projectSubProjects = subProjects.filter(sp => sp.project_id === project.id);
            const projectTasks = tasks.filter(t => projectSubProjects.some(sp => sp.id === t.sub_project_id));
            const doneTasks = projectTasks.filter(t => t.status === 'done').length;
            const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;
            
            return (
              <div key={project.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{project.emoji || '📁'}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{project.name}</h3>
                    <p className="text-sm text-slate-500">
                      {projectSubProjects.length} departments • {projectTasks.length} tasks
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    project.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {project.status}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{progress}% complete</p>
                
                {/* Sub-projects */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {projectSubProjects.map(sp => (
                    <span 
                      key={sp.id}
                      className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400"
                    >
                      {sp.organization?.emoji} {sp.organization?.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          
          {projects.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <FolderKanban className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No projects yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ============ ORGANIZATIONS VIEW ============
  const OrganizationsView = () => (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Organizations</h1>
        
        <div className="grid grid-cols-2 gap-4">
          {organizations.map(org => {
            const orgSubProjects = subProjects.filter(sp => sp.organization_id === org.id);
            const orgTasks = tasks.filter(t => orgSubProjects.some(sp => sp.id === t.sub_project_id));
            const activeTasks = orgTasks.filter(t => t.status !== 'done').length;
            
            return (
              <div 
                key={org.id}
                className="p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{org.emoji || '🏢'}</span>
                  <div>
                    <h3 className="font-semibold text-white">{org.name}</h3>
                    <p className="text-sm text-slate-500">
                      {orgSubProjects.length} projects • {activeTasks} active tasks
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {organizations.length === 0 && (
            <div className="col-span-2 text-center py-12 text-slate-500">
              <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No organizations yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="text-4xl mb-4">🦫</div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-950 text-white overflow-hidden">
      <Sidebar />
      
      {view === 'today' && (
        <>
          <WeeklyCalendar />
          <DailyTaskPanel />
        </>
      )}
      
      {view === 'backlog' && <BacklogView />}
      {view === 'projects' && <ProjectsView />}
      {view === 'orgs' && <OrganizationsView />}
      
      {view === 'home' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🦫</div>
            <h1 className="text-2xl font-bold mb-2">Welcome to Capy Command</h1>
            <p className="text-slate-500">Your team's daily planning dashboard</p>
            <p className="text-slate-600 text-sm mt-4">V2 Sandbox • Sunsama-style Layout</p>
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
    </div>
  );
}

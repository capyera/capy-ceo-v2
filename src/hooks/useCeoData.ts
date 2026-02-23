import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase,
  DBProject,
  DBCategory,
  DBTask,
  fetchProjects,
  fetchCategories,
  fetchTasks,
  upsertProject,
  upsertCategory,
  upsertTask,
  deleteProject as deleteProjectDB,
  deleteCategory as deleteCategoryDB,
  deleteTask as deleteTaskDB,
  bulkUpsertProjects,
  bulkUpsertCategories,
  bulkUpsertTasks,
  migrateFromLocalStorage,
  hasSupabaseData,
  LocalStorageData,
} from '../lib/supabase';

// Debug flag
const DEBUG = true;
const log = (...args: unknown[]) => DEBUG && console.log('[CEO Data]', ...args);

// App types
export interface Project {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
  description?: string | null;
  due_date?: string | null;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  project_id: string;
  name: string;
  order: number;
  created_at?: string;
}

export interface Task {
  id: string;
  project_id: string;
  category_id?: string | null;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  due_date?: string | null;
  assignee?: string | null;
  notes?: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

// Local storage keys
const LS_PROJECTS = 'ceo_projects';
const LS_CATEGORIES = 'ceo_categories';
const LS_TASKS = 'ceo_tasks';
const LS_MIGRATED = 'ceo_migrated_to_supabase';

// Map DB types to app types
const mapDBProject = (p: DBProject): Project => ({
  id: p.id,
  name: p.name,
  emoji: p.emoji,
  color: p.color,
  description: p.description,
  due_date: p.due_date,
  priority: p.priority,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

const mapDBCategory = (c: DBCategory): Category => ({
  id: c.id,
  project_id: c.project_id,
  name: c.name,
  order: c.sort_order,
  created_at: c.created_at,
});

const mapDBTask = (t: DBTask): Task => ({
  id: t.id,
  project_id: t.project_id,
  category_id: t.category_id,
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  due_date: t.due_date,
  assignee: t.assignee,
  notes: t.notes,
  order: t.sort_order,
  created_at: t.created_at,
  updated_at: t.updated_at,
});

// Map app types back to DB
const mapProjectToDB = (p: Project): DBProject => ({
  id: p.id,
  name: p.name,
  emoji: p.emoji || null,
  color: p.color || null,
  description: p.description || null,
  due_date: p.due_date || null,
  priority: p.priority,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

const mapCategoryToDB = (c: Category): DBCategory => ({
  id: c.id,
  project_id: c.project_id,
  name: c.name,
  sort_order: c.order,
  created_at: c.created_at || new Date().toISOString(),
});

const mapTaskToDB = (t: Task): DBTask => ({
  id: t.id,
  project_id: t.project_id,
  category_id: t.category_id || null,
  title: t.title,
  description: t.description || null,
  status: t.status,
  priority: t.priority,
  due_date: t.due_date || null,
  assignee: t.assignee || null,
  notes: t.notes || null,
  sort_order: t.order,
  created_at: t.created_at,
  updated_at: t.updated_at,
});

// Get local storage data
function getLocalStorageData(): LocalStorageData | null {
  try {
    const projects = JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]');
    const categories = JSON.parse(localStorage.getItem(LS_CATEGORIES) || '[]');
    const tasks = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
    
    if (projects.length === 0 && categories.length === 0 && tasks.length === 0) {
      return null;
    }
    
    return { projects, categories, tasks };
  } catch {
    return null;
  }
}

interface UseCeoDataReturn {
  // Data
  projects: Project[];
  categories: Category[];
  tasks: Task[];
  
  // Loading states
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Migration
  needsMigration: boolean;
  migrating: boolean;
  migrateToCloud: () => Promise<{ projects: number; categories: number; tasks: number }>;
  
  // Project operations
  addProject: (project: Project) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  // Category operations
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Task operations
  addTask: (task: Task) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  
  // Bulk operations
  setProjects: (projects: Project[]) => void;
  setCategories: (categories: Category[]) => void;
  setTasks: (tasks: Task[]) => void;
  
  // Refresh
  refresh: () => Promise<void>;
}

export function useCeoData(): UseCeoDataReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrating, setMigrating] = useState(false);
  
  const initialLoadDone = useRef(false);
  
  // Refs to always have latest data
  const projectsRef = useRef(projects);
  const categoriesRef = useRef(categories);
  const tasksRef = useRef(tasks);
  
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [dbProjects, dbCategories, dbTasks] = await Promise.all([
        fetchProjects(),
        fetchCategories(),
        fetchTasks(),
      ]);
      
      setProjects(dbProjects.map(mapDBProject));
      setCategories(dbCategories.map(mapDBCategory));
      setTasks(dbTasks.map(mapDBTask));
      initialLoadDone.current = true;
      
      // Check if migration needed
      const alreadyMigrated = localStorage.getItem(LS_MIGRATED) === 'true';
      if (!alreadyMigrated) {
        const localData = getLocalStorageData();
        const hasCloud = await hasSupabaseData();
        if (localData && !hasCloud) {
          setNeedsMigration(true);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time subscriptions
  useEffect(() => {
    const projectsSub = supabase
      .channel('ceo_projects_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_projects' }, (payload) => {
        log('Projects change:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setProjects(prev => {
            const updated = mapDBProject(payload.new as DBProject);
            const exists = prev.find(p => p.id === updated.id);
            if (exists) {
              return prev.map(p => p.id === updated.id ? updated : p);
            }
            return [...prev, updated];
          });
        } else if (payload.eventType === 'DELETE') {
          setProjects(prev => prev.filter(p => p.id !== (payload.old as DBProject).id));
        }
      })
      .subscribe();

    const categoriesSub = supabase
      .channel('ceo_categories_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_categories' }, (payload) => {
        log('Categories change:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setCategories(prev => {
            const updated = mapDBCategory(payload.new as DBCategory);
            const exists = prev.find(c => c.id === updated.id);
            if (exists) {
              return prev.map(c => c.id === updated.id ? updated : c);
            }
            return [...prev, updated];
          });
        } else if (payload.eventType === 'DELETE') {
          setCategories(prev => prev.filter(c => c.id !== (payload.old as DBCategory).id));
        }
      })
      .subscribe();

    const tasksSub = supabase
      .channel('ceo_tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_tasks' }, (payload) => {
        log('Tasks change:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setTasks(prev => {
            const updated = mapDBTask(payload.new as DBTask);
            const exists = prev.find(t => t.id === updated.id);
            if (exists) {
              return prev.map(t => t.id === updated.id ? updated : t);
            }
            return [...prev, updated];
          });
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as DBTask).id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectsSub);
      supabase.removeChannel(categoriesSub);
      supabase.removeChannel(tasksSub);
    };
  }, []);

  // Migration function
  const migrateToCloud = useCallback(async () => {
    const localData = getLocalStorageData();
    if (!localData) {
      throw new Error('No local data to migrate');
    }
    
    setMigrating(true);
    try {
      const result = await migrateFromLocalStorage(localData);
      localStorage.setItem(LS_MIGRATED, 'true');
      setNeedsMigration(false);
      await loadData(); // Reload from Supabase
      return result;
    } finally {
      setMigrating(false);
    }
  }, [loadData]);

  // ============ PROJECT OPERATIONS ============
  const addProject = useCallback(async (project: Project) => {
    setProjects(prev => [...prev, project]);
    
    try {
      setSaving(true);
      await upsertProject(mapProjectToDB(project));
    } catch (err) {
      setProjects(prev => prev.filter(p => p.id !== project.id));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    log('updateProject:', id, updates);
    
    setProjects(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    ));
    
    try {
      setSaving(true);
      const current = projectsRef.current.find(p => p.id === id);
      if (current) {
        await upsertProject(mapProjectToDB({ ...current, ...updates }));
      }
    } catch (err) {
      await loadData();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  const deleteProjectFn = useCallback(async (id: string) => {
    const original = projects.find(p => p.id === id);
    
    setProjects(prev => prev.filter(p => p.id !== id));
    setCategories(prev => prev.filter(c => c.project_id !== id));
    setTasks(prev => prev.filter(t => t.project_id !== id));
    
    try {
      setSaving(true);
      await deleteProjectDB(id);
    } catch (err) {
      if (original) setProjects(prev => [...prev, original]);
      await loadData();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [projects, loadData]);

  // ============ CATEGORY OPERATIONS ============
  const addCategoryFn = useCallback(async (category: Category) => {
    setCategories(prev => [...prev, category]);
    
    try {
      setSaving(true);
      await upsertCategory(mapCategoryToDB(category));
    } catch (err) {
      setCategories(prev => prev.filter(c => c.id !== category.id));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateCategoryFn = useCallback(async (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    
    try {
      setSaving(true);
      const current = categoriesRef.current.find(c => c.id === id);
      if (current) {
        await upsertCategory(mapCategoryToDB({ ...current, ...updates }));
      }
    } catch (err) {
      await loadData();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  const deleteCategoryFn = useCallback(async (id: string) => {
    const original = categories.find(c => c.id === id);
    
    setCategories(prev => prev.filter(c => c.id !== id));
    setTasks(prev => prev.map(t => t.category_id === id ? { ...t, category_id: undefined } : t));
    
    try {
      setSaving(true);
      await deleteCategoryDB(id);
    } catch (err) {
      if (original) setCategories(prev => [...prev, original]);
      await loadData();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [categories, loadData]);

  // ============ TASK OPERATIONS ============
  const addTaskFn = useCallback(async (task: Task) => {
    setTasks(prev => [...prev, task]);
    
    try {
      setSaving(true);
      await upsertTask(mapTaskToDB(task));
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== task.id));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTaskFn = useCallback(async (id: string, updates: Partial<Task>) => {
    log('updateTask:', id, updates);
    
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    ));
    
    try {
      setSaving(true);
      const current = tasksRef.current.find(t => t.id === id);
      if (current) {
        await upsertTask(mapTaskToDB({ ...current, ...updates }));
      }
    } catch (err) {
      await loadData();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  const deleteTaskFn = useCallback(async (id: string) => {
    const original = tasks.find(t => t.id === id);
    
    setTasks(prev => prev.filter(t => t.id !== id));
    
    try {
      setSaving(true);
      await deleteTaskDB(id);
    } catch (err) {
      if (original) setTasks(prev => [...prev, original]);
      await loadData();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [tasks, loadData]);

  // ============ BULK SETTERS ============
  const setProjectsWithSave = useCallback((newProjects: Project[]) => {
    setProjects(newProjects);
    bulkUpsertProjects(newProjects.map(mapProjectToDB)).catch(console.error);
  }, []);

  const setCategoriesWithSave = useCallback((newCategories: Category[]) => {
    setCategories(newCategories);
    bulkUpsertCategories(newCategories.map(mapCategoryToDB)).catch(console.error);
  }, []);

  const setTasksWithSave = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
    bulkUpsertTasks(newTasks.map(mapTaskToDB)).catch(console.error);
  }, []);

  return {
    projects,
    categories,
    tasks,
    loading,
    saving,
    error,
    needsMigration,
    migrating,
    migrateToCloud,
    addProject,
    updateProject,
    deleteProject: deleteProjectFn,
    addCategory: addCategoryFn,
    updateCategory: updateCategoryFn,
    deleteCategory: deleteCategoryFn,
    addTask: addTaskFn,
    updateTask: updateTaskFn,
    deleteTask: deleteTaskFn,
    setProjects: setProjectsWithSave,
    setCategories: setCategoriesWithSave,
    setTasks: setTasksWithSave,
    refresh: loadData,
  };
}

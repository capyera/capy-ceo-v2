import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hmsdccptlyikdhjvtwtd.supabase.co';
const supabaseAnonKey = 'sb_publishable_I80wx2Moh3cM7Q1NlCx1uQ_XAU6me_Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============ TYPES ============
export interface Organization {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
  description?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  due_date?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubProject {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  status: 'active' | 'completed' | 'on_hold';
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  organization?: Organization;
  project?: Project;
}

export interface Task {
  id: string;
  sub_project_id: string;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  due_date?: string | null;
  assignee?: string | null;
  estimated_minutes?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  sub_project?: SubProject;
}

export interface DailyPlan {
  id: string;
  task_id: string;
  user_id: string;
  plan_date: string;
  start_time?: string | null;
  end_time?: string | null;
  completed: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  task?: Task;
}

// ============ SANDBOX TABLE NAMES ============
const TABLES = {
  organizations: 'ceo_sandbox_organizations',
  projects: 'ceo_sandbox_projects',
  subprojects: 'ceo_sandbox_subprojects',
  tasks: 'ceo_sandbox_tasks',
  daily_plans: 'ceo_sandbox_daily_plans',
};

// ============ ORGANIZATIONS ============
export async function fetchOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from(TABLES.organizations)
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertOrganization(org: Partial<Organization> & { id: string }): Promise<Organization> {
  const { data, error } = await supabase
    .from(TABLES.organizations)
    .upsert({ ...org, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ PROJECTS ============
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from(TABLES.projects)
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertProject(project: Partial<Project> & { id: string }): Promise<Project> {
  const { data, error } = await supabase
    .from(TABLES.projects)
    .upsert({ ...project, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ SUB-PROJECTS ============
export async function fetchSubProjects(): Promise<SubProject[]> {
  const { data, error } = await supabase
    .from(TABLES.subprojects)
    .select(`
      *,
      organization:ceo_sandbox_organizations(*),
      project:ceo_sandbox_projects(*)
    `)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertSubProject(sp: Partial<SubProject> & { id: string }): Promise<SubProject> {
  const { data, error } = await supabase
    .from(TABLES.subprojects)
    .upsert({ ...sp, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ TASKS ============
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from(TABLES.tasks)
    .select(`
      *,
      sub_project:ceo_sandbox_subprojects(
        *,
        organization:ceo_sandbox_organizations(*),
        project:ceo_sandbox_projects(*)
      )
    `)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertTask(task: Partial<Task> & { id: string }): Promise<Task> {
  const { data, error } = await supabase
    .from(TABLES.tasks)
    .upsert({ ...task, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from(TABLES.tasks).delete().eq('id', id);
  if (error) throw error;
}

// ============ DAILY PLANS ============
export async function fetchDailyPlans(date: string, userId?: string): Promise<DailyPlan[]> {
  let query = supabase
    .from(TABLES.daily_plans)
    .select(`
      *,
      task:ceo_sandbox_tasks(
        *,
        sub_project:ceo_sandbox_subprojects(
          *,
          organization:ceo_sandbox_organizations(*),
          project:ceo_sandbox_projects(*)
        )
      )
    `)
    .eq('plan_date', date)
    .order('start_time');
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertDailyPlan(plan: Partial<DailyPlan> & { task_id: string; plan_date: string }): Promise<DailyPlan> {
  const { data, error } = await supabase
    .from(TABLES.daily_plans)
    .upsert({ ...plan, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDailyPlan(id: string): Promise<void> {
  const { error } = await supabase.from(TABLES.daily_plans).delete().eq('id', id);
  if (error) throw error;
}

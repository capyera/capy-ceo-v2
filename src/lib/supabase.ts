import { createClient } from '@supabase/supabase-js';
import type { User, Session } from '@supabase/supabase-js';

const supabaseUrl = 'https://hmsdccptlyikdhjvtwtd.supabase.co';
const supabaseAnonKey = 'sb_publishable_I80wx2Moh3cM7Q1NlCx1uQ_XAU6me_Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============ AUTH ============
export type { User, Session };

export interface CeoUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  created_at: string;
  updated_at: string;
}

// Forward declaration - full interface defined below
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

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'viewer' | 'editor';
  created_at: string;
  organization?: Organization;
  user?: CeoUser;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/capy-ceo-v2/',
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<CeoUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('ceo_users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function createOrUpdateUser(authUser: User): Promise<CeoUser> {
  // Check if user exists
  const { data: existing } = await supabase
    .from('ceo_users')
    .select('*')
    .eq('id', authUser.id)
    .single();
  
  if (existing) {
    // Update last login
    const { data, error } = await supabase
      .from('ceo_users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', authUser.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  
  // Create new user - first user is admin, rest are members
  const { data: allUsers } = await supabase.from('ceo_users').select('id');
  const isFirstUser = !allUsers || allUsers.length === 0;
  
  const { data, error } = await supabase
    .from('ceo_users')
    .insert({
      id: authUser.id,
      email: authUser.email!,
      display_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
      avatar_url: authUser.user_metadata?.avatar_url,
      role: isFirstUser ? 'admin' : 'member',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============ ORG MEMBERS ============
export async function fetchOrgMembers(): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('ceo_org_members')
    .select(`
      *,
      organization:ceo_sandbox_organizations(*),
      user:ceo_users(*)
    `);
  if (error) throw error;
  return data || [];
}

export async function fetchUserOrgIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ceo_org_members')
    .select('organization_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(m => m.organization_id);
}

export async function addOrgMember(organizationId: string, userId: string, role: 'viewer' | 'editor' = 'editor'): Promise<OrgMember> {
  const { data, error } = await supabase
    .from('ceo_org_members')
    .insert({ organization_id: organizationId, user_id: userId, role })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeOrgMember(organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('ceo_org_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ============ ALL USERS (for admin) ============
export async function fetchAllUsers(): Promise<CeoUser[]> {
  const { data, error } = await supabase
    .from('ceo_users')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function updateUserRole(userId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase
    .from('ceo_users')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateUserProfile(userId: string, updates: { display_name?: string; avatar_url?: string }): Promise<CeoUser> {
  const { data, error } = await supabase
    .from('ceo_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ TEAM MEMBERS (Manager -> Direct Reports) ============
export interface TeamMember {
  id: string;
  manager_id: string;
  member_id: string;
  created_at: string;
  member?: CeoUser;
}

export async function fetchTeamMembers(managerId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('ceo_team_members')
    .select(`
      *,
      member:ceo_users!member_id(*)
    `)
    .eq('manager_id', managerId);
  if (error) throw error;
  return data || [];
}

export async function fetchAllTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('ceo_team_members')
    .select(`
      *,
      member:ceo_users!member_id(*)
    `);
  if (error) throw error;
  return data || [];
}

export async function addTeamMember(managerId: string, memberId: string): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('ceo_team_members')
    .insert({ manager_id: managerId, member_id: memberId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeTeamMember(managerId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('ceo_team_members')
    .delete()
    .eq('manager_id', managerId)
    .eq('member_id', memberId);
  if (error) throw error;
}

// ============ TYPES ============
// Organization already defined above

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
  start_date?: string | null;
  due_date?: string | null;
  start_time?: string | null;
  assignee?: string | null;
  assigned_to_user_id?: string | null;
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
  // Check if task exists first
  const { data: existing } = await supabase
    .from(TABLES.tasks)
    .select('id')
    .eq('id', task.id)
    .single();
  
  if (existing) {
    // Update existing task
    const { data, error } = await supabase
      .from(TABLES.tasks)
      .update({ ...task, updated_at: new Date().toISOString() })
      .eq('id', task.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Insert new task
    const { data, error } = await supabase
      .from(TABLES.tasks)
      .insert({ ...task, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
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

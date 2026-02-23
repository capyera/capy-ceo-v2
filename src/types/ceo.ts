export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface Project {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
  due_date?: string;
  priority: Priority;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  category_id?: string; // Category within project
  parent_task_id?: string; // For subtasks
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  start_date?: string;
  end_date?: string;
  due_date?: string;
  assignee?: string;
  notes?: string;
  order: number;
  // Time blocking
  scheduled_start?: string; // HH:MM format for time blocking
  duration_minutes?: number; // Duration in minutes (default 30)
  created_at: string;
  updated_at: string;
}

export interface TaskWithSubtasks extends Task {
  subtasks: Task[];
}

export interface ProjectWithProgress extends Project {
  total_tasks: number;
  completed_tasks: number;
  progress: number;
  tasks: TaskWithSubtasks[];
}

// Legacy - keeping for migration
export interface Category {
  id: string;
  project_id: string;
  name: string;
  order: number;
  created_at: string;
}

export interface CategoryWithTasks extends Category {
  tasks: Task[];
}

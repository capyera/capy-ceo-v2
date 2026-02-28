-- Create users table
CREATE TABLE IF NOT EXISTS ceo_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create org membership table
CREATE TABLE IF NOT EXISTS ceo_org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES ceo_sandbox_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES ceo_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Add assigned_to_user_id to tasks (nullable for migration)
ALTER TABLE ceo_sandbox_tasks 
ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES ceo_users(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_user ON ceo_org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON ceo_org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON ceo_sandbox_tasks(assigned_to_user_id);

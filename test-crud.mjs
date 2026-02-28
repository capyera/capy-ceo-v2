import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hmsdccptlyikdhjvtwtd.supabase.co',
  'sb_publishable_I80wx2Moh3cM7Q1NlCx1uQ_XAU6me_Q'
);

const TABLES = {
  organizations: 'ceo_sandbox_organizations',
  projects: 'ceo_sandbox_projects',
  subprojects: 'ceo_sandbox_subprojects',
  tasks: 'ceo_sandbox_tasks',
  daily_plans: 'ceo_sandbox_daily_plans',
};

let passed = 0;
let failed = 0;
const testIds = {
  org: `test-org-${Date.now()}`,
  project: `test-proj-${Date.now()}`,
  subproject: `test-subproj-${Date.now()}`,
  task: `test-task-${Date.now()}`,
};

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function main() {
  console.log('🧪 CEO Dashboard V2 CRUD Tests\n');
  console.log('='.repeat(50));

  // ===== CREATE TESTS =====
  console.log('\n📝 CREATE OPERATIONS\n');

  await test('Create Organization', async () => {
    const { data, error } = await supabase.from(TABLES.organizations).insert({
      id: testIds.org,
      name: 'Test Marketing',
      emoji: '📊',
      color: 'blue',
      description: 'Test org for CRUD',
      sort_order: 99,
    }).select().single();
    if (error) throw error;
    assert(data.id === testIds.org, 'ID mismatch');
    assert(data.name === 'Test Marketing', 'Name mismatch');
  });

  await test('Create Project', async () => {
    const { data, error } = await supabase.from(TABLES.projects).insert({
      id: testIds.project,
      name: 'Test Spring Launch',
      emoji: '🚀',
      color: 'emerald',
      description: 'Test project for CRUD',
      status: 'active',
      priority: 'high',
      sort_order: 99,
    }).select().single();
    if (error) throw error;
    assert(data.id === testIds.project, 'ID mismatch');
  });

  await test('Create Sub-Project (link org to project)', async () => {
    const { data, error } = await supabase.from(TABLES.subprojects).insert({
      id: testIds.subproject,
      project_id: testIds.project,
      organization_id: testIds.org,
      name: 'Marketing Tasks',
      status: 'active',
      sort_order: 0,
    }).select().single();
    if (error) throw error;
    assert(data.project_id === testIds.project, 'Project ID mismatch');
    assert(data.organization_id === testIds.org, 'Org ID mismatch');
  });

  await test('Create Task under Sub-Project', async () => {
    const { data, error } = await supabase.from(TABLES.tasks).insert({
      id: testIds.task,
      sub_project_id: testIds.subproject,
      title: 'Design test banner',
      description: 'Test task',
      status: 'todo',
      priority: 'high',
      sort_order: 0,
    }).select().single();
    if (error) throw error;
    assert(data.sub_project_id === testIds.subproject, 'SubProject ID mismatch');
  });

  await test('Create Daily Plan for Task', async () => {
    const { data, error } = await supabase.from(TABLES.daily_plans).insert({
      task_id: testIds.task,
      user_id: 'test-user',
      plan_date: '2026-02-23',
      start_time: '09:00',
      end_time: '10:00',
      completed: false,
    }).select().single();
    if (error) throw error;
    assert(data.task_id === testIds.task, 'Task ID mismatch');
    testIds.plan = data.id;
  });

  // ===== READ TESTS =====
  console.log('\n📖 READ OPERATIONS\n');

  await test('Read Organization with filters', async () => {
    const { data, error } = await supabase
      .from(TABLES.organizations)
      .select('*')
      .eq('id', testIds.org)
      .single();
    if (error) throw error;
    assert(data.name === 'Test Marketing', 'Name mismatch');
  });

  await test('Read Sub-Project with joins', async () => {
    const { data, error } = await supabase
      .from(TABLES.subprojects)
      .select(`
        *,
        organization:ceo_sandbox_organizations(*),
        project:ceo_sandbox_projects(*)
      `)
      .eq('id', testIds.subproject)
      .single();
    if (error) throw error;
    assert(data.organization?.name === 'Test Marketing', 'Org join failed');
    assert(data.project?.name === 'Test Spring Launch', 'Project join failed');
  });

  await test('Read Task with nested joins', async () => {
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
      .eq('id', testIds.task)
      .single();
    if (error) throw error;
    assert(data.sub_project?.project?.name === 'Test Spring Launch', 'Nested join failed');
  });

  await test('Read Daily Plan with task details', async () => {
    const { data, error } = await supabase
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
      .eq('task_id', testIds.task)
      .single();
    if (error) throw error;
    assert(data.task?.title === 'Design test banner', 'Task join failed');
  });

  // ===== UPDATE TESTS =====
  console.log('\n✏️ UPDATE OPERATIONS\n');

  await test('Update Task status to done', async () => {
    const { data, error } = await supabase
      .from(TABLES.tasks)
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', testIds.task)
      .select()
      .single();
    if (error) throw error;
    assert(data.status === 'done', 'Status not updated');
  });

  await test('Update Daily Plan to completed', async () => {
    const { data, error } = await supabase
      .from(TABLES.daily_plans)
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq('id', testIds.plan)
      .select()
      .single();
    if (error) throw error;
    assert(data.completed === true, 'Completed not updated');
  });

  await test('Update Project status', async () => {
    const { data, error } = await supabase
      .from(TABLES.projects)
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', testIds.project)
      .select()
      .single();
    if (error) throw error;
    assert(data.status === 'completed', 'Status not updated');
  });

  // ===== CONSTRAINT TESTS =====
  console.log('\n🔒 CONSTRAINT TESTS\n');

  await test('Reject duplicate sub-project (same org + project)', async () => {
    const { error } = await supabase.from(TABLES.subprojects).insert({
      id: 'duplicate-test',
      project_id: testIds.project,
      organization_id: testIds.org,
      name: 'Duplicate',
      status: 'active',
      sort_order: 0,
    });
    assert(error !== null, 'Should have rejected duplicate');
    assert(error.code === '23505', 'Should be unique violation');
  });

  await test('Reject daily plan for same task on same day', async () => {
    const { error } = await supabase.from(TABLES.daily_plans).insert({
      task_id: testIds.task,
      user_id: 'test-user',
      plan_date: '2026-02-23', // Same date
      start_time: '14:00',
      end_time: '15:00',
    });
    assert(error !== null, 'Should have rejected duplicate');
  });

  // ===== DELETE TESTS (CASCADE) =====
  console.log('\n🗑️ DELETE OPERATIONS (Cascade)\n');

  await test('Delete cascades: Delete project removes sub-projects + tasks + plans', async () => {
    // First verify they exist
    const { data: spBefore } = await supabase.from(TABLES.subprojects).select('id').eq('project_id', testIds.project);
    assert(spBefore?.length > 0, 'Sub-project should exist before delete');

    // Delete project
    const { error } = await supabase.from(TABLES.projects).delete().eq('id', testIds.project);
    if (error) throw error;

    // Verify cascades
    const { data: spAfter } = await supabase.from(TABLES.subprojects).select('id').eq('id', testIds.subproject);
    assert(spAfter?.length === 0, 'Sub-project should be deleted');

    const { data: taskAfter } = await supabase.from(TABLES.tasks).select('id').eq('id', testIds.task);
    assert(taskAfter?.length === 0, 'Task should be deleted');

    const { data: planAfter } = await supabase.from(TABLES.daily_plans).select('id').eq('task_id', testIds.task);
    assert(planAfter?.length === 0, 'Plan should be deleted');
  });

  await test('Clean up: Delete test organization', async () => {
    const { error } = await supabase.from(TABLES.organizations).delete().eq('id', testIds.org);
    if (error) throw error;
    const { data } = await supabase.from(TABLES.organizations).select('id').eq('id', testIds.org);
    assert(data?.length === 0, 'Org should be deleted');
  });

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  console.log(`\n${failed === 0 ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);

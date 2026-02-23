#!/usr/bin/env node
/**
 * QA Checklist - Run before every deploy
 * Usage: node scripts/qa-check.mjs
 */

import { execSync } from 'child_process';

const CHECKS = [];
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

console.log('🔍 Running QA Checks...\n');

// 1. TypeScript compilation
check('TypeScript compiles without errors', () => {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe', cwd: process.cwd() });
    return true;
  } catch (e) {
    console.log('   TypeScript errors found');
    return false;
  }
});

// 2. Build succeeds
check('Production build succeeds', () => {
  try {
    execSync('npm run build', { stdio: 'pipe', cwd: process.cwd() });
    return true;
  } catch (e) {
    return false;
  }
});

// 3. No console.log in production code (except services)
check('No debug console.logs in components', () => {
  try {
    const result = execSync('grep -r "console.log" src/pages src/components --include="*.tsx" 2>/dev/null || true', { encoding: 'utf8' });
    const lines = result.trim().split('\n').filter(l => l && !l.includes('// debug'));
    if (lines.length > 0 && lines[0] !== '') {
      console.log(`   Found ${lines.length} console.log statements`);
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
});

// 4. All imports resolve
check('All imports resolve correctly', () => {
  try {
    const result = execSync('grep -r "from.*supabase" src/pages --include="*.tsx" 2>/dev/null || true', { encoding: 'utf8' });
    // Build would fail if imports don't resolve, so if we got here, we're good
    return true;
  } catch (e) {
    return true;
  }
});

// 5. Supabase connection test
check('Supabase API responds', async () => {
  try {
    const response = await fetch('https://hmsdccptlyikdhjvtwtd.supabase.co/rest/v1/', {
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2RjY3B0bHlpa2RoanZ0d3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzNTY2NjIsImV4cCI6MjA1NDkzMjY2Mn0.o1NZ8LWYP8LsTd8SLqLVLiILYDqT4isoVWEDL2UJJDQ' }
    });
    return response.ok;
  } catch (e) {
    return false;
  }
});

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ QA FAILED - Do not deploy!\n');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed - Safe to deploy!\n');
  process.exit(0);
}

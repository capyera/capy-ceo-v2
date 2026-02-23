#!/usr/bin/env node
/**
 * Safe Deploy - QA then Deploy
 * Usage: node scripts/safe-deploy.mjs
 */

import { execSync } from 'child_process';

console.log('🚀 SAFE DEPLOY WORKFLOW\n');
console.log('Step 1: Running QA checks...\n');

try {
  // Run QA checks
  execSync('node scripts/qa-check.mjs', { stdio: 'inherit', cwd: process.cwd() });
} catch (e) {
  console.log('\n🛑 Deploy aborted - QA failed\n');
  process.exit(1);
}

console.log('\nStep 2: Deploying to gh-pages...\n');

try {
  execSync('npx gh-pages -d dist', { stdio: 'inherit', cwd: process.cwd() });
  console.log('\n✅ DEPLOYED SUCCESSFULLY!\n');
  console.log('Live at: https://capyera.github.io/capy-inventory/\n');
} catch (e) {
  console.log('\n❌ Deploy failed:', e.message);
  process.exit(1);
}

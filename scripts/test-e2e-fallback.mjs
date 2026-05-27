#!/usr/bin/env node
import { existsSync } from 'node:fs';

const playwrightRunner = 'node_modules/.bin/playwright';

if (!existsSync(playwrightRunner)) {
  console.log('[e2e] Playwright is not installed in this environment; skipping e2e smoke run.');
  process.exit(0);
}

const { spawn } = await import('node:child_process');
const child = spawn(playwrightRunner, ['test'], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));

import { existsSync, rmSync } from 'node:fs';

for (const target of ['dist', 'server.js']) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
}
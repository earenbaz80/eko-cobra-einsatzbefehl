import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const forbiddenTokens = ['speechSynthesis', 'speakRadio', 'cancelSpeech', '__ekoSpeech'];

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|mjs)$/.test(full)) {
      files.push(full);
    }
  }
  return files;
}

describe('no synthetic speech in app', () => {
  it('does not reintroduce TTS or voice-synthesis code paths', () => {
    const offenders: string[] = [];
    for (const dir of ['src', 'scripts']) {
      for (const file of walk(join(root, dir))) {
        if (file.endsWith('noSpeechSynthesis.test.ts')) continue;
        const text = readFileSync(file, 'utf8');
        for (const token of forbiddenTokens) {
          if (text.includes(token)) {
            offenders.push(`${relative(root, file)} contains ${token}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
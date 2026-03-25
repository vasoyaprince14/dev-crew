import { describe, it, expect, afterEach } from 'vitest';
import { ProjectCache } from '../../src/core/project-cache.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('ProjectCache', () => {
  const tmpDir = path.join(os.tmpdir(), 'dev-crew-test-cache-' + Date.now());

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ok */ }
  });

  it('returns null when no cache exists', () => {
    const cache = new ProjectCache(tmpDir);
    expect(cache.get()).toBeNull();
  });

  it('stores and retrieves project info', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const cache = new ProjectCache(tmpDir);
    const info = {
      name: 'test',
      root: tmpDir,
      language: 'typescript' as const,
      framework: null,
      database: [],
      orm: null,
      testFramework: null,
      packageManager: 'npm',
      hasDocker: false,
      hasCI: false,
      ciPlatform: null,
      monorepo: false,
      structure: 'flat' as const,
      dependencies: {},
      devDependencies: {},
      scripts: {},
      files: [],
    };
    cache.set(info);
    const retrieved = cache.get();
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('test');
    expect(retrieved!.language).toBe('typescript');
  });
});

import { describe, it, expect } from 'vitest';
import { ProjectDetector } from '../../src/core/project-detector.js';

describe('ProjectDetector', () => {
  const detector = new ProjectDetector();

  it('detects this project as typescript', async () => {
    const info = await detector.detect(process.cwd());
    expect(info.language).toBe('typescript');
    expect(info.name).toBe('dev-crew');
  });

  it('detects test framework', async () => {
    const info = await detector.detect(process.cwd());
    expect(info.testFramework).toBe('vitest');
  });

  it('detects package manager', async () => {
    const info = await detector.detect(process.cwd());
    expect(['npm', 'pnpm', 'yarn', 'bun']).toContain(info.packageManager);
  });

  it('populates dependencies from package.json', async () => {
    const info = await detector.detect(process.cwd());
    expect(info.dependencies).toBeDefined();
    expect(info.dependencies['chalk']).toBeDefined();
  });

  it('returns unknown for non-existent directory', async () => {
    const info = await detector.detect('/tmp/nonexistent-dir-xyz');
    expect(info.language).toBe('unknown');
  });

  it('detects file list', async () => {
    const info = await detector.detect(process.cwd());
    expect(info.files.length).toBeGreaterThan(0);
    expect(info.files).toContain('package.json');
  });
});

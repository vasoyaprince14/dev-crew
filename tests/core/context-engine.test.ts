import { describe, it, expect } from 'vitest';
import { ContextEngine } from '../../src/core/context-engine.js';
import { ProjectDetector } from '../../src/core/project-detector.js';

describe('ContextEngine', () => {
  const engine = new ContextEngine();

  it('gathers context with files', async () => {
    const detector = new ProjectDetector();
    const projectInfo = await detector.detect(process.cwd());

    const result = await engine.gather({
      files: ['src/core/token-optimizer.ts'],
      projectInfo,
    });

    expect(result).toContain('token-optimizer');
    expect(result).toContain('dev-crew');
  });

  it('gathers directory tree when no files specified', async () => {
    const detector = new ProjectDetector();
    const projectInfo = await detector.detect(process.cwd());

    const result = await engine.gather({ projectInfo });
    expect(result).toContain('Project Structure');
    expect(result).toContain('src/');
  });

  it('strips comments from code', async () => {
    const detector = new ProjectDetector();
    const projectInfo = await detector.detect(process.cwd());

    const result = await engine.gather({
      files: ['src/core/token-optimizer.ts'],
      projectInfo,
    });
    // Single-line comments should be stripped
    expect(result).not.toContain('// 1. Collapse');
  });

  it('returns project line with metadata', async () => {
    const detector = new ProjectDetector();
    const projectInfo = await detector.detect(process.cwd());
    projectInfo.framework = 'express';

    const result = await engine.gather({ projectInfo });
    expect(result).toContain('express');
  });
});

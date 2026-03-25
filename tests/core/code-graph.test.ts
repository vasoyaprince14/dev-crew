import { describe, it, expect } from 'vitest';
import { CodeGraph } from '../../src/core/code-graph.js';
import path from 'node:path';

describe('CodeGraph', () => {
  describe('buildFromFiles', () => {
    it('indexes TypeScript files and extracts symbols', () => {
      const cg = new CodeGraph();
      // Index our own source files
      cg.buildFromFiles([
        path.resolve('src/core/code-graph.ts'),
      ]);
      const stats = cg.getStats();
      expect(stats.files).toBeGreaterThanOrEqual(1);
      expect(stats.nodes).toBeGreaterThan(5); // CodeGraph class + methods
      expect(stats.edges).toBeGreaterThan(0);
    });

    it('extracts class and function nodes', () => {
      const cg = new CodeGraph();
      cg.buildFromFiles([path.resolve('src/core/token-optimizer.ts')]);
      const structure = cg.getFileStructure('src/core/token-optimizer.ts');
      const names = structure.map(n => n.name);
      expect(names).toContain('TokenOptimizer');
      expect(structure.some(n => n.kind === 'class')).toBe(true);
      expect(structure.some(n => n.kind === 'function')).toBe(true);
    });
  });

  describe('buildFromDirectory', () => {
    it('indexes project directory with file cap', () => {
      const cg = new CodeGraph();
      cg.buildFromDirectory(process.cwd(), 50);
      const stats = cg.getStats();
      expect(stats.files).toBeGreaterThan(0);
      expect(stats.files).toBeLessThanOrEqual(50);
      expect(stats.nodes).toBeGreaterThan(0);
    });
  });

  describe('getBlastRadius', () => {
    it('returns blast radius for changed files', () => {
      const cg = new CodeGraph();
      // Build from specific files so we know they're indexed
      cg.buildFromFiles([
        path.resolve('src/core/token-optimizer.ts'),
        path.resolve('src/agents/base-agent.ts'),
      ]);
      const blast = cg.getBlastRadius(['src/core/token-optimizer.ts'], 2, 100);
      expect(blast.changedNodes.length).toBeGreaterThan(0);
      expect(blast.totalNodes).toBeGreaterThanOrEqual(blast.changedNodes.length);
    });

    it('returns impacted files', () => {
      const cg = new CodeGraph();
      cg.buildFromFiles([
        path.resolve('src/core/token-optimizer.ts'),
        path.resolve('src/core/provider-bridge.ts'),
      ]);
      const blast = cg.getBlastRadius(['src/core/token-optimizer.ts'], 2, 200);
      // provider-bridge imports token-optimizer, so it should be impacted
      expect(blast.impactedFiles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getSmartContext', () => {
    it('returns ranked files for context', () => {
      const cg = new CodeGraph();
      cg.buildFromDirectory(process.cwd(), 100);
      const context = cg.getSmartContext(['src/agents/base-agent.ts'], 5);
      expect(context.length).toBeGreaterThan(0);
      expect(context.length).toBeLessThanOrEqual(5);
      // Changed file should be first
      expect(context[0]).toContain('base-agent');
    });
  });

  describe('formatBlastRadius', () => {
    it('returns formatted string', () => {
      const cg = new CodeGraph();
      cg.buildFromFiles([
        path.resolve('src/core/token-optimizer.ts'),
        path.resolve('src/agents/base-agent.ts'),
      ]);
      const formatted = cg.formatBlastRadius(['src/core/token-optimizer.ts']);
      expect(formatted).toContain('Blast Radius');
    });

    it('returns empty string for unknown files', () => {
      const cg = new CodeGraph();
      const formatted = cg.formatBlastRadius(['/nonexistent/file.ts']);
      expect(formatted).toBe('');
    });
  });

  describe('formatStructureSummary', () => {
    it('returns compact structure summary', () => {
      const cg = new CodeGraph();
      cg.buildFromFiles([path.resolve('src/core/token-optimizer.ts')]);
      const summary = cg.formatStructureSummary(['src/core/token-optimizer.ts']);
      expect(summary).toContain('token-optimizer');
      expect(summary).toContain('TokenOptimizer');
    });
  });

  describe('incrementalUpdate', () => {
    it('returns 0 for already-indexed unchanged files', () => {
      const cg = new CodeGraph();
      const file = path.resolve('src/core/token-optimizer.ts');
      cg.buildFromFiles([file]);
      const updated = cg.incrementalUpdate([file]);
      expect(updated).toBe(0);
    });
  });

  describe('query helpers', () => {
    it('getFileStructure returns nodes for indexed files', () => {
      const cg = new CodeGraph();
      cg.buildFromFiles([path.resolve('src/core/token-optimizer.ts')]);
      const nodes = cg.getFileStructure('src/core/token-optimizer.ts');
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.every(n => n.kind !== 'file')).toBe(true);
    });
  });
});

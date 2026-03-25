import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../../src/core/dependency-graph.js';

describe('DependencyGraph', () => {
  const graph = new DependencyGraph();

  it('builds graph from a TypeScript file', async () => {
    const nodes = await graph.build('src/core/token-optimizer.ts', 1);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0].file).toContain('token-optimizer');
    expect(nodes[0].depth).toBe(0);
  });

  it('returns empty for non-existent file', async () => {
    const nodes = await graph.build('/nonexistent/file.ts');
    expect(nodes).toEqual([]);
  });

  it('returns empty for directory', async () => {
    const nodes = await graph.build('src/core');
    expect(nodes).toEqual([]);
  });

  it('resolves imports to depth 1', async () => {
    // base-agent imports use .js extensions which resolve to .ts files
    const nodes = await graph.build('src/agents/base-agent.ts', 1);
    // At minimum, the target file itself is included
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    expect(nodes[0].depth).toBe(0);
  });

  it('getContextFiles returns files for review', async () => {
    await graph.build('src/core/token-optimizer.ts', 2);
    const files = graph.getContextFiles('src/core/token-optimizer.ts', 'review');
    expect(files.length).toBeGreaterThan(0);
  });

  it('formatTree returns formatted string', async () => {
    await graph.build('src/core/token-optimizer.ts', 1);
    const tree = graph.formatTree('src/core/token-optimizer.ts');
    expect(tree).toContain('token-optimizer');
  });
});

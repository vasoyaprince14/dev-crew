import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

interface DependencyNode {
  file: string;
  imports: string[];
  importedBy: string[];
  types: string[];
  depth: number;
}

export class DependencyGraph {
  private graph: Map<string, DependencyNode> = new Map();

  async build(targetFile: string, maxDepth = 2): Promise<DependencyNode[]> {
    this.graph.clear();
    const absTarget = path.resolve(targetFile);
    if (!fs.existsSync(absTarget) || fs.statSync(absTarget).isDirectory()) {
      return [];
    }
    await this.traverse(absTarget, 0, maxDepth, new Set());
    return Array.from(this.graph.values()).sort((a, b) => a.depth - b.depth);
  }

  getContextFiles(target: string, operation: 'review' | 'fix' | 'debug' | 'test'): string[] {
    const nodes = Array.from(this.graph.values());

    switch (operation) {
      case 'review':
        return nodes.filter(n => n.depth <= 1).map(n => n.file);
      case 'fix':
        return nodes.filter(n => n.depth === 0 || n.depth === 1).map(n => n.file);
      case 'debug':
        return nodes.filter(n => n.depth <= 2).map(n => n.file);
      case 'test':
        return nodes.filter(n => n.depth <= 1).map(n => n.file);
      default:
        return nodes.map(n => n.file);
    }
  }

  formatTree(targetFile: string): string {
    const target = path.resolve(targetFile);
    const node = this.graph.get(target);
    if (!node) return '';

    const lines: string[] = [chalk.bold(path.basename(target))];

    for (const imp of node.imports) {
      const impNode = this.graph.get(imp);
      const rel = path.relative(process.cwd(), imp);
      const suffix = impNode ? chalk.gray(' (included)') : '';
      lines.push(`├── imports → ${rel}${suffix}`);
    }

    for (const by of node.importedBy) {
      const rel = path.relative(process.cwd(), by);
      lines.push(`├── imported by → ${chalk.gray(rel)}`);
    }

    if (node.types.length > 0) {
      for (const t of node.types) {
        const rel = path.relative(process.cwd(), t);
        lines.push(`├── uses type → ${chalk.gray(rel)}`);
      }
    }

    const total = this.graph.size;
    const included = Array.from(this.graph.values()).filter(n => n.depth <= 1).length;
    lines.push('');
    lines.push(`${included} files included | ${total - included} at depth 2+`);

    return lines.join('\n');
  }

  private async traverse(file: string, depth: number, maxDepth: number, visited: Set<string>): Promise<void> {
    if (depth > maxDepth || visited.has(file)) return;
    visited.add(file);

    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch { return; }

    const imports = this.extractImports(file, content);
    const types = this.extractTypeImports(file, content);

    const node: DependencyNode = {
      file,
      imports,
      importedBy: [],
      types,
      depth,
    };

    this.graph.set(file, node);

    for (const imp of [...imports, ...types]) {
      await this.traverse(imp, depth + 1, maxDepth, visited);
      const impNode = this.graph.get(imp);
      if (impNode && !impNode.importedBy.includes(file)) {
        impNode.importedBy.push(file);
      }
    }
  }

  private extractImports(file: string, content: string): string[] {
    const imports: string[] = [];
    const regex = /from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        const resolved = this.resolveImport(file, match[1]);
        if (resolved) imports.push(resolved);
      }
    }
    return [...new Set(imports)];
  }

  private extractTypeImports(file: string, content: string): string[] {
    const imports: string[] = [];
    const regex = /import\s+type\s+\{[^}]+\}\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        const resolved = this.resolveImport(file, match[1]);
        if (resolved && !imports.includes(resolved)) imports.push(resolved);
      }
    }
    return imports;
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    const dir = path.dirname(fromFile);
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      const candidate = path.resolve(dir, importPath + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
    const direct = path.resolve(dir, importPath);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
    return null;
  }
}

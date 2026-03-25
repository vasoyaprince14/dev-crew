import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readFileSafe } from '../utils/file-reader.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  /** Unique qualified name: file#symbolName */
  id: string;
  kind: 'file' | 'function' | 'class' | 'type' | 'variable';
  name: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  isTest: boolean;
}

export interface GraphEdge {
  source: string; // node id
  target: string; // node id
  kind: 'imports' | 'calls' | 'extends' | 'implements' | 'contains' | 'tested_by';
}

export interface BlastRadiusResult {
  changedNodes: GraphNode[];
  impactedNodes: GraphNode[];
  impactedFiles: string[];
  depth: number;
  totalNodes: number;
}

export interface FileStructure {
  file: string;
  hash: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Regex-based structural parser (no native deps, works everywhere)
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage', '.next', '.nuxt',
  '__pycache__', '.pytest_cache', 'vendor', 'target', '.turbo', '.cache',
  '.venv', 'venv', 'env',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt',
  '.c', '.cpp', '.cs', '.swift', '.dart',
  '.rb', '.php', '.ex', '.exs', '.scala',
  '.vue', '.svelte',
]);

export class CodeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private fileHashes: Map<string, string> = new Map();
  private adjacency: Map<string, Set<string>> = new Map(); // forward
  private reverseAdj: Map<string, Set<string>> = new Map(); // reverse

  // -----------------------------------------------------------------------
  // Build graph for a project or set of files
  // -----------------------------------------------------------------------

  buildFromFiles(files: string[]): void {
    for (const file of files) {
      this.indexFile(file);
    }
    this.buildAdjacency();
  }

  buildFromDirectory(root: string, maxFiles = 500): void {
    const files = this.collectFiles(root, maxFiles);
    this.buildFromFiles(files);
  }

  /**
   * Incremental update — only re-index files that changed (by SHA-256 hash).
   * Returns number of files re-indexed.
   */
  incrementalUpdate(files: string[]): number {
    let updated = 0;
    for (const file of files) {
      const content = readFileSafe(file);
      if (!content) continue;
      const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
      if (this.fileHashes.get(file) === hash) continue;

      // Remove old nodes/edges for this file
      this.removeFile(file);
      this.indexFileContent(file, content, hash);
      updated++;
    }
    if (updated > 0) this.buildAdjacency();
    return updated;
  }

  // -----------------------------------------------------------------------
  // Blast radius — BFS from changed files/nodes
  // -----------------------------------------------------------------------

  getBlastRadius(changedFiles: string[], maxDepth = 2, maxNodes = 200): BlastRadiusResult {
    const changedNodeIds = new Set<string>();
    const changedNodes: GraphNode[] = [];

    // Resolve changed files to absolute paths
    const absChangedFiles = changedFiles.map(f => path.resolve(f));

    // Seed: all nodes in changed files
    for (const absFile of absChangedFiles) {
      for (const [id, node] of this.nodes) {
        if (node.file === absFile) {
          changedNodeIds.add(id);
          changedNodes.push(node);
        }
      }
      // Also add the file-level node
      const fileNodeId = absFile + '#__file__';
      if (this.nodes.has(fileNodeId)) {
        changedNodeIds.add(fileNodeId);
      }
    }

    // BFS: traverse both forward and reverse edges
    const visited = new Set<string>(changedNodeIds);
    let frontier = [...changedNodeIds];
    let depth = 0;

    while (depth < maxDepth && frontier.length > 0 && visited.size < maxNodes) {
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        // Forward neighbors (things this node affects)
        const fwd = this.adjacency.get(nodeId);
        if (fwd) {
          for (const neighbor of fwd) {
            if (!visited.has(neighbor) && visited.size < maxNodes) {
              visited.add(neighbor);
              nextFrontier.push(neighbor);
            }
          }
        }
        // Reverse neighbors (things that depend on this node)
        const rev = this.reverseAdj.get(nodeId);
        if (rev) {
          for (const neighbor of rev) {
            if (!visited.has(neighbor) && visited.size < maxNodes) {
              visited.add(neighbor);
              nextFrontier.push(neighbor);
            }
          }
        }
      }
      frontier = nextFrontier;
      depth++;
    }

    // Collect impacted (non-changed) nodes
    const impactedNodes: GraphNode[] = [];
    const impactedFileSet = new Set<string>();

    for (const id of visited) {
      if (changedNodeIds.has(id)) continue;
      const node = this.nodes.get(id);
      if (node) {
        impactedNodes.push(node);
        impactedFileSet.add(node.file);
      }
    }

    // Also add changed files
    for (const file of changedFiles) {
      impactedFileSet.add(path.resolve(file));
    }

    return {
      changedNodes,
      impactedNodes,
      impactedFiles: [...impactedFileSet],
      depth,
      totalNodes: visited.size,
    };
  }

  // -----------------------------------------------------------------------
  // Smart context selection — returns files ranked by relevance
  // -----------------------------------------------------------------------

  getSmartContext(changedFiles: string[], maxFiles = 10): string[] {
    const blast = this.getBlastRadius(changedFiles, 2, 300);

    // Score each impacted file by number of connections to changed files
    const fileScores = new Map<string, number>();
    for (const file of blast.impactedFiles) {
      fileScores.set(file, 0);
    }

    // Count edges connecting to changed files
    const absChanged = new Set(changedFiles.map(f => path.resolve(f)));
    for (const edge of this.edges) {
      const srcNode = this.nodes.get(edge.source);
      const tgtNode = this.nodes.get(edge.target);
      if (!srcNode || !tgtNode) continue;

      const srcChanged = absChanged.has(srcNode.file);
      const tgtChanged = absChanged.has(tgtNode.file);

      if (srcChanged && !tgtChanged) {
        fileScores.set(tgtNode.file, (fileScores.get(tgtNode.file) || 0) + 1);
      }
      if (tgtChanged && !srcChanged) {
        fileScores.set(srcNode.file, (fileScores.get(srcNode.file) || 0) + 1);
      }
    }

    // Sort by score (most connected first), exclude changed files themselves
    const changedAbsPaths = absChanged;
    const ranked = [...fileScores.entries()]
      .filter(([file]) => !changedAbsPaths.has(file))
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxFiles)
      .map(([file]) => path.relative(process.cwd(), file));

    // Changed files first, then related files
    const result = changedFiles.map(f => path.relative(process.cwd(), path.resolve(f)));
    for (const f of ranked) {
      if (!result.includes(f)) result.push(f);
    }

    return result.slice(0, maxFiles);
  }

  // -----------------------------------------------------------------------
  // Query helpers
  // -----------------------------------------------------------------------

  getCallersOf(functionName: string): GraphNode[] {
    const results: GraphNode[] = [];
    for (const edge of this.edges) {
      if (edge.kind !== 'calls') continue;
      const target = this.nodes.get(edge.target);
      if (target && target.name === functionName) {
        const caller = this.nodes.get(edge.source);
        if (caller) results.push(caller);
      }
    }
    return results;
  }

  getCalleesOf(functionName: string): GraphNode[] {
    const results: GraphNode[] = [];
    for (const edge of this.edges) {
      if (edge.kind !== 'calls') continue;
      const source = this.nodes.get(edge.source);
      if (source && source.name === functionName) {
        const callee = this.nodes.get(edge.target);
        if (callee) results.push(callee);
      }
    }
    return results;
  }

  getTestsFor(file: string): GraphNode[] {
    const absFile = path.resolve(file);
    const results: GraphNode[] = [];
    for (const edge of this.edges) {
      if (edge.kind !== 'tested_by') continue;
      const source = this.nodes.get(edge.source);
      if (source && source.file === absFile) {
        const test = this.nodes.get(edge.target);
        if (test) results.push(test);
      }
    }
    return results;
  }

  getFileStructure(file: string): GraphNode[] {
    const absFile = path.resolve(file);
    // Match both absolute and as stored (in case of path mismatches)
    return [...this.nodes.values()].filter(n =>
      (n.file === absFile || n.file === file) && n.kind !== 'file'
    );
  }

  /** Compact summary for AI prompt — just the structural skeleton */
  formatStructureSummary(files: string[]): string {
    const sections: string[] = [];
    for (const file of files) {
      const nodes = this.getFileStructure(file);
      if (nodes.length === 0) continue;

      const rel = path.relative(process.cwd(), path.resolve(file));
      const lines: string[] = [`### ${rel}`];
      for (const node of nodes) {
        const prefix = node.exported ? 'export ' : '';
        const testTag = node.isTest ? ' [test]' : '';
        lines.push(`  ${prefix}${node.kind} ${node.name} (L${node.lineStart}-${node.lineEnd})${testTag}`);
      }
      sections.push(lines.join('\n'));
    }
    return sections.join('\n\n');
  }

  /** Format blast radius for AI prompt */
  formatBlastRadius(changedFiles: string[]): string {
    const blast = this.getBlastRadius(changedFiles);
    if (blast.totalNodes === 0) return '';

    const lines: string[] = ['## Blast Radius Analysis'];
    if (blast.changedNodes.length === 0 && blast.impactedNodes.length === 0) return '';
    lines.push(`Changed: ${blast.changedNodes.length} symbols in ${changedFiles.length} files`);
    lines.push(`Impacted: ${blast.impactedNodes.length} symbols in ${blast.impactedFiles.length} files`);

    if (blast.impactedFiles.length > 0) {
      lines.push('\nImpacted files:');
      for (const file of blast.impactedFiles.slice(0, 15)) {
        const rel = path.relative(process.cwd(), file);
        const nodeCount = blast.impactedNodes.filter(n => n.file === file).length;
        lines.push(`  - ${rel} (${nodeCount} symbols)`);
      }
      if (blast.impactedFiles.length > 15) {
        lines.push(`  ... and ${blast.impactedFiles.length - 15} more files`);
      }
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  getStats(): { files: number; nodes: number; edges: number } {
    const files = new Set([...this.nodes.values()].map(n => n.file)).size;
    return { files, nodes: this.nodes.size, edges: this.edges.length };
  }

  // -----------------------------------------------------------------------
  // Internals — file indexing
  // -----------------------------------------------------------------------

  private indexFile(file: string): void {
    const absFile = path.resolve(file);
    const content = readFileSafe(absFile);
    if (!content) return;
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    if (this.fileHashes.get(absFile) === hash) return;
    this.indexFileContent(absFile, content, hash);
  }

  private indexFileContent(absFile: string, content: string, hash: string): void {
    this.fileHashes.set(absFile, hash);
    const ext = path.extname(absFile).toLowerCase();
    const lines = content.split('\n');

    // File-level node
    const fileNodeId = absFile + '#__file__';
    this.nodes.set(fileNodeId, {
      id: fileNodeId,
      kind: 'file',
      name: path.basename(absFile),
      file: absFile,
      lineStart: 1,
      lineEnd: lines.length,
      exported: false,
      isTest: this.isTestFile(absFile),
    });

    // Language-specific extraction
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      this.extractJavaScriptSymbols(absFile, content, lines);
    } else if (ext === '.py') {
      this.extractPythonSymbols(absFile, content, lines);
    } else if (ext === '.go') {
      this.extractGoSymbols(absFile, content, lines);
    } else if (['.java', '.kt'].includes(ext)) {
      this.extractJavaSymbols(absFile, content, lines);
    } else if (ext === '.rs') {
      this.extractRustSymbols(absFile, content, lines);
    }

    // Extract import edges (cross-language)
    this.extractImportEdges(absFile, content, ext);

    // Link test files to source files
    this.linkTestFiles(absFile);
  }

  // -----------------------------------------------------------------------
  // JS/TS extraction
  // -----------------------------------------------------------------------

  private extractJavaScriptSymbols(file: string, content: string, lines: string[]): void {
    // Functions: export (async)? function name, const name = (args) =>, etc.
    // Note: these run against `trimmed` (leading whitespace removed)
    // Top-level function patterns
    const topFuncPatterns = [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\w+\s*=>/,
    ];
    // Class method pattern (only matched when inside a class)
    const methodPattern = /^(?:private\s+|protected\s+|public\s+|readonly\s+|static\s+|abstract\s+|override\s+|get\s+|set\s+)*(?:async\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(/;

    // Classes: export? (abstract)? class Name
    const classPattern = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(\w+))?/;

    // Interfaces/Types: export? (interface|type) Name
    const typePattern = /^(?:export\s+)?(?:interface|type)\s+(\w+)/;

    let currentClass: string | null = null;
    let classStartBrace = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      // Track brace depth for class scope
      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;
      braceDepth += opens - closes;
      if (currentClass && braceDepth < classStartBrace) currentClass = null;

      // Class
      const classMatch = classPattern.exec(trimmed);
      if (classMatch) {
        const name = classMatch[1];
        const end = this.findBlockEnd(lines, i);
        const nodeId = `${file}#${name}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'class', name, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: trimmed.startsWith('export'),
          isTest: this.isTestFile(file),
        });
        this.edges.push({ source: file + '#__file__', target: nodeId, kind: 'contains' });
        currentClass = name;
        classStartBrace = braceDepth; // track when we entered the class

        if (classMatch[2]) {
          // extends
          this.edges.push({ source: nodeId, target: `*#${classMatch[2]}`, kind: 'extends' });
        }
        if (classMatch[3]) {
          this.edges.push({ source: nodeId, target: `*#${classMatch[3]}`, kind: 'implements' });
        }
        continue;
      }

      // Type/Interface
      const typeMatch = typePattern.exec(trimmed);
      if (typeMatch) {
        const name = typeMatch[1];
        const nodeId = `${file}#${name}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'type', name, file,
          lineStart: i + 1, lineEnd: i + 1,
          exported: trimmed.startsWith('export'),
          isTest: false,
        });
        this.edges.push({ source: file + '#__file__', target: nodeId, kind: 'contains' });
        continue;
      }

      // Functions — try top-level patterns first, then class methods
      let funcMatch: RegExpExecArray | null = null;
      for (const pattern of topFuncPatterns) {
        funcMatch = pattern.exec(trimmed);
        if (funcMatch) break;
      }
      // Class methods — only when inside a class and line is indented
      if (!funcMatch && currentClass && line.length > trimmed.length) {
        funcMatch = methodPattern.exec(trimmed);
        // Skip keywords that look like method names
        if (funcMatch && ['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return', 'throw', 'new', 'class', 'interface', 'type', 'import', 'export'].includes(funcMatch[1])) {
          if (funcMatch[1] !== 'constructor') funcMatch = null;
        }
      }

      if (funcMatch) {
        const name = funcMatch[1];
        if (!this.isJSBuiltin(name)) {
          const end = this.findBlockEnd(lines, i);
          const qualifiedName = currentClass ? `${currentClass}.${name}` : name;
          const nodeId = `${file}#${qualifiedName}`;
          this.nodes.set(nodeId, {
            id: nodeId, kind: 'function', name: qualifiedName, file,
            lineStart: i + 1, lineEnd: end + 1,
            exported: trimmed.startsWith('export'),
            isTest: this.isTestFunction(name, file),
          });

          const parent = currentClass ? `${file}#${currentClass}` : `${file}#__file__`;
          this.edges.push({ source: parent, target: nodeId, kind: 'contains' });

          // Extract function calls within this function body
          this.extractCallEdges(file, nodeId, lines, i, end);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Python extraction
  // -----------------------------------------------------------------------

  private extractPythonSymbols(file: string, content: string, lines: string[]): void {
    const funcPattern = /^(?:async\s+)?def\s+(\w+)/;
    const classPattern = /^class\s+(\w+)(?:\(([^)]+)\))?/;
    let currentClass: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;

      if (indent === 0) currentClass = null;

      const classMatch = classPattern.exec(trimmed);
      if (classMatch && indent === 0) {
        const name = classMatch[1];
        const end = this.findIndentBlockEnd(lines, i);
        const nodeId = `${file}#${name}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'class', name, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: !name.startsWith('_'),
          isTest: name.startsWith('Test') || this.isTestFile(file),
        });
        this.edges.push({ source: file + '#__file__', target: nodeId, kind: 'contains' });
        currentClass = name;

        if (classMatch[2]) {
          for (const base of classMatch[2].split(',').map(s => s.trim())) {
            if (base && base !== 'object') {
              this.edges.push({ source: nodeId, target: `*#${base}`, kind: 'extends' });
            }
          }
        }
        continue;
      }

      const funcMatch = funcPattern.exec(trimmed);
      if (funcMatch) {
        const name = funcMatch[1];
        const end = this.findIndentBlockEnd(lines, i);
        const qualifiedName = currentClass ? `${currentClass}.${name}` : name;
        const nodeId = `${file}#${qualifiedName}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'function', name: qualifiedName, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: !name.startsWith('_'),
          isTest: name.startsWith('test_') || this.isTestFile(file),
        });
        const parent = currentClass ? `${file}#${currentClass}` : `${file}#__file__`;
        this.edges.push({ source: parent, target: nodeId, kind: 'contains' });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Go extraction
  // -----------------------------------------------------------------------

  private extractGoSymbols(file: string, content: string, lines: string[]): void {
    const funcPattern = /^func\s+(?:\(\w+\s+\*?(\w+)\)\s+)?(\w+)\s*\(/;
    const typePattern = /^type\s+(\w+)\s+(struct|interface)/;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();

      const typeMatch = typePattern.exec(trimmed);
      if (typeMatch) {
        const name = typeMatch[1];
        const kind = typeMatch[2] === 'interface' ? 'type' : 'class';
        const end = this.findBlockEnd(lines, i);
        const nodeId = `${file}#${name}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: kind as any, name, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: name[0] === name[0].toUpperCase(),
          isTest: this.isTestFile(file),
        });
        this.edges.push({ source: file + '#__file__', target: nodeId, kind: 'contains' });
        continue;
      }

      const funcMatch = funcPattern.exec(trimmed);
      if (funcMatch) {
        const receiver = funcMatch[1];
        const name = funcMatch[2];
        const qualifiedName = receiver ? `${receiver}.${name}` : name;
        const end = this.findBlockEnd(lines, i);
        const nodeId = `${file}#${qualifiedName}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'function', name: qualifiedName, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: name[0] === name[0].toUpperCase(),
          isTest: name.startsWith('Test') || name.startsWith('Benchmark'),
        });
        this.edges.push({ source: file + '#__file__', target: nodeId, kind: 'contains' });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Java/Kotlin extraction
  // -----------------------------------------------------------------------

  private extractJavaSymbols(file: string, content: string, lines: string[]): void {
    const classPattern = /^(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?(?:class|interface)\s+(\w+)(?:\s+extends\s+(\w+))?/;
    const funcPattern = /^\s+(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:abstract\s+)?(?:\w+(?:<[^>]+>)?\s+)(\w+)\s*\(/;

    let currentClass: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();

      const classMatch = classPattern.exec(trimmed);
      if (classMatch) {
        const name = classMatch[1];
        const end = this.findBlockEnd(lines, i);
        const nodeId = `${file}#${name}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'class', name, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: trimmed.includes('public'),
          isTest: name.endsWith('Test') || name.endsWith('Tests'),
        });
        this.edges.push({ source: file + '#__file__', target: nodeId, kind: 'contains' });
        currentClass = name;
        continue;
      }

      const funcMatch = funcPattern.exec(trimmed);
      if (funcMatch && currentClass) {
        const name = funcMatch[1];
        if (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) continue;
        const qualifiedName = `${currentClass}.${name}`;
        const end = this.findBlockEnd(lines, i);
        const nodeId = `${file}#${qualifiedName}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'function', name: qualifiedName, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: trimmed.includes('public'),
          isTest: name.startsWith('test') || trimmed.includes('@Test'),
        });
        this.edges.push({ source: `${file}#${currentClass}`, target: nodeId, kind: 'contains' });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Rust extraction
  // -----------------------------------------------------------------------

  private extractRustSymbols(file: string, content: string, lines: string[]): void {
    const funcPattern = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/;
    const structPattern = /^(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)/;
    const implPattern = /^impl(?:<[^>]+>)?\s+(\w+)/;

    let currentImpl: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();

      const structMatch = structPattern.exec(trimmed);
      if (structMatch) {
        const name = structMatch[1];
        const end = this.findBlockEnd(lines, i);
        const nodeId = `${file}#${name}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'class', name, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: trimmed.startsWith('pub'),
          isTest: false,
        });
        this.edges.push({ source: file + '#__file__', target: nodeId, kind: 'contains' });
        continue;
      }

      const implMatch = implPattern.exec(trimmed);
      if (implMatch) {
        currentImpl = implMatch[1];
        continue;
      }

      const funcMatch = funcPattern.exec(trimmed);
      if (funcMatch) {
        const name = funcMatch[1];
        const qualifiedName = currentImpl ? `${currentImpl}::${name}` : name;
        const end = this.findBlockEnd(lines, i);
        const nodeId = `${file}#${qualifiedName}`;
        this.nodes.set(nodeId, {
          id: nodeId, kind: 'function', name: qualifiedName, file,
          lineStart: i + 1, lineEnd: end + 1,
          exported: trimmed.startsWith('pub'),
          isTest: trimmed.includes('#[test]') || name.startsWith('test_'),
        });
        const parent = currentImpl ? `${file}#${currentImpl}` : `${file}#__file__`;
        this.edges.push({ source: parent, target: nodeId, kind: 'contains' });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Import edge extraction
  // -----------------------------------------------------------------------

  private extractImportEdges(file: string, content: string, ext: string): void {
    const fileNodeId = file + '#__file__';

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
          const resolved = this.resolveImport(file, importPath);
          if (resolved) {
            const targetId = resolved + '#__file__';
            this.edges.push({ source: fileNodeId, target: targetId, kind: 'imports' });
          }
        }
      }
    } else if (ext === '.py') {
      const importRegex = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const mod = match[1] || match[2];
        if (mod && mod.startsWith('.')) {
          const resolved = this.resolvePythonImport(file, mod);
          if (resolved) {
            this.edges.push({ source: fileNodeId, target: resolved + '#__file__', kind: 'imports' });
          }
        }
      }
    } else if (ext === '.go') {
      const importRegex = /import\s+(?:\(\s*([\s\S]*?)\)|"([^"]+)")/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        // Go imports are package-level, not file-level — skip for now
      }
    }
  }

  // -----------------------------------------------------------------------
  // Call edge extraction (within function bodies)
  // -----------------------------------------------------------------------

  private extractCallEdges(file: string, callerId: string, lines: string[], start: number, end: number): void {
    const callPattern = /(?<!\w)(\w+)\s*\(/g;
    for (let i = start; i <= end && i < lines.length; i++) {
      let match;
      while ((match = callPattern.exec(lines[i])) !== null) {
        const callee = match[1];
        if (this.isJSBuiltin(callee)) continue;
        if (['if', 'for', 'while', 'switch', 'catch', 'return', 'throw', 'new', 'typeof', 'void', 'delete'].includes(callee)) continue;

        // Try to resolve to a known node (same file first, then wildcard)
        const sameFileTarget = `${file}#${callee}`;
        const wildcardTarget = `*#${callee}`;

        if (this.nodes.has(sameFileTarget)) {
          this.edges.push({ source: callerId, target: sameFileTarget, kind: 'calls' });
        } else {
          // Store as wildcard — resolved during adjacency build
          this.edges.push({ source: callerId, target: wildcardTarget, kind: 'calls' });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Test linkage
  // -----------------------------------------------------------------------

  private linkTestFiles(file: string): void {
    if (!this.isTestFile(file)) return;

    // Try to find the source file this test covers
    const base = path.basename(file);
    const possibleSources = [
      base.replace(/\.test\./, '.').replace(/\.spec\./, '.'),
      base.replace(/_test\./, '.'),
      base.replace(/test_/, ''),
    ];

    const dir = path.dirname(file);
    const parentDir = path.dirname(dir);

    for (const src of possibleSources) {
      // Same directory
      const sameDirPath = path.join(dir, src);
      if (this.fileHashes.has(sameDirPath)) {
        this.edges.push({ source: sameDirPath + '#__file__', target: file + '#__file__', kind: 'tested_by' });
        return;
      }
      // Parent/src directory
      for (const subdir of ['src', 'lib', 'app', '']) {
        const candidate = path.join(parentDir, subdir, src);
        if (this.fileHashes.has(candidate)) {
          this.edges.push({ source: candidate + '#__file__', target: file + '#__file__', kind: 'tested_by' });
          return;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private findBlockEnd(lines: string[], start: number): number {
    let depth = 0;
    let foundOpen = false;
    for (let i = start; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') { depth++; foundOpen = true; }
        if (ch === '}') depth--;
        if (foundOpen && depth === 0) return i;
      }
    }
    return Math.min(start + 50, lines.length - 1);
  }

  private findIndentBlockEnd(lines: string[], start: number): number {
    const baseIndent = lines[start].length - lines[start].trimStart().length;
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      const indent = line.length - line.trimStart().length;
      if (indent <= baseIndent) return i - 1;
    }
    return lines.length - 1;
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    const dir = path.dirname(fromFile);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx'];
    for (const ext of extensions) {
      const candidate = path.resolve(dir, importPath + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
    const direct = path.resolve(dir, importPath);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
    return null;
  }

  private resolvePythonImport(fromFile: string, mod: string): string | null {
    const dir = path.dirname(fromFile);
    const parts = mod.replace(/^\.+/, '');
    const dots = mod.length - parts.length;
    let base = dir;
    for (let i = 1; i < dots; i++) base = path.dirname(base);

    const filePath = path.join(base, parts.replace(/\./g, '/'));
    for (const ext of ['.py', '/__init__.py']) {
      const candidate = filePath + ext;
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private isTestFile(file: string): boolean {
    const base = path.basename(file).toLowerCase();
    return base.includes('.test.') || base.includes('.spec.') ||
      base.includes('_test.') || base.startsWith('test_') ||
      file.includes('/tests/') || file.includes('/__tests__/') ||
      file.includes('/test/');
  }

  private isTestFunction(name: string, file: string): boolean {
    return name.startsWith('test') || name.startsWith('it') ||
      name.startsWith('describe') || this.isTestFile(file);
  }

  private isJSBuiltin(name: string): boolean {
    return JS_BUILTINS.has(name);
  }

  private removeFile(file: string): void {
    // Remove all nodes for this file
    const toRemove: string[] = [];
    for (const [id, node] of this.nodes) {
      if (node.file === file) toRemove.push(id);
    }
    for (const id of toRemove) this.nodes.delete(id);

    // Remove edges involving this file's nodes
    const removeSet = new Set(toRemove);
    this.edges = this.edges.filter(e => !removeSet.has(e.source) && !removeSet.has(e.target));
    this.fileHashes.delete(file);
  }

  private buildAdjacency(): void {
    this.adjacency.clear();
    this.reverseAdj.clear();

    // Resolve wildcard targets (*#name) to actual nodes
    const nameIndex = new Map<string, string[]>();
    for (const [id, node] of this.nodes) {
      const existing = nameIndex.get(node.name) || [];
      existing.push(id);
      nameIndex.set(node.name, existing);
    }

    for (const edge of this.edges) {
      let targets: string[];
      if (edge.target.startsWith('*#')) {
        const name = edge.target.slice(2);
        targets = nameIndex.get(name) || [];
      } else {
        targets = [edge.target];
      }

      for (const target of targets) {
        if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, new Set());
        this.adjacency.get(edge.source)!.add(target);

        if (!this.reverseAdj.has(target)) this.reverseAdj.set(target, new Set());
        this.reverseAdj.get(target)!.add(edge.source);
      }
    }
  }

  private collectFiles(root: string, maxFiles: number): string[] {
    const files: string[] = [];
    const walk = (dir: string): void => {
      if (files.length >= maxFiles) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

      for (const entry of entries) {
        if (files.length >= maxFiles) return;
        if (entry.name.startsWith('.') && entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;

        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (CODE_EXTENSIONS.has(path.extname(full).toLowerCase())) {
          files.push(full);
        }
      }
    };
    walk(root);
    return files;
  }
}

// JS/TS builtins to skip in call extraction
const JS_BUILTINS = new Set([
  'console', 'log', 'warn', 'error', 'info', 'debug', 'trace',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'Promise', 'resolve', 'reject',
  'require', 'import', 'super', 'this',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Symbol', 'Map', 'Set',
  'Date', 'RegExp', 'Error', 'JSON', 'Math',
  'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat',
  'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'some', 'every',
  'includes', 'indexOf', 'join', 'split', 'trim', 'replace', 'match', 'test',
  'keys', 'values', 'entries', 'assign', 'freeze', 'create',
  'parse', 'stringify', 'toString', 'valueOf', 'hasOwnProperty',
  'then', 'catch', 'finally', 'all', 'race', 'allSettled',
  'from', 'of', 'isArray',
  'abs', 'ceil', 'floor', 'round', 'min', 'max', 'random',
  'bind', 'call', 'apply',
  'addEventListener', 'removeEventListener', 'querySelector', 'getElementById',
  'createElement', 'appendChild', 'remove',
  'fetch', 'Response', 'Request', 'Headers', 'URL', 'URLSearchParams',
  'Buffer', 'process', 'exit',
  'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
  'jest', 'vi', 'mock', 'fn', 'spyOn',
]);

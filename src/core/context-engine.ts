import fs from 'node:fs';
import path from 'node:path';
import type { ProjectInfo } from '../types/config.js';
import { readFileSafe, walkDir, getExtensionLabel } from '../utils/file-reader.js';

interface ContextOptions {
  files?: string[];
  projectInfo: ProjectInfo;
  includeSchema?: boolean;
  includeConfig?: boolean;
  maxDepth?: number;
  maxTokenBudget?: number;
}

export class ContextEngine {
  async gather(options: ContextOptions): Promise<string> {
    const sections: string[] = [];

    // Compact project line (not a full section)
    sections.push(this.projectLine(options.projectInfo));

    // Target files — the actual content the user wants analyzed
    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        const content = this.readFileContext(file, options.maxDepth || 2);
        if (content) sections.push(content);
      }
    } else {
      // No files specified — include a compact directory tree so AI knows the structure
      const tree = this.getDirectoryTree(options.projectInfo.root, 2);
      if (tree) sections.push(tree);
    }

    // Schema — only when explicitly requested by agent
    if (options.includeSchema && options.projectInfo.orm) {
      const schema = this.getSchema(options.projectInfo);
      if (schema) sections.push(schema);
    }

    // Config — only when explicitly requested by agent
    if (options.includeConfig) {
      const configs = this.getConfigContext(options.projectInfo);
      if (configs) sections.push(configs);
    }

    // Skip related files import resolution — it adds too many tokens
    // for marginal benefit. The user can @tag additional files if needed.

    return sections.filter(Boolean).join('\n\n');
  }

  private projectLine(info: ProjectInfo): string {
    // Single line, not a full section — saves ~200 tokens vs old format
    const parts: string[] = [info.language];
    if (info.framework) parts.push(info.framework);
    if (info.database.length) parts.push('DB: ' + info.database.join(','));
    if (info.orm) parts.push('ORM: ' + info.orm);
    return `Project: ${info.name} (${parts.join(', ')})`;
  }

  private readFileContext(filePath: string, maxDepth: number): string | null {
    const absPath = path.resolve(filePath);

    if (!fs.existsSync(absPath)) {
      return `[File not found: ${filePath}]`;
    }

    const stat = fs.statSync(absPath);

    if (stat.isDirectory()) {
      return this.readDirectoryContext(absPath, maxDepth);
    }

    const content = readFileSafe(absPath);
    if (!content) return null;

    // Strip comments for token savings (keep code, remove noise)
    const stripped = this.stripComments(content, absPath);

    const relativePath = path.relative(process.cwd(), absPath);
    const ext = getExtensionLabel(absPath);
    return `## ${relativePath}\n\`\`\`${ext}\n${stripped}\n\`\`\``;
  }

  private readDirectoryContext(dirPath: string, maxDepth: number): string {
    const effectiveDepth = Math.min(maxDepth, 2);
    const files = walkDir(dirPath, effectiveDepth);
    const sections: string[] = [];
    const maxFiles = 8;               // Down from 10
    const maxTotalChars = 30_000;     // Down from 50K (~7.5K tokens)
    const maxFileSize = 6_000;        // Down from 8K
    let totalChars = 0;

    for (const file of files) {
      if (sections.length >= maxFiles) break;
      const content = readFileSafe(file);
      if (!content) continue;
      if (content.length > maxFileSize) continue;
      if (totalChars + content.length > maxTotalChars) break;

      const stripped = this.stripComments(content, file);
      totalChars += stripped.length;
      const relativePath = path.relative(process.cwd(), file);
      const ext = getExtensionLabel(file);
      sections.push(`## ${relativePath}\n\`\`\`${ext}\n${stripped}\n\`\`\``);
    }

    const skipped = files.length - sections.length;
    if (skipped > 0) {
      sections.push(`[${skipped} more files — use @path/to/file for specific files]`);
    }

    return sections.join('\n\n');
  }

  /**
   * Strip comments from code to save tokens.
   * Keeps the code, removes noise. ~10-30% token savings on typical files.
   */
  private stripComments(content: string, filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const jsLike = ['.ts', '.tsx', '.js', '.jsx', '.java', '.kt', '.go', '.rs', '.c', '.cpp', '.cs', '.swift', '.dart'];
    const pyLike = ['.py', '.rb', '.sh', '.bash', '.zsh', '.yaml', '.yml'];

    let result = content;

    if (jsLike.includes(ext)) {
      // Remove single-line comments (but not URLs with //)
      result = result.replace(/^\s*\/\/(?!:).*$/gm, '');
      // Remove multi-line comments
      result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    } else if (pyLike.includes(ext)) {
      // Remove # comments (but not shebangs)
      result = result.replace(/^\s*#(?!!).*$/gm, '');
    }

    // Collapse multiple blank lines
    result = result.replace(/\n{3,}/g, '\n\n');
    // Remove trailing whitespace
    result = result.replace(/[ \t]+$/gm, '');

    return result.trim();
  }

  private getDirectoryTree(root: string, depth: number): string | null {
    const SKIP = new Set([
      'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'out',
      '__pycache__', '.venv', 'venv', 'env', '.env', '.tox', '.mypy_cache',
      '.pytest_cache', 'coverage', '.turbo', '.cache', '.parcel-cache',
    ]);

    const lines: string[] = ['## Project Structure'];
    let count = 0;
    const maxEntries = 80;

    const walk = (dir: string, prefix: string, currentDepth: number): void => {
      if (currentDepth > depth || count >= maxEntries) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      // Sort: directories first, then files
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        if (count >= maxEntries) break;
        if (entry.name.startsWith('.') && entry.isDirectory()) continue;
        if (SKIP.has(entry.name)) continue;

        count++;
        if (entry.isDirectory()) {
          lines.push(`${prefix}${entry.name}/`);
          walk(path.join(dir, entry.name), prefix + '  ', currentDepth + 1);
        } else {
          lines.push(`${prefix}${entry.name}`);
        }
      }
    };

    walk(root, '', 0);

    if (count === 0) return null;
    return lines.join('\n');
  }

  private getSchema(info: ProjectInfo): string | null {
    // Prisma
    const prismaPath = path.join(info.root, 'prisma/schema.prisma');
    if (fs.existsSync(prismaPath)) {
      const content = readFileSafe(prismaPath);
      if (content) {
        // Only include model definitions, skip comments and generator blocks
        const models = content.split('\n')
          .filter(line => !line.startsWith('//') && !line.startsWith('generator'))
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        return `## Schema (Prisma)\n\`\`\`prisma\n${models}\n\`\`\``;
      }
    }

    // Drizzle
    const drizzlePath = path.join(info.root, 'src/db/schema.ts');
    if (fs.existsSync(drizzlePath)) {
      const content = readFileSafe(drizzlePath);
      if (content) return `## Schema (Drizzle)\n\`\`\`typescript\n${this.stripComments(content, drizzlePath)}\n\`\`\``;
    }

    return null;
  }

  private getConfigContext(info: ProjectInfo): string | null {
    const configs: string[] = [];
    // Only include files that actually affect code behavior
    const configFiles = ['.env.example', 'docker-compose.yml', 'docker-compose.yaml'];
    const maxConfigSize = 3_000; // Cap config file size

    for (const file of configFiles) {
      const filePath = path.join(info.root, file);
      if (fs.existsSync(filePath)) {
        let content = readFileSafe(filePath);
        if (content) {
          if (content.length > maxConfigSize) {
            content = content.slice(0, maxConfigSize) + '\n[... truncated]';
          }
          configs.push(`## ${file}\n\`\`\`\n${content}\n\`\`\``);
        }
      }
    }

    return configs.length > 0 ? configs.join('\n\n') : null;
  }
}

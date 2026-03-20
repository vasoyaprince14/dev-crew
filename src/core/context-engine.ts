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

    // Project overview
    sections.push(this.projectOverview(options.projectInfo));

    // Target files
    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        const content = this.readFileContext(file, options.maxDepth || 2);
        if (content) sections.push(content);
      }
    }

    // Schema
    if (options.includeSchema !== false && options.projectInfo.orm) {
      const schema = this.getSchema(options.projectInfo);
      if (schema) sections.push(schema);
    }

    // Config files
    if (options.includeConfig !== false) {
      const configs = this.getConfigContext(options.projectInfo);
      if (configs) sections.push(configs);
    }

    // Related files (imports)
    if (options.files && options.files.length > 0) {
      const related = this.getRelatedFiles(options.files, options.projectInfo);
      if (related) sections.push(related);
    }

    return sections.filter(Boolean).join('\n\n---\n\n');
  }

  private projectOverview(info: ProjectInfo): string {
    return `# Project: ${info.name}
Language: ${info.language}
Framework: ${info.framework || 'unknown'}
Database: ${info.database.join(', ') || 'none'}
ORM: ${info.orm || 'none'}
Test Framework: ${info.testFramework || 'none'}
Structure: ${info.structure}
Monorepo: ${info.monorepo ? 'yes' : 'no'}`;
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

    const relativePath = path.relative(process.cwd(), absPath);
    const ext = getExtensionLabel(absPath);
    return `## File: ${relativePath}\n\`\`\`${ext}\n${content}\n\`\`\``;
  }

  private readDirectoryContext(dirPath: string, maxDepth: number): string {
    const files = walkDir(dirPath, maxDepth);
    const sections: string[] = [];

    for (const file of files) {
      const content = readFileSafe(file);
      if (!content) continue;
      const relativePath = path.relative(process.cwd(), file);
      const ext = getExtensionLabel(file);
      sections.push(`## File: ${relativePath}\n\`\`\`${ext}\n${content}\n\`\`\``);
    }

    return sections.join('\n\n');
  }

  private getSchema(info: ProjectInfo): string | null {
    // Prisma
    const prismaPath = path.join(info.root, 'prisma/schema.prisma');
    if (fs.existsSync(prismaPath)) {
      const content = readFileSafe(prismaPath);
      if (content) return `## Database Schema (Prisma)\n\`\`\`prisma\n${content}\n\`\`\``;
    }

    // Drizzle schema
    const drizzlePath = path.join(info.root, 'src/db/schema.ts');
    if (fs.existsSync(drizzlePath)) {
      const content = readFileSafe(drizzlePath);
      if (content) return `## Database Schema (Drizzle)\n\`\`\`typescript\n${content}\n\`\`\``;
    }

    // TypeORM entities
    const entitiesDir = path.join(info.root, 'src/entities');
    if (fs.existsSync(entitiesDir)) {
      return this.readDirectoryContext(entitiesDir, 1);
    }

    return null;
  }

  private getConfigContext(info: ProjectInfo): string | null {
    const configs: string[] = [];
    const configFiles = [
      '.env.example',
      'docker-compose.yml',
      'docker-compose.yaml',
      'nest-cli.json',
    ];

    for (const file of configFiles) {
      const filePath = path.join(info.root, file);
      if (fs.existsSync(filePath)) {
        const content = readFileSafe(filePath);
        if (content) {
          configs.push(`## Config: ${file}\n\`\`\`\n${content}\n\`\`\``);
        }
      }
    }

    return configs.length > 0 ? configs.join('\n\n') : null;
  }

  private getRelatedFiles(targetFiles: string[], info: ProjectInfo): string | null {
    const related: Set<string> = new Set();

    for (const file of targetFiles) {
      const absPath = path.resolve(file);
      if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) continue;

      const content = readFileSafe(absPath);
      if (!content) continue;

      const importRegex = /from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
          const resolved = this.resolveImport(absPath, importPath);
          if (resolved && !targetFiles.includes(resolved) && !targetFiles.includes(path.relative(process.cwd(), resolved))) {
            related.add(resolved);
          }
        }
      }
    }

    if (related.size === 0) return null;

    const sections: string[] = [];
    for (const file of related) {
      const content = readFileSafe(file);
      if (!content) continue;
      const relativePath = path.relative(process.cwd(), file);
      const ext = getExtensionLabel(file);
      sections.push(`## Related: ${relativePath}\n\`\`\`${ext}\n${content}\n\`\`\``);
    }

    return sections.length > 0 ? sections.join('\n\n') : null;
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    const dir = path.dirname(fromFile);
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];

    for (const ext of extensions) {
      const candidate = path.resolve(dir, importPath + ext);
      if (fs.existsSync(candidate)) return candidate;
    }

    // Try without extension (already has one)
    const direct = path.resolve(dir, importPath);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

    return null;
  }
}

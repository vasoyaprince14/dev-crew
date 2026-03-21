import fs from 'node:fs';
import path from 'node:path';
import { Logger } from '../utils/logger.js';

export interface GeneratedFile {
  path: string;
  content: string;
  description?: string;
}

export interface WriteResult {
  written: string[];
  skipped: string[];
  errors: Array<{ path: string; error: string }>;
}

export class FileWriter {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async writeAll(
    outputDir: string,
    files: GeneratedFile[],
    options: { dryRun?: boolean } = {},
  ): Promise<WriteResult> {
    const result: WriteResult = { written: [], skipped: [], errors: [] };

    // Ensure output dir exists
    if (!options.dryRun) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const file of files) {
      // Sanitize path — prevent directory traversal
      const normalized = path.normalize(file.path).replace(/^(\.\.[/\\])+/, '');
      const fullPath = path.join(outputDir, normalized);

      // Ensure the file stays within output dir
      if (!fullPath.startsWith(path.resolve(outputDir))) {
        result.errors.push({ path: file.path, error: 'Path escapes output directory' });
        continue;
      }

      if (options.dryRun) {
        result.written.push(normalized);
        continue;
      }

      try {
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, file.content, 'utf-8');
        result.written.push(normalized);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ path: normalized, error: msg });
      }
    }

    return result;
  }

  printTree(files: GeneratedFile[]): void {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const dirs = new Set<string>();

    for (const file of sorted) {
      const parts = file.path.split('/');
      // Print directory prefixes we haven't seen
      for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/');
        if (!dirs.has(dir)) {
          dirs.add(dir);
          const indent = '  '.repeat(i - 1);
          const name = parts[i - 1] + '/';
          console.log(`    ${indent}${name}`);
        }
      }
      // Print file
      const indent = '  '.repeat(parts.length - 1);
      const name = parts[parts.length - 1];
      console.log(`    ${indent}${name}`);
    }
  }
}

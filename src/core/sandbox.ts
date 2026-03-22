/**
 * Sandbox — Validates generated code in an isolated temp directory.
 *
 * Runs real build tools (npm install, tsc) against generated files
 * to catch errors before writing to the user's project.
 *
 * Part of the self-healing pipeline: Generate → Validate → Fix → Repeat.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { GeneratedFile } from './file-writer.js';

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
}

export class Sandbox {
  private dir: string;

  constructor() {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-crew-sandbox-'));
  }

  get path(): string {
    return this.dir;
  }

  /**
   * Write generated files into the sandbox directory.
   */
  writeFiles(files: GeneratedFile[]): void {
    for (const file of files) {
      const normalized = path.normalize(file.path).replace(/^(\.\.[/\\])+/, '');
      const fullPath = path.join(this.dir, normalized);

      // Safety: prevent path traversal
      if (!fullPath.startsWith(this.dir)) continue;

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf-8');
    }
  }

  /**
   * Run validation checks against the sandbox files.
   * Returns structured results with per-check status.
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checks: ValidationCheck[] = [];

    // Check 1: package.json exists and is valid JSON
    const pkgPath = path.join(this.dir, 'package.json');
    const hasPkg = fs.existsSync(pkgPath);

    if (!hasPkg) {
      checks.push({ name: 'package.json', status: 'fail', message: 'Missing package.json' });
      errors.push('Missing package.json — cannot install dependencies');
      return { success: false, errors, warnings, checks };
    }

    try {
      JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      checks.push({ name: 'package.json', status: 'pass' });
    } catch {
      checks.push({ name: 'package.json', status: 'fail', message: 'Invalid JSON in package.json' });
      errors.push('package.json is not valid JSON');
      return { success: false, errors, warnings, checks };
    }

    // Check 2: npm install
    try {
      execSync('npm install --ignore-scripts 2>&1', {
        cwd: this.dir,
        stdio: 'pipe',
        timeout: 120000,
        env: { ...process.env, NODE_ENV: 'development' },
      });
      checks.push({ name: 'npm install', status: 'pass' });
    } catch (err) {
      const stderr = extractOutput(err);
      // npm install warnings aren't fatal — only real failures
      if (stderr.includes('ERR!') || stderr.includes('ERESOLVE')) {
        checks.push({ name: 'npm install', status: 'fail', message: truncate(stderr, 500) });
        errors.push(`npm install failed:\n${truncate(stderr, 1000)}`);
      } else {
        // Warnings only
        checks.push({ name: 'npm install', status: 'pass', message: 'Completed with warnings' });
        if (stderr.trim()) warnings.push(truncate(stderr, 300));
      }
    }

    // Check 3: TypeScript compilation
    const hasTsConfig = fs.existsSync(path.join(this.dir, 'tsconfig.json'));
    const hasTsFiles = this.hasFilesWithExtension('.ts') || this.hasFilesWithExtension('.tsx');

    if (hasTsConfig && hasTsFiles) {
      try {
        execSync('npx tsc --noEmit 2>&1', {
          cwd: this.dir,
          stdio: 'pipe',
          timeout: 60000,
        });
        checks.push({ name: 'TypeScript', status: 'pass' });
      } catch (err) {
        const output = extractOutput(err);
        checks.push({ name: 'TypeScript', status: 'fail', message: truncate(output, 500) });
        errors.push(`TypeScript errors:\n${truncate(output, 2000)}`);
      }
    } else {
      checks.push({ name: 'TypeScript', status: 'skip', message: 'No tsconfig.json or .ts files' });
    }

    // Check 4: Basic file structure sanity
    const entryPoints = ['src/main.ts', 'src/index.ts', 'src/app.ts', 'index.ts', 'main.ts',
      'src/main.tsx', 'src/index.tsx', 'app/page.tsx', 'pages/index.tsx', 'app/layout.tsx'];
    const hasEntry = entryPoints.some(ep => fs.existsSync(path.join(this.dir, ep)));

    if (hasEntry) {
      checks.push({ name: 'Entry point', status: 'pass' });
    } else {
      checks.push({ name: 'Entry point', status: 'fail', message: 'No recognizable entry point found' });
      warnings.push('No entry point file found (src/main.ts, src/index.ts, etc.)');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      checks,
    };
  }

  /**
   * Clean up the sandbox directory.
   */
  cleanup(): void {
    try {
      fs.rmSync(this.dir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
  }

  private hasFilesWithExtension(ext: string): boolean {
    return this.walkDir(this.dir).some(f => f.endsWith(ext));
  }

  private walkDir(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
          results.push(...this.walkDir(fullPath));
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch { /* ignore read errors */ }
    return results;
  }
}

function extractOutput(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.stdout) return String(e.stdout);
    if (e.stderr) return String(e.stderr);
    if (e.message) return String(e.message);
  }
  return String(err);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n...(truncated)';
}

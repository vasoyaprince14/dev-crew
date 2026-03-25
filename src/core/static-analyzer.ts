import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface StaticFinding {
  type: 'error' | 'warning' | 'info';
  source: string;       // 'tsc' | 'eslint' | 'pattern'
  file: string;
  line?: number;
  message: string;
}

/**
 * Runs real local static analysis tools BEFORE sending to AI.
 * This gives the AI concrete findings to work with instead of
 * guessing from raw code alone.
 */
export class StaticAnalyzer {

  /**
   * Run all available analyzers on the given files.
   * Returns concrete findings from real tools — not AI guesses.
   */
  analyze(files: string[]): StaticFinding[] {
    if (files.length === 0) return [];
    const findings: StaticFinding[] = [];

    findings.push(...this.runTypeCheck(files));
    findings.push(...this.runLintCheck(files));
    findings.push(...this.runPatternScan(files));

    return findings;
  }

  /**
   * Format findings as context for the AI prompt.
   */
  formatForPrompt(findings: StaticFinding[]): string {
    if (findings.length === 0) return '';
    const lines = ['## Local Analysis (real tool output — not AI-generated)'];
    for (const f of findings.slice(0, 30)) { // cap at 30 findings
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`- [${f.source}] ${f.type.toUpperCase()}: ${loc} — ${f.message}`);
    }
    if (findings.length > 30) {
      lines.push(`... and ${findings.length - 30} more findings`);
    }
    return lines.join('\n');
  }

  /**
   * TypeScript type checking — real compiler errors.
   */
  private runTypeCheck(files: string[]): StaticFinding[] {
    // Only run if tsconfig exists and files are TS
    const tsFiles = files.filter(f => /\.tsx?$/.test(f));
    if (tsFiles.length === 0 || !fs.existsSync('tsconfig.json')) return [];

    try {
      // Run tsc on specific files with --noEmit
      const result = execSync(
        `npx tsc --noEmit --pretty false ${tsFiles.join(' ')} 2>&1`,
        { encoding: 'utf-8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      return this.parseTscOutput(result);
    } catch (err: any) {
      // tsc exits non-zero when there are errors — that's the output we want
      const output = err.stdout || err.stderr || '';
      return this.parseTscOutput(output);
    }
  }

  private parseTscOutput(output: string): StaticFinding[] {
    const findings: StaticFinding[] = [];
    // Format: file(line,col): error TS1234: message
    const regex = /^(.+?)\((\d+),\d+\):\s*(error|warning)\s+TS\d+:\s*(.+)$/gm;
    let match;
    while ((match = regex.exec(output)) !== null) {
      findings.push({
        type: match[3] === 'error' ? 'error' : 'warning',
        source: 'tsc',
        file: match[1],
        line: parseInt(match[2]),
        message: match[4].trim(),
      });
    }
    return findings;
  }

  /**
   * ESLint — real linting errors.
   */
  private runLintCheck(files: string[]): StaticFinding[] {
    const jsFiles = files.filter(f => /\.[jt]sx?$/.test(f));
    if (jsFiles.length === 0) return [];

    // Check if eslint is available
    const eslintConfigExists = [
      '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
      '.eslintrc.cjs', '.eslintrc.mjs', 'eslint.config.js', 'eslint.config.mjs',
      'eslint.config.ts',
    ].some(f => fs.existsSync(f));
    if (!eslintConfigExists) return [];

    try {
      const result = execSync(
        `npx eslint --format json ${jsFiles.join(' ')} 2>/dev/null`,
        { encoding: 'utf-8', timeout: 20_000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      return this.parseEslintOutput(result);
    } catch (err: any) {
      const output = err.stdout || '';
      if (output.startsWith('[')) {
        return this.parseEslintOutput(output);
      }
      return [];
    }
  }

  private parseEslintOutput(output: string): StaticFinding[] {
    const findings: StaticFinding[] = [];
    try {
      const results = JSON.parse(output);
      for (const file of results) {
        for (const msg of file.messages || []) {
          findings.push({
            type: msg.severity === 2 ? 'error' : 'warning',
            source: 'eslint',
            file: path.relative(process.cwd(), file.filePath),
            line: msg.line,
            message: `${msg.message} (${msg.ruleId || 'unknown'})`,
          });
        }
      }
    } catch { /* not valid JSON */ }
    return findings;
  }

  /**
   * Pattern-based scan — catches things tools miss.
   * These are real patterns, not AI guesses.
   */
  private runPatternScan(files: string[]): StaticFinding[] {
    const findings: StaticFinding[] = [];
    const patterns: Array<{ regex: RegExp; message: string; type: StaticFinding['type'] }> = [
      { regex: /console\.(log|debug|info)\(/g, message: 'console.log left in code', type: 'warning' },
      { regex: /TODO|FIXME|HACK|XXX/g, message: 'TODO/FIXME comment found', type: 'info' },
      { regex: /\bany\b(?:\s*[;,)\]}]|\s+[a-z])/g, message: 'TypeScript `any` type usage', type: 'warning' },
      { regex: /process\.env\.\w+(?!\s*[|?])/g, message: 'Unguarded process.env access (no fallback)', type: 'warning' },
      { regex: /(?:password|secret|api.?key|token)\s*[:=]\s*['"][^'"]{4,}['"]/gi, message: 'Possible hardcoded secret', type: 'error' },
      { regex: /eval\s*\(/g, message: 'eval() usage — security risk', type: 'error' },
      { regex: /innerHTML\s*=/g, message: 'innerHTML assignment — XSS risk', type: 'error' },
      { regex: /\bnew\s+Function\s*\(/g, message: 'new Function() — code injection risk', type: 'error' },
    ];

    for (const file of files) {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
      if (!/\.[jt]sx?$|\.py$|\.go$|\.rs$/.test(file)) continue;

      let content: string;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch { continue; }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const p of patterns) {
          p.regex.lastIndex = 0; // reset regex
          if (p.regex.test(lines[i])) {
            findings.push({
              type: p.type,
              source: 'pattern',
              file: path.relative(process.cwd(), file),
              line: i + 1,
              message: p.message,
            });
          }
        }
      }
    }
    return findings;
  }
}

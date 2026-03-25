import { execSync } from 'node:child_process';
import path from 'node:path';

export interface DiffHunk {
  file: string;
  additions: number;
  deletions: number;
  patch: string;
}

/**
 * Extracts only the changed code from git, so the AI reviews
 * actual changes instead of entire files. This is dramatically
 * more useful and token-efficient than sending whole files.
 */
export class DiffContext {

  /**
   * Get diff of uncommitted changes (staged + unstaged).
   */
  getUncommittedDiff(): DiffHunk[] {
    return [
      ...this.parseDiff(this.run('git diff')),
      ...this.parseDiff(this.run('git diff --cached')),
    ];
  }

  /**
   * Get diff against a specific base (e.g., main branch).
   */
  getDiffAgainst(base: string): DiffHunk[] {
    return this.parseDiff(this.run(`git diff ${base}...HEAD`));
  }

  /**
   * Get diff of last N commits.
   */
  getRecentDiff(commits = 1): DiffHunk[] {
    return this.parseDiff(this.run(`git diff HEAD~${commits}..HEAD`));
  }

  /**
   * Get changed files only (no content).
   */
  getChangedFiles(base?: string): string[] {
    const cmd = base
      ? `git diff --name-only ${base}...HEAD`
      : 'git diff --name-only HEAD';
    const output = this.run(cmd);
    return output.split('\n').filter(Boolean).map(f => path.resolve(f));
  }

  /**
   * Format diff hunks for AI prompt. Much more focused than full file content.
   */
  formatForPrompt(hunks: DiffHunk[]): string {
    if (hunks.length === 0) return '';
    const sections: string[] = ['## Changed Code (git diff — review ONLY these changes)'];
    let totalChars = 0;
    const maxChars = 20_000; // Cap diff context

    for (const hunk of hunks) {
      if (totalChars + hunk.patch.length > maxChars) {
        sections.push(`\n[... ${hunks.length - sections.length + 1} more files truncated]`);
        break;
      }
      sections.push(`### ${hunk.file} (+${hunk.additions}/-${hunk.deletions})`);
      sections.push('```diff');
      sections.push(hunk.patch);
      sections.push('```');
      totalChars += hunk.patch.length;
    }

    return sections.join('\n');
  }

  private parseDiff(output: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    // Split by file boundaries
    const fileDiffs = output.split(/^diff --git /m).filter(Boolean);

    for (const fileDiff of fileDiffs) {
      const fileMatch = fileDiff.match(/a\/(.+?)\s+b\/(.+)/);
      if (!fileMatch) continue;

      const file = fileMatch[2];
      const lines = fileDiff.split('\n');
      let additions = 0;
      let deletions = 0;

      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }

      // Extract just the hunk content (after @@)
      const hunkStart = fileDiff.indexOf('@@');
      const patch = hunkStart >= 0 ? fileDiff.slice(hunkStart) : fileDiff;

      hunks.push({ file, additions, deletions, patch: patch.slice(0, 5000) }); // cap per file
    }

    return hunks;
  }

  private run(cmd: string): string {
    try {
      return execSync(cmd, { encoding: 'utf-8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      return '';
    }
  }
}

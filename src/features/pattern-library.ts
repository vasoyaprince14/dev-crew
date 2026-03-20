import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

interface Pattern {
  id: string;
  description: string;
  category: string;
  appliedCount: number;
  firstSeen: string;
  lastApplied: string;
  agent: string;
}

export class PatternLibrary {
  private patternsPath: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.patternsPath = path.join(root, '.dev-crew', 'patterns.json');
  }

  loadPatterns(): Pattern[] {
    try {
      if (fs.existsSync(this.patternsPath)) {
        return JSON.parse(fs.readFileSync(this.patternsPath, 'utf-8'));
      }
    } catch { /* ignore */ }
    return [];
  }

  savePatterns(patterns: Pattern[]): void {
    const dir = path.dirname(this.patternsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.patternsPath, JSON.stringify(patterns, null, 2));
  }

  recordPattern(description: string, category: string, agent: string): void {
    const patterns = this.loadPatterns();
    const now = new Date().toISOString();
    const id = this.generateId(description);

    const existing = patterns.find(p => p.id === id);
    if (existing) {
      existing.appliedCount++;
      existing.lastApplied = now;
    } else {
      patterns.push({
        id,
        description,
        category,
        appliedCount: 1,
        firstSeen: now,
        lastApplied: now,
        agent,
      });
    }

    this.savePatterns(patterns);
  }

  recordFromIssues(issues: Array<{ message: string; suggestion?: string }>, agent: string): void {
    for (const issue of issues) {
      if (issue.suggestion) {
        this.recordPattern(issue.suggestion, this.categorize(issue.message), agent);
      }
    }
  }

  getTopPatterns(limit = 10): Pattern[] {
    return this.loadPatterns()
      .sort((a, b) => b.appliedCount - a.appliedCount)
      .slice(0, limit);
  }

  getPatternPrompt(): string {
    const patterns = this.getTopPatterns(5);
    if (patterns.length === 0) return '';

    return `\n## Known Patterns (from this project's history — enforce these):\n` +
      patterns.map(p => `- ${p.description} (applied ${p.appliedCount} times)`).join('\n');
  }

  formatPatterns(): string {
    const patterns = this.getTopPatterns(15);
    if (patterns.length === 0) {
      return chalk.gray('No patterns learned yet. Run some reviews to build the pattern library.');
    }

    const lines: string[] = [chalk.bold.cyan('Learned Patterns (from your project\'s history):'), ''];

    for (let i = 0; i < patterns.length; i++) {
      const p = patterns[i];
      const ago = this.timeAgo(new Date(p.lastApplied));
      lines.push(`  ${chalk.bold(`${i + 1}.`)} "${p.description}"`);
      lines.push(chalk.gray(`     Applied ${p.appliedCount} times | Last: ${ago}`));
      lines.push('');
    }

    lines.push(chalk.gray('These patterns are automatically applied in future reviews.'));
    return lines.join('\n');
  }

  private generateId(description: string): string {
    return description.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 80);
  }

  private categorize(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('query') || lower.includes('database') || lower.includes('prisma')) return 'database';
    if (lower.includes('valid') || lower.includes('input')) return 'validation';
    if (lower.includes('secur') || lower.includes('auth')) return 'security';
    if (lower.includes('error') || lower.includes('catch')) return 'error-handling';
    if (lower.includes('test')) return 'testing';
    return 'general';
  }

  private timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    const days = Math.floor(seconds / 86400);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }
}

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import boxen from 'boxen';

interface DebtItem {
  category: string;
  file: string;
  line?: number;
  description: string;
  points: number;
  effort: 'low' | 'medium' | 'high';
  detectedAt: string;
  resolvedAt?: string;
}

interface DebtReport {
  totalPoints: number;
  itemCount: number;
  resolved: number;
  newItems: number;
  trend: number; // percentage change
  topSources: Array<{ category: string; points: number; count: number }>;
  quickWins: DebtItem[];
}

export class DebtTracker {
  private debtPath: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.debtPath = path.join(root, '.dev-crew', 'debt.json');
  }

  loadDebt(): DebtItem[] {
    try {
      if (fs.existsSync(this.debtPath)) {
        return JSON.parse(fs.readFileSync(this.debtPath, 'utf-8'));
      }
    } catch { /* ignore */ }
    return [];
  }

  saveDebt(items: DebtItem[]): void {
    const dir = path.dirname(this.debtPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.debtPath, JSON.stringify(items, null, 2));
  }

  updateFromReview(issues: Array<{ severity: string; file: string; line?: number; message: string }>): void {
    const current = this.loadDebt();
    const now = new Date().toISOString();

    for (const issue of issues) {
      const points = issue.severity === 'critical' ? 25 : issue.severity === 'warning' ? 10 : 3;
      const effort = issue.severity === 'critical' ? 'medium' as const : 'low' as const;
      const category = this.categorize(issue.message);

      const existing = current.find(d =>
        d.file === issue.file && d.description === issue.message && !d.resolvedAt,
      );

      if (!existing) {
        current.push({
          category,
          file: issue.file,
          line: issue.line,
          description: issue.message,
          points,
          effort,
          detectedAt: now,
        });
      }
    }

    this.saveDebt(current);
  }

  generateReport(): DebtReport {
    const all = this.loadDebt();
    const active = all.filter(d => !d.resolvedAt);
    const resolved = all.filter(d => d.resolvedAt);

    // Recent items (last 14 days)
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const newItems = active.filter(d => d.detectedAt > twoWeeksAgo).length;
    const recentResolved = resolved.filter(d => d.resolvedAt! > twoWeeksAgo).length;

    // Group by category
    const categories: Record<string, { points: number; count: number }> = {};
    for (const d of active) {
      if (!categories[d.category]) categories[d.category] = { points: 0, count: 0 };
      categories[d.category].points += d.points;
      categories[d.category].count++;
    }

    const topSources = Object.entries(categories)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.points - a.points);

    // Quick wins: low effort, high points
    const quickWins = active
      .filter(d => d.effort === 'low' && d.points >= 10)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // Trend (simplified)
    const trend = recentResolved > newItems ? -Math.round(((recentResolved - newItems) / Math.max(active.length, 1)) * 100) : 0;

    return {
      totalPoints: active.reduce((s, d) => s + d.points, 0),
      itemCount: active.length,
      resolved: recentResolved,
      newItems,
      trend,
      topSources,
      quickWins,
    };
  }

  formatReport(report: DebtReport): string {
    const trendIcon = report.trend < 0 ? chalk.green(`▼ ${Math.abs(report.trend)}% (improving)`) : report.trend > 0 ? chalk.red(`▲ ${report.trend}% (growing)`) : chalk.gray('→ stable');

    const lines: string[] = [
      chalk.bold.cyan('Technical Debt Dashboard'),
      '',
      `Current Debt Score: ${chalk.bold(String(report.totalPoints))} points`,
      `Trend: ${trendIcon}`,
      '',
      chalk.bold('Top Debt Sources:'),
    ];

    for (const src of report.topSources.slice(0, 5)) {
      const bar = '█'.repeat(Math.min(Math.round(src.points / 20), 5)) + '░'.repeat(Math.max(0, 5 - Math.round(src.points / 20)));
      lines.push(`  ${(src.count + '.').padEnd(4)} ${src.category.padEnd(28)} ${String(src.points).padStart(3)} pts  ${bar}`);
    }

    if (report.quickWins.length > 0) {
      lines.push('');
      lines.push(chalk.bold('Quick wins (high impact, low effort):'));
      for (const qw of report.quickWins) {
        lines.push(`  → ${qw.description.slice(0, 60)} (-${qw.points} pts)`);
      }
    }

    return boxen(lines.join('\n'), { padding: 1, borderStyle: 'round', borderColor: 'yellow' });
  }

  private categorize(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('catch') || lower.includes('exception')) return 'Missing error handling';
    if (lower.includes('valid') || lower.includes('input') || lower.includes('dto')) return 'No input validation';
    if (lower.includes('hardcod') || lower.includes('config') || lower.includes('env')) return 'Hardcoded values';
    if (lower.includes('test') || lower.includes('coverage')) return 'Missing tests';
    if (lower.includes('depend') || lower.includes('outdated') || lower.includes('vulnerab')) return 'Outdated dependencies';
    if (lower.includes('n+1') || lower.includes('query') || lower.includes('index')) return 'Database performance';
    if (lower.includes('secur') || lower.includes('auth') || lower.includes('inject')) return 'Security issue';
    if (lower.includes('type') || lower.includes('any') || lower.includes('cast')) return 'Type safety';
    return 'General tech debt';
  }
}

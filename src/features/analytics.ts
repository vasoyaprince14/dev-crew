import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import boxen from 'boxen';

interface AnalyticsEvent {
  date: string;
  agent: string;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  score?: number;
  tokensUsed: number;
  duration: number;
}

interface AnalyticsReport {
  totalSessions: number;
  avgIssuesPerReview: number;
  avgCriticalPerReview: number;
  mostCommonAgent: string;
  avgScore: number;
  weeklyTrend: Array<{ week: string; avgScore: number; avgIssues: number }>;
  improvementPercent: number;
}

const ANALYTICS_DIR = path.join(os.homedir(), '.dev-crew');
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, 'analytics.json');

export class Analytics {
  recordEvent(event: AnalyticsEvent): void {
    try {
      if (!fs.existsSync(ANALYTICS_DIR)) fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
      const events = this.loadEvents();
      events.push(event);
      fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(events.slice(-5000), null, 2));
    } catch { /* non-critical */ }
  }

  generateReport(days = 30): AnalyticsReport {
    const events = this.loadEvents();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const recent = events.filter(e => e.date > cutoff);

    if (recent.length === 0) {
      return {
        totalSessions: 0,
        avgIssuesPerReview: 0,
        avgCriticalPerReview: 0,
        mostCommonAgent: 'none',
        avgScore: 0,
        weeklyTrend: [],
        improvementPercent: 0,
      };
    }

    // Basic stats
    const reviews = recent.filter(e => e.agent === 'review');
    const avgIssues = reviews.length > 0 ? reviews.reduce((s, e) => s + e.issueCount, 0) / reviews.length : 0;
    const avgCritical = reviews.length > 0 ? reviews.reduce((s, e) => s + e.criticalCount, 0) / reviews.length : 0;
    const scored = recent.filter(e => e.score !== undefined);
    const avgScore = scored.length > 0 ? scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length : 0;

    // Most common agent
    const agentCounts: Record<string, number> = {};
    for (const e of recent) {
      agentCounts[e.agent] = (agentCounts[e.agent] || 0) + 1;
    }
    const mostCommonAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    // Weekly trend
    const weeks = this.groupByWeek(recent);
    const weeklyTrend = weeks.map(w => ({
      week: w.week,
      avgScore: w.events.filter(e => e.score).length > 0
        ? w.events.filter(e => e.score).reduce((s, e) => s + (e.score || 0), 0) / w.events.filter(e => e.score).length : 0,
      avgIssues: w.events.filter(e => e.agent === 'review').length > 0
        ? w.events.filter(e => e.agent === 'review').reduce((s, e) => s + e.issueCount, 0) / w.events.filter(e => e.agent === 'review').length : 0,
    }));

    // Improvement
    let improvement = 0;
    if (weeklyTrend.length >= 2) {
      const first = weeklyTrend[0].avgScore;
      const last = weeklyTrend[weeklyTrend.length - 1].avgScore;
      if (first > 0) improvement = Math.round(((last - first) / first) * 100);
    }

    return {
      totalSessions: recent.length,
      avgIssuesPerReview: Math.round(avgIssues * 10) / 10,
      avgCriticalPerReview: Math.round(avgCritical * 10) / 10,
      mostCommonAgent,
      avgScore: Math.round(avgScore * 10) / 10,
      weeklyTrend,
      improvementPercent: improvement,
    };
  }

  formatReport(report: AnalyticsReport): string {
    const lines: string[] = [
      chalk.bold.cyan(`Developer Analytics (Last 30 Days)`),
      '',
      `Sessions: ${report.totalSessions}`,
      `Avg issues per review: ${report.avgIssuesPerReview}`,
      `Avg critical per review: ${report.avgCriticalPerReview}`,
      `Most used agent: ${report.mostCommonAgent}`,
    ];

    if (report.avgScore > 0) {
      lines.push(`Average quality score: ${report.avgScore}/10`);
    }

    if (report.weeklyTrend.length > 0) {
      lines.push('');
      lines.push('Code quality trend:');
      for (const w of report.weeklyTrend) {
        const bar = '█'.repeat(Math.round(w.avgScore));
        const pad = '░'.repeat(Math.max(0, 10 - Math.round(w.avgScore)));
        lines.push(`  ${w.week}: ${bar}${pad} ${w.avgScore.toFixed(1)}/10`);
      }
    }

    if (report.improvementPercent !== 0) {
      lines.push('');
      if (report.improvementPercent > 0) {
        lines.push(chalk.green.bold(`You've improved ${report.improvementPercent}% this period!`));
      } else {
        lines.push(chalk.yellow(`Quality dipped ${Math.abs(report.improvementPercent)}% — focus on review feedback.`));
      }
    }

    return boxen(lines.join('\n'), { padding: 1, borderStyle: 'round', borderColor: 'magenta' });
  }

  private loadEvents(): AnalyticsEvent[] {
    try {
      if (fs.existsSync(ANALYTICS_FILE)) {
        return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return [];
  }

  private groupByWeek(events: AnalyticsEvent[]): Array<{ week: string; events: AnalyticsEvent[] }> {
    const weeks: Record<string, AnalyticsEvent[]> = {};
    for (const e of events) {
      const d = new Date(e.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(e);
    }
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, events]) => ({ week, events }));
  }
}

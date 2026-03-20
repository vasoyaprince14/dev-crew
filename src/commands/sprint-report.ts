import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import boxen from 'boxen';
import { Analytics } from '../features/analytics.js';
import { TokenIntelligence } from '../core/token-intelligence.js';
import { DebtTracker } from '../features/debt-tracker.js';
import { Logger } from '../utils/logger.js';

interface SprintOptions {
  days?: string;
}

export async function sprintReportCommand(options: SprintOptions): Promise<void> {
  const logger = new Logger();
  const days = parseInt(options.days || '14');

  const analytics = new Analytics();
  const intelligence = new TokenIntelligence();
  const debtTracker = new DebtTracker();

  const report = analytics.generateReport(days);
  const tokenReport = await intelligence.monthlyReport();
  const debtReport = debtTracker.generateReport();

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const endDate = new Date();
  const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  const lines: string[] = [
    chalk.bold.cyan(`Sprint Report (${dateRange})`),
    '',
    chalk.bold('Dev-Crew Usage:'),
    `├── ${report.totalSessions} commands run`,
    `├── Avg issues per review: ${report.avgIssuesPerReview}`,
    `├── Avg critical per review: ${report.avgCriticalPerReview}`,
    `└── Most used agent: ${report.mostCommonAgent}`,
    '',
    chalk.bold('Token Economy:'),
    `├── Total tokens used: ${tokenReport.totalTokensUsed.toLocaleString()}`,
    `├── Tokens saved: ${tokenReport.totalTokensSaved.toLocaleString()} (${tokenReport.averageSavingsPercent}% savings)`,
    `└── Estimated cost saved: $${tokenReport.estimatedCostSaved.toFixed(2)}`,
    '',
    chalk.bold('Code Quality:'),
  ];

  if (report.avgScore > 0) {
    lines.push(`├── Average review score: ${report.avgScore}/10`);
  }

  if (report.weeklyTrend.length >= 2) {
    const first = report.weeklyTrend[0];
    const last = report.weeklyTrend[report.weeklyTrend.length - 1];
    if (first.avgIssues > 0) {
      const change = Math.round(((last.avgIssues - first.avgIssues) / first.avgIssues) * 100);
      const icon = change < 0 ? chalk.green(`▼ ${Math.abs(change)}%`) : chalk.red(`▲ ${change}%`);
      lines.push(`├── Issues trend: ${icon}`);
    }
  }

  lines.push(`└── Tech debt score: ${debtReport.totalPoints} points (${debtReport.itemCount} items)`);

  if (report.improvementPercent !== 0) {
    lines.push('');
    if (report.improvementPercent > 0) {
      lines.push(chalk.green.bold(`Quality improved ${report.improvementPercent}% this sprint!`));
    }
  }

  console.log();
  console.log(boxen(lines.join('\n'), { padding: 1, borderStyle: 'round', borderColor: 'cyan', title: 'Sprint Report', titleAlignment: 'center' }));
  console.log();
}

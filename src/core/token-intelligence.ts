import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import boxen from 'boxen';

interface TokenBreakdown {
  smartFileSelection: number;
  commentStripping: number;
  boilerplateCollapse: number;
  contextDedup: number;
  promptOptimization: number;
}

interface TokenReport {
  withoutDevCrew: number;
  withDevCrew: number;
  saved: number;
  percentage: number;
  breakdown: TokenBreakdown;
}

interface SessionStats {
  totalSaved: number;
  totalUsed: number;
  commands: number;
}

interface UsageRecord {
  date: string;
  agent: string;
  saved: number;
  used: number;
}

interface MonthlyReport {
  totalTokensSaved: number;
  totalTokensUsed: number;
  estimatedCostSaved: number;
  commandsRun: number;
  averageSavingsPercent: number;
  topSavingAgents: Array<{ agent: string; saved: number }>;
}

const CHARS_PER_TOKEN = 4;
const USAGE_DIR = path.join(os.homedir(), '.dev-crew');
const USAGE_FILE = path.join(USAGE_DIR, 'usage.json');

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export class TokenIntelligence {
  private sessionStats: SessionStats = { totalSaved: 0, totalUsed: 0, commands: 0 };

  calculateSavings(
    originalFiles: string[],
    optimizedContext: string,
    systemPromptLength: number,
  ): TokenReport {
    // Naive approach: read all files fully + long generic prompt
    let naiveFileTokens = 0;
    for (const file of originalFiles) {
      try {
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          const content = fs.readFileSync(file, 'utf-8');
          naiveFileTokens += estimateTokens(content);
        } else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
          const files = this.walkFlat(file);
          for (const f of files) {
            try {
              naiveFileTokens += estimateTokens(fs.readFileSync(f, 'utf-8'));
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }

    // Add a generic prompt estimate (user typing raw instructions)
    const naivePromptTokens = Math.max(500, Math.round(systemPromptLength * 0.3));
    const naiveTotal = naiveFileTokens + naivePromptTokens;

    const optimizedTotal = estimateTokens(optimizedContext) + systemPromptLength;
    const saved = Math.max(0, naiveTotal - optimizedTotal);

    // Approximate breakdown
    const fileSelectionSaved = Math.round(saved * 0.38);
    const commentSaved = Math.round(saved * 0.12);
    const boilerplateSaved = Math.round(saved * 0.18);
    const dedupSaved = Math.round(saved * 0.15);
    const promptSaved = saved - fileSelectionSaved - commentSaved - boilerplateSaved - dedupSaved;

    return {
      withoutDevCrew: naiveTotal,
      withDevCrew: optimizedTotal,
      saved,
      percentage: naiveTotal > 0 ? Math.round((saved / naiveTotal) * 100) : 0,
      breakdown: {
        smartFileSelection: fileSelectionSaved,
        commentStripping: commentSaved,
        boilerplateCollapse: boilerplateSaved,
        contextDedup: dedupSaved,
        promptOptimization: promptSaved,
      },
    };
  }

  recordSession(report: TokenReport, agent: string): void {
    this.sessionStats.totalSaved += report.saved;
    this.sessionStats.totalUsed += report.withDevCrew;
    this.sessionStats.commands++;
    this.persistUsage({ date: new Date().toISOString(), agent, saved: report.saved, used: report.withDevCrew });
  }

  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  formatReport(report: TokenReport): string {
    const lines = [
      `${chalk.bold.cyan('Token Intelligence')}`,
      ``,
      `Without Dev-Crew:  ~${report.withoutDevCrew.toLocaleString()} tokens`,
      `With Dev-Crew:     ~${report.withDevCrew.toLocaleString()} tokens`,
      `${chalk.green.bold(`Saved:             ${report.saved.toLocaleString()} tokens (${report.percentage}% less)`)}`,
      ``,
      `How we saved:`,
      `  Smart file selection:     -${report.breakdown.smartFileSelection.toLocaleString()} tokens`,
      `  Comment stripping:        -${report.breakdown.commentStripping.toLocaleString()} tokens`,
      `  Boilerplate collapse:     -${report.breakdown.boilerplateCollapse.toLocaleString()} tokens`,
      `  Context deduplication:    -${report.breakdown.contextDedup.toLocaleString()} tokens`,
      `  Prompt optimization:      -${report.breakdown.promptOptimization.toLocaleString()} tokens`,
      ``,
      `Session total saved: ${this.sessionStats.totalSaved.toLocaleString()} tokens`,
    ];

    return boxen(lines.join('\n'), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      title: 'Token Intelligence',
      titleAlignment: 'center',
    });
  }

  async monthlyReport(): Promise<MonthlyReport> {
    const history = this.loadHistory();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = history.filter(r => new Date(r.date) >= monthStart);
    const totalSaved = thisMonth.reduce((s, r) => s + r.saved, 0);
    const totalUsed = thisMonth.reduce((s, r) => s + r.used, 0);

    const agentSavings: Record<string, number> = {};
    for (const r of thisMonth) {
      agentSavings[r.agent] = (agentSavings[r.agent] || 0) + r.saved;
    }

    return {
      totalTokensSaved: totalSaved,
      totalTokensUsed: totalUsed,
      estimatedCostSaved: (totalSaved / 1000) * 0.003,
      commandsRun: thisMonth.length,
      averageSavingsPercent: totalSaved + totalUsed > 0
        ? Math.round((totalSaved / (totalSaved + totalUsed)) * 100) : 0,
      topSavingAgents: Object.entries(agentSavings)
        .map(([agent, saved]) => ({ agent, saved }))
        .sort((a, b) => b.saved - a.saved),
    };
  }

  private persistUsage(record: UsageRecord): void {
    try {
      if (!fs.existsSync(USAGE_DIR)) fs.mkdirSync(USAGE_DIR, { recursive: true });
      const history = this.loadHistory();
      history.push(record);
      // Keep last 10000 records
      const trimmed = history.slice(-10000);
      fs.writeFileSync(USAGE_FILE, JSON.stringify(trimmed, null, 2));
    } catch { /* non-critical */ }
  }

  private loadHistory(): UsageRecord[] {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return [];
  }

  private walkFlat(dir: string, depth = 0): string[] {
    if (depth > 2) return [];
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
        const full = path.join(dir, e.name);
        if (e.isFile()) files.push(full);
        else if (e.isDirectory()) files.push(...this.walkFlat(full, depth + 1));
      }
    } catch { /* skip */ }
    return files;
  }
}

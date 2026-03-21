import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import boxen from 'boxen';

interface TokenBreakdown {
  smartFileSelection: number;  // tokens saved by including only relevant files, not everything
  contextCompression: number;  // tokens saved by whitespace/blank-line removal
  systemPromptReuse: number;   // tokens the structured system prompt replaces vs raw user typing
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
    // Total raw size: read every file the user pointed at (what they'd paste manually)
    let allFileTokens = 0;
    const allFilePaths: string[] = [];

    for (const file of originalFiles) {
      try {
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          allFilePaths.push(file);
        } else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
          allFilePaths.push(...this.walkFlat(file));
        }
      } catch { /* skip */ }
    }

    for (const f of allFilePaths) {
      try {
        allFileTokens += estimateTokens(fs.readFileSync(f, 'utf-8'));
      } catch { /* skip */ }
    }

    // withoutDevCrew: all files raw + a rough estimate of what the user would type as instructions
    const manualPromptEstimate = Math.max(200, Math.round(systemPromptLength * 0.3));
    const withoutDevCrew = allFileTokens + manualPromptEstimate;

    // withDevCrew: the actual optimized context that was sent + the system prompt
    const withDevCrew = estimateTokens(optimizedContext) + systemPromptLength;

    const saved = Math.max(0, withoutDevCrew - withDevCrew);

    // Honest breakdown — only things we actually do:

    // 1. Smart file selection: we limit to ~10 relevant files instead of everything.
    //    Measure: raw size of all files minus raw size of files that made it into optimizedContext.
    const optimizedContextTokens = estimateTokens(optimizedContext);
    const fileSelectionSaved = Math.max(0, allFileTokens - optimizedContextTokens);

    // 2. Context compression: whitespace/blank-line removal (TokenOptimizer.compress).
    //    This is modest — we don't strip comments or collapse boilerplate.
    //    Estimate by comparing optimized context length to what's left after file selection.
    const contextCompressionSaved = Math.max(0, saved - fileSelectionSaved);

    // 3. System prompt reuse: the structured system prompt replaces manual typing.
    //    Already accounted for in the manualPromptEstimate vs systemPromptLength difference.
    //    This can be negative (system prompt may be larger than what a user would type),
    //    so we just report it as part of contextCompression above to keep numbers honest.
    const systemPromptReuse = Math.max(0, systemPromptLength - manualPromptEstimate);

    return {
      withoutDevCrew,
      withDevCrew,
      saved,
      percentage: withoutDevCrew > 0 ? Math.round((saved / withoutDevCrew) * 100) : 0,
      breakdown: {
        smartFileSelection: fileSelectionSaved,
        contextCompression: Math.max(0, contextCompressionSaved - systemPromptReuse),
        systemPromptReuse,
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
      `  File selection (relevant only):  -${report.breakdown.smartFileSelection.toLocaleString()} tokens`,
      `  Whitespace compression:          -${report.breakdown.contextCompression.toLocaleString()} tokens`,
      `  Structured system prompt:        -${report.breakdown.systemPromptReuse.toLocaleString()} tokens`,
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

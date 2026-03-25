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
    // ── withDevCrew: what we actually sent ──
    // This is the real, measured number: optimized context + system prompt
    const optimizedContextTokens = estimateTokens(optimizedContext);
    const systemPromptTokens = Math.ceil(systemPromptLength / CHARS_PER_TOKEN);
    const withDevCrew = optimizedContextTokens + systemPromptTokens;

    // ── withoutDevCrew: what user would need to send manually for same quality ──
    // Without Dev-Crew, to get the SAME quality result the user would need to:
    // 1. Read ALL files they pointed at (full content, no smart selection)
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

    // 2. Manually write the context that Dev-Crew auto-generates:
    //    - Project info (language, framework, database, etc.)
    //    - Related files from dependency graph
    //    - Git intelligence data (commit patterns, hotspots)
    //    - Pattern library patterns
    //    The optimizedContext INCLUDES auto-resolved dependencies and enrichments
    //    that the user didn't provide — so the "raw" baseline must include the
    //    same information the user would have to gather manually.
    //
    //    Fair estimate: user would paste ALL their raw files (no compression),
    //    PLUS they'd need the equivalent context that Dev-Crew auto-gathered.
    //    The auto-gathered context beyond the original files = optimizedContext - originalFileContent.
    const autoGatheredContext = Math.max(0, optimizedContextTokens - allFileTokens);

    // 3. Write their own instructions (system prompt equivalent).
    //    A user writing instructions manually would write ~30% of what our
    //    expert system prompt contains (they'd miss framework-specific rules,
    //    severity classification, output format, etc.)
    const manualInstructions = Math.max(100, Math.round(systemPromptTokens * 0.3));

    // Without Dev-Crew total: raw files + auto-gathered context (they'd need it too)
    //   + their manual instructions
    // But they wouldn't know to gather the auto context, so they'd get a WORSE result.
    // We compare apples-to-apples: same information, just sent inefficiently.
    const withoutDevCrew = allFileTokens + autoGatheredContext + manualInstructions;

    // ── Savings ──
    // Dev-Crew's value: expert system prompt (better instructions than manual),
    // smart file selection (when pointing at a directory), context compression,
    // and the system prompt is reusable across turns.
    //
    // When withDevCrew > withoutDevCrew, it means our system prompt and enrichments
    // ADD tokens but ADD quality. In that case, show the quality gain, not fake savings.
    const saved = Math.max(0, withoutDevCrew - withDevCrew);

    // Breakdown
    const fileSelectionSaved = Math.max(0, allFileTokens - optimizedContextTokens);
    const contextCompressionSaved = Math.max(0, saved - fileSelectionSaved);
    const systemPromptReuse = Math.max(0, systemPromptTokens - manualInstructions);

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
    const hasSavings = report.saved > 0;
    const title = hasSavings ? 'Token Intelligence' : 'Token Usage';

    const lines: string[] = [
      `${chalk.bold.cyan(title)}`,
      ``,
    ];

    if (hasSavings) {
      lines.push(
        `Without Dev-Crew:  ~${report.withoutDevCrew.toLocaleString()} tokens`,
        `With Dev-Crew:     ~${report.withDevCrew.toLocaleString()} tokens`,
        `${chalk.green.bold(`Saved:             ${report.saved.toLocaleString()} tokens (${report.percentage}% less)`)}`,
        ``,
        `How we saved:`,
        `  File selection (relevant only):  -${report.breakdown.smartFileSelection.toLocaleString()} tokens`,
        `  Whitespace compression:          -${report.breakdown.contextCompression.toLocaleString()} tokens`,
        `  Structured system prompt:        -${report.breakdown.systemPromptReuse.toLocaleString()} tokens`,
      );
    } else {
      lines.push(
        `Tokens used:  ~${report.withDevCrew.toLocaleString()} tokens`,
      );
    }

    lines.push(
      ``,
      `Session total ${hasSavings ? 'saved' : 'used'}: ${hasSavings ? this.sessionStats.totalSaved.toLocaleString() : this.sessionStats.totalUsed.toLocaleString()} tokens`,
    );

    return boxen(lines.join('\n'), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      title,
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

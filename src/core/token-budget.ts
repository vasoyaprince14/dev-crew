import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';

interface BudgetConfig {
  daily?: number;
  weekly?: number;
  monthly?: number;
}

interface BudgetDecision {
  allowed: boolean;
  remaining: number;
  estimated: number;
  suggestions: Suggestion[];
}

interface Suggestion {
  action: string;
  description: string;
  estimatedTokens: number;
}

const USAGE_FILE = path.join(os.homedir(), '.dev-crew', 'usage.json');

export class TokenBudget {
  private config: BudgetConfig;

  constructor(config: BudgetConfig = {}) {
    this.config = config;
  }

  checkBudget(estimatedTokens: number): BudgetDecision {
    const budget = this.config.daily;
    if (!budget) return { allowed: true, remaining: Infinity, estimated: estimatedTokens, suggestions: [] };

    const todayUsage = this.getTodayUsage();
    const remaining = budget - todayUsage;

    if (estimatedTokens <= remaining) {
      return { allowed: true, remaining, estimated: estimatedTokens, suggestions: [] };
    }

    return {
      allowed: false,
      remaining,
      estimated: estimatedTokens,
      suggestions: this.getSuggestions(estimatedTokens, remaining),
    };
  }

  formatBudgetWarning(decision: BudgetDecision): string {
    const budget = this.config.daily || 0;
    const pct = budget > 0 ? Math.round((decision.remaining / budget) * 100) : 100;
    const color = pct > 50 ? 'green' : pct > 20 ? 'yellow' : 'red';

    let msg = chalk[color](`Token budget: ${decision.remaining.toLocaleString()} / ${budget.toLocaleString()} remaining today (${pct}%)`);

    if (!decision.allowed) {
      msg += '\n' + chalk.red(`Estimated ${decision.estimated.toLocaleString()} tokens needed, but only ${decision.remaining.toLocaleString()} remaining.`);
      if (decision.suggestions.length > 0) {
        msg += '\n\nOptions:';
        decision.suggestions.forEach((s, i) => {
          msg += `\n  ${i + 1}. ${s.description} (est. ${s.estimatedTokens.toLocaleString()} tokens)`;
        });
      }
    }

    return msg;
  }

  private getSuggestions(needed: number, available: number): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (needed * 0.6 < available) {
      suggestions.push({
        action: 'reduce_depth',
        description: 'Switch to quick mode',
        estimatedTokens: Math.round(needed * 0.6),
      });
    }

    if (needed * 0.3 < available) {
      suggestions.push({
        action: 'summary_only',
        description: 'Get summary without file-level details',
        estimatedTokens: Math.round(needed * 0.3),
      });
    }

    suggestions.push({
      action: 'override',
      description: 'Override budget limit',
      estimatedTokens: needed,
    });

    return suggestions;
  }

  private getTodayUsage(): number {
    try {
      if (!fs.existsSync(USAGE_FILE)) return 0;
      const records = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8')) as Array<{ date: string; used: number }>;
      const today = new Date().toISOString().slice(0, 10);
      return records
        .filter(r => r.date.startsWith(today))
        .reduce((sum, r) => sum + (r.used || 0), 0);
    } catch { return 0; }
  }
}

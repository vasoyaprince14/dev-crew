import chalk from 'chalk';
import boxen from 'boxen';
import { TokenIntelligence } from '../core/token-intelligence.js';
import { TokenOptimizer } from '../core/token-optimizer.js';
import { Logger } from '../utils/logger.js';
import { readFileSafe, walkDir } from '../utils/file-reader.js';

export async function tokensCommand(action: string, target?: string): Promise<void> {
  const logger = new Logger();
  const optimizer = new TokenOptimizer();
  const intelligence = new TokenIntelligence();

  switch (action) {
    case 'estimate': {
      if (!target) {
        logger.error('Usage: dev-crew tokens estimate <file|directory>');
        process.exit(1);
      }

      const content = readFileSafe(target);
      if (content) {
        const tokens = optimizer.estimate(content);
        console.log(`\n  ${chalk.bold(target)}: ~${tokens.toLocaleString()} tokens\n`);
      } else {
        const files = walkDir(target, 3);
        let total = 0;
        const results: Array<{ file: string; tokens: number }> = [];

        for (const f of files) {
          const c = readFileSafe(f);
          if (c) {
            const t = optimizer.estimate(c);
            total += t;
            results.push({ file: f, tokens: t });
          }
        }

        results.sort((a, b) => b.tokens - a.tokens);

        console.log(`\n  ${chalk.bold(target)}: ~${total.toLocaleString()} tokens across ${results.length} files\n`);
        console.log('  Top files by token count:');
        for (const r of results.slice(0, 10)) {
          const rel = r.file.replace(process.cwd() + '/', '');
          console.log(`    ${rel.padEnd(50)} ~${r.tokens.toLocaleString()}`);
        }
        console.log();
      }
      break;
    }

    case 'usage':
    case 'stats': {
      const report = await intelligence.monthlyReport();

      const lines = [
        chalk.bold.cyan('Token Usage Stats'),
        '',
        `This month:`,
        `  Tokens used:     ${report.totalTokensUsed.toLocaleString()}`,
        `  Tokens saved:    ${chalk.green(report.totalTokensSaved.toLocaleString())}`,
        `  Cost saved:      ~$${report.estimatedCostSaved.toFixed(2)}`,
        `  Commands run:    ${report.commandsRun}`,
        `  Avg savings:     ${report.averageSavingsPercent}%`,
      ];

      if (report.topSavingAgents.length > 0) {
        lines.push('', '  Top saving agents:');
        for (const a of report.topSavingAgents.slice(0, 5)) {
          lines.push(`    ${a.agent.padEnd(15)} ${a.saved.toLocaleString()} tokens saved`);
        }
      }

      console.log();
      console.log(boxen(lines.join('\n'), { padding: 1, borderStyle: 'round', borderColor: 'cyan' }));
      console.log();
      break;
    }

    default:
      logger.error('Usage: dev-crew tokens <estimate|usage> [target]');
      process.exit(1);
  }
}

import path from 'node:path';
import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';

export async function watchCommand(targetPath?: string): Promise<void> {
  const logger = new Logger();

  // Dynamic import chokidar (optional dep)
  let chokidar: typeof import('chokidar');
  try {
    chokidar = await import('chokidar');
  } catch {
    logger.error('Watch mode requires chokidar. Install it: npm install chokidar');
    process.exit(1);
    return;
  }

  const watchPath = targetPath || 'src/';
  logger.info(`Watching ${watchPath} for changes...\n`);

  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('review');
  const registry = new AgentRegistry();

  const pendingFiles: Set<string> = new Set();
  let debounceTimer: ReturnType<typeof setTimeout>;

  const watcher = chokidar.watch(watchPath, {
    ignored: /(node_modules|\.git|dist|build|coverage|\.dev-crew)/,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1000 },
  });

  watcher.on('change', (filePath: string) => {
    pendingFiles.add(filePath);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const files = Array.from(pendingFiles);
      pendingFiles.clear();

      for (const file of files) {
        const timestamp = new Date().toLocaleTimeString();
        const rel = path.relative(process.cwd(), file);
        console.log(`\n${chalk.gray(`[${timestamp}]`)} Changed: ${chalk.white(rel)}`);

        try {
          const agent = registry.create('review', projectInfo, { maxTokens: 2000, contextDepth: 1 }, feedback);
          if (!agent) continue;

          const result = await agent.execute({ files: [file] });
          const issues = result.parsed.issues || [];

          if (issues.length > 0) {
            for (const issue of issues) {
              const icon = issue.severity === 'critical' ? chalk.red('●') : issue.severity === 'warning' ? chalk.yellow('●') : chalk.blue('●');
              console.log(`  ${icon} ${issue.line ? `Line ${issue.line}: ` : ''}${issue.message}`);
            }
          } else {
            console.log(chalk.green('  ✓ Looks good'));
          }

          console.log(chalk.gray(`  (${(result.duration / 1000).toFixed(1)}s, ~${result.tokensUsed || 0} tokens)`));
        } catch (err) {
          console.log(chalk.red(`  ✖ Review failed: ${err instanceof Error ? err.message : 'unknown error'}`));
        }
      }
    }, 2000);
  });

  // Keep process alive
  process.on('SIGINT', () => {
    watcher.close();
    console.log('\nStopped watching.');
    process.exit(0);
  });
}

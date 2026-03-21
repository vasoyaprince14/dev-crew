import path from 'node:path';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { ActionLayer } from '../core/action-layer.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';
import { colorizeDiff } from '../utils/diff-formatter.js';
import type { Fix } from '../types/agent.js';

interface FixOptions {
  issue?: string;
  autoApply?: boolean;
  dryRun?: boolean;
}

export async function fixCommand(file: string, options: FixOptions): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!file) {
    logger.error('Please specify a file to fix: dev-crew fix <file>');
    process.exit(1);
  }

  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.succeed(`Detected: ${projectInfo.framework || projectInfo.language}`);

  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('fix');

  const registry = new AgentRegistry();
  const agent = registry.create('fix', projectInfo, {}, feedback);
  if (!agent) {
    logger.error('Failed to create fix agent');
    process.exit(1);
  }

  spinner.start('Analyzing and generating fix...');
  try {
    const result = await agent.execute({
      files: [file],
      query: options.issue,
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);

    // Attempt to apply fixes if parsed response contains actionable data
    const parsed = result.parsed;
    const fixes: Fix[] = parsed.fixes || [];

    if (fixes.length === 0) {
      return;
    }

    logger.blank();
    logger.info(`Found ${fixes.length} fix(es) to apply.`);

    const actionLayer = new ActionLayer();

    for (const fix of fixes) {
      const resolvedFile = path.resolve(fix.file);

      // Prefer applying via newContent (full file replacement) when available
      const newContent = fix.newContent;

      if (newContent) {
        logger.blank();
        logger.info(`--- Fix: ${fix.description || fix.file} ---`);

        if (options.dryRun) {
          // In dry-run mode, show the diff but do not apply
          const fs = await import('node:fs');
          const oldContent = fs.readFileSync(resolvedFile, 'utf-8');
          const { formatDiff } = await import('../utils/diff-formatter.js');
          console.log(formatDiff(oldContent, newContent, fix.file));
          logger.info('[dry-run] No changes applied.');
        } else if (options.autoApply) {
          // Auto-apply: skip confirmation
          const fs = await import('node:fs');
          const oldContent = fs.readFileSync(resolvedFile, 'utf-8');
          const backupPath = `${resolvedFile}.backup`;
          fs.writeFileSync(backupPath, oldContent);
          fs.writeFileSync(resolvedFile, newContent);
          const { formatDiff } = await import('../utils/diff-formatter.js');
          console.log(formatDiff(oldContent, newContent, fix.file));
          logger.success(`Applied. Backup at ${backupPath}`);
        } else {
          // Interactive: show diff and ask for confirmation
          await actionLayer.showAndApply(resolvedFile, newContent);
        }
      } else if (fix.diff) {
        logger.blank();
        logger.info(`--- Fix: ${fix.description || fix.file} ---`);

        if (options.dryRun) {
          console.log(colorizeDiff(fix.diff));
          logger.info('[dry-run] No changes applied.');
        } else if (options.autoApply) {
          // Auto-apply the diff without confirmation
          const fs = await import('node:fs');
          const { execSync } = await import('node:child_process');
          console.log(colorizeDiff(fix.diff));
          const tmpDiff = `/tmp/dev-crew-${Date.now()}.patch`;
          fs.writeFileSync(tmpDiff, fix.diff);
          try {
            execSync(`git apply ${tmpDiff}`, { stdio: 'pipe' });
            fs.unlinkSync(tmpDiff);
            logger.success('Diff applied successfully.');
          } catch {
            logger.error('Failed to apply diff. Manual intervention needed.');
            try { fs.unlinkSync(tmpDiff); } catch { /* ignore */ }
          }
        } else {
          // Interactive: show diff and ask for confirmation
          await actionLayer.applyDiff(resolvedFile, fix.diff);
        }
      }
    }
  } catch (err) {
    spinner.fail('Fix failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { getBranchDiff, getChangedFiles } from '../utils/git-utils.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface PROptions {
  branch?: string;
}

export async function prCommand(action: string, options: PROptions): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (action !== 'review') {
    logger.error('Usage: dev-crew pr review [--branch <name>]');
    process.exit(1);
  }

  spinner.start('Getting PR diff...');
  let diff: string;
  try {
    diff = await getBranchDiff(options.branch);
  } catch (err) {
    spinner.fail('Failed to get diff');
    logger.error('Could not get branch diff. Are you in a git repository?');
    process.exit(1);
    return;
  }

  if (!diff.trim()) {
    spinner.fail('No changes found');
    logger.warn('No diff found. Make sure you have commits ahead of the base branch.');
    return;
  }
  spinner.succeed(`Found changes in PR`);

  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();

  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('pr');

  const registry = new AgentRegistry();
  const agent = registry.create('pr', projectInfo, {}, feedback);
  if (!agent) {
    logger.error('Failed to create PR reviewer agent');
    process.exit(1);
  }

  spinner.start('Reviewing PR...');
  try {
    const result = await agent.execute({
      query: diff,
      files: await getChangedFiles(options.branch),
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('PR review failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

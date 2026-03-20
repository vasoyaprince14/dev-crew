import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function ctoCommand(action: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (action !== 'review') {
    logger.error('Usage: dev-crew cto review');
    process.exit(1);
  }

  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.succeed(`Detected: ${projectInfo.framework || projectInfo.language}`);

  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('cto');

  const registry = new AgentRegistry();
  const agent = registry.create('cto', projectInfo, {}, feedback);
  if (!agent) {
    logger.error('Failed to create CTO agent');
    process.exit(1);
  }

  spinner.start('Running strategic review...');
  try {
    const result = await agent.execute({
      files: ['src/', '.'],
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('CTO review failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

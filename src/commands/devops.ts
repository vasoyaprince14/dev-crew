import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function devopsCommand(question?: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.succeed(`Detected: ${projectInfo.framework || projectInfo.language}`);

  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('devops');

  const registry = new AgentRegistry();
  const agent = registry.create('devops', projectInfo, {}, feedback);
  if (!agent) {
    logger.error('Failed to create devops agent');
    process.exit(1);
  }

  spinner.start('Consulting DevOps engineer...');
  try {
    const result = await agent.execute({
      query: question,
      files: ['.'],
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('DevOps consultation failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

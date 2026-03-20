import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface BuildOptions {
  stack?: string;
}

export async function buildCommand(description: string, options: BuildOptions): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!description) {
    logger.error('Please provide what to build. Example: dev-crew build "user authentication with JWT and refresh tokens"');
    process.exit(1);
  }

  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.succeed(`Detected: ${projectInfo.framework || projectInfo.language}`);

  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('fullstack-builder');

  const registry = new AgentRegistry();
  const agent = registry.create('fullstack-builder', projectInfo, {}, feedback);
  if (!agent) {
    logger.error('Failed to create fullstack-builder agent');
    process.exit(1);
  }

  const stackHint = options.stack ? ` Use this tech stack: ${options.stack}.` : '';

  spinner.start('Building feature implementation plan...');
  try {
    const result = await agent.execute({
      query: `Build this feature into the existing project: ${description}.${stackHint} Provide complete implementation with all files, code, and setup instructions. Consider the existing project structure and integrate cleanly.`,
      files: ['.'],
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('Build planning failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

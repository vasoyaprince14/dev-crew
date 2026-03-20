import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function scaffoldCommand(description: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!description) {
    logger.error('Please provide a project description. Example: dev-crew scaffold "React + Express + Postgres todo app"');
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

  spinner.start('Scaffolding project structure...');
  try {
    const result = await agent.execute({
      query: `Scaffold a new project: ${description}. Provide the complete file structure, key files with their content, setup steps, and required dependencies.`,
      files: ['.'],
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('Scaffolding failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

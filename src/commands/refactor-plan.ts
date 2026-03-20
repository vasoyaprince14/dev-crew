import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function refactorPlanCommand(targetPath: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!targetPath) {
    logger.error('Usage: dev-crew refactor-plan <path>');
    process.exit(1);
  }

  spinner.start('Analyzing codebase for refactoring...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('tech-lead');

  const registry = new AgentRegistry();
  const agent = registry.create('tech-lead', projectInfo, {}, feedback);
  if (!agent) {
    spinner.fail('Failed to create tech-lead agent');
    process.exit(1);
  }

  spinner.update('Creating refactoring plan...');
  try {
    const result = await agent.execute({
      query: `Analyze this code and create a prioritized refactoring plan. For each step, include: what to change, why, estimated effort (S/M/L), risk level, and implementation steps. Focus on practical improvements ordered by priority.`,
      files: [targetPath],
    });
    spinner.stop();

    console.log();
    console.log(result.raw);
    console.log();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('Failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

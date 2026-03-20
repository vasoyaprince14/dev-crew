import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function designerCommand(designType: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!designType || !['api', 'schema'].includes(designType)) {
    logger.error('Usage: dev-crew designer <api|schema>');
    process.exit(1);
  }

  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('designer');

  const registry = new AgentRegistry();
  const agent = registry.create('designer', projectInfo, {}, feedback);
  if (!agent) {
    spinner.fail('Failed to create designer agent');
    process.exit(1);
  }

  spinner.start(`Reviewing ${designType} design...`);
  try {
    const result = await agent.execute({
      files: ['src/'],
      designType,
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('Design review failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

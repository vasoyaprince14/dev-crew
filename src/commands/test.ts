import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface TestOptions {
  type?: string;
}

export async function testCommand(file: string, options: TestOptions): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!file) {
    logger.error('Please specify a file: dev-crew test <file>');
    process.exit(1);
  }

  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.succeed(`Detected: ${projectInfo.framework || projectInfo.language}`);

  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('test');

  const registry = new AgentRegistry();
  const agent = registry.create('test', projectInfo, {}, feedback);
  if (!agent) {
    logger.error('Failed to create test agent');
    process.exit(1);
  }

  spinner.start(`Generating ${options.type || 'unit'} tests...`);
  try {
    const result = await agent.execute({
      files: [file],
      testType: options.type || 'unit',
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('Test generation failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

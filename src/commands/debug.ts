import fs from 'node:fs';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function debugCommand(input: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!input) {
    logger.error('Please provide error text or log file: dev-crew debug <logs|error|file>');
    process.exit(1);
  }

  // Check if input is a file path
  let errorText = input;
  if (fs.existsSync(input)) {
    errorText = fs.readFileSync(input, 'utf-8');
    logger.info(`Reading from file: ${input}`);
  }

  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.succeed(`Detected: ${projectInfo.framework || projectInfo.language}`);

  const configManager = new ConfigManager();
  const feedback = configManager.getFeedback('debug');

  const registry = new AgentRegistry();
  const agent = registry.create('debug', projectInfo, {}, feedback);
  if (!agent) {
    logger.error('Failed to create debug agent');
    process.exit(1);
  }

  spinner.start('Analyzing error...');
  try {
    const result = await agent.execute({
      query: errorText,
      files: [],
    });
    spinner.stop();

    console.log(result.raw);

    logger.blank();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('Debug failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

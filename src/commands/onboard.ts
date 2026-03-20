import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function onboardCommand(): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  spinner.start('Analyzing codebase for onboarding...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();

  const registry = new AgentRegistry();
  const agent = registry.create('onboard', projectInfo);
  if (!agent) {
    spinner.fail('Failed to create onboard agent');
    process.exit(1);
  }

  spinner.update('Generating onboarding guide...');
  try {
    const result = await agent.execute({
      files: ['src/', '.'],
    });
    spinner.stop();

    console.log();
    console.log(chalk.bold.cyan(`  Welcome to ${projectInfo.name}!`));
    console.log(chalk.cyan('  ' + '━'.repeat(40)));
    console.log();
    console.log(result.raw);
    console.log();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.fail('Onboarding failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

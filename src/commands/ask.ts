import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function askCommand(question: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!question) {
    logger.error('Please provide a question: dev-crew ask "how does auth work?"');
    process.exit(1);
  }

  spinner.start('Analyzing codebase...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();

  const registry = new AgentRegistry();
  const agent = registry.create('ask', projectInfo);
  if (!agent) {
    spinner.fail('Failed to create ask agent');
    process.exit(1);
  }

  spinner.update('Thinking...');
  try {
    const result = await agent.execute({
      query: question,
      files: ['src/'],
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

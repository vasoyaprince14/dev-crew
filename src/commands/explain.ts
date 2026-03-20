import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function explainCommand(filePath: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!filePath) {
    logger.error('Usage: dev-crew explain <file>');
    process.exit(1);
  }

  spinner.start('Analyzing code...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();

  const registry = new AgentRegistry();
  const agent = registry.create('ask', projectInfo);
  if (!agent) {
    spinner.fail('Failed to create agent');
    process.exit(1);
  }

  spinner.update('Generating explanation...');
  try {
    const result = await agent.execute({
      query: `Explain this code file in detail. Cover:
1. Purpose — what does this file do?
2. Key functions/methods — what does each one do?
3. Dependencies — what does it import and why?
4. Data flow — how does data move through this code?
5. Important patterns — any notable patterns or techniques used?
Keep it practical and useful for a developer who needs to work with this code.`,
      files: [filePath],
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

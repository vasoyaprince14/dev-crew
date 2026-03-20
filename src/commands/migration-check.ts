import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function migrationCheckCommand(migrationPath: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!migrationPath) {
    logger.error('Usage: dev-crew migration-check <path-to-migration>');
    process.exit(1);
  }

  spinner.start('Analyzing migration...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();

  const registry = new AgentRegistry();
  const agent = registry.create('designer', projectInfo);
  if (!agent) {
    spinner.fail('Failed to create designer agent');
    process.exit(1);
  }

  spinner.update('Checking migration safety...');
  try {
    const result = await agent.execute({
      query: `Review this database migration for safety issues. Check for:
1. Adding NOT NULL columns without defaults (will fail on existing rows)
2. Dropping columns or tables (data loss)
3. Table locks on large tables (ALTER TABLE, CREATE INDEX without CONCURRENTLY)
4. Missing indexes for new foreign keys
5. Unsafe data transformations
6. Missing rollback strategy
7. Backward compatibility with running application code

For each issue, rate severity (critical/warning/info) and suggest the safe alternative.`,
      files: [migrationPath],
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

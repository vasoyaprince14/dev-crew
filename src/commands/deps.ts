import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function depsCommand(action: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (action !== 'health') {
    logger.error('Usage: dev-crew deps health');
    process.exit(1);
  }

  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    logger.error('No package.json found');
    process.exit(1);
  }

  spinner.start('Analyzing dependencies...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();

  const registry = new AgentRegistry();
  const agent = registry.create('security', projectInfo);
  if (!agent) {
    spinner.fail('Failed to create security agent');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const depCount = Object.keys(pkg.dependencies || {}).length;
  const devDepCount = Object.keys(pkg.devDependencies || {}).length;

  spinner.update('Checking dependency health...');
  try {
    const result = await agent.execute({
      query: `Analyze the dependency health of this project's package.json. Check for:
1. Known security vulnerabilities in major packages
2. Severely outdated packages (major version behind)
3. Unmaintained packages (no updates in 12+ months)
4. Duplicate functionality (multiple packages doing the same thing)
5. Heavy packages that could be replaced with lighter alternatives
6. Missing important security packages (helmet, cors, rate-limit, etc.)

Package.json dependencies: ${JSON.stringify(pkg.dependencies || {}, null, 2)}
DevDependencies: ${JSON.stringify(pkg.devDependencies || {}, null, 2)}`,
      files: [],
    });
    spinner.stop();

    console.log();
    console.log(chalk.bold.cyan(`  Dependency Health Report`));
    console.log(chalk.gray(`  Total: ${depCount} dependencies | ${devDepCount} devDependencies`));
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

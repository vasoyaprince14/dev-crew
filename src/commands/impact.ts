import path from 'node:path';
import chalk from 'chalk';
import { DependencyGraph } from '../core/dependency-graph.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function impactCommand(filePath: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  if (!filePath) {
    logger.error('Usage: dev-crew impact <file>');
    process.exit(1);
  }

  spinner.start('Building dependency graph...');
  const graph = new DependencyGraph();
  const nodes = await graph.build(filePath, 3);
  spinner.succeed(`Analyzed ${nodes.length} files`);

  const rel = path.relative(process.cwd(), path.resolve(filePath));
  console.log();
  console.log(chalk.bold.cyan(`  Impact Analysis: ${rel}`));
  console.log(chalk.cyan('  ' + '━'.repeat(40)));

  // Direct dependents (depth 1)
  const direct = nodes.filter(n => n.depth === 1);
  const indirect = nodes.filter(n => n.depth === 2);
  const deep = nodes.filter(n => n.depth >= 3);

  if (direct.length > 0) {
    console.log();
    console.log(chalk.bold(`  Direct dependents (${direct.length} files):`));
    for (const n of direct) {
      const r = path.relative(process.cwd(), n.file);
      const reason = n.importedBy.length > 0 ? 'imports this file' : 'imported by this file';
      console.log(`  ├── ${chalk.white(r)} ${chalk.gray(`(${reason})`)}`);
    }
  }

  if (indirect.length > 0) {
    console.log();
    console.log(chalk.bold(`  Indirect dependents (${indirect.length} files):`));
    for (const n of indirect.slice(0, 10)) {
      const r = path.relative(process.cwd(), n.file);
      console.log(`  ├── ${chalk.gray(r)}`);
    }
    if (indirect.length > 10) {
      console.log(chalk.gray(`  └── ... and ${indirect.length - 10} more`));
    }
  }

  // Find test files
  const allFiles = nodes.map(n => n.file);
  const testFiles = allFiles.filter(f => f.includes('.spec.') || f.includes('.test.'));
  if (testFiles.length > 0) {
    console.log();
    console.log(chalk.bold(`  Tests that may need updating (${testFiles.length} files):`));
    for (const f of testFiles) {
      console.log(`  ├── ${path.relative(process.cwd(), f)}`);
    }
  }

  // Risk level
  const totalAffected = direct.length + indirect.length + deep.length;
  const risk = totalAffected > 20 ? 'HIGH' : totalAffected > 10 ? 'MEDIUM' : 'LOW';
  const riskColor = risk === 'HIGH' ? 'red' : risk === 'MEDIUM' ? 'yellow' : 'green';

  console.log();
  console.log(`  Risk level: ${chalk[riskColor].bold(risk)} (${totalAffected} files affected)`);
  console.log();
}

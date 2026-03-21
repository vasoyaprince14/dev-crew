import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { ProjectDetector } from '../core/project-detector.js';
import { Discovery } from '../core/discovery.js';
import { CreatePipeline } from '../pipelines/create-pipeline.js';
import { FileWriter } from '../core/file-writer.js';
import { ActionLayer } from '../core/action-layer.js';
import { AgentRegistry } from '../agents/registry.js';
import { Logger } from '../utils/logger.js';

interface CreateOptions {
  stack?: string;
  output?: string;
  yes?: boolean;
  install?: boolean;
}

export async function createCommand(description: string, options: CreateOptions): Promise<void> {
  const logger = new Logger();
  const actionLayer = new ActionLayer();
  const fileWriter = new FileWriter();

  if (!description) {
    logger.error('Usage: dev-crew create "build an uber clone with React and Node.js"');
    process.exit(1);
  }

  // Banner
  console.log();
  console.log(chalk.bold.cyan('  Dev-Crew App Builder'));
  console.log(chalk.cyan('  ' + '='.repeat(50)));
  console.log(chalk.dim(`  "${description}"`));
  console.log();

  // Step 1: Detect environment
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  const registry = new AgentRegistry();

  // Step 2: Discovery — interactive Q&A
  console.log(chalk.bold('  Step 1: Understanding your app'));
  console.log(chalk.dim('  ' + '-'.repeat(40)));

  const discovery = new Discovery(registry, projectInfo);
  const discoveryResult = await discovery.run(description, options.stack);

  console.log();
  console.log(chalk.green('  Got it! Here\'s what I\'ll build:'));
  console.log(chalk.dim(`  Stack: ${discoveryResult.techStack}`));
  if (discoveryResult.features.length > 0) {
    console.log(chalk.dim(`  Features: ${discoveryResult.features.slice(0, 5).join(', ')}`));
  }

  if (!options.yes) {
    const proceed = await actionLayer.confirm('\n  Start building?');
    if (!proceed) {
      logger.info('Cancelled.');
      return;
    }
  }

  // Step 3: Run the pipeline
  const pipeline = new CreatePipeline(projectInfo, options.yes);
  const result = await pipeline.run({
    description,
    refinedDescription: discoveryResult.refinedDescription,
    techStack: discoveryResult.techStack,
    features: discoveryResult.features,
    answers: discoveryResult.answers,
  });

  if (result.files.length === 0) {
    logger.error('No files were generated. The AI may have returned an unparseable response.');
    logger.info('Try again with a more specific description or different tech stack.');
    return;
  }

  // Step 4: Show file tree and confirm write
  const outputDir = options.output || path.resolve(process.cwd(), result.projectName);

  console.log();
  console.log(chalk.bold.cyan('  Generated Files'));
  console.log(chalk.cyan('  ' + '-'.repeat(40)));
  fileWriter.printTree(result.files);
  console.log();
  console.log(chalk.dim(`  ${result.files.length} files → ${outputDir}`));

  if (!options.yes) {
    const confirmWrite = await actionLayer.confirm('\n  Write all files to disk?');
    if (!confirmWrite) {
      logger.info('Cancelled. No files written.');
      return;
    }
  }

  // Step 5: Write files
  const writeResult = await fileWriter.writeAll(outputDir, result.files);

  console.log();
  console.log(chalk.green(`  ${writeResult.written.length} files written`));
  if (writeResult.errors.length > 0) {
    for (const err of writeResult.errors) {
      console.log(chalk.red(`  Failed: ${err.path} — ${err.error}`));
    }
  }

  // Step 6: Post-setup
  const hasPackageJson = result.files.some(f => f.path === 'package.json');

  if (hasPackageJson && options.install !== false) {
    console.log();
    try {
      console.log(chalk.dim('  Installing dependencies...'));
      execSync('npm install', { cwd: outputDir, stdio: 'pipe', timeout: 120000 });
      console.log(chalk.green('  Dependencies installed'));
    } catch {
      console.log(chalk.yellow('  Auto-install failed. Run npm install manually.'));
    }
  }

  // Git init
  try {
    const hasGit = fs.existsSync(path.join(outputDir, '.git'));
    if (!hasGit) {
      execSync('git init && git add -A && git commit -m "Initial commit from dev-crew create"', {
        cwd: outputDir,
        stdio: 'pipe',
        timeout: 30000,
      });
      console.log(chalk.green('  Git repository initialized'));
    }
  } catch {
    // Non-critical
  }

  // Step 7: Summary
  console.log();
  console.log(chalk.bold.cyan('  Your app is ready!'));
  console.log(chalk.cyan('  ' + '='.repeat(50)));
  console.log();
  console.log(`  ${chalk.bold('Location:')} ${outputDir}`);
  console.log(`  ${chalk.bold('Files:')}    ${writeResult.written.length} generated`);
  console.log(`  ${chalk.bold('Tokens:')}   ~${result.totalTokens.toLocaleString()}`);
  console.log(`  ${chalk.bold('Time:')}     ${(result.totalDuration / 1000).toFixed(1)}s`);

  if (result.setupSteps.length > 0) {
    console.log();
    console.log(chalk.bold('  Next steps:'));
    for (let i = 0; i < result.setupSteps.length; i++) {
      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${result.setupSteps[i]}`);
    }
  } else {
    console.log();
    console.log(chalk.bold('  Next steps:'));
    console.log(`  ${chalk.cyan('1.')} cd ${result.projectName}`);
    if (hasPackageJson && options.install === false) {
      console.log(`  ${chalk.cyan('2.')} npm install`);
    }
    console.log(`  ${chalk.cyan(hasPackageJson && options.install !== false ? '2.' : '3.')} Check .env.example and create .env`);
    console.log(`  ${chalk.cyan(hasPackageJson && options.install !== false ? '3.' : '4.')} npm run dev`);
  }

  console.log();
  console.log(chalk.dim('  Built with Dev-Crew — https://github.com/vasoyaprince14/dev-crew'));
  console.log();
}

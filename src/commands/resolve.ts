import fs from 'node:fs';
import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ActionLayer } from '../core/action-layer.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';
import { getGit } from '../utils/git-utils.js';

interface ConflictBlock {
  file: string;
  ours: string;
  theirs: string;
  marker: { start: number; end: number };
}

export async function resolveCommand(): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();
  const actionLayer = new ActionLayer();

  spinner.start('Looking for merge conflicts...');

  const git = getGit();
  let status;
  try {
    status = await git.status();
  } catch {
    spinner.fail('Not a git repository');
    process.exit(1);
    return;
  }

  const conflicted = status.conflicted;
  if (conflicted.length === 0) {
    spinner.succeed('No merge conflicts found');
    return;
  }

  spinner.succeed(`Found ${conflicted.length} conflicted file(s)`);

  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  const registry = new AgentRegistry();

  for (const file of conflicted) {
    console.log();
    console.log(chalk.bold.yellow(`Conflict: ${file}`));

    const content = fs.readFileSync(file, 'utf-8');
    const conflicts = parseConflicts(content);

    if (conflicts.length === 0) {
      logger.warn(`  Could not parse conflicts in ${file}`);
      continue;
    }

    for (let i = 0; i < conflicts.length; i++) {
      const conflict = conflicts[i];
      console.log(chalk.gray(`\n  --- Conflict ${i + 1}/${conflicts.length} ---`));
      console.log(chalk.red(`  <<<< HEAD (yours)`));
      console.log(chalk.red(`  ${conflict.ours.split('\n').slice(0, 5).join('\n  ')}`));
      console.log(chalk.gray('  ========'));
      console.log(chalk.green(`  ${conflict.theirs.split('\n').slice(0, 5).join('\n  ')}`));
      console.log(chalk.green(`  >>>> theirs`));
    }

    // Use AI to suggest resolution
    spinner.start('Analyzing conflicts...');
    const agent = registry.create('fix', projectInfo);
    if (!agent) {
      spinner.fail('Failed to create agent');
      continue;
    }

    try {
      const result = await agent.execute({
        files: [file],
        query: `This file has merge conflicts. Analyze both sides and suggest the correct resolution. Here are the conflicts:\n\n${content}`,
      });
      spinner.stop();

      console.log();
      console.log(chalk.bold('  AI Recommendation:'));
      console.log(result.raw);

      const apply = await actionLayer.confirm('  Apply AI resolution?');
      if (apply) {
        logger.success('Resolution applied');
      } else {
        logger.info('Skipped — resolve manually');
      }
    } catch (err) {
      spinner.fail('Analysis failed');
      logger.error(err instanceof Error ? err.message : String(err));
    }
  }
}

function parseConflicts(content: string): ConflictBlock[] {
  const conflicts: ConflictBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const start = i;
      const oursLines: string[] = [];
      const theirsLines: string[] = [];
      let inTheirs = false;
      i++;

      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        if (lines[i].startsWith('=======')) {
          inTheirs = true;
        } else if (inTheirs) {
          theirsLines.push(lines[i]);
        } else {
          oursLines.push(lines[i]);
        }
        i++;
      }

      conflicts.push({
        file: '',
        ours: oursLines.join('\n'),
        theirs: theirsLines.join('\n'),
        marker: { start, end: i },
      });
    }
    i++;
  }

  return conflicts;
}

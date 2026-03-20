import chalk from 'chalk';
import { createTwoFilesPatch } from 'diff';

export function formatDiff(oldContent: string, newContent: string, fileName: string): string {
  const patch = createTwoFilesPatch(
    `a/${fileName}`,
    `b/${fileName}`,
    oldContent,
    newContent,
    '',
    '',
  );
  return colorizeDiff(patch);
}

export function colorizeDiff(diff: string): string {
  return diff
    .split('\n')
    .map(line => {
      if (line.startsWith('+++')) return chalk.bold.green(line);
      if (line.startsWith('---')) return chalk.bold.red(line);
      if (line.startsWith('+')) return chalk.green(line);
      if (line.startsWith('-')) return chalk.red(line);
      if (line.startsWith('@@')) return chalk.cyan(line);
      return line;
    })
    .join('\n');
}

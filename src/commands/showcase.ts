import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';

export async function showcaseCommand(): Promise<void> {
  const feedbackDir = path.join(os.homedir(), '.dev-crew');
  const feedbackFile = path.join(feedbackDir, 'feedback.json');

  console.log();
  console.log(chalk.bold.cyan('  Dev-Crew Showcase'));
  console.log(chalk.cyan('  ' + '='.repeat(50)));
  console.log();

  // Show local feedback
  let feedbackData: Array<{ date: string; rating: number; project: string }> = [];
  try {
    feedbackData = JSON.parse(fs.readFileSync(feedbackFile, 'utf-8'));
  } catch { /* no feedback yet */ }

  if (feedbackData.length > 0) {
    console.log(chalk.bold('  Your Projects Built with Dev-Crew'));
    console.log(chalk.dim('  ' + '-'.repeat(40)));
    const avgRating = feedbackData.reduce((sum, f) => sum + f.rating, 0) / feedbackData.length;
    console.log(`  Total projects: ${chalk.bold(String(feedbackData.length))}`);
    console.log(`  Average rating: ${chalk.bold(avgRating.toFixed(1))} / 5.0`);
    console.log();

    // Show recent projects
    const recent = feedbackData.slice(-10).reverse();
    for (const entry of recent) {
      const stars = '\u2605'.repeat(entry.rating) + '\u2606'.repeat(5 - entry.rating);
      const date = new Date(entry.date).toLocaleDateString();
      console.log(`  ${chalk.yellow(stars)}  ${chalk.bold(entry.project)}  ${chalk.dim(date)}`);
    }
  } else {
    console.log(chalk.dim('  No projects built yet. Get started with:'));
    console.log();
    console.log(`  ${chalk.cyan('dev-crew create "build a todo app with React and PostgreSQL"')}`);
  }

  console.log();
  console.log(chalk.bold('  Community'));
  console.log(chalk.dim('  ' + '-'.repeat(40)));
  console.log(`  ${chalk.dim('Star us:')}     ${chalk.cyan('https://github.com/vasoyaprince14/dev-crew')}`);
  console.log(`  ${chalk.dim('Report bugs:')} ${chalk.cyan('https://github.com/vasoyaprince14/dev-crew/issues')}`);
  console.log(`  ${chalk.dim('npm:')}         ${chalk.cyan('https://www.npmjs.com/package/dev-crew')}`);
  console.log();

  // Show badge instructions
  console.log(chalk.bold('  Add "Built with Dev-Crew" Badge'));
  console.log(chalk.dim('  ' + '-'.repeat(40)));
  console.log(chalk.dim('  Add this to your project README:'));
  console.log();
  console.log(chalk.cyan('  [![Built with Dev-Crew](https://img.shields.io/badge/Built%20with-Dev--Crew-blue?style=flat-square)](https://github.com/vasoyaprince14/dev-crew)'));
  console.log();
}

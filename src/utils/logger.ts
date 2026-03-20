import chalk from 'chalk';

export class Logger {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message: string): void {
    console.error(chalk.red('✖'), message);
  }

  critical(message: string): void {
    console.error(chalk.bgRed.white(' CRITICAL '), message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`  [debug] ${message}`));
    }
  }

  blank(): void {
    console.log();
  }

  divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }

  header(title: string): void {
    console.log();
    console.log(chalk.bold.white(title));
    this.divider();
  }

  issue(severity: string, file: string, line: number | undefined, message: string): void {
    const icon = severity === 'critical' ? chalk.red('●')
      : severity === 'warning' ? chalk.yellow('●')
      : chalk.blue('●');
    const tag = severity === 'critical' ? chalk.red.bold('CRITICAL')
      : severity === 'warning' ? chalk.yellow.bold('WARNING')
      : chalk.blue('INFO');
    const location = line ? `${file}:${line}` : file;
    console.log(`  ${icon} ${tag}  ${chalk.gray(location)}`);
    console.log(`     ${message}`);
  }
}

import readline from 'node:readline';

// ── ANSI color codes (no external dependencies) ──────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',
  gray: '\x1b[38;5;245m',
  darkGray: '\x1b[38;5;238m',
  orange: '\x1b[38;5;208m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// ── Types ────────────────────────────────────────────────────────────────────

type SeverityLevel = 'critical' | 'warning' | 'info' | 'success';

interface BoxOptions {
  title?: string;
  borderColor?: string;
  padding?: number;
  width?: number;
}

interface ReviewIssue {
  severity: SeverityLevel;
  file: string;
  line: number;
  message: string;
  suggestion?: string;
}

interface TokenStats {
  before: number;
  after: number;
  saved: number;
  percentage: number;
}

interface Agent {
  name: string;
  category: string;
  description?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ANSI escape sequences to measure visible string length. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

function padEnd(str: string, len: number): string {
  const diff = len - visibleLength(str);
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

function terminalWidth(): number {
  return process.stdout.columns ?? 80;
}

// ── TerminalUI class ─────────────────────────────────────────────────────────

export class TerminalUI {
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;

  // ── Banner & Welcome ────────────────────────────────────────────────────

  /** Display a colorful ASCII art "DEV CREW" banner. */
  showBanner(): void {
    const banner = `
${C.brightCyan}${C.bold}  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   ${C.brightGreen}██████╗  ███████╗██╗   ██╗                    ${C.brightCyan}║
  ║   ${C.brightGreen}██╔══██╗ ██╔════╝██║   ██║                    ${C.brightCyan}║
  ║   ${C.brightGreen}██║  ██║ █████╗  ██║   ██║                    ${C.brightCyan}║
  ║   ${C.brightGreen}██║  ██║ ██╔══╝  ╚██╗ ██╔╝                    ${C.brightCyan}║
  ║   ${C.brightGreen}██████╔╝ ███████╗ ╚████╔╝                     ${C.brightCyan}║
  ║   ${C.brightGreen}╚═════╝  ╚══════╝  ╚═══╝                      ${C.brightCyan}║
  ║                                                  ║
  ║   ${C.orange} ██████╗██████╗ ███████╗██╗    ██╗             ${C.brightCyan}║
  ║   ${C.orange}██╔════╝██╔══██╗██╔════╝██║    ██║             ${C.brightCyan}║
  ║   ${C.orange}██║     ██████╔╝█████╗  ██║ █╗ ██║             ${C.brightCyan}║
  ║   ${C.orange}██║     ██╔══██╗██╔══╝  ██║███╗██║             ${C.brightCyan}║
  ║   ${C.orange}╚██████╗██║  ██║███████╗╚███╔███╔╝             ${C.brightCyan}║
  ║   ${C.orange} ╚═════╝╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝              ${C.brightCyan}║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝${C.reset}
`;
    console.log(banner);
  }

  /** Show provider information and a help hint. */
  showWelcome(providerName: string): void {
    const content = [
      `${C.bold}${C.white}Provider: ${C.brightGreen}${providerName}${C.reset}`,
      `${C.gray}Type ${C.white}help${C.gray} to see available commands${C.reset}`,
    ].join('\n');

    this.box(content, { title: 'Welcome', borderColor: C.brightCyan });
  }

  // ── Box Drawing ─────────────────────────────────────────────────────────

  /** Draw a Unicode box around content with optional title and border color. */
  box(content: string, options: BoxOptions = {}): void {
    const {
      title,
      borderColor = C.gray,
      padding = 1,
      width: explicitWidth,
    } = options;

    const lines = content.split('\n');
    const maxContentWidth = Math.max(
      ...lines.map((l) => visibleLength(l)),
      title ? visibleLength(title) + 4 : 0,
    );
    const innerWidth = explicitWidth
      ? explicitWidth - 2 - padding * 2
      : maxContentWidth;
    const totalInner = innerWidth + padding * 2;

    const bc = borderColor;
    const pad = ' '.repeat(padding);

    // Top border
    if (title) {
      const titleStr = ` ${C.bold}${C.white}${title}${C.reset}${bc} `;
      const remaining = totalInner - visibleLength(titleStr) + 1;
      console.log(`${bc}╭─${titleStr}${'─'.repeat(Math.max(0, remaining))}╮${C.reset}`);
    } else {
      console.log(`${bc}╭${'─'.repeat(totalInner)}╮${C.reset}`);
    }

    // Content lines
    for (const line of lines) {
      const padded = padEnd(line, innerWidth);
      console.log(`${bc}│${C.reset}${pad}${padded}${pad}${bc}│${C.reset}`);
    }

    // Bottom border
    console.log(`${bc}╰${'─'.repeat(totalInner)}╯${C.reset}`);
  }

  // ── Severity Badge ──────────────────────────────────────────────────────

  /** Return a colored badge string for the given severity level. */
  severity(level: SeverityLevel): string {
    switch (level) {
      case 'critical':
        return `${C.bgRed}${C.bold}${C.white} CRITICAL ${C.reset}`;
      case 'warning':
        return `${C.bgYellow}${C.bold}${C.white} WARNING ${C.reset}`;
      case 'info':
        return `${C.bgBlue}${C.bold}${C.white} INFO ${C.reset}`;
      case 'success':
        return `${C.bgGreen}${C.bold}${C.white} SUCCESS ${C.reset}`;
    }
  }

  // ── Spinner ─────────────────────────────────────────────────────────────

  /** Start an animated spinner with the given message. */
  startSpinner(message: string): void {
    this.stopSpinner(); // clear any existing spinner
    this.spinnerIndex = 0;

    process.stdout.write(`${C.cyan}${this.spinnerFrames[0]}${C.reset} ${message}`);

    this.spinnerTimer = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
      const frame = this.spinnerFrames[this.spinnerIndex];
      process.stdout.write(`\r${C.cyan}${frame}${C.reset} ${message}`);
    }, 80);
  }

  /** Stop the spinner and display a final status message. */
  stopSpinner(message?: string, success = true): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }

    if (message !== undefined) {
      const icon = success
        ? `${C.brightGreen}✓${C.reset}`
        : `${C.brightRed}✗${C.reset}`;
      process.stdout.write(`\r${icon} ${message}\n`);
    }
  }

  // ── Score Bar ───────────────────────────────────────────────────────────

  /** Render a visual score bar: ████████░░ 8/10 */
  scoreBar(score: number, max = 10): string {
    const clamped = Math.max(0, Math.min(max, score));
    const filled = Math.round(clamped);
    const empty = max - filled;

    let color: string;
    if (clamped >= 8) color = C.brightGreen;
    else if (clamped >= 5) color = C.brightYellow;
    else color = C.brightRed;

    const bar =
      `${color}${'█'.repeat(filled)}${C.darkGray}${'░'.repeat(empty)}${C.reset}`;

    return `${bar} ${C.bold}${clamped}${C.reset}${C.gray}/${max}${C.reset}`;
  }

  // ── Review Issue ────────────────────────────────────────────────────────

  /** Display a review issue with severity badge, file location, message, and suggestion. */
  showIssue(issue: ReviewIssue): void {
    const badge = this.severity(issue.severity);
    const location = `${C.cyan}${issue.file}${C.reset}${C.gray}:${C.reset}${C.yellow}${issue.line}${C.reset}`;

    console.log('');
    console.log(`  ${badge}  ${location}`);
    console.log(`  ${C.white}${issue.message}${C.reset}`);

    if (issue.suggestion) {
      console.log(`  ${C.dim}${C.green}Suggestion: ${issue.suggestion}${C.reset}`);
    }

    console.log('');
  }

  // ── Diff Colorizer ──────────────────────────────────────────────────────

  /** Colorize a unified diff: additions green, deletions red, hunks cyan. */
  showDiff(diffText: string): void {
    const lines = diffText.split('\n');

    for (const line of lines) {
      if (line.startsWith('@@')) {
        console.log(`${C.cyan}${line}${C.reset}`);
      } else if (line.startsWith('+')) {
        console.log(`${C.green}${line}${C.reset}`);
      } else if (line.startsWith('-')) {
        console.log(`${C.red}${line}${C.reset}`);
      } else {
        console.log(`${C.dim}${line}${C.reset}`);
      }
    }
  }

  // ── Token Savings ───────────────────────────────────────────────────────

  /** Display a box showing token savings statistics. */
  showTokenSavings(stats: TokenStats): void {
    const saved = stats.saved.toLocaleString();
    const pct = stats.percentage.toFixed(1);

    const content = [
      `${C.gray}Before: ${C.white}${stats.before.toLocaleString()} tokens${C.reset}`,
      `${C.gray}After:  ${C.white}${stats.after.toLocaleString()} tokens${C.reset}`,
      `${C.brightGreen}${C.bold}Saved:  ${saved} tokens (${pct}%)${C.reset}`,
    ].join('\n');

    this.box(content, { title: 'Token Savings', borderColor: C.green });
  }

  // ── Agent List ──────────────────────────────────────────────────────────

  /** Pretty-print a list of agents grouped by category. */
  showAgentList(agents: Agent[]): void {
    const grouped = new Map<string, Agent[]>();

    for (const agent of agents) {
      const list = grouped.get(agent.category) ?? [];
      list.push(agent);
      grouped.set(agent.category, list);
    }

    console.log('');

    for (const [category, members] of grouped) {
      console.log(`  ${C.bold}${C.brightCyan}${category}${C.reset}`);

      for (const agent of members) {
        const desc = agent.description
          ? `${C.gray} - ${agent.description}${C.reset}`
          : '';
        console.log(`    ${C.green}●${C.reset} ${C.white}${agent.name}${C.reset}${desc}`);
      }

      console.log('');
    }
  }

  // ── Interactive Prompts ─────────────────────────────────────────────────

  /** Prompt the user with a question and return their answer. */
  prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(`${C.brightCyan}?${C.reset} ${C.bold}${question}${C.reset} `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /** Ask a y/n confirmation question. Returns true for yes. */
  confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(
        `${C.brightCyan}?${C.reset} ${C.bold}${message}${C.reset} ${C.gray}(y/n)${C.reset} `,
        (answer) => {
          rl.close();
          resolve(answer.trim().toLowerCase().startsWith('y'));
        },
      );
    });
  }

  // ── Divider ─────────────────────────────────────────────────────────────

  /** Draw a horizontal divider line. */
  divider(): void {
    const width = Math.min(terminalWidth(), 80);
    console.log(`${C.darkGray}${'─'.repeat(width)}${C.reset}`);
  }

  // ── Log Helpers ─────────────────────────────────────────────────────────

  /** Log a success message. */
  success(msg: string): void {
    console.log(`${C.brightGreen}✓${C.reset} ${msg}`);
  }

  /** Log an error message. */
  error(msg: string): void {
    console.log(`${C.brightRed}✗${C.reset} ${msg}`);
  }

  /** Log a warning message. */
  warn(msg: string): void {
    console.log(`${C.brightYellow}⚠${C.reset} ${msg}`);
  }

  /** Log an info message. */
  info(msg: string): void {
    console.log(`${C.brightCyan}ℹ${C.reset} ${msg}`);
  }
}

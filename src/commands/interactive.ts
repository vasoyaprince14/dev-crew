import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ProviderBridge } from '../core/provider-bridge.js';
import { ConfigManager } from '../core/config-manager.js';
import { TokenOptimizer } from '../core/token-optimizer.js';
import { parseNaturalInput } from '../core/nlp-router.js';
import { DebtTracker } from '../features/debt-tracker.js';
import { ActionLayer } from '../core/action-layer.js';
import { Logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearLine: '\x1b[2K\r',
};

// ---------------------------------------------------------------------------
// Thinking animation
// ---------------------------------------------------------------------------

class ThinkingIndicator {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private startTime = 0;
  private currentStep = '';

  private readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  start(step = 'Thinking'): void {
    this.startTime = Date.now();
    this.currentStep = step;
    this.frame = 0;
    process.stdout.write(C.hideCursor);
    this.render();
    this.interval = setInterval(() => this.render(), 80);
  }

  update(step: string): void {
    this.currentStep = step;
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write(C.clearLine);
    process.stdout.write(C.showCursor);
    if (message) {
      console.log(message);
    }
  }

  private render(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
    const spinner = this.frames[this.frame % this.frames.length];
    process.stdout.write(C.clearLine);
    process.stdout.write(`  ${C.brightCyan}${spinner}${C.reset} ${C.dim}${this.currentStep}${C.reset} ${C.gray}${elapsed}s${C.reset}`);
    this.frame++;
  }
}

// ---------------------------------------------------------------------------
// Beautiful output formatters
// ---------------------------------------------------------------------------

function scoreBar(score: number, max = 10): string {
  const clamped = Math.max(0, Math.min(max, score));
  const filled = Math.round(clamped);
  const empty = max - filled;
  let color: string;
  if (clamped >= 8) color = C.brightGreen;
  else if (clamped >= 5) color = C.brightYellow;
  else color = C.brightRed;
  return `${color}${'█'.repeat(filled)}${C.gray}${'░'.repeat(empty)}${C.reset} ${C.bold}${clamped}${C.reset}${C.gray}/${max}${C.reset}`;
}

function severityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return `${C.bgRed}${C.bold}${C.white} CRITICAL ${C.reset}`;
    case 'error':
      return `${C.bgRed}${C.bold}${C.white} ERROR    ${C.reset}`;
    case 'warning':
      return `${C.bgYellow}${C.bold}${C.white} WARNING  ${C.reset}`;
    case 'info':
      return `${C.bgBlue}${C.bold}${C.white} INFO     ${C.reset}`;
    case 'suggestion':
      return `${C.bgCyan}${C.bold}${C.white} SUGGEST  ${C.reset}`;
    default:
      return `${C.bgGray}${C.white} ${severity.toUpperCase().padEnd(9)}${C.reset}`;
  }
}

function formatReviewResponse(raw: string): void {
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  let data: any;
  try {
    data = JSON.parse(jsonStr.trim());
  } catch {
    console.log(raw);
    return;
  }

  // Summary
  if (data.summary) {
    console.log();
    console.log(`  ${C.bold}${C.white}Summary${C.reset}`);
    console.log(`  ${C.gray}${'─'.repeat(50)}${C.reset}`);
    console.log(`  ${data.summary}`);
    console.log();
  }

  // Score
  if (typeof data.score === 'number') {
    console.log(`  ${C.bold}Score${C.reset}  ${scoreBar(data.score)}`);
    console.log();
  }

  // Issues
  if (data.issues && data.issues.length > 0) {
    const criticalCount = data.issues.filter((i: any) => i.severity === 'critical' || i.severity === 'error').length;
    const warningCount = data.issues.filter((i: any) => i.severity === 'warning').length;
    const infoCount = data.issues.filter((i: any) => i.severity === 'info' || i.severity === 'suggestion').length;

    console.log(`  ${C.bold}Issues${C.reset}  ${criticalCount ? `${C.brightRed}${criticalCount} critical${C.reset}  ` : ''}${warningCount ? `${C.brightYellow}${warningCount} warnings${C.reset}  ` : ''}${infoCount ? `${C.cyan}${infoCount} info${C.reset}` : ''}`);
    console.log();

    for (let idx = 0; idx < data.issues.length; idx++) {
      const issue = data.issues[idx];
      const badge = severityBadge(issue.severity);
      const location = issue.file
        ? `${C.cyan}${issue.file}${C.reset}${issue.line ? `${C.gray}:${C.yellow}${issue.line}${C.reset}` : ''}`
        : '';

      console.log(`  ${C.dim}#${idx + 1}${C.reset} ${badge}  ${location}`);
      if (issue.title) {
        console.log(`     ${C.bold}${C.white}${issue.title}${C.reset}`);
      }
      if (issue.message) {
        console.log(`     ${C.gray}${issue.message}${C.reset}`);
      }
      if (issue.suggestion || issue.fix) {
        console.log(`     ${C.green}→ ${issue.suggestion || issue.fix}${C.reset}`);
      }
      console.log();
    }
  }

  // Positives
  if (data.positives && data.positives.length > 0) {
    console.log(`  ${C.bold}${C.brightGreen}Positives${C.reset}`);
    for (const p of data.positives) {
      console.log(`  ${C.green}  ✓${C.reset} ${p}`);
    }
    console.log();
  }

  // Suggestions
  if (data.suggestions && data.suggestions.length > 0) {
    console.log(`  ${C.bold}${C.cyan}Suggestions${C.reset}`);
    for (const s of data.suggestions) {
      console.log(`  ${C.cyan}  →${C.reset} ${s}`);
    }
    console.log();
  }

  // Generic fields for non-review JSON
  if (!data.issues && !data.summary) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        console.log(`  ${C.bold}${key}:${C.reset} ${value}`);
      } else if (typeof value === 'number') {
        console.log(`  ${C.bold}${key}:${C.reset} ${C.brightCyan}${value}${C.reset}`);
      } else if (Array.isArray(value)) {
        console.log(`  ${C.bold}${key}:${C.reset}`);
        for (const item of value) {
          if (typeof item === 'string') {
            console.log(`    ${C.cyan}•${C.reset} ${item}`);
          } else if (typeof item === 'object' && item !== null) {
            const label = item.name || item.title || item.message || JSON.stringify(item);
            console.log(`    ${C.cyan}•${C.reset} ${label}`);
          }
        }
      }
    }
    console.log();
  }
}

function formatGenericResponse(raw: string): void {
  // Try JSON first
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  try {
    JSON.parse(jsonStr.trim());
    formatReviewResponse(raw);
    return;
  } catch {
    // Not JSON
  }

  // Format markdown-like text
  const lines = raw.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        const lang = line.slice(3).trim();
        console.log(`  ${C.gray}┌─${lang ? ` ${lang} ` : ''}${'─'.repeat(Math.max(0, 40 - (lang ? lang.length + 2 : 0)))}${C.reset}`);
      } else {
        console.log(`  ${C.gray}└${'─'.repeat(42)}${C.reset}`);
      }
      continue;
    }
    if (inCodeBlock) {
      console.log(`  ${C.gray}│${C.reset} ${C.brightCyan}${line}${C.reset}`);
      continue;
    }

    if (line.startsWith('# ')) {
      console.log();
      console.log(`  ${C.bold}${C.brightCyan}${line.slice(2)}${C.reset}`);
      console.log(`  ${C.gray}${'─'.repeat(50)}${C.reset}`);
    } else if (line.startsWith('## ')) {
      console.log();
      console.log(`  ${C.bold}${C.white}${line.slice(3)}${C.reset}`);
    } else if (line.startsWith('### ')) {
      console.log(`  ${C.bold}${line.slice(4)}${C.reset}`);
    } else if (/^[-*] /.test(line)) {
      console.log(`  ${C.cyan}  •${C.reset} ${line.slice(2)}`);
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/)!;
      console.log(`  ${C.cyan}  ${match[1]}.${C.reset} ${match[2]}`);
    } else if (line.startsWith('>')) {
      console.log(`  ${C.gray}  │ ${C.italic}${line.slice(1).trim()}${C.reset}`);
    } else if (line.trim() === '') {
      console.log();
    } else {
      let formatted = line;
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, `${C.bold}$1${C.reset}`);
      formatted = formatted.replace(/`(.*?)`/g, `${C.brightCyan}$1${C.reset}`);
      formatted = formatted.replace(/_(.*?)_/g, `${C.italic}$1${C.reset}`);
      console.log(`  ${formatted}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Diff viewer
// ---------------------------------------------------------------------------

function showDiff(file: string, diff: string): void {
  console.log(`  ${C.bold}${C.white}Diff: ${C.cyan}${file}${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);

  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('@@')) {
      console.log(`  ${C.cyan}${line}${C.reset}`);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      console.log(`  ${C.brightGreen}${line}${C.reset}`);
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      console.log(`  ${C.brightRed}${line}${C.reset}`);
    } else {
      console.log(`  ${C.gray}${line}${C.reset}`);
    }
  }
  console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);
}

// ---------------------------------------------------------------------------
// Token savings display (real data from TokenIntelligence)
// ---------------------------------------------------------------------------

function showTokenUsage(tokensUsed: number, duration: number): void {
  console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
  const cost = (tokensUsed * 0.003) / 1000;
  console.log(`  ${C.dim}~${tokensUsed.toLocaleString()} tokens${C.reset}  ${C.dim}~$${cost.toFixed(4)}${C.reset}  ${C.dim}${duration.toFixed(1)}s${C.reset}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Status bar (persistent line after each command)
// ---------------------------------------------------------------------------

function renderStatusBar(opts: {
  agent?: string;
  provider: string;
  gitBranch: string;
  tokensUsed: number;
  tokensSaved: number;
  mode: string;
  commands: number;
}): void {
  const agentPart = opts.agent ? `${C.brightCyan}${opts.agent}${C.reset}` : '';
  const providerPart = `${C.dim}${opts.provider}${C.reset}`;
  const branchPart = opts.gitBranch ? `${C.magenta}${opts.gitBranch}${C.reset}` : '';
  const tokensPart = `${C.dim}${opts.tokensUsed.toLocaleString()} tok${C.reset}`;
  const modePart = opts.mode !== 'normal' ? `${C.bgMagenta}${C.bold}${C.white} ${opts.mode.toUpperCase()} ${C.reset}` : '';

  const parts = [agentPart, providerPart, branchPart, tokensPart, modePart].filter(Boolean);
  console.log(`  ${C.gray}${parts.join(` ${C.gray}│${C.reset} `)}${C.reset}`);
}

// ---------------------------------------------------------------------------
// File path completer
// ---------------------------------------------------------------------------

function getFileList(partial: string, maxResults = 15): { display: string; value: string }[] {
  try {
    const raw = partial.startsWith('@') ? partial.slice(1) : partial;
    const dir = raw.includes('/') ? path.dirname(raw) : '.';
    const prefix = raw.includes('/') ? path.basename(raw) : raw;
    const atPrefix = partial.startsWith('@') ? '@' : '';

    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir);
    return entries
      .filter(e => e.startsWith(prefix))
      .filter(e => !e.startsWith('.') && e !== 'node_modules' && e !== 'dist' && e !== '.git')
      .slice(0, maxResults)
      .map(e => {
        const full = dir === '.' ? e : `${dir}/${e}`;
        const isDir = fs.statSync(full).isDirectory();
        const icon = isDir ? `${C.blue}📁${C.reset}` : `${C.gray}📄${C.reset}`;
        return {
          display: `${icon} ${isDir ? `${C.blue}${e}/${C.reset}` : `${C.white}${e}${C.reset}`}`,
          value: `${atPrefix}${isDir ? `${full}/` : full}`,
        };
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Slash command registry
// ---------------------------------------------------------------------------

const SLASH_COMMANDS = [
  { cmd: '/help', alias: '/h', desc: 'Show help and commands' },
  { cmd: '/agents', alias: '/a', desc: 'List all 24 agents' },
  { cmd: '/providers', alias: null, desc: 'Show AI provider status' },
  { cmd: '/provider', alias: null, desc: 'Switch provider (/provider ollama)' },
  { cmd: '/project', alias: null, desc: 'Show detected project info' },
  { cmd: '/test', alias: null, desc: 'Test AI provider connectivity' },
  { cmd: '/tokens', alias: null, desc: 'Session token usage & savings' },
  { cmd: '/diff', alias: null, desc: 'Show recent git changes' },
  { cmd: '/debt', alias: null, desc: 'Tech debt dashboard' },
  { cmd: '/feedback', alias: null, desc: 'Teach agent (/feedback review always check X)' },
  { cmd: '/export', alias: null, desc: 'Export last result to file' },
  { cmd: '/doctor', alias: null, desc: 'Diagnose installation & setup' },
  { cmd: '/config', alias: null, desc: 'Show project configuration' },
  { cmd: '/history', alias: null, desc: 'Show command history' },
  { cmd: '/plan', alias: null, desc: 'Toggle plan mode' },
  { cmd: '/clear', alias: null, desc: 'Clear the screen' },
  { cmd: '/quit', alias: '/q', desc: 'Exit interactive mode' },
];

function buildCompleter(knownAgentIds: string[]) {
  return function completer(line: string): [string[], string] {
    const trimmed = line.trim();

    // Slash commands
    if (trimmed.startsWith('/')) {
      const matches = SLASH_COMMANDS.filter(s => s.cmd.startsWith(trimmed) || (s.alias && s.alias.startsWith(trimmed)));
      if (matches.length > 0) {
        if (matches.length > 1 || trimmed === '/') {
          console.log();
          for (const m of matches) {
            console.log(`    ${C.white}${m.cmd.padEnd(14)}${C.reset}${C.gray}${m.desc}${C.reset}`);
          }
          console.log();
        }
        return [matches.map(m => m.cmd), trimmed];
      }
      return [SLASH_COMMANDS.map(s => s.cmd), trimmed];
    }

    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1] || '';

    // @file tagging
    if (lastWord.startsWith('@')) {
      const files = getFileList(lastWord);
      if (files.length > 0) {
        console.log();
        for (const f of files) {
          console.log(`    ${f.display}`);
        }
        console.log();
        return [files.map(f => f.value), lastWord];
      }
      return [[], lastWord];
    }

    // Agent names at beginning
    if (words.length === 1) {
      const hits = knownAgentIds.filter(a => a.startsWith(words[0]));
      if (hits.length > 0 && hits.length <= 10) {
        console.log();
        for (const h of hits) {
          console.log(`    ${C.brightCyan}${h}${C.reset}`);
        }
        console.log();
      }
      return [hits.length ? hits : knownAgentIds, words[0]];
    }

    // File path completion (without @)
    if (lastWord && (lastWord.includes('/') || lastWord.includes('.'))) {
      const files = getFileList(lastWord);
      if (files.length > 0) {
        console.log();
        for (const f of files) {
          console.log(`    ${f.display}`);
        }
        console.log();
        return [files.map(f => f.value), lastWord];
      }
    }

    return [[], line];
  };
}

// ---------------------------------------------------------------------------
// Contextual tips
// ---------------------------------------------------------------------------

const TIPS = [
  `Type ${C.white}@${C.gray} then press ${C.white}Tab${C.gray} to browse and tag files`,
  `Use ${C.white}/agents${C.gray} to see all 24 specialized agents`,
  `Try ${C.white}security @src/${C.gray} to run a security audit`,
  `Use ${C.white}/feedback review${C.gray} to teach the review agent your preferences`,
  `Run ${C.white}fix <file>${C.gray} after a review to auto-fix found issues`,
  `Type ${C.white}/debt${C.gray} to see your tech debt dashboard`,
  `Use ${C.white}/diff${C.gray} to see recent git changes before reviewing`,
  `Try ${C.white}explain @src/complex-file.ts${C.gray} for code explanations`,
  `Run ${C.white}test @src/utils.ts${C.gray} to auto-generate tests`,
  `Type ${C.white}/export${C.gray} to save the last result as markdown`,
  `Use ${C.white}\\${C.gray} at end of line for multi-line input`,
  `Try ${C.white}debug "error message here"${C.gray} for root cause analysis`,
  `Use ${C.white}/plan${C.gray} to toggle plan mode — agents explain before executing`,
  `Run ${C.white}tech-lead${C.gray} for architecture advice on your project`,
  `Type ${C.white}/provider ollama${C.gray} to switch to a local AI model`,
];

let tipIndex = 0;
function getNextTip(): string {
  const tip = TIPS[tipIndex % TIPS.length];
  tipIndex++;
  return `  ${C.dim}💡 ${tip}${C.reset}`;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function getGitDiff(): string {
  try {
    return execSync('git diff --stat HEAD~5..HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    try {
      return execSync('git diff --stat 2>/dev/null', { encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  }
}

function getGitDiffDetailed(): string {
  try {
    return execSync('git diff HEAD~1..HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    try {
      return execSync('git diff 2>/dev/null', { encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  }
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function showBanner(projectName: string, language: string, framework: string | null, providerName: string, version: string, gitBranch: string): void {
  console.log();
  console.log(`${C.brightCyan}  ╭──────────────────────────────────────────────╮${C.reset}`);
  console.log(`${C.brightCyan}  │${C.reset}                                              ${C.brightCyan}│${C.reset}`);
  console.log(`${C.brightCyan}  │${C.reset}   ${C.bold}${C.brightCyan}Dev-Crew${C.reset} ${C.dim}v${version}${C.reset}                          ${C.brightCyan}│${C.reset}`);
  console.log(`${C.brightCyan}  │${C.reset}   ${C.gray}Your AI-Powered Developer Team${C.reset}             ${C.brightCyan}│${C.reset}`);
  console.log(`${C.brightCyan}  │${C.reset}                                              ${C.brightCyan}│${C.reset}`);
  console.log(`${C.brightCyan}  ╰──────────────────────────────────────────────╯${C.reset}`);
  console.log();
  console.log(`  ${C.green}●${C.reset} ${C.bold}Project${C.reset}    ${C.white}${projectName}${C.reset} ${C.gray}(${language}${framework ? ' / ' + framework : ''})${C.reset}`);
  console.log(`  ${C.green}●${C.reset} ${C.bold}Provider${C.reset}   ${C.white}${providerName}${C.reset}`);
  console.log(`  ${C.green}●${C.reset} ${C.bold}Agents${C.reset}     ${C.white}24 specialized agents${C.reset}`);
  if (gitBranch) {
    console.log(`  ${C.green}●${C.reset} ${C.bold}Branch${C.reset}     ${C.magenta}${gitBranch}${C.reset}`);
  }
  console.log();
  console.log(`  ${C.gray}Shortcuts:${C.reset} ${C.white}/${C.reset}${C.gray}commands  ${C.white}@${C.reset}${C.gray}files  ${C.white}Tab${C.reset}${C.gray} autocomplete  ${C.white}\\${C.reset}${C.gray} multi-line${C.reset}`);
  console.log(`  ${C.gray}Try:${C.reset} ${C.dim}review @src/app.ts${C.reset} ${C.gray}|${C.reset} ${C.dim}security src/${C.reset} ${C.gray}|${C.reset} ${C.dim}explain @lib/auth.ts${C.reset}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function showHelp(): void {
  console.log();

  console.log(`  ${C.bold}${C.brightCyan}/ Slash Commands${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);
  for (const s of SLASH_COMMANDS) {
    const aliasStr = s.alias ? ` ${C.dim}(${s.alias})${C.reset}` : '';
    console.log(`  ${C.white}  ${s.cmd.padEnd(14)}${C.reset}${aliasStr}${aliasStr ? '' : '  '} ${C.gray}${s.desc}${C.reset}`);
  }
  console.log();

  console.log(`  ${C.bold}${C.brightCyan}@ File Tagging${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);
  console.log(`  ${C.gray}  Type ${C.white}@${C.gray} then press ${C.white}Tab${C.gray} to browse files${C.reset}`);
  console.log(`  ${C.white}  review @src/app.ts${C.reset}         ${C.gray}Review a file${C.reset}`);
  console.log(`  ${C.white}  fix @src/api.ts${C.reset}            ${C.gray}Fix a file${C.reset}`);
  console.log(`  ${C.white}  explain @lib/auth.ts${C.reset}       ${C.gray}Explain a file${C.reset}`);
  console.log(`  ${C.white}  test @src/utils.ts${C.reset}         ${C.gray}Generate tests${C.reset}`);
  console.log(`  ${C.white}  what does @config.ts do${C.reset}    ${C.gray}Natural language + file${C.reset}`);
  console.log();

  console.log(`  ${C.bold}${C.brightCyan}Multi-line Input${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);
  console.log(`  ${C.gray}  End a line with ${C.white}\\${C.gray} to continue on the next line${C.reset}`);
  console.log(`  ${C.white}  review @src/app.ts \\${C.reset}`);
  console.log(`  ${C.white}  ... focus on security and performance${C.reset}`);
  console.log();

  console.log(`  ${C.bold}${C.brightCyan}Agent Commands${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);
  const agents: [string, string][] = [
    ['review <path>', 'Code review with severity scores'],
    ['fix <file>', 'Fix issues with diff preview'],
    ['test <file>', 'Generate tests'],
    ['debug <error>', 'Root cause analysis'],
    ['security <path>', 'Security audit (OWASP)'],
    ['explain <file>', 'Code explanation'],
    ['ask <question>', 'Codebase Q&A'],
    ['tech-lead <q>', 'Architecture advice'],
    ['devops <question>', 'Docker, CI/CD, infrastructure'],
    ['db-architect <q>', 'Database design & queries'],
    ['api-architect <q>', 'API design review'],
    ['performance <path>', 'Performance audit'],
    ['accessibility <path>', 'WCAG audit'],
    ['onboard', 'New developer guide'],
  ];
  for (const [cmd, desc] of agents) {
    console.log(`  ${C.white}  ${cmd.padEnd(24)}${C.reset} ${C.gray}${desc}${C.reset}`);
  }
  console.log();
  console.log(`  ${C.dim}  Type naturally: "check security of src/" or "is there tech debt?"${C.reset}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Interactive REPL
// ---------------------------------------------------------------------------

export async function interactiveCommand(): Promise<void> {
  const logger = new Logger();

  // --- Session state ---
  let sessionTokensIn = 0;
  let sessionTokensOut = 0;
  // sessionTokensSaved removed — we don't fabricate savings
  let sessionCommands = 0;
  const sessionStartTime = Date.now();
  let lastResult: { raw: string; agent: string; parsed: any } | null = null;
  let lastAgentId = '';
  let currentMode: 'normal' | 'plan' = 'normal';
  const commandHistory: string[] = [];
  let multiLineBuffer = '';

  // --- Setup with thinking animation ---
  const thinking = new ThinkingIndicator();
  thinking.start('Detecting project');

  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  thinking.update('Connecting to AI provider');

  const bridge = new ProviderBridge();
  let providerInfo = await bridge.autoSelect();

  const configManager = new ConfigManager();
  const registry = new AgentRegistry();
  const agentList = registry.list();
  const knownAgentIds = agentList.map((a) => a.name);
  const optimizer = new TokenOptimizer();
  const gitBranch = getGitBranch();

  // Read version
  let version = '1.0.0';
  try {
    const pkgPath = path.join(process.cwd(), 'node_modules', 'dev-crew', 'package.json');
    const globalPkgPath = path.resolve(import.meta.url.replace('file://', '').replace(/\/dist\/.*/, ''), 'package.json');
    for (const p of [pkgPath, globalPkgPath, path.join(process.cwd(), 'package.json')]) {
      try {
        const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (pkg.name === 'dev-crew') { version = pkg.version; break; }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  thinking.stop();

  showBanner(projectInfo.name, projectInfo.language, projectInfo.framework, providerInfo.name, version, gitBranch);

  // --- Readline with tab completion ---
  const modeIndicator = () => currentMode === 'plan' ? `${C.bgMagenta}${C.white} PLAN ${C.reset} ` : '';
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${modeIndicator()}${C.brightCyan}${C.bold}❯${C.reset} `,
    completer: buildCompleter(knownAgentIds),
    historySize: 200,
  });

  function updatePrompt(): void {
    rl.setPrompt(`${modeIndicator()}${C.brightCyan}${C.bold}❯${C.reset} `);
  }

  rl.prompt();

  let busy = false;
  const queue: string[] = [];

  function processNext(): void {
    if (queue.length === 0) {
      busy = false;
      updatePrompt();
      rl.prompt();
      return;
    }
    const next = queue.shift()!;
    handleInput(next);
  }

  rl.on('line', (line: string) => {
    const raw = line.trimEnd();

    // Multi-line continuation with trailing backslash
    if (raw.endsWith('\\')) {
      multiLineBuffer += raw.slice(0, -1) + '\n';
      process.stdout.write(`${C.dim}  ...${C.reset} `);
      return;
    }

    const input = (multiLineBuffer + raw).trim();
    multiLineBuffer = '';

    if (!input) {
      if (!busy) rl.prompt();
      return;
    }
    if (busy) {
      queue.push(input);
      return;
    }
    busy = true;
    handleInput(input);
  });

  async function handleInput(input: string): Promise<void> {
    commandHistory.push(input);

    // ---- Slash commands ----
    if (input.startsWith('/')) {
      const parts = input.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      // --- /help ---
      if (cmd === '/help' || cmd === '/h') {
        showHelp();
        processNext();
        return;
      }

      // --- /agents (categorized) ---
      if (cmd === '/agents' || cmd === '/a') {
        console.log();
        const categories: Record<string, { icon: string; color: string; agents: typeof agentList }> = {
          'Code Quality': { icon: '🔍', color: C.brightCyan, agents: [] },
          'Architecture': { icon: '🏗️', color: C.brightYellow, agents: [] },
          'Infrastructure': { icon: '⚙️', color: C.brightMagenta, agents: [] },
          'Mobile': { icon: '📱', color: C.brightRed, agents: [] },
          'Quality': { icon: '✅', color: C.brightGreen, agents: [] },
          'General': { icon: '💬', color: C.white, agents: [] },
        };

        const catMap: Record<string, string> = {
          review: 'Code Quality', fix: 'Code Quality', debug: 'Code Quality',
          test: 'Code Quality', security: 'Code Quality',
          'tech-lead': 'Architecture', ba: 'Architecture', cto: 'Architecture',
          designer: 'Architecture', 'db-architect': 'Architecture', 'api-architect': 'Architecture',
          'fullstack-builder': 'Architecture',
          devops: 'Infrastructure', 'cost-optimizer': 'Infrastructure', monitoring: 'Infrastructure',
          flutter: 'Mobile', 'react-native': 'Mobile', ios: 'Mobile', android: 'Mobile',
          performance: 'Quality', accessibility: 'Quality',
          ask: 'General', explain: 'General', onboard: 'General', pr: 'General',
        };

        for (const agent of agentList) {
          const cat = catMap[agent.name] || 'General';
          categories[cat].agents.push(agent);
        }

        for (const [catName, cat] of Object.entries(categories)) {
          if (cat.agents.length === 0) continue;
          console.log(`  ${cat.icon} ${C.bold}${cat.color}${catName}${C.reset}`);
          for (const agent of cat.agents) {
            const tierBadge = agent.tier === 'free' ? `${C.green}free${C.reset}` : `${C.yellow}${agent.tier}${C.reset}`;
            console.log(`    ${C.white}${agent.name.padEnd(22)}${C.reset} ${C.gray}${agent.description}${C.reset} ${C.dim}[${tierBadge}${C.dim}]${C.reset}`);
          }
          console.log();
        }
        processNext();
        return;
      }

      // --- /providers ---
      if (cmd === '/providers') {
        console.log();
        thinking.start('Detecting providers');
        const providers = await bridge.detectProviders();
        thinking.stop();
        console.log(`  ${C.bold}AI Providers${C.reset}`);
        console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
        for (const p of providers) {
          const icon = p.status === 'available' ? `${C.green}●${C.reset}` : `${C.red}○${C.reset}`;
          const statusText = p.status === 'available' ? `${C.green}ready${C.reset}` : `${C.gray}not installed${C.reset}`;
          const active = p.name === providerInfo.name ? ` ${C.bgCyan}${C.bold}${C.white} ACTIVE ${C.reset}` : '';
          console.log(`  ${icon} ${C.bold}${p.name.padEnd(20)}${C.reset} ${statusText}${active}`);
        }
        console.log();
        processNext();
        return;
      }

      // --- /provider <name> ---
      if (cmd === '/provider') {
        if (!args) {
          console.log(`  ${C.yellow}Usage: /provider <name>${C.reset}`);
          console.log(`  ${C.gray}Available: claude-code, aider, copilot, openai, ollama, simulation${C.reset}`);
        } else {
          try {
            thinking.start(`Switching to ${args}`);
            providerInfo = await bridge.setProvider(args.trim());
            thinking.stop(`  ${C.green}✓${C.reset} Switched to ${C.bold}${providerInfo.name}${C.reset}`);
          } catch (err) {
            thinking.stop(`  ${C.red}✗${C.reset} ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        console.log();
        processNext();
        return;
      }

      // --- /project ---
      if (cmd === '/project') {
        console.log();
        console.log(`  ${C.bold}${C.brightCyan}Project Info${C.reset}`);
        console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
        const fields: [string, string][] = [
          ['Name', projectInfo.name],
          ['Language', projectInfo.language],
          ['Framework', projectInfo.framework || `${C.dim}none${C.reset}`],
          ['Database', projectInfo.database.join(', ') || `${C.dim}none${C.reset}`],
          ['ORM', projectInfo.orm || `${C.dim}none${C.reset}`],
          ['Tests', projectInfo.testFramework || `${C.dim}none${C.reset}`],
          ['Package Mgr', projectInfo.packageManager],
          ['Docker', projectInfo.hasDocker ? `${C.green}✓ yes${C.reset}` : `${C.dim}no${C.reset}`],
          ['CI', projectInfo.ciPlatform || `${C.dim}none${C.reset}`],
          ['Monorepo', projectInfo.monorepo ? `${C.green}✓ yes${C.reset}` : `${C.dim}no${C.reset}`],
        ];
        for (const [label, value] of fields) {
          console.log(`  ${C.gray}  ${label.padEnd(14)}${C.reset}${value}`);
        }
        console.log();
        processNext();
        return;
      }

      // --- /test ---
      if (cmd === '/test') {
        console.log();
        const testStart = Date.now();
        try {
          thinking.start('Pinging AI provider');
          const testResult = await bridge.send('Respond with exactly: "Dev-Crew OK"', {
            systemPrompt: 'You are a test assistant. Respond with exactly what is asked.',
            maxTokens: 100,
          });
          const testElapsed = ((Date.now() - testStart) / 1000).toFixed(1);
          thinking.stop(`  ${C.green}✓${C.reset} ${C.bold}${providerInfo.name}${C.reset} responded in ${C.brightGreen}${testElapsed}s${C.reset}`);
          console.log(`  ${C.gray}  Response: ${testResult.content.slice(0, 200)}${C.reset}`);
        } catch (err) {
          const testElapsed = ((Date.now() - testStart) / 1000).toFixed(1);
          thinking.stop(`  ${C.red}✗${C.reset} Failed after ${testElapsed}s`);
          console.log(`  ${C.red}  ${err instanceof Error ? err.message : String(err)}${C.reset}`);
        }
        console.log();
        processNext();
        return;
      }

      // --- /tokens ---
      if (cmd === '/tokens') {
        console.log();
        console.log(`  ${C.bold}${C.brightCyan}Session Token Stats${C.reset}`);
        console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
        const duration = ((Date.now() - sessionStartTime) / 60000).toFixed(0);
        console.log(`  ${C.gray}  Duration${C.reset}         ${C.bold}${duration} min${C.reset}`);
        console.log(`  ${C.gray}  Commands run${C.reset}     ${C.bold}${sessionCommands}${C.reset}`);
        console.log(`  ${C.gray}  Tokens in${C.reset}        ${C.bold}~${sessionTokensIn.toLocaleString()}${C.reset}`);
        console.log(`  ${C.gray}  Tokens out${C.reset}       ${C.bold}~${sessionTokensOut.toLocaleString()}${C.reset}`);
        console.log(`  ${C.gray}  Total${C.reset}            ${C.bold}~${(sessionTokensIn + sessionTokensOut).toLocaleString()}${C.reset}`);
        const totalCost = ((sessionTokensIn * 0.003 + sessionTokensOut * 0.015) / 1000);
        console.log(`  ${C.gray}  Est. cost${C.reset}        ${C.bold}~$${totalCost.toFixed(4)}${C.reset}`);
        console.log();
        processNext();
        return;
      }

      // --- /diff ---
      if (cmd === '/diff') {
        console.log();
        const diffStat = getGitDiff();
        if (!diffStat) {
          console.log(`  ${C.dim}No recent git changes found${C.reset}`);
        } else {
          console.log(`  ${C.bold}${C.brightCyan}Recent Changes${C.reset} ${C.gray}(last 5 commits)${C.reset}`);
          console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);
          for (const line of diffStat.split('\n')) {
            if (line.includes('|')) {
              const [file, stats] = line.split('|');
              const colored = (stats || '').replace(/\+/g, `${C.brightGreen}+${C.reset}`).replace(/-/g, `${C.brightRed}-${C.reset}`);
              console.log(`  ${C.cyan}${file.trim().padEnd(36)}${C.reset} │ ${colored}`);
            } else {
              console.log(`  ${C.dim}${line}${C.reset}`);
            }
          }

          // Show detailed diff if args provided
          if (args === '--full' || args === '-f') {
            console.log();
            const detailed = getGitDiffDetailed();
            if (detailed) {
              for (const line of detailed.split('\n')) {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  console.log(`  ${C.brightGreen}${line}${C.reset}`);
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  console.log(`  ${C.brightRed}${line}${C.reset}`);
                } else if (line.startsWith('@@')) {
                  console.log(`  ${C.cyan}${line}${C.reset}`);
                } else {
                  console.log(`  ${C.gray}${line}${C.reset}`);
                }
              }
            }
          } else {
            console.log();
            console.log(`  ${C.dim}Use /diff --full for detailed diff${C.reset}`);
          }
        }
        console.log();
        processNext();
        return;
      }

      // --- /debt ---
      if (cmd === '/debt') {
        console.log();
        try {
          const tracker = new DebtTracker();
          const report = tracker.generateReport();

          console.log(`  ${C.bold}${C.brightCyan}Tech Debt Dashboard${C.reset}`);
          console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
          console.log(`  ${C.gray}  Total points${C.reset}     ${C.bold}${report.totalPoints}${C.reset}`);
          console.log(`  ${C.gray}  Items${C.reset}            ${C.bold}${report.itemCount}${C.reset}`);
          console.log(`  ${C.gray}  Resolved${C.reset}         ${C.bold}${C.green}${report.resolved}${C.reset}`);
          console.log(`  ${C.gray}  New (7 days)${C.reset}     ${C.bold}${report.newItems}${C.reset}`);
          console.log(`  ${C.gray}  Trend${C.reset}            ${report.trend > 0 ? `${C.red}↑ ${report.trend}${C.reset}` : report.trend < 0 ? `${C.green}↓ ${Math.abs(report.trend)}${C.reset}` : `${C.dim}→ stable${C.reset}`}`);

          if (report.quickWins.length > 0) {
            console.log();
            console.log(`  ${C.bold}${C.brightGreen}Quick Wins${C.reset}`);
            for (const qw of report.quickWins.slice(0, 5)) {
              console.log(`  ${C.green}  →${C.reset} ${C.cyan}${qw.file}${C.reset} — ${qw.description}`);
            }
          }

          if (report.topSources.length > 0) {
            console.log();
            console.log(`  ${C.bold}${C.brightYellow}Top Debt Sources${C.reset}`);
            for (const src of report.topSources.slice(0, 5)) {
              console.log(`  ${C.yellow}  •${C.reset} ${src.category} ${C.dim}(${src.points} pts, ${src.count} items)${C.reset}`);
            }
          }
        } catch {
          console.log(`  ${C.dim}No debt data yet. Run some reviews first.${C.reset}`);
        }
        console.log();
        processNext();
        return;
      }

      // --- /feedback ---
      if (cmd === '/feedback') {
        if (!args) {
          console.log(`  ${C.yellow}Usage: /feedback <agent> <message>${C.reset}`);
          console.log(`  ${C.gray}Example: /feedback review always flag console.log in production code${C.reset}`);
        } else {
          const fbParts = args.split(/\s+/);
          const fbAgent = fbParts[0];
          const fbMessage = fbParts.slice(1).join(' ');
          if (!fbMessage) {
            console.log(`  ${C.yellow}Provide feedback message after agent name${C.reset}`);
          } else if (!registry.has(fbAgent)) {
            console.log(`  ${C.red}Unknown agent: ${fbAgent}${C.reset}`);
          } else {
            configManager.addFeedback(fbAgent, fbMessage);
            console.log(`  ${C.green}✓${C.reset} Feedback saved for ${C.bold}${fbAgent}${C.reset} agent`);
            console.log(`  ${C.dim}The agent will follow this in future runs${C.reset}`);
          }
        }
        console.log();
        processNext();
        return;
      }

      // --- /export ---
      if (cmd === '/export') {
        if (!lastResult) {
          console.log(`  ${C.yellow}No results to export yet. Run a command first.${C.reset}`);
        } else {
          const filename = args || `dev-crew-${lastResult.agent}-${Date.now()}.md`;
          const content = `# Dev-Crew ${lastResult.agent} Result\n\n${lastResult.raw}\n`;
          try {
            fs.writeFileSync(filename, content);
            console.log(`  ${C.green}✓${C.reset} Exported to ${C.cyan}${filename}${C.reset}`);
          } catch (err) {
            console.log(`  ${C.red}✗${C.reset} Failed to write: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        console.log();
        processNext();
        return;
      }

      // --- /doctor ---
      if (cmd === '/doctor') {
        console.log();
        console.log(`  ${C.bold}${C.brightCyan}Dev-Crew Doctor${C.reset}`);
        console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);

        // Node version
        const nodeVersion = process.version;
        const nodeOk = parseInt(nodeVersion.slice(1)) >= 18;
        console.log(`  ${nodeOk ? C.green + '✓' : C.red + '✗'}${C.reset} Node.js ${nodeVersion} ${nodeOk ? '' : `${C.red}(need >= 18)${C.reset}`}`);

        // Provider
        console.log(`  ${providerInfo.status === 'available' ? C.green + '✓' : C.red + '✗'}${C.reset} Provider: ${providerInfo.name} (${providerInfo.status})`);

        // Git
        try {
          execSync('git --version', { stdio: 'pipe' });
          console.log(`  ${C.green}✓${C.reset} Git available`);
        } catch {
          console.log(`  ${C.yellow}⚠${C.reset} Git not found (optional)`);
        }

        // Config
        const configExists = configManager.isInitialized();
        console.log(`  ${configExists ? C.green + '✓' : C.yellow + '⚠'}${C.reset} Project config ${configExists ? 'found' : 'not found (run dev-crew init)'}`);

        // Package version
        console.log(`  ${C.green}✓${C.reset} Dev-Crew v${version}`);

        // Check providers
        thinking.start('Scanning AI providers');
        const allProviders = await bridge.detectProviders();
        thinking.stop();
        const available = allProviders.filter(p => p.status === 'available' && p.id !== 'simulation');
        console.log(`  ${available.length > 0 ? C.green + '✓' : C.red + '✗'}${C.reset} ${available.length} AI provider(s) found: ${available.map(p => p.name).join(', ') || 'none'}`);

        console.log();
        if (available.length === 0) {
          console.log(`  ${C.yellow}Install an AI provider:${C.reset}`);
          console.log(`  ${C.gray}  npm i -g @anthropic-ai/claude-code  ${C.dim}(recommended)${C.reset}`);
          console.log(`  ${C.gray}  pip install aider-chat${C.reset}`);
          console.log(`  ${C.gray}  curl -fsSL https://ollama.ai/install.sh | sh${C.reset}`);
        } else {
          console.log(`  ${C.brightGreen}Everything looks good!${C.reset}`);
        }
        console.log();
        processNext();
        return;
      }

      // --- /config ---
      if (cmd === '/config') {
        console.log();
        if (configManager.isInitialized()) {
          console.log(`  ${C.bold}${C.brightCyan}Configuration${C.reset} ${C.gray}(.dev-crew/config.yml)${C.reset}`);
          console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
          try {
            const config = configManager.load();
            console.log(`  ${C.dim}${JSON.stringify(config, null, 2).split('\n').join('\n  ')}${C.reset}`);
          } catch {
            console.log(`  ${C.red}Failed to read config${C.reset}`);
          }
        } else {
          console.log(`  ${C.yellow}No project config found.${C.reset}`);
          console.log(`  ${C.gray}Run ${C.white}dev-crew init${C.gray} to create one${C.reset}`);
        }
        console.log();
        processNext();
        return;
      }

      // --- /history ---
      if (cmd === '/history') {
        console.log();
        console.log(`  ${C.bold}${C.brightCyan}Command History${C.reset}`);
        console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
        if (commandHistory.length <= 1) {
          console.log(`  ${C.dim}No commands yet${C.reset}`);
        } else {
          // Skip the /history command itself
          const history = commandHistory.slice(0, -1);
          for (let i = Math.max(0, history.length - 20); i < history.length; i++) {
            console.log(`  ${C.dim}${(i + 1).toString().padStart(3)}${C.reset}  ${history[i]}`);
          }
        }
        console.log();
        processNext();
        return;
      }

      // --- /plan ---
      if (cmd === '/plan') {
        currentMode = currentMode === 'plan' ? 'normal' : 'plan';
        console.log();
        if (currentMode === 'plan') {
          console.log(`  ${C.bgMagenta}${C.bold}${C.white} PLAN MODE ${C.reset} ${C.gray}Agents will explain their plan before executing${C.reset}`);
        } else {
          console.log(`  ${C.green}●${C.reset} ${C.bold}Normal mode${C.reset} ${C.gray}Agents execute immediately${C.reset}`);
        }
        console.log();
        processNext();
        return;
      }

      // --- /clear ---
      if (cmd === '/clear') {
        console.clear();
        showBanner(projectInfo.name, projectInfo.language, projectInfo.framework, providerInfo.name, version, gitBranch);
        processNext();
        return;
      }

      // --- /quit ---
      if (cmd === '/quit' || cmd === '/exit' || cmd === '/q') {
        const duration = ((Date.now() - sessionStartTime) / 60000).toFixed(0);
        console.log();
        console.log(`  ${C.gray}╭──────────────────────────────────────────╮${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}  ${C.bold}Session Summary${C.reset}                          ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}                                          ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}  Duration:    ${C.bold}${duration.padStart(4)} min${C.reset}                  ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}  Commands:    ${C.bold}${sessionCommands.toString().padStart(4)}${C.reset}                      ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}  Tokens in:   ${C.bold}~${sessionTokensIn.toLocaleString().padStart(8)}${C.reset}               ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}  Tokens out:  ${C.bold}~${sessionTokensOut.toLocaleString().padStart(8)}${C.reset}               ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}                                          ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}│${C.reset}  ${C.dim}Goodbye!${C.reset}                                ${C.gray}│${C.reset}`);
        console.log(`  ${C.gray}╰──────────────────────────────────────────╯${C.reset}`);
        console.log();
        rl.close();
        return;
      }

      // Unknown slash command
      console.log();
      console.log(`  ${C.yellow}Unknown command: ${C.white}${cmd}${C.reset}`);
      console.log(`  ${C.gray}Type ${C.white}/help${C.gray} for available commands${C.reset}`);
      console.log();
      processNext();
      return;
    }

    // ---- Extract @file references ----
    const atFiles: string[] = [];
    const cleanedInput = input.replace(/@(\S+)/g, (_match, filePath: string) => {
      atFiles.push(filePath);
      return filePath;
    });

    // ---- Natural language → agent execution ----
    const parsed = parseNaturalInput(cleanedInput, knownAgentIds);

    // Merge @tagged files
    const allFiles = [...new Set([
      ...(parsed.filePath ? [parsed.filePath] : []),
      ...atFiles,
    ])];

    const feedback = configManager.getFeedback(parsed.agentId);
    const agent = registry.create(parsed.agentId, projectInfo, undefined, feedback);
    if (!agent) {
      console.log(`  ${C.red}✗${C.reset} Agent ${C.bold}"${parsed.agentId}"${C.reset} not found.`);
      console.log(`  ${C.gray}Type ${C.white}/agents${C.gray} to see available agents${C.reset}`);
      console.log();
      processNext();
      return;
    }

    // Show agent header
    console.log();
    const agentBadge = `${C.bgMagenta}${C.bold}${C.white} ${parsed.agentId.toUpperCase()} ${C.reset}`;
    const fileDisplay = allFiles.length > 0
      ? allFiles.map(f => `${C.cyan}@${f}${C.reset}`).join(' ')
      : `${C.dim}${parsed.query.slice(0, 60)}${parsed.query.length > 60 ? '...' : ''}${C.reset}`;
    console.log(`  ${agentBadge}  ${fileDisplay}`);

    // Show auto-included files
    if (allFiles.length > 0) {
      for (const f of allFiles) {
        try {
          const stat = fs.statSync(f);
          const lines = stat.isFile() ? fs.readFileSync(f, 'utf-8').split('\n').length : 0;
          console.log(`  ${C.dim}  └── ${f} (${lines} lines)${C.reset}`);
        } catch {
          console.log(`  ${C.dim}  └── ${f}${C.reset}`);
        }
      }
    }
    console.log();

    // Plan mode: show what the agent will do
    if (currentMode === 'plan') {
      console.log(`  ${C.bgMagenta}${C.white} PLAN ${C.reset} ${C.bold}${parsed.agentId}${C.reset} agent will:`);
      console.log(`  ${C.dim}  1. Gather context from ${allFiles.length || 'auto-detected'} files${C.reset}`);
      console.log(`  ${C.dim}  2. Resolve import dependencies${C.reset}`);
      console.log(`  ${C.dim}  3. Analyze with ${parsed.agentId}-specific prompt${C.reset}`);
      console.log(`  ${C.dim}  4. Return structured results${C.reset}`);
      console.log();
      console.log(`  ${C.gray}Proceeding... (use /plan to toggle off)${C.reset}`);
      console.log();
    }

    // Thinking animation + streaming
    thinking.start('Gathering context');
    const startTime = Date.now();
    let streamOutput = '';

    try {
      const timeoutMs = 120_000;
      const result = await Promise.race([
        agent.execute({
          query: parsed.query,
          files: allFiles.length > 0 ? allFiles : undefined,
          streaming: true,
          onStream: (chunk: string) => {
            // On first chunk, stop the thinking indicator
            if (!streamOutput) {
              thinking.stop();
              console.log();
            }
            streamOutput += chunk;
            process.stdout.write(chunk);
          },
          onProgress: (step: string) => {
            if (!streamOutput) {
              thinking.update(step);
            }
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timed out after 2 minutes. Try specifying a file: review @src/app.ts')), timeoutMs),
        ),
      ]);

      const elapsed = (Date.now() - startTime) / 1000;
      const tokensUsed = result.tokensUsed || 0;
      const responseTokens = optimizer.estimate(result.raw);
      lastAgentId = parsed.agentId;

      // If we were streaming, add a newline
      if (streamOutput) {
        console.log();
      } else {
        thinking.stop(`  ${C.green}✓${C.reset} ${C.bold}Done${C.reset} ${C.gray}${elapsed.toFixed(1)}s${C.reset}`);
        console.log();
      }

      // Format the response (only if not already streamed)
      if (!streamOutput) {
        formatGenericResponse(result.raw);
      } else {
        // Re-format the collected output nicely
        console.log();
        formatGenericResponse(result.raw);
      }

      // Store last result for /export and fix commands
      lastResult = { raw: result.raw, agent: parsed.agentId, parsed: result.parsed };

      // Token tracking
      sessionCommands++;
      sessionTokensIn += tokensUsed;
      sessionTokensOut += responseTokens;

      showTokenUsage(tokensUsed + responseTokens, elapsed);

      // Status bar
      renderStatusBar({
        agent: parsed.agentId,
        provider: providerInfo.name,
        gitBranch,
        tokensUsed: sessionTokensIn,
        tokensSaved: 0,
        mode: currentMode,
        commands: sessionCommands,
      });
      console.log();

      // Show fix hint for review/security results
      if (result.parsed.issues && result.parsed.issues.length > 0) {
        const critCount = result.parsed.issues.filter((i: any) => i.severity === 'critical').length;
        if (critCount > 0) {
          console.log(`  ${C.brightRed}${critCount} critical issue${critCount > 1 ? 's' : ''} found${C.reset} — run ${C.white}fix${C.reset} ${allFiles.length ? allFiles.map(f => `${C.cyan}@${f}${C.reset}`).join(' ') : ''} to address them`);
        }
      }

      // Show contextual tip (every 3rd command)
      if (sessionCommands % 3 === 0) {
        console.log(getNextTip());
      }

      // Show fix prompt for fix agent results with diffs
      if (parsed.agentId === 'fix' && result.parsed.fixes && result.parsed.fixes.length > 0) {
        console.log();
        console.log(`  ${C.bold}${C.brightGreen}Fixes available:${C.reset}`);
        for (let i = 0; i < result.parsed.fixes.length; i++) {
          const fix = result.parsed.fixes[i];
          console.log(`  ${C.dim}#${i + 1}${C.reset} ${C.cyan}${fix.file}${C.reset} — ${fix.description}`);
          if (fix.diff) {
            showDiff(fix.file, fix.diff);
          }
        }
        console.log();
        console.log(`  ${C.dim}Fixes shown above. Use ${C.white}dev-crew fix --auto-apply @file${C.dim} to apply.${C.reset}`);
      }

      console.log();
    } catch (err) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (streamOutput) {
        console.log();
      }
      thinking.stop(`  ${C.red}✗${C.reset} Failed after ${elapsed.toFixed(1)}s`);
      console.log();
      console.log(`  ${C.red}${err instanceof Error ? err.message : String(err)}${C.reset}`);
      console.log();
    }

    processNext();
  }

  // Handle Ctrl+C gracefully
  rl.on('SIGINT', () => {
    if (busy) {
      // During execution, show cancellation message
      thinking.stop(`  ${C.yellow}⚠${C.reset} Interrupted`);
      console.log();
      busy = false;
      rl.prompt();
    } else {
      console.log();
      console.log(`  ${C.gray}Press ${C.white}Ctrl+C${C.gray} again to exit, or type ${C.white}/quit${C.reset}`);
      rl.prompt();
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

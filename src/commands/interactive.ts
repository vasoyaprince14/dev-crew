import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ProviderBridge } from '../core/provider-bridge.js';
import { ConfigManager } from '../core/config-manager.js';
import { TokenOptimizer } from '../core/token-optimizer.js';
import { parseNaturalInput } from '../core/nlp-router.js';
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
  // Cursor control
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearLine: '\x1b[2K\r',
};

// ---------------------------------------------------------------------------
// Thinking animation (like Claude Code)
// ---------------------------------------------------------------------------

class ThinkingIndicator {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private startTime = 0;
  private currentStep = '';

  private readonly thinkingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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
    const spinner = this.thinkingFrames[this.frame % this.thinkingFrames.length];
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

    for (const issue of data.issues) {
      const badge = severityBadge(issue.severity);
      const location = issue.file
        ? `${C.cyan}${issue.file}${C.reset}${issue.line ? `${C.gray}:${C.yellow}${issue.line}${C.reset}` : ''}`
        : '';

      console.log(`  ${badge}  ${location}`);
      if (issue.title) {
        console.log(`  ${C.bold}${C.white}  ${issue.title}${C.reset}`);
      }
      if (issue.message) {
        console.log(`  ${C.gray}  ${issue.message}${C.reset}`);
      }
      if (issue.suggestion || issue.fix) {
        console.log(`  ${C.green}  → ${issue.suggestion || issue.fix}${C.reset}`);
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

  // Format markdown-like text with beautiful rendering
  const lines = raw.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    // Code blocks
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

    // Headers
    if (line.startsWith('# ')) {
      console.log();
      console.log(`  ${C.bold}${C.brightCyan}${line.slice(2)}${C.reset}`);
      console.log(`  ${C.gray}${'─'.repeat(50)}${C.reset}`);
    } else if (line.startsWith('## ')) {
      console.log();
      console.log(`  ${C.bold}${C.white}${line.slice(3)}${C.reset}`);
    } else if (line.startsWith('### ')) {
      console.log(`  ${C.bold}${line.slice(4)}${C.reset}`);
    }
    // Lists
    else if (/^[-*] /.test(line)) {
      console.log(`  ${C.cyan}  •${C.reset} ${line.slice(2)}`);
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/)!;
      console.log(`  ${C.cyan}  ${match[1]}.${C.reset} ${match[2]}`);
    }
    // Blockquotes
    else if (line.startsWith('>')) {
      console.log(`  ${C.gray}  │ ${C.italic}${line.slice(1).trim()}${C.reset}`);
    }
    // Bold text: **text**
    else if (line.trim() === '') {
      console.log();
    } else {
      // Inline formatting
      let formatted = line;
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, `${C.bold}$1${C.reset}`);
      formatted = formatted.replace(/`(.*?)`/g, `${C.brightCyan}$1${C.reset}`);
      formatted = formatted.replace(/_(.*?)_/g, `${C.italic}$1${C.reset}`);
      console.log(`  ${formatted}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Token savings display
// ---------------------------------------------------------------------------

function showTokenSavings(tokenReport: { withoutDevCrew: number; withDevCrew: number; saved: number; percentage: number } | undefined, duration: number): void {
  console.log(`  ${C.gray}${'─'.repeat(54)}${C.reset}`);
  console.log(`  ${C.bold}Token Usage${C.reset}                    ${C.gray}${duration.toFixed(1)}s${C.reset}`);

  if (!tokenReport || tokenReport.withDevCrew === 0) {
    console.log();
    return;
  }

  const costPer1k = 0.003; // input cost estimate
  const costWithout = (tokenReport.withoutDevCrew * costPer1k) / 1000;
  const costWith = (tokenReport.withDevCrew * costPer1k) / 1000;

  console.log();
  console.log(`  ${C.gray}Without Dev-Crew${C.reset}  ${C.dim}~${tokenReport.withoutDevCrew.toLocaleString()} tokens${C.reset}  ${C.dim}~$${costWithout.toFixed(4)}${C.reset}`);
  console.log(`  ${C.brightGreen}With Dev-Crew${C.reset}     ${C.bold}~${tokenReport.withDevCrew.toLocaleString()} tokens${C.reset}  ${C.bold}~$${costWith.toFixed(4)}${C.reset}`);

  if (tokenReport.percentage > 0) {
    const barLen = 20;
    const filledLen = Math.round((tokenReport.percentage / 100) * barLen);
    const bar = `${C.brightGreen}${'█'.repeat(filledLen)}${C.gray}${'░'.repeat(barLen - filledLen)}${C.reset}`;
    console.log(`  ${C.brightGreen}Saved${C.reset}             ${bar} ${C.bold}${C.brightGreen}${tokenReport.percentage}%${C.reset} ${C.gray}(~${tokenReport.saved.toLocaleString()} tokens)${C.reset}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// File path completer with inline display
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

function buildCompleter(knownAgentIds: string[]) {
  const slashCommands = [
    { cmd: '/help', desc: 'Show help and available commands' },
    { cmd: '/agents', desc: 'List all 24 agents' },
    { cmd: '/providers', desc: 'Show AI provider status' },
    { cmd: '/project', desc: 'Show detected project info' },
    { cmd: '/test', desc: 'Test AI provider connectivity' },
    { cmd: '/tokens', desc: 'Show session token usage' },
    { cmd: '/clear', desc: 'Clear the screen' },
    { cmd: '/quit', desc: 'Exit interactive mode' },
  ];

  return function completer(line: string): [string[], string] {
    const trimmed = line.trim();

    // Slash commands
    if (trimmed.startsWith('/')) {
      const matches = slashCommands.filter(s => s.cmd.startsWith(trimmed));
      if (matches.length > 0) {
        // Show command descriptions inline
        if (matches.length > 1 || trimmed === '/') {
          console.log();
          for (const m of matches) {
            console.log(`    ${C.white}${m.cmd.padEnd(14)}${C.reset}${C.gray}${m.desc}${C.reset}`);
          }
          console.log();
        }
        return [matches.map(m => m.cmd), trimmed];
      }
      return [slashCommands.map(s => s.cmd), trimmed];
    }

    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1] || '';

    // @file tagging
    if (lastWord.startsWith('@')) {
      const files = getFileList(lastWord);
      if (files.length > 0) {
        // Show file list inline
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
// Banner
// ---------------------------------------------------------------------------

function showBanner(projectName: string, language: string, framework: string | null, providerName: string, version: string): void {
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
  console.log();
  console.log(`  ${C.gray}Shortcuts:${C.reset} ${C.white}/${C.reset}${C.gray}commands  ${C.white}@${C.reset}${C.gray}files  ${C.white}Tab${C.reset}${C.gray} autocomplete${C.reset}`);
  console.log(`  ${C.gray}Try:${C.reset} ${C.dim}review @src/app.ts${C.reset} ${C.gray}|${C.reset} ${C.dim}security src/${C.reset} ${C.gray}|${C.reset} ${C.dim}explain @lib/auth.ts${C.reset}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function showHelp(): void {
  console.log();

  // Slash commands in a box
  console.log(`  ${C.bold}${C.brightCyan}/ Slash Commands${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(50)}${C.reset}`);
  const cmds = [
    ['/help', 'Show this help'],
    ['/agents', 'List all 24 agents with descriptions'],
    ['/providers', 'Show AI providers and status'],
    ['/project', 'Show detected project info'],
    ['/test', 'Test AI provider connectivity'],
    ['/tokens', 'Show session token usage & savings'],
    ['/clear', 'Clear the screen'],
    ['/quit', 'Exit interactive mode'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(`  ${C.white}  ${cmd.padEnd(14)}${C.reset} ${C.gray}${desc}${C.reset}`);
  }
  console.log();

  console.log(`  ${C.bold}${C.brightCyan}@ File Tagging${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(50)}${C.reset}`);
  console.log(`  ${C.gray}  Type ${C.white}@${C.gray} then press ${C.white}Tab${C.gray} to browse files${C.reset}`);
  console.log(`  ${C.white}  review @src/app.ts${C.reset}         ${C.gray}Review a file${C.reset}`);
  console.log(`  ${C.white}  fix @src/api.ts${C.reset}            ${C.gray}Fix a file${C.reset}`);
  console.log(`  ${C.white}  explain @lib/auth.ts${C.reset}       ${C.gray}Explain a file${C.reset}`);
  console.log(`  ${C.white}  test @src/utils.ts${C.reset}         ${C.gray}Generate tests${C.reset}`);
  console.log(`  ${C.white}  what does @config.ts do${C.reset}    ${C.gray}Natural language + file${C.reset}`);
  console.log();

  console.log(`  ${C.bold}${C.brightCyan}Agent Commands${C.reset}`);
  console.log(`  ${C.gray}${'─'.repeat(50)}${C.reset}`);
  const agents = [
    ['review <path>', 'Code review', 'cyan'],
    ['fix <file>', 'Fix issues', 'cyan'],
    ['test <file>', 'Generate tests', 'cyan'],
    ['debug <error>', 'Root cause analysis', 'cyan'],
    ['security <path>', 'Security audit', 'yellow'],
    ['explain <file>', 'Code explanation', 'cyan'],
    ['ask <question>', 'Codebase Q&A', 'cyan'],
    ['tech-lead <q>', 'Architecture advice', 'yellow'],
    ['devops <question>', 'DevOps guidance', 'magenta'],
    ['db-architect <q>', 'Database design', 'blue'],
    ['api-architect <q>', 'API design', 'blue'],
    ['performance <path>', 'Performance audit', 'green'],
    ['accessibility <path>', 'WCAG audit', 'green'],
    ['flutter <input>', 'Flutter/Dart', 'red'],
    ['react-native <input>', 'React Native', 'red'],
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

  // --- Session stats ---
  let sessionTokensIn = 0;
  let sessionTokensOut = 0;
  let sessionTokensSaved = 0;
  let sessionCommands = 0;

  // --- Setup with thinking animation ---
  const thinking = new ThinkingIndicator();
  thinking.start('Detecting project');

  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  thinking.update('Connecting to AI provider');

  const bridge = new ProviderBridge();
  const providerInfo = await bridge.autoSelect();

  const configManager = new ConfigManager();
  const registry = new AgentRegistry();
  const agentList = registry.list();
  const knownAgentIds = agentList.map((a) => a.name);
  const optimizer = new TokenOptimizer();

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

  showBanner(projectInfo.name, projectInfo.language, projectInfo.framework, providerInfo.name, version);

  // --- Readline with tab completion ---
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.brightCyan}${C.bold}❯${C.reset} `,
    completer: buildCompleter(knownAgentIds),
  });

  rl.prompt();

  let busy = false;
  const queue: string[] = [];

  function processNext(): void {
    if (queue.length === 0) {
      busy = false;
      rl.prompt();
      return;
    }
    const next = queue.shift()!;
    handleInput(next);
  }

  rl.on('line', (line: string) => {
    const input = line.trim();
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
    // ---- Slash commands ----
    if (input.startsWith('/')) {
      const cmd = input.toLowerCase().split(/\s+/)[0];

      if (cmd === '/help' || cmd === '/h') {
        showHelp();
        processNext();
        return;
      }

      if (cmd === '/agents') {
        console.log();
        const categories: Record<string, typeof agentList> = {};
        for (const agent of agentList) {
          const cat = agent.tier === 'free' ? 'Core' : 'Advanced';
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(agent);
        }

        for (const [cat, agents] of Object.entries(categories)) {
          const color = cat === 'Core' ? C.brightGreen : C.brightYellow;
          const icon = cat === 'Core' ? C.green : C.yellow;
          console.log(`  ${C.bold}${color}${cat} Agents${C.reset}`);
          for (const agent of agents) {
            console.log(`  ${icon}●${C.reset} ${C.bold}${C.white}${agent.name.padEnd(22)}${C.reset} ${C.gray}${agent.description}${C.reset}`);
          }
          console.log();
        }
        processNext();
        return;
      }

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

      if (cmd === '/tokens') {
        console.log();
        console.log(`  ${C.bold}${C.brightCyan}Session Token Stats${C.reset}`);
        console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
        console.log(`  ${C.gray}  Commands run${C.reset}     ${C.bold}${sessionCommands}${C.reset}`);
        console.log(`  ${C.gray}  Tokens in${C.reset}        ${C.bold}~${sessionTokensIn.toLocaleString()}${C.reset}`);
        console.log(`  ${C.gray}  Tokens out${C.reset}       ${C.bold}~${sessionTokensOut.toLocaleString()}${C.reset}`);
        console.log(`  ${C.gray}  Total${C.reset}            ${C.bold}~${(sessionTokensIn + sessionTokensOut).toLocaleString()}${C.reset}`);
        if (sessionTokensSaved > 0) {
          console.log(`  ${C.brightGreen}  Tokens saved${C.reset}     ${C.bold}${C.brightGreen}~${sessionTokensSaved.toLocaleString()}${C.reset}`);
        }
        const totalCost = ((sessionTokensIn * 0.003 + sessionTokensOut * 0.015) / 1000);
        console.log(`  ${C.gray}  Est. cost${C.reset}        ${C.bold}~$${totalCost.toFixed(4)}${C.reset}`);
        console.log();
        processNext();
        return;
      }

      if (cmd === '/clear') {
        console.clear();
        showBanner(projectInfo.name, projectInfo.language, projectInfo.framework, providerInfo.name, version);
        processNext();
        return;
      }

      if (cmd === '/quit' || cmd === '/exit' || cmd === '/q') {
        console.log();
        console.log(`  ${C.gray}Session: ${sessionCommands} commands, ~${(sessionTokensIn + sessionTokensOut).toLocaleString()} tokens${C.reset}`);
        if (sessionTokensSaved > 0) {
          console.log(`  ${C.brightGreen}Saved ~${sessionTokensSaved.toLocaleString()} tokens with Dev-Crew optimization${C.reset}`);
        }
        console.log(`  ${C.gray}Goodbye!${C.reset}`);
        console.log();
        rl.close();
        return;
      }

      // Unknown slash command — show suggestions
      console.log();
      console.log(`  ${C.yellow}Unknown command: ${C.white}${cmd}${C.reset}`);
      console.log(`  ${C.gray}Available: /help /agents /providers /project /test /tokens /clear /quit${C.reset}`);
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
    console.log();

    // Thinking animation with step updates
    thinking.start('Gathering context');
    const startTime = Date.now();

    try {
      const timeoutMs = 120_000; // 2 min timeout
      const result = await Promise.race([
        agent.execute({
          query: parsed.query,
          files: allFiles.length > 0 ? allFiles : undefined,
          onProgress: (step: string) => {
            thinking.update(step);
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timed out after 2 minutes. Try specifying a file: review @src/app.ts')), timeoutMs),
        ),
      ]);

      const elapsed = (Date.now() - startTime) / 1000;
      const tokensUsed = result.tokensUsed || 0;
      const responseTokens = optimizer.estimate(result.raw);

      thinking.stop(`  ${C.green}✓${C.reset} ${C.bold}Done${C.reset} ${C.gray}${elapsed.toFixed(1)}s${C.reset}`);
      console.log();

      // Format the response
      formatGenericResponse(result.raw);

      // Token savings from real measurement
      sessionCommands++;
      sessionTokensIn += tokensUsed;
      sessionTokensOut += responseTokens;
      if (result.tokenReport) {
        sessionTokensSaved += result.tokenReport.saved;
      }

      showTokenSavings(result.tokenReport, elapsed);

    } catch (err) {
      const elapsed = (Date.now() - startTime) / 1000;
      thinking.stop(`  ${C.red}✗${C.reset} Failed after ${elapsed.toFixed(1)}s`);
      console.log();
      console.log(`  ${C.red}${err instanceof Error ? err.message : String(err)}${C.reset}`);
      console.log();
    }

    processNext();
  }

  // Handle Ctrl+C gracefully
  rl.on('SIGINT', () => {
    console.log();
    console.log(`  ${C.gray}Use /quit to exit${C.reset}`);
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

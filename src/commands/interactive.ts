import readline from 'node:readline';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ProjectCache } from '../core/project-cache.js';
import type { ProjectInfo } from '../types/config.js';
import { ProviderBridge } from '../core/provider-bridge.js';
import { ConfigManager } from '../core/config-manager.js';
import { TokenOptimizer } from '../core/token-optimizer.js';
import { parseNaturalInput } from '../core/nlp-router.js';
import { DebtTracker } from '../features/debt-tracker.js';
import { Logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// ANSI — disabled when not a real terminal
// ---------------------------------------------------------------------------
const isTTY = process.stdout.isTTY === true;
const ansi = (code: string) => isTTY ? code : '';
const C = {
  reset: ansi('\x1b[0m'),
  bold: ansi('\x1b[1m'),
  dim: ansi('\x1b[2m'),
  italic: ansi('\x1b[3m'),
  red: ansi('\x1b[31m'),
  green: ansi('\x1b[32m'),
  yellow: ansi('\x1b[33m'),
  blue: ansi('\x1b[34m'),
  magenta: ansi('\x1b[35m'),
  cyan: ansi('\x1b[36m'),
  white: ansi('\x1b[37m'),
  gray: ansi('\x1b[90m'),
  brightCyan: ansi('\x1b[96m'),
  brightGreen: ansi('\x1b[92m'),
  brightRed: ansi('\x1b[91m'),
  brightYellow: ansi('\x1b[93m'),
  bgRed: ansi('\x1b[41m'),
  bgYellow: ansi('\x1b[43m'),
  bgBlue: ansi('\x1b[44m'),
  bgCyan: ansi('\x1b[46m'),
  bgGray: ansi('\x1b[100m'),
  hideCursor: ansi('\x1b[?25l'),
  showCursor: ansi('\x1b[?25h'),
  clearLine: ansi('\x1b[2K\r'),
};

// ---------------------------------------------------------------------------
// Spinner (clean, like Claude Code)
// ---------------------------------------------------------------------------
class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private startTime = 0;
  private text = '';
  private readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  start(text = 'Thinking'): void {
    this.startTime = Date.now();
    this.text = text;
    this.frame = 0;
    try { process.stdout.write(C.hideCursor); } catch { /* pipe closed */ }
    this.render();
    this.interval = setInterval(() => this.render(), 80);
  }

  update(text: string): void { this.text = text; }

  stop(message?: string): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    try { process.stdout.write(C.clearLine + C.showCursor); } catch { /* pipe closed */ }
    if (message) console.log(message);
  }

  private render(): void {
    try {
      const s = ((Date.now() - this.startTime) / 1000).toFixed(0);
      process.stdout.write(C.clearLine);
      process.stdout.write(`  ${C.cyan}${this.frames[this.frame % this.frames.length]}${C.reset} ${C.dim}${this.text}${C.reset} ${C.dim}${s}s${C.reset}`);
      this.frame++;
    } catch { /* stdout closed, ignore */ }
  }
}

// ---------------------------------------------------------------------------
// File completer (for @ and Tab)
// ---------------------------------------------------------------------------
const SKIP_COMPLETIONS = new Set(['node_modules', 'dist', 'build', '.git', '__pycache__', '.next', '.nuxt', 'coverage', '.venv', 'venv']);

function getFiles(partial: string, max = 20): string[] {
  try {
    const raw = partial.startsWith('@') ? partial.slice(1) : partial;
    const dir = raw.includes('/') ? path.dirname(raw) : '.';
    const prefix = raw.includes('/') ? path.basename(raw) : raw;
    const at = partial.startsWith('@') ? '@' : '';
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(e => e.toLowerCase().startsWith(prefix.toLowerCase()) && !SKIP_COMPLETIONS.has(e))
      .sort((a, b) => {
        // Directories first, then alphabetical
        const aIsDir = fs.statSync(dir === '.' ? a : `${dir}/${a}`).isDirectory();
        const bIsDir = fs.statSync(dir === '.' ? b : `${dir}/${b}`).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      })
      .slice(0, max)
      .map(e => {
        const full = dir === '.' ? e : `${dir}/${e}`;
        try {
          const isDir = fs.statSync(full).isDirectory();
          return `${at}${isDir ? full + '/' : full}`;
        } catch { return `${at}${full}`; }
      });
  } catch { return []; }
}

function buildCompleter(agentIds: string[]) {
  const cmds = ['/help', '/agents', '/clear', '/quit', '/provider', '/diff', '/diff-review', '/analyze', '/graph', '/project', '/doctor', '/tokens', '/feedback', '/export', '/verbose'];
  return (line: string): [string[], string] => {
    const trimmed = line.trim();
    if (trimmed.startsWith('/')) {
      const hits = cmds.filter(c => c.startsWith(trimmed));
      return [hits, trimmed];
    }
    const words = trimmed.split(/\s+/);
    const last = words[words.length - 1] || '';
    if (last.startsWith('@')) return [getFiles(last), last];
    if (words.length === 1) {
      const hits = agentIds.filter(a => a.startsWith(last));
      return [hits.length ? hits : [], last];
    }
    if (last.includes('/') || last.includes('.')) return [getFiles(last), last];
    return [[], line];
  };
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------
function gitBranch(): string {
  try { return execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8' }).trim(); }
  catch { return ''; }
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------
function getVersion(): string {
  try {
    for (const p of [
      path.join(process.cwd(), 'node_modules', 'dev-crew', 'package.json'),
      path.resolve(import.meta.url.replace('file://', '').replace(/\/dist\/.*/, ''), 'package.json'),
      path.join(process.cwd(), 'package.json'),
    ]) {
      try {
        const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (pkg.name === 'dev-crew') return pkg.version;
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return '2.0.0';
}

// ---------------------------------------------------------------------------
// Interactive REPL — clean like Claude Code
// ---------------------------------------------------------------------------
export async function interactiveCommand(): Promise<void> {
  const spinner = new Spinner();
  spinner.start('Starting');

  const cache = new ProjectCache();
  const cached = cache.get();
  let projectInfo: ProjectInfo;
  if (cached) {
    projectInfo = cached;
  } else {
    const detector = new ProjectDetector();
    projectInfo = await detector.detect();
    cache.set(projectInfo);
  }
  const bridge = new ProviderBridge();
  const providerInfo = await bridge.autoSelect();
  const configManager = new ConfigManager();
  const registry = new AgentRegistry();
  const agentList = registry.list();
  const agentIds = agentList.map(a => a.name);
  const optimizer = new TokenOptimizer();
  const version = getVersion();
  const branch = gitBranch();

  // Session stats
  let commands = 0;
  let totalTokens = 0;
  const sessionStart = Date.now();
  let lastRaw = '';
  let lastAgent = '';
  let multiLine = '';
  let verbose = false;

  spinner.stop();

  // Welcome — compact, like Claude Code
  console.log();
  console.log(`  ${C.bold}${C.brightCyan}Dev-Crew${C.reset} ${C.dim}v${version}${C.reset}`);
  console.log();
  const stack = [projectInfo.language, projectInfo.framework].filter(Boolean).join('/');
  console.log(`  ${C.dim}${projectInfo.name}${C.reset} ${C.dim}(${stack})${C.reset}${branch ? `  ${C.dim}on${C.reset} ${C.magenta}${branch}${C.reset}` : ''}`);
  console.log(`  ${C.dim}${providerInfo.name} · ${agentList.length} agents · /help for commands${C.reset}`);
  console.log();

  // Simulation mode warning
  if (bridge.isSimulation()) {
    console.log(`  ${C.yellow}${C.bold}⚠  SIMULATION MODE${C.reset}${C.yellow} — No AI provider detected.${C.reset}`);
    console.log(`  ${C.yellow}   Output below is example data, not real analysis.${C.reset}`);
    console.log(`  ${C.yellow}   Run 'dev-crew doctor' for setup help.${C.reset}`);
    console.log();
  }

  // Readline
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.brightCyan}❯${C.reset} `,
    completer: buildCompleter(agentIds),
    historySize: 500,
  });

  rl.prompt();

  let busy = false;

  rl.on('line', (line: string) => {
    const raw = line.trimEnd();

    // Multi-line with trailing backslash (ignore trailing spaces before \)
    if (raw.trimEnd().endsWith('\\')) {
      const content = raw.replace(/\s*\\$/, '');
      multiLine += content + '\n';
      process.stdout.write(`${C.dim}… ${C.reset}`);
      return;
    }

    const input = (multiLine + raw).trim();
    multiLine = '';
    if (!input) { rl.prompt(); return; }
    if (busy) {
      console.log(`  ${C.dim}Still working… press Ctrl+C to cancel${C.reset}`);
      return;
    }
    busy = true;
    handle(input)
      .catch((err) => {
        console.log(`  ${C.red}Unexpected error: ${err instanceof Error ? err.message : String(err)}${C.reset}`);
      })
      .finally(() => { busy = false; rl.prompt(); });
  });

  async function handle(input: string): Promise<void> {

    // ── Slash commands ──
    if (input.startsWith('/')) {
      const [cmd, ...rest] = input.split(/\s+/);
      const args = rest.join(' ');

      switch (cmd) {
        case '/help': case '/h':
          console.log();
          console.log(`  ${C.bold}Commands${C.reset}`);
          const helpCmds: [string, string][] = [
            ['/help', 'Show this help'],
            ['/agents', 'List all agents'],
            ['/clear', 'Clear screen'],
            ['/diff', 'Recent git changes'],
            ['/provider <name>', 'Switch AI provider'],
            ['/project', 'Project info'],
            ['/doctor', 'Check setup'],
            ['/tokens', 'Session stats'],
            ['/feedback <agent> <msg>', 'Teach an agent'],
            ['/diff-review', 'AI review of uncommitted changes'],
            ['/analyze [file]', 'Run local static analysis (tsc, eslint, patterns)'],
            ['/graph [file]', 'Show code graph & blast radius analysis'],
            ['/export [file]', 'Save last result'],
            ['/verbose', 'Toggle verbose debug output'],
            ['/quit', 'Exit'],
          ];
          for (const [c, d] of helpCmds) {
            console.log(`  ${C.dim}${c.padEnd(26)}${d}${C.reset}`);
          }
          console.log();
          console.log(`  ${C.bold}Usage${C.reset}`);
          console.log(`  ${C.dim}Just type naturally — Dev-Crew picks the right agent.${C.reset}`);
          console.log(`  ${C.dim}Use @file to include files. Use \\ for multi-line.${C.reset}`);
          console.log();
          console.log(`  ${C.dim}review @src/app.ts          Code review${C.reset}`);
          console.log(`  ${C.dim}fix @src/api.ts             Fix issues${C.reset}`);
          console.log(`  ${C.dim}explain @lib/auth.ts         Explain code${C.reset}`);
          console.log(`  ${C.dim}is there a security issue?   Natural language${C.reset}`);
          console.log();
          return;

        case '/agents': case '/a':
          console.log();
          for (const a of agentList) {
            console.log(`  ${C.cyan}${a.name.padEnd(22)}${C.reset}${C.dim}${a.description}${C.reset}`);
          }
          console.log();
          return;

        case '/clear':
          console.clear();
          console.log(`  ${C.bold}${C.brightCyan}Dev-Crew${C.reset} ${C.dim}v${version}${C.reset}`);
          console.log();
          return;

        case '/diff': {
          try {
            const diff = execSync('git diff --stat HEAD~3..HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
            if (diff) {
              console.log();
              for (const line of diff.split('\n')) {
                console.log(`  ${C.dim}${line}${C.reset}`);
              }
              console.log();
            } else {
              console.log(`  ${C.dim}No recent changes${C.reset}`);
            }
          } catch { console.log(`  ${C.dim}Not a git repository${C.reset}`); }
          return;
        }

        case '/provider':
          if (!args) {
            console.log(`  ${C.dim}Current: ${providerInfo.name}${C.reset}`);
            console.log(`  ${C.dim}Usage: /provider <claude-api|claude-code|aider|copilot|openai|ollama|simulation>${C.reset}`);
            if (!process.env.ANTHROPIC_API_KEY) {
              console.log(`  ${C.dim}Tip: Set ANTHROPIC_API_KEY for fastest direct Claude API access${C.reset}`);
            }
          } else {
            try {
              const info = await bridge.setProvider(args.trim());
              Object.assign(providerInfo, info);
              console.log(`  ${C.green}✓${C.reset} ${info.name}`);
            } catch (e) {
              console.log(`  ${C.red}✗${C.reset} ${e instanceof Error ? e.message : e}`);
            }
          }
          return;

        case '/project':
          console.log();
          const fields: [string, string][] = [
            ['Language', projectInfo.language],
            ['Framework', projectInfo.framework || '—'],
            ['Database', projectInfo.database.join(', ') || '—'],
            ['ORM', projectInfo.orm || '—'],
            ['Tests', projectInfo.testFramework || '—'],
            ['Docker', projectInfo.hasDocker ? 'yes' : 'no'],
            ['CI', projectInfo.ciPlatform || '—'],
          ];
          for (const [k, v] of fields) {
            console.log(`  ${C.dim}${k.padEnd(14)}${C.reset}${v}`);
          }
          console.log();
          return;

        case '/doctor': {
          console.log();
          const nodeOk = parseInt(process.version.slice(1)) >= 18;
          console.log(`  ${nodeOk ? '✓' : '✗'} Node ${process.version}`);
          console.log(`  ✓ Provider: ${providerInfo.name}`);
          try { execSync('git --version', { stdio: 'pipe' }); console.log('  ✓ Git'); } catch { console.log('  ⚠ Git not found'); }
          console.log(`  ${configManager.isInitialized() ? '✓' : '⚠'} Config ${configManager.isInitialized() ? 'found' : '(run dev-crew init)'}`);
          console.log();
          return;
        }

        case '/tokens': {
          const mins = ((Date.now() - sessionStart) / 60000).toFixed(0);
          const cost = ((totalTokens * 0.003) / 1000).toFixed(4);
          console.log();
          console.log(`  ${C.dim}${commands} commands · ${totalTokens.toLocaleString()} tokens · $${cost} · ${mins}m${C.reset}`);
          console.log();
          return;
        }

        case '/feedback':
          if (!args || !args.includes(' ')) {
            console.log(`  ${C.dim}Usage: /feedback <agent> <message>${C.reset}`);
            console.log(`  ${C.dim}Example: /feedback review always check for console.log${C.reset}`);
          } else {
            const [agent, ...msg] = args.split(/\s+/);
            if (registry.has(agent)) {
              configManager.addFeedback(agent, msg.join(' '));
              console.log(`  ${C.green}✓${C.reset} ${C.dim}Saved for ${agent}${C.reset}`);
            } else {
              console.log(`  ${C.red}✗${C.reset} ${C.dim}Unknown agent: ${agent}${C.reset}`);
            }
          }
          return;

        case '/export': {
          if (!lastRaw) { console.log(`  ${C.dim}Nothing to export yet — run a command first${C.reset}`); return; }
          const file = args || `dev-crew-${lastAgent}-${Date.now()}.md`;
          try {
            const dir = path.dirname(file);
            if (dir && dir !== '.' && !fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(file, `# ${lastAgent}\n\n${lastRaw}\n`);
            console.log(`  ${C.green}✓${C.reset} ${C.dim}Saved to ${file}${C.reset}`);
          } catch (e) { console.log(`  ${C.red}✗${C.reset} ${e instanceof Error ? e.message : e}`); }
          return;
        }

        case '/diff-review': {
          // Review uncommitted changes with AI — much more useful than reviewing full files
          try {
            const { DiffContext } = await import('../core/diff-context.js');
            const dc = new DiffContext();
            const hunks = dc.getUncommittedDiff();
            if (hunks.length === 0) {
              console.log(`  ${C.dim}No uncommitted changes to review${C.reset}`);
              return;
            }
            console.log(`  ${C.dim}Found ${hunks.length} changed files — sending to review agent...${C.reset}`);
            console.log();
            spinner.start('review');
            const changedFiles = hunks.map(h => h.file);
            const feedback = configManager.getFeedback('review');
            const agent = registry.create('review', projectInfo, undefined, feedback);
            if (!agent) { spinner.stop(); console.log(`  ${C.red}Review agent not found${C.reset}`); return; }
            const t0 = Date.now();
            const diffPrompt = dc.formatForPrompt(hunks);
            const result = await agent.execute({
              query: 'Review ONLY the changes shown in the diff below. Focus on bugs, security issues, and code quality in the CHANGED lines.',
              context: diffPrompt,
              files: changedFiles,
              streaming: true,
              onStream: (chunk: string) => {
                spinner.stop();
                try { process.stdout.write(chunk); } catch { /* stdout closed */ }
              },
            });
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            const tokens = (result.tokensUsed || 0) + optimizer.estimate(result.raw);
            console.log();
            const simTag = result.simulated ? ' [simulated]' : '';
            console.log(`  ${C.dim}diff-review · ${tokens.toLocaleString()} tokens · ${elapsed}s${simTag}${C.reset}`);
            console.log();
            commands++;
            totalTokens += tokens;
            lastRaw = result.raw;
            lastAgent = 'diff-review';
          } catch (e) {
            spinner.stop();
            console.log(`  ${C.red}${e instanceof Error ? e.message : e}${C.reset}`);
          }
          return;
        }

        case '/analyze': {
          // Run local static analysis — real tool output, zero AI
          try {
            const { StaticAnalyzer } = await import('../core/static-analyzer.js');
            const sa = new StaticAnalyzer();
            const targetFiles = args
              ? [args.replace(/^@/, '')]
              : (() => { try { return execSync('git diff --name-only HEAD 2>/dev/null', { encoding: 'utf-8' }).split('\n').filter(Boolean); } catch { return []; } })();

            if (targetFiles.length === 0) {
              console.log(`  ${C.dim}No files to analyze. Use /analyze @path/to/file${C.reset}`);
              return;
            }
            console.log(`  ${C.dim}Analyzing ${targetFiles.length} files locally (tsc, eslint, patterns)...${C.reset}`);
            const findings = sa.analyze(targetFiles);
            if (findings.length === 0) {
              console.log(`  ${C.green}✓${C.reset} ${C.dim}No issues found${C.reset}`);
            } else {
              console.log();
              const errors = findings.filter(f => f.type === 'error');
              const warns = findings.filter(f => f.type === 'warning');
              const infos = findings.filter(f => f.type === 'info');
              for (const f of findings.slice(0, 40)) {
                const icon = f.type === 'error' ? `${C.red}●${C.reset}` : f.type === 'warning' ? `${C.yellow}●${C.reset}` : `${C.blue}●${C.reset}`;
                const loc = f.line ? `${f.file}:${f.line}` : f.file;
                console.log(`  ${icon} ${C.dim}[${f.source}]${C.reset} ${C.dim}${loc}${C.reset} — ${f.message}`);
              }
              if (findings.length > 40) console.log(`  ${C.dim}... and ${findings.length - 40} more${C.reset}`);
              console.log();
              console.log(`  ${C.dim}${errors.length} errors · ${warns.length} warnings · ${infos.length} info${C.reset}`);
            }
            console.log();
          } catch (e) {
            console.log(`  ${C.red}${e instanceof Error ? e.message : e}${C.reset}`);
          }
          return;
        }

        case '/graph': {
          // Show code graph structure and blast radius
          try {
            const { CodeGraph } = await import('../core/code-graph.js');
            const cg = new CodeGraph();
            const targetFiles = args
              ? [args.replace(/^@/, '')]
              : (() => { try { return execSync('git diff --name-only HEAD 2>/dev/null', { encoding: 'utf-8' }).split('\n').filter(Boolean); } catch { return []; } })();

            console.log(`  ${C.dim}Building code graph...${C.reset}`);
            cg.buildFromDirectory(process.cwd(), 500);
            const stats = cg.getStats();
            console.log(`  ${C.cyan}Graph:${C.reset} ${stats.fileCount} files · ${stats.nodeCount} symbols · ${stats.edgeCount} edges`);
            console.log();

            if (targetFiles.length > 0) {
              // Show blast radius for specified/changed files
              const blast = cg.getBlastRadius(targetFiles, 2, 200);
              console.log(`  ${C.bold}Blast Radius${C.reset} for ${targetFiles.length} file(s):`);
              console.log(`  ${C.dim}Changed: ${blast.changedNodes.length} symbols${C.reset}`);
              console.log(`  ${C.dim}Impacted: ${blast.impactedNodes.length} symbols in ${blast.impactedFiles.length} files${C.reset}`);
              console.log();

              // Show impacted files
              for (const file of blast.impactedFiles.slice(0, 15)) {
                const rel = path.relative(process.cwd(), file);
                const nodes = blast.impactedNodes.filter(n => n.file === file);
                const isChanged = targetFiles.some(t => path.resolve(t) === file);
                const icon = isChanged ? `${C.yellow}★${C.reset}` : `${C.blue}→${C.reset}`;
                console.log(`  ${icon} ${rel} ${C.dim}(${nodes.length} symbols)${C.reset}`);
              }
              if (blast.impactedFiles.length > 15) {
                console.log(`  ${C.dim}... and ${blast.impactedFiles.length - 15} more${C.reset}`);
              }

              // Show smart context recommendation
              const smart = cg.getSmartContext(targetFiles, 8);
              console.log();
              console.log(`  ${C.green}Recommended context${C.reset} (${smart.length} files):`);
              for (const f of smart) {
                console.log(`  ${C.dim}  ${f}${C.reset}`);
              }
            } else {
              // No files — show file structure summary
              console.log(`  ${C.dim}Tip: /graph @file to see blast radius for a specific file${C.reset}`);
              console.log(`  ${C.dim}Tip: Change files with git, then /graph to see impact${C.reset}`);
            }
            console.log();
          } catch (e) {
            console.log(`  ${C.red}${e instanceof Error ? e.message : e}${C.reset}`);
          }
          return;
        }

        case '/verbose':
          verbose = !verbose;
          console.log(`  ${C.dim}Verbose mode: ${verbose ? 'on' : 'off'}${C.reset}`);
          return;

        case '/quit': case '/q': case '/exit':
          const mins = ((Date.now() - sessionStart) / 60000).toFixed(0);
          console.log();
          console.log(`  ${C.dim}${commands} commands · ${totalTokens.toLocaleString()} tokens · ${mins}m${C.reset}`);
          console.log();
          rl.close();
          return;

        default:
          console.log(`  ${C.dim}Unknown command. Type /help${C.reset}`);
          return;
      }
    }

    // ── Extract @files ──
    const atFiles: string[] = [];
    const cleaned = input.replace(/@(\S+)/g, (_, f: string) => { atFiles.push(f); return f; });

    // ── Route to agent ──
    const parsed = parseNaturalInput(cleaned, agentIds);
    const allFiles = [...new Set([...(parsed.filePath ? [parsed.filePath] : []), ...atFiles])];
    const feedback = configManager.getFeedback(parsed.agentId);
    const agent = registry.create(parsed.agentId, projectInfo, undefined, feedback);

    if (!agent) {
      console.log(`  ${C.red}✗${C.reset} ${C.dim}Unknown agent "${parsed.agentId}" — /agents to list${C.reset}`);
      return;
    }

    // ── Execute with streaming ──
    console.log();
    spinner.start(parsed.agentId);
    const t0 = Date.now();
    let streamed = false;
    let abortTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const timeoutMs = allFiles.length > 0 ? 180_000 : 120_000; // more time for file analysis
      const executePromise = agent.execute({
        query: parsed.query,
        files: allFiles.length > 0 ? allFiles : undefined,
        streaming: true,
        onStream: (chunk: string) => {
          if (!streamed) { spinner.stop(); streamed = true; }
          try { process.stdout.write(chunk); } catch { /* stdout closed */ }
        },
        onProgress: (step: string) => {
          if (!streamed) spinner.update(step);
        },
      });

      const timeoutPromise = new Promise<never>((_, rej) => {
        abortTimer = setTimeout(() => rej(new Error(
          allFiles.length > 0
            ? 'Request timed out — the file may be too large. Try a smaller file.'
            : 'Request timed out — try targeting specific files with @path/to/file'
        )), timeoutMs);
      });

      const result = await Promise.race([executePromise, timeoutPromise]);
      if (abortTimer) clearTimeout(abortTimer);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const tokens = (result.tokensUsed || 0) + optimizer.estimate(result.raw);

      if (streamed) {
        console.log();
      } else {
        spinner.stop();
        printResponse(result.raw);
      }

      // Minimal footer
      const simTag = result.simulated ? ' [simulated]' : '';
      console.log(`  ${C.dim}${parsed.agentId} · ${tokens.toLocaleString()} tokens · ${elapsed}s${simTag}${C.reset}`);
      console.log();

      // Track
      commands++;
      totalTokens += tokens;
      lastRaw = result.raw;
      lastAgent = parsed.agentId;

    } catch (err) {
      if (abortTimer) clearTimeout(abortTimer);
      spinner.stop();
      if (streamed) console.log();
      const msg = err instanceof Error ? err.message : String(err);
      // Provide helpful context for common errors
      if (msg.includes('ENOENT') || msg.includes('not found')) {
        console.log(`  ${C.red}AI provider not found.${C.reset} Run ${C.cyan}/doctor${C.reset} to check setup.`);
      } else if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
        console.log(`  ${C.red}Connection failed.${C.reset} Check your internet or provider status.`);
      } else if (msg.includes('exit code')) {
        console.log(`  ${C.red}Provider error:${C.reset} ${msg}`);
        console.log(`  ${C.dim}Try /provider simulation to test without AI${C.reset}`);
      } else {
        console.log(`  ${C.red}${msg}${C.reset}`);
      }
      console.log();
    }
  }

  // ── Ctrl+C — cancel current operation or exit ──
  let sigintCount = 0;
  rl.on('SIGINT', () => {
    if (busy) {
      spinner.stop(`  ${C.dim}cancelled${C.reset}`);
      busy = false;
      sigintCount = 0;
      console.log();
      rl.prompt();
      return;
    }
    sigintCount++;
    if (sigintCount >= 2) {
      console.log();
      console.log(`  ${C.dim}${commands} commands · ${totalTokens.toLocaleString()} tokens${C.reset}`);
      console.log();
      process.exit(0);
    }
    console.log();
    console.log(`  ${C.dim}Press Ctrl+C again to exit, or type /quit${C.reset}`);
    rl.prompt();
    // Reset after 2 seconds
    setTimeout(() => { sigintCount = 0; }, 2000);
  });

  rl.on('close', () => {
    // Restore cursor on exit
    try { process.stdout.write(C.showCursor); } catch { /* ignore */ }
    process.exit(0);
  });

  // Ensure cursor is restored on unexpected exit
  process.on('exit', () => {
    try { process.stdout.write('\x1b[?25h'); } catch { /* ignore */ }
  });
}

// ---------------------------------------------------------------------------
// Response printer — clean markdown rendering
// ---------------------------------------------------------------------------
function printResponse(raw: string): void {
  // Try to parse as JSON (structured agent response)
  let json: any = null;
  try {
    const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    json = JSON.parse(match ? match[1].trim() : raw.trim());
  } catch { /* not JSON */ }

  if (json) {
    printStructured(json);
  } else {
    printMarkdown(raw);
  }
}

function printStructured(data: any): void {
  console.log();

  // Summary
  if (data.summary) {
    console.log(`  ${data.summary}`);
    console.log();
  }

  // Score
  if (typeof data.score === 'number') {
    const s = data.score;
    const color = s >= 8 ? C.brightGreen : s >= 5 ? C.brightYellow : C.brightRed;
    const bar = color + '█'.repeat(s) + C.dim + '░'.repeat(10 - s) + C.reset;
    console.log(`  ${bar} ${C.bold}${s}${C.reset}${C.dim}/10${C.reset}`);
    console.log();
  }

  // Issues
  if (data.issues?.length) {
    for (const issue of data.issues) {
      const sev = issue.severity;
      const icon = sev === 'critical' ? `${C.red}●${C.reset}` : sev === 'warning' ? `${C.yellow}●${C.reset}` : `${C.blue}●${C.reset}`;
      const loc = issue.file ? `${C.dim}${issue.file}${issue.line ? ':' + issue.line : ''}${C.reset}` : '';
      console.log(`  ${icon} ${C.bold}${issue.title || issue.message}${C.reset}  ${loc}`);
      if (issue.title && issue.message) {
        console.log(`    ${C.dim}${issue.message}${C.reset}`);
      }
      if (issue.suggestion) {
        console.log(`    ${C.green}→ ${issue.suggestion}${C.reset}`);
      }
      console.log();
    }
  }

  // Positives
  if (data.positives?.length) {
    for (const p of data.positives) {
      console.log(`  ${C.green}✓${C.reset} ${C.dim}${p}${C.reset}`);
    }
    console.log();
  }

  // Suggestions
  if (data.suggestions?.length) {
    for (const s of data.suggestions) {
      console.log(`  ${C.cyan}→${C.reset} ${C.dim}${s}${C.reset}`);
    }
    console.log();
  }

  // Fixes
  if (data.fixes?.length) {
    for (const fix of data.fixes) {
      console.log(`  ${C.bold}${fix.file}${C.reset} — ${fix.description}`);
      if (fix.diff) {
        for (const line of fix.diff.split('\n')) {
          if (line.startsWith('+') && !line.startsWith('+++')) console.log(`  ${C.green}${line}${C.reset}`);
          else if (line.startsWith('-') && !line.startsWith('---')) console.log(`  ${C.red}${line}${C.reset}`);
          else if (line.startsWith('@@')) console.log(`  ${C.cyan}${line}${C.reset}`);
        }
      }
      console.log();
    }
  }

  // Generic key-value for other JSON responses
  if (!data.issues && !data.summary && !data.fixes) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        console.log(`  ${C.bold}${key}${C.reset}: ${value}`);
      } else if (Array.isArray(value)) {
        console.log(`  ${C.bold}${key}${C.reset}:`);
        for (const item of value) {
          const label = typeof item === 'string' ? item : (item as any).name || (item as any).message || JSON.stringify(item);
          console.log(`    ${C.dim}• ${label}${C.reset}`);
        }
      } else if (typeof value === 'number') {
        console.log(`  ${C.bold}${key}${C.reset}: ${value}`);
      }
    }
    console.log();
  }
}

function printMarkdown(raw: string): void {
  const lines = raw.split('\n');
  let inCode = false;

  console.log();
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      if (inCode) {
        const lang = line.slice(3).trim();
        console.log(`  ${C.dim}─── ${lang || 'code'} ${'─'.repeat(Math.max(0, 36 - (lang?.length || 4)))}${C.reset}`);
      } else {
        console.log(`  ${C.dim}${'─'.repeat(42)}${C.reset}`);
      }
      continue;
    }
    if (inCode) { console.log(`  ${C.cyan}${line}${C.reset}`); continue; }

    if (line.startsWith('# ')) { console.log(); console.log(`  ${C.bold}${line.slice(2)}${C.reset}`); }
    else if (line.startsWith('## ')) { console.log(); console.log(`  ${C.bold}${line.slice(3)}${C.reset}`); }
    else if (line.startsWith('### ')) { console.log(`  ${C.bold}${line.slice(4)}${C.reset}`); }
    else if (/^[-*] /.test(line)) { console.log(`  • ${line.slice(2)}`); }
    else if (/^\d+\. /.test(line)) { console.log(`  ${line}`); }
    else if (line.startsWith('>')) { console.log(`  ${C.dim}│ ${line.slice(1).trim()}${C.reset}`); }
    else if (line.trim() === '') { console.log(); }
    else {
      let f = line;
      f = f.replace(/\*\*(.*?)\*\*/g, `${C.bold}$1${C.reset}`);
      f = f.replace(/`(.*?)`/g, `${C.cyan}$1${C.reset}`);
      console.log(`  ${f}`);
    }
  }
  console.log();
}

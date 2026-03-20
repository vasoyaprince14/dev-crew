import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ProviderBridge } from '../core/provider-bridge.js';
import { ConfigManager } from '../core/config-manager.js';
import { parseNaturalInput } from '../core/nlp-router.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
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
  brightCyan: '\x1b[96m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

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
    case 'warning':
      return `${C.bgYellow}${C.bold}${C.white} WARNING  ${C.reset}`;
    case 'info':
      return `${C.bgBlue}${C.bold}${C.white} INFO     ${C.reset}`;
    default:
      return `${C.gray}${severity}${C.reset}`;
  }
}

function formatReviewResponse(raw: string): void {
  // Try to extract JSON from the response (may be wrapped in ```json blocks)
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  let data: any;
  try {
    data = JSON.parse(jsonStr.trim());
  } catch {
    // Not JSON — just print raw
    console.log(raw);
    return;
  }

  // Summary + Score
  if (data.summary) {
    console.log();
    console.log(`  ${C.bold}${C.white}Summary${C.reset}`);
    console.log(`  ${C.gray}${data.summary}${C.reset}`);
    console.log();
  }

  if (typeof data.score === 'number') {
    console.log(`  ${C.bold}Score:${C.reset}  ${scoreBar(data.score)}`);
    console.log();
  }

  // Issues
  if (data.issues && data.issues.length > 0) {
    const criticalCount = data.issues.filter((i: any) => i.severity === 'critical').length;
    const warningCount = data.issues.filter((i: any) => i.severity === 'warning').length;
    const infoCount = data.issues.filter((i: any) => i.severity === 'info').length;

    console.log(`  ${C.bold}Issues${C.reset}  ${C.brightRed}${criticalCount} critical${C.reset}  ${C.brightYellow}${warningCount} warnings${C.reset}  ${C.cyan}${infoCount} info${C.reset}`);
    console.log();

    for (const issue of data.issues) {
      const badge = severityBadge(issue.severity);
      const location = issue.file
        ? `${C.cyan}${issue.file}${C.reset}${issue.line ? `${C.gray}:${C.yellow}${issue.line}${C.reset}` : ''}`
        : '';

      console.log(`  ${badge}  ${location}`);
      if (issue.title) {
        console.log(`  ${C.bold}${C.white}${issue.title}${C.reset}`);
      }
      if (issue.message) {
        console.log(`  ${C.gray}${issue.message}${C.reset}`);
      }
      if (issue.suggestion) {
        console.log(`  ${C.dim}${C.green}→ ${issue.suggestion}${C.reset}`);
      }
      console.log();
    }
  }

  // Positives
  if (data.positives && data.positives.length > 0) {
    console.log(`  ${C.bold}${C.brightGreen}Positives${C.reset}`);
    for (const p of data.positives) {
      console.log(`  ${C.green}✓${C.reset} ${p}`);
    }
    console.log();
  }

  // Suggestions
  if (data.suggestions && data.suggestions.length > 0) {
    console.log(`  ${C.bold}${C.cyan}Suggestions${C.reset}`);
    for (const s of data.suggestions) {
      console.log(`  ${C.cyan}→${C.reset} ${s}`);
    }
    console.log();
  }

  // Generic fields (for non-review JSON responses)
  if (!data.issues && !data.summary) {
    // Just pretty-print key-value pairs
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        console.log(`  ${C.bold}${key}:${C.reset} ${value}`);
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

  let data: any;
  try {
    data = JSON.parse(jsonStr.trim());
    formatReviewResponse(raw);
    return;
  } catch {
    // Not JSON
  }

  // Format markdown-like text
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      console.log(`  ${C.bold}${C.brightCyan}${line.slice(2)}${C.reset}`);
    } else if (line.startsWith('## ')) {
      console.log(`  ${C.bold}${C.white}${line.slice(3)}${C.reset}`);
    } else if (line.startsWith('### ')) {
      console.log(`  ${C.bold}${line.slice(4)}${C.reset}`);
    } else if (line.startsWith('- ')) {
      console.log(`  ${C.cyan}•${C.reset} ${line.slice(2)}`);
    } else if (line.startsWith('* ')) {
      console.log(`  ${C.cyan}•${C.reset} ${line.slice(2)}`);
    } else if (line.startsWith('```')) {
      console.log(`  ${C.gray}${line}${C.reset}`);
    } else if (line.startsWith('>')) {
      console.log(`  ${C.gray}│ ${line.slice(1).trim()}${C.reset}`);
    } else if (line.trim() === '') {
      console.log();
    } else {
      console.log(`  ${line}`);
    }
  }
}

// ---------------------------------------------------------------------------
// File path completer
// ---------------------------------------------------------------------------

function completeFilePath(partial: string): string[] {
  try {
    const raw = partial.startsWith('@') ? partial.slice(1) : partial;
    const dir = raw.includes('/') ? path.dirname(raw) : '.';
    const prefix = raw.includes('/') ? path.basename(raw) : raw;
    const atPrefix = partial.startsWith('@') ? '@' : '';

    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir);
    return entries
      .filter(e => e.startsWith(prefix))
      .filter(e => !e.startsWith('.') && e !== 'node_modules' && e !== 'dist')
      .map(e => {
        const full = dir === '.' ? e : `${dir}/${e}`;
        const isDir = fs.statSync(full).isDirectory();
        return `${atPrefix}${isDir ? `${full}/` : full}`;
      });
  } catch {
    return [];
  }
}

function buildCompleter(knownAgentIds: string[]) {
  const slashCmds = ['/help', '/agents', '/providers', '/project', '/test', '/clear', '/quit'];

  return function completer(line: string): [string[], string] {
    const trimmed = line.trim();

    // Slash commands: / triggers command list
    if (trimmed.startsWith('/')) {
      const hits = slashCmds.filter(c => c.startsWith(trimmed));
      return [hits.length ? hits : slashCmds, trimmed];
    }

    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1] || '';

    // @file tagging: @ triggers file path completion
    if (lastWord.startsWith('@')) {
      const matches = completeFilePath(lastWord);
      if (matches.length > 0) return [matches, lastWord];
      return [[], lastWord];
    }

    // Agent names at the beginning (first word)
    if (words.length === 1) {
      const hits = knownAgentIds.filter(a => a.startsWith(words[0]));
      return [hits.length ? hits : knownAgentIds, words[0]];
    }

    // File path completion for non-@ paths too
    if (lastWord && (lastWord.includes('/') || lastWord.includes('.'))) {
      const matches = completeFilePath(lastWord);
      if (matches.length > 0) return [matches, lastWord];
    }

    return [[], line];
  };
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function showBanner(projectName: string, language: string, framework: string | null, providerName: string): void {
  console.log();
  console.log(`${C.brightCyan}${C.bold}  ╔══════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.brightCyan}${C.bold}  ║${C.reset}  ${C.brightGreen}${C.bold}Dev-Crew${C.reset} ${C.gray}— AI Developer Team${C.reset}          ${C.brightCyan}${C.bold}║${C.reset}`);
  console.log(`${C.brightCyan}${C.bold}  ╚══════════════════════════════════════════╝${C.reset}`);
  console.log();
  console.log(`  ${C.green}●${C.reset} ${C.bold}Project${C.reset}   ${projectName} ${C.gray}(${language}${framework ? ' / ' + framework : ''})${C.reset}`);
  console.log(`  ${C.green}●${C.reset} ${C.bold}Provider${C.reset}  ${providerName}`);
  console.log();
  console.log(`  ${C.gray}Type a command or question. Tab to autocomplete.${C.reset}`);
  console.log(`  ${C.gray}Use ${C.white}@${C.gray} to tag files: ${C.white}review @src/app.ts${C.gray} | ${C.white}explain @lib/auth.ts${C.reset}`);
  console.log(`  ${C.gray}Use ${C.white}/${C.gray} for commands: ${C.white}/help${C.gray} ${C.white}/agents${C.gray} ${C.white}/providers${C.gray} ${C.white}/test${C.gray} ${C.white}/quit${C.reset}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function showHelp(): void {
  console.log();
  console.log(`  ${C.bold}${C.brightCyan}Slash Commands${C.reset}`);
  console.log(`  ${C.white}/help${C.reset}        ${C.gray}Show this help${C.reset}`);
  console.log(`  ${C.white}/agents${C.reset}      ${C.gray}List all 24 agents${C.reset}`);
  console.log(`  ${C.white}/providers${C.reset}   ${C.gray}Show AI provider status${C.reset}`);
  console.log(`  ${C.white}/project${C.reset}     ${C.gray}Show detected project info${C.reset}`);
  console.log(`  ${C.white}/test${C.reset}        ${C.gray}Test AI provider connectivity${C.reset}`);
  console.log(`  ${C.white}/clear${C.reset}       ${C.gray}Clear the screen${C.reset}`);
  console.log(`  ${C.white}/quit${C.reset}        ${C.gray}Exit${C.reset}`);
  console.log();
  console.log(`  ${C.bold}${C.brightCyan}File Tagging${C.reset}  ${C.gray}Use ${C.white}@${C.gray} to reference files (Tab to autocomplete)${C.reset}`);
  console.log(`  ${C.white}review @src/app.ts${C.reset}          ${C.gray}Review a specific file${C.reset}`);
  console.log(`  ${C.white}explain @lib/auth.ts${C.reset}        ${C.gray}Explain a file${C.reset}`);
  console.log(`  ${C.white}fix @src/api.ts${C.reset}             ${C.gray}Fix issues in a file${C.reset}`);
  console.log(`  ${C.white}what does @utils/hash.ts do${C.reset} ${C.gray}Natural language with file context${C.reset}`);
  console.log();
  console.log(`  ${C.bold}${C.brightCyan}Agent Commands${C.reset}`);
  console.log(`  ${C.white}review ${C.cyan}<file|path>${C.reset}       ${C.gray}Code review${C.reset}`);
  console.log(`  ${C.white}fix ${C.cyan}<file>${C.reset}              ${C.gray}Fix issues${C.reset}`);
  console.log(`  ${C.white}test ${C.cyan}<file>${C.reset}             ${C.gray}Generate tests${C.reset}`);
  console.log(`  ${C.white}debug ${C.cyan}<error>${C.reset}           ${C.gray}Root cause analysis${C.reset}`);
  console.log(`  ${C.white}security ${C.cyan}<path>${C.reset}         ${C.gray}Security audit${C.reset}`);
  console.log(`  ${C.white}explain ${C.cyan}<file>${C.reset}          ${C.gray}Code explanation${C.reset}`);
  console.log(`  ${C.white}ask ${C.cyan}<question>${C.reset}          ${C.gray}Ask about your codebase${C.reset}`);
  console.log(`  ${C.white}devops ${C.cyan}<question>${C.reset}       ${C.gray}DevOps guidance${C.reset}`);
  console.log(`  ${C.white}performance ${C.cyan}<path>${C.reset}      ${C.gray}Performance audit${C.reset}`);
  console.log(`  ${C.white}db-architect ${C.cyan}<question>${C.reset}  ${C.gray}Database design${C.reset}`);
  console.log(`  ${C.white}api-architect ${C.cyan}<question>${C.reset} ${C.gray}API design review${C.reset}`);
  console.log();
  console.log(`  ${C.gray}Tip: Type naturally — "check security of src/" or "is there tech debt?"${C.reset}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Interactive REPL
// ---------------------------------------------------------------------------

export async function interactiveCommand(): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  // --- Setup ---
  spinner.start('Detecting project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.stop();

  const bridge = new ProviderBridge();
  const providerInfo = await bridge.autoSelect();

  const configManager = new ConfigManager();
  const registry = new AgentRegistry();
  const agentList = registry.list();
  const knownAgentIds = agentList.map((a) => a.name);

  showBanner(projectInfo.name, projectInfo.language, projectInfo.framework, providerInfo.name);

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
      const cmd = input.toLowerCase();

      if (cmd === '/help') {
        showHelp();
        processNext();
        return;
      }

      if (cmd === '/agents') {
        console.log();
        const freeAgents = agentList.filter(a => a.tier === 'free');
        const proAgents = agentList.filter(a => a.tier === 'pro');

        console.log(`  ${C.bold}${C.brightGreen}Free Agents${C.reset}`);
        for (const agent of freeAgents) {
          console.log(`  ${C.green}●${C.reset} ${C.bold}${C.white}${agent.name.padEnd(22)}${C.reset}${C.gray}${agent.description}${C.reset}`);
        }
        console.log();
        console.log(`  ${C.bold}${C.brightYellow}Pro Agents${C.reset}`);
        for (const agent of proAgents) {
          console.log(`  ${C.yellow}●${C.reset} ${C.bold}${C.white}${agent.name.padEnd(22)}${C.reset}${C.gray}${agent.description}${C.reset}`);
        }
        console.log();
        processNext();
        return;
      }

      if (cmd === '/providers') {
        console.log();
        const providers = await bridge.detectProviders();
        for (const p of providers) {
          const icon = p.status === 'available' ? `${C.green}●${C.reset}` : `${C.red}○${C.reset}`;
          const statusText = p.status === 'available' ? `${C.green}ready${C.reset}` : `${C.gray}not installed${C.reset}`;
          const active = p.name === providerInfo.name ? ` ${C.brightCyan}← active${C.reset}` : '';
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
        const fields = [
          ['Name', projectInfo.name],
          ['Language', projectInfo.language],
          ['Framework', projectInfo.framework || 'none'],
          ['Database', projectInfo.database.join(', ') || 'none'],
          ['ORM', projectInfo.orm || 'none'],
          ['Tests', projectInfo.testFramework || 'none'],
          ['Package Mgr', projectInfo.packageManager],
          ['Docker', projectInfo.hasDocker ? `${C.green}yes${C.reset}` : 'no'],
          ['CI', projectInfo.ciPlatform || 'none'],
          ['Monorepo', projectInfo.monorepo ? `${C.green}yes${C.reset}` : 'no'],
        ];
        for (const [label, value] of fields) {
          console.log(`  ${C.gray}${label.padEnd(14)}${C.reset}${value}`);
        }
        console.log();
        processNext();
        return;
      }

      if (cmd === '/test') {
        console.log();
        const testStart = Date.now();
        try {
          spinner.start('Pinging AI provider...');
          const testResult = await bridge.send('Respond with exactly: "Dev-Crew OK"', {
            systemPrompt: 'You are a test assistant. Respond with exactly what is asked.',
            maxTokens: 100,
          });
          const testElapsed = ((Date.now() - testStart) / 1000).toFixed(1);
          spinner.succeed(`${providerInfo.name} responded in ${testElapsed}s`);
          console.log(`  ${C.green}Response:${C.reset} ${testResult.content.slice(0, 200)}`);
        } catch (err) {
          const testElapsed = ((Date.now() - testStart) / 1000).toFixed(1);
          spinner.fail(`Failed after ${testElapsed}s`);
          console.log(`  ${C.red}${err instanceof Error ? err.message : String(err)}${C.reset}`);
        }
        console.log();
        processNext();
        return;
      }

      if (cmd === '/clear') {
        console.clear();
        showBanner(projectInfo.name, projectInfo.language, projectInfo.framework, providerInfo.name);
        processNext();
        return;
      }

      if (cmd === '/quit' || cmd === '/exit') {
        console.log(`\n  ${C.gray}Goodbye!${C.reset}\n`);
        rl.close();
        return;
      }

      console.log(`  ${C.yellow}Unknown command.${C.reset} Type ${C.white}/help${C.reset} for available commands.`);
      console.log();
      processNext();
      return;
    }

    // ---- Extract @file references ----
    const atFiles: string[] = [];
    let cleanedInput = input.replace(/@(\S+)/g, (_match, filePath: string) => {
      atFiles.push(filePath);
      return filePath; // keep file path in query for NLP router
    });

    // ---- Natural language → agent execution ----
    const parsed = parseNaturalInput(cleanedInput, knownAgentIds);

    // Merge @tagged files with NLP-detected file path
    const allFiles = [...new Set([
      ...(parsed.filePath ? [parsed.filePath] : []),
      ...atFiles,
    ])];

    const feedback = configManager.getFeedback(parsed.agentId);
    const agent = registry.create(parsed.agentId, projectInfo, undefined, feedback);
    if (!agent) {
      console.log(`  ${C.red}✗${C.reset} Agent ${C.bold}"${parsed.agentId}"${C.reset} not found. Type ${C.white}/agents${C.reset} to see available agents.`);
      console.log();
      processNext();
      return;
    }

    // Show what's happening
    console.log();
    const fileDisplay = allFiles.length > 0
      ? allFiles.map(f => `${C.cyan}@${f}${C.reset}`).join(' ')
      : `${C.gray}${parsed.query}${C.reset}`;
    console.log(`  ${C.bgMagenta}${C.bold}${C.white} ${parsed.agentId.toUpperCase()} ${C.reset}  ${fileDisplay}`);

    spinner.start('Gathering context...');
    const startTime = Date.now();

    const timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      spinner.update(`Waiting for AI... (${elapsed}s)`);
    }, 5000);

    try {
      const timeoutMs = 180_000;
      const result = await Promise.race([
        agent.execute({
          query: parsed.query,
          files: allFiles.length > 0 ? allFiles : undefined,
          onProgress: (step: string) => {
            spinner.update(step);
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timed out after 3 minutes.')), timeoutMs),
        ),
      ]);

      clearInterval(timerInterval);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.succeed(`Done in ${elapsed}s`);
      console.log();

      // Format the response beautifully
      formatGenericResponse(result.raw);

      // Footer
      console.log(`  ${C.gray}${'─'.repeat(40)}${C.reset}`);
      console.log(`  ${C.gray}${elapsed}s  •  ~${(result.tokensUsed || 0).toLocaleString()} tokens  •  ${parsed.agentId}${C.reset}`);
      console.log();
    } catch (err) {
      clearInterval(timerInterval);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.fail(`Failed after ${elapsed}s`);
      console.log(`  ${C.red}${err instanceof Error ? err.message : String(err)}${C.reset}`);
      console.log();
    }

    processNext();
  }

  rl.on('close', () => {
    process.exit(0);
  });
}

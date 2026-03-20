import readline from 'node:readline';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ProviderBridge } from '../core/provider-bridge.js';
import { ConfigManager } from '../core/config-manager.js';
import { parseNaturalInput } from '../core/nlp-router.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function showBanner(): void {
  console.log();
  console.log(
    '\x1b[36m' +
      '  ____              _____                   \n' +
      ' |  _ \\  _____   __/ ____|_ __ _____      __\n' +
      " | | | |/ _ \\ \\ / / |   | '__/ _ \\ \\ /\\ / /\n" +
      ' | |_| |  __/\\ V /| |___| | |  __/\\ V  V / \n' +
      ' |____/ \\___| \\_/  \\_____|_|  \\___| \\_/\\_/  \n' +
      '\x1b[0m',
  );
  console.log(
    '\x1b[90m  Interactive Mode — type a command or ask a question\x1b[0m',
  );
  console.log(
    '\x1b[90m  Type /help for available commands, /quit to exit\x1b[0m',
  );
  console.log();
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function showHelp(): void {
  console.log();
  console.log('\x1b[1mSlash Commands:\x1b[0m');
  console.log('  /help        Show this help message');
  console.log('  /agents      List all available agents');
  console.log('  /providers   Show detected AI providers');
  console.log('  /project     Show detected project info');
  console.log('  /quit        Exit interactive mode');
  console.log();
  console.log('\x1b[1mNatural Language:\x1b[0m');
  console.log(
    '  Just type what you want to do. Examples:',
  );
  console.log('    review src/index.ts');
  console.log('    fix the login bug');
  console.log('    write tests for utils/helper.ts');
  console.log('    explain how the auth flow works');
  console.log('    check security of the API routes');
  console.log();
}

// ---------------------------------------------------------------------------
// Interactive REPL
// ---------------------------------------------------------------------------

export async function interactiveCommand(): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();

  // --- Setup ---
  showBanner();

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

  // Show detected info
  console.log(
    `\x1b[32m  Project:\x1b[0m ${projectInfo.name} \x1b[90m(${projectInfo.language}${projectInfo.framework ? ' / ' + projectInfo.framework : ''})\x1b[0m`,
  );
  console.log(
    `\x1b[32m  Provider:\x1b[0m ${providerInfo.name} \x1b[90m(${providerInfo.status})\x1b[0m`,
  );
  console.log();

  // --- Readline interface ---
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[36m❯\x1b[0m ',
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
        console.log('\x1b[1mAvailable Agents:\x1b[0m');
        for (const agent of agentList) {
          const tierColor = agent.tier === 'free' ? '\x1b[32m' : '\x1b[33m';
          console.log(
            `  \x1b[36m${agent.name.padEnd(20)}\x1b[0m ${agent.description} ${tierColor}[${agent.tier}]\x1b[0m`,
          );
        }
        console.log();
        processNext();
        return;
      }

      if (cmd === '/providers') {
        console.log();
        console.log('\x1b[1mAI Providers:\x1b[0m');
        const providers = await bridge.detectProviders();
        for (const p of providers) {
          const statusColor =
            p.status === 'available' ? '\x1b[32m' : '\x1b[31m';
          console.log(
            `  ${p.name.padEnd(20)} ${statusColor}${p.status}\x1b[0m`,
          );
        }
        console.log(
          `\n  \x1b[90mActive: ${providerInfo.name}\x1b[0m`,
        );
        console.log();
        processNext();
        return;
      }

      if (cmd === '/project') {
        console.log();
        console.log('\x1b[1mProject Info:\x1b[0m');
        console.log(`  Name:           ${projectInfo.name}`);
        console.log(`  Language:       ${projectInfo.language}`);
        console.log(`  Framework:      ${projectInfo.framework || 'none'}`);
        console.log(`  Database:       ${projectInfo.database.join(', ') || 'none'}`);
        console.log(`  ORM:            ${projectInfo.orm || 'none'}`);
        console.log(`  Test Framework: ${projectInfo.testFramework || 'none'}`);
        console.log(`  Package Mgr:    ${projectInfo.packageManager}`);
        console.log(`  Docker:         ${projectInfo.hasDocker ? 'yes' : 'no'}`);
        console.log(`  CI:             ${projectInfo.ciPlatform || 'none'}`);
        console.log(`  Monorepo:       ${projectInfo.monorepo ? 'yes' : 'no'}`);
        console.log(`  Structure:      ${projectInfo.structure}`);
        console.log();
        processNext();
        return;
      }

      if (cmd === '/quit' || cmd === '/exit') {
        console.log('\x1b[90mGoodbye!\x1b[0m');
        rl.close();
        return;
      }

      logger.warn(`Unknown command: ${input}. Type /help for available commands.`);
      processNext();
      return;
    }

    // ---- Natural language → agent execution ----
    const parsed = parseNaturalInput(input, knownAgentIds);

    // Load agent-specific feedback from config
    const feedback = configManager.getFeedback(parsed.agentId);

    const agent = registry.create(parsed.agentId, projectInfo, undefined, feedback);
    if (!agent) {
      logger.error(`Agent "${parsed.agentId}" could not be created.`);
      processNext();
      return;
    }

    spinner.start(`Running ${parsed.agentId} agent... (this may take 15-60s)`);

    try {
      // Add a timeout so it doesn't hang forever
      const timeoutMs = 90_000; // 90 seconds
      const result = await Promise.race([
        agent.execute({
          query: parsed.query,
          files: parsed.filePath ? [parsed.filePath] : undefined,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Agent timed out. Try a more specific query like "review src/app.ts"')), timeoutMs),
        ),
      ]);

      spinner.succeed(`${parsed.agentId} agent completed`);

      console.log();
      console.log(result.raw);
      console.log();
      logger.info(
        `Agent: ${result.agent} | Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`,
      );
      console.log();
    } catch (err) {
      spinner.fail(`${parsed.agentId} agent failed`);
      logger.error(err instanceof Error ? err.message : String(err));
      console.log();
    }

    processNext();
  }

  rl.on('close', () => {
    process.exit(0);
  });
}

#!/usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
import { initCommand } from '../src/commands/init.js';
import { doctorCommand } from '../src/commands/doctor.js';
import { reviewCommand } from '../src/commands/review.js';
import { fixCommand } from '../src/commands/fix.js';
import { debugCommand } from '../src/commands/debug.js';
import { testCommand } from '../src/commands/test.js';
import { techLeadCommand } from '../src/commands/tech-lead.js';
import { baCommand } from '../src/commands/ba.js';
import { ctoCommand } from '../src/commands/cto.js';
import { prCommand } from '../src/commands/pr.js';
import { securityCommand } from '../src/commands/security.js';
import { designerCommand } from '../src/commands/designer.js';
import { agentsCommand } from '../src/commands/agents.js';
import { configCommand } from '../src/commands/config.js';
import { feedbackCommand } from '../src/commands/feedback.js';
import { watchCommand } from '../src/commands/watch.js';
import { askCommand } from '../src/commands/ask.js';
import { onboardCommand } from '../src/commands/onboard.js';
import { impactCommand } from '../src/commands/impact.js';
import { resolveCommand } from '../src/commands/resolve.js';
import { featureCommand } from '../src/commands/feature.js';
import { refactorPlanCommand } from '../src/commands/refactor-plan.js';
import { migrationCheckCommand } from '../src/commands/migration-check.js';
import { depsCommand } from '../src/commands/deps.js';
import { debtCommand } from '../src/commands/debt.js';
import { analyticsCommand } from '../src/commands/analytics-cmd.js';
import { tokensCommand } from '../src/commands/tokens.js';
import { sprintReportCommand } from '../src/commands/sprint-report.js';
import { explainCommand } from '../src/commands/explain.js';
import { devopsCommand } from '../src/commands/devops.js';
import { costOptimizerCommand } from '../src/commands/cost-optimizer.js';
import { fullstackBuilderCommand } from '../src/commands/fullstack-builder.js';
import { dbArchitectCommand } from '../src/commands/db-architect.js';
import { apiArchitectCommand } from '../src/commands/api-architect.js';
import { flutterCommand } from '../src/commands/flutter.js';
import { reactNativeCommand } from '../src/commands/react-native.js';
import { iosCommand } from '../src/commands/ios.js';
import { androidCommand } from '../src/commands/android.js';
import { monitoringCommand } from '../src/commands/monitoring.js';
import { performanceCommand } from '../src/commands/performance.js';
import { accessibilityCommand } from '../src/commands/accessibility.js';
import { scaffoldCommand } from '../src/commands/scaffold.js';
import { buildCommand } from '../src/commands/build.js';
import { deployCommand } from '../src/commands/deploy.js';
import { interactiveCommand } from '../src/commands/interactive.js';

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;
const blue = (s: string) => `\x1b[34m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const white = (s: string) => `\x1b[97m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Custom help
// ---------------------------------------------------------------------------
function showBrandedHelp() {
  const v = pkg.version;
  console.log();
  console.log(cyan('  ____              _____'));
  console.log(cyan(' |  _ \\  _____   __/ ____|_ __ _____      __'));
  console.log(cyan(' | | | |/ _ \\ \\ / / |   | \'__/ _ \\ \\ /\\ / /'));
  console.log(cyan(' | |_| |  __/\\ V /| |___| | |  __/\\ V  V /'));
  console.log(cyan(' |____/ \\___| \\_/  \\_____|_|  \\___| \\_/\\_/'));
  console.log();
  console.log(`  ${bold('Dev-Crew')} ${dim(`v${v}`)}  ${dim('—')} Your AI-Powered Developer Team`);
  console.log(`  ${dim('by Prince Vasoya')}`);
  console.log();
  console.log(`  ${bold('Usage:')} dev-crew ${dim('<command>')} ${dim('[options]')}`);
  console.log();

  // ── Getting Started ──
  printSection(green('Getting Started'), [
    ['init', 'Initialize Dev-Crew in your project'],
    ['doctor', 'Check setup and system requirements'],
    ['interactive, i', 'Interactive REPL mode'],
  ]);

  // ── Core Agents ──
  printSection(cyan('Core Agents'), [
    ['review [path]', 'Code review with project-aware rules'],
    ['fix <file>', 'Suggest and apply code fixes'],
    ['debug <input>', 'Root cause analysis from logs/errors'],
    ['test <file>', 'Generate unit/integration/e2e tests'],
    ['ask <question>', 'Ask anything about your codebase'],
    ['explain <file>', 'Detailed code explanation'],
  ]);

  // ── Advanced Agents ──
  printSection(yellow('Advanced Agents'), [
    ['tech-lead [question]', 'Architecture decisions and guidance'],
    ['ba <requirement>', 'Requirements to technical specs'],
    ['cto review', 'Strategic technical review'],
    ['pr review', 'Automated pull request review'],
    ['security [path]', 'OWASP security audit'],
    ['designer api|schema', 'API and schema design review'],
  ]);

  // ── DevOps & Infrastructure ──
  printSection(magenta('DevOps & Infrastructure'), [
    ['devops [question]', 'Docker, CI/CD, Terraform, K8s'],
    ['deploy [question]', 'Deployment strategy'],
    ['cost-optimizer [question]', 'Cloud cost analysis'],
    ['monitoring [question]', 'Observability and alerting'],
  ]);

  // ── Full-Stack & Database ──
  printSection(blue('Full-Stack & Database'), [
    ['scaffold <description>', 'Scaffold a new project'],
    ['build <description>', 'Build a feature into your project'],
    ['db-architect [input]', 'Schema design & query optimization'],
    ['api-architect [input]', 'API design review'],
  ]);

  // ── Mobile ──
  printSection(red('Mobile Development'), [
    ['flutter [input]', 'Flutter/Dart review'],
    ['react-native [input]', 'React Native review'],
    ['ios [input]', 'iOS/Swift review'],
    ['android [input]', 'Android/Kotlin review'],
  ]);

  // ── Quality ──
  printSection(green('Quality & Performance'), [
    ['performance [path]', 'Performance audit'],
    ['accessibility [path]', 'WCAG compliance audit'],
  ]);

  // ── Smart Features ──
  printSection(cyan('Smart Features'), [
    ['onboard', 'Onboarding guide for new devs'],
    ['watch [path]', 'Watch files & auto-review changes'],
    ['impact <file>', 'Change impact analysis'],
    ['resolve', 'AI-assisted merge conflict resolution'],
    ['feature <description>', 'Full pipeline: BA → Tech Lead → Security → Tests'],
    ['refactor-plan <path>', 'Prioritized refactoring plan'],
  ]);

  // ── Code Health ──
  printSection(yellow('Code Health'), [
    ['debt report|scan', 'Technical debt tracker'],
    ['deps health', 'Dependency health scanner'],
    ['migration-check <path>', 'Database migration safety check'],
  ]);

  // ── Analytics ──
  printSection(magenta('Analytics & Tokens'), [
    ['tokens estimate|usage', 'Token management & cost tracking'],
    ['analytics', 'Developer analytics & trends'],
    ['sprint-report', 'Sprint summary report'],
    ['stats', 'npm download stats'],
  ]);

  // ── Configuration ──
  printSection(dim('Configuration'), [
    ['agents list', 'List all 24 agents'],
    ['config show|set|get', 'Manage configuration'],
    ['feedback <agent> <msg>', 'Teach agents your preferences'],
    ['patterns', 'View learned patterns'],
  ]);

  console.log();
  console.log(`  ${dim('Run')} dev-crew ${white('<command>')} --help ${dim('for detailed usage')}`);
  console.log(`  ${dim('Docs:')} ${cyan('https://github.com/vasoyaprince14/dev-crew')}`);
  console.log();
}

function printSection(title: string, commands: [string, string][]) {
  console.log(`  ${bold(title)}`);
  for (const [cmd, desc] of commands) {
    const paddedCmd = cmd.padEnd(28);
    console.log(`    ${white(paddedCmd)} ${dim(desc)}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------
const program = new Command();

program
  .name('dev-crew')
  .description('AI-powered developer crew built by Prince Vasoya')
  .version(pkg.version)
  .configureHelp({ showGlobalOptions: false })
  .helpOption('-h, --help', 'Display help')
  .addHelpCommand(false);

// Override default help to show branded version
program.helpInformation = () => '';
program.on('--help', () => {}); // suppress default
program.action(() => {
  showBrandedHelp();
});

// ===== SETUP =====
program
  .command('init')
  .description('Initialize Dev-Crew in your project')
  .action(initCommand);

program
  .command('doctor')
  .description('Check Dev-Crew setup and system requirements')
  .action(doctorCommand);

// ===== CORE AGENTS =====
program
  .command('review [path]')
  .description('Code review with project-aware rules')
  .option('-d, --depth <level>', 'Review depth: quick, normal, deep', 'normal')
  .option('-e, --explain', 'Include educational explanations for each issue')
  .option('--git-aware', 'Include git history analysis (hotspots, trends)')
  .option('--ci', 'CI mode: output JSON, exit code 2 on critical issues')
  .option('-o, --output <format>', 'Output format: pretty, json', 'pretty')
  .action(reviewCommand);

program
  .command('fix <file>')
  .description('Suggest and apply code fixes')
  .option('-i, --issue <description>', 'Specific issue to fix')
  .action(fixCommand);

program
  .command('debug <input>')
  .description('Root cause analysis from logs, errors, or stack traces')
  .action(debugCommand);

program
  .command('test <file>')
  .description('Generate tests for a file')
  .option('-t, --type <type>', 'Test type: unit, integration, e2e', 'unit')
  .action(testCommand);

// ===== ADVANCED AGENTS =====
program
  .command('tech-lead [question]')
  .description('Architecture decisions and guidance')
  .action(techLeadCommand);

program
  .command('ba <requirement>')
  .description('Translate requirements into technical specs')
  .action(baCommand);

program
  .command('cto <action>')
  .description('Strategic technical review (use: cto review)')
  .action(ctoCommand);

program
  .command('pr <action>')
  .description('PR review (use: pr review)')
  .option('-b, --branch <name>', 'Base branch for diff')
  .action(prCommand);

program
  .command('security [path]')
  .description('Security audit and vulnerability detection')
  .action(securityCommand);

program
  .command('designer <type>')
  .description('API or schema design review (use: designer api|schema)')
  .action(designerCommand);

// ===== SMART FEATURES =====
program
  .command('ask <question>')
  .description('Ask any question about your codebase')
  .action(askCommand);

program
  .command('explain <file>')
  .description('Get a detailed explanation of a code file')
  .action(explainCommand);

program
  .command('onboard')
  .description('Generate onboarding guide for new developers')
  .action(onboardCommand);

program
  .command('watch [path]')
  .description('Watch files and review changes in real-time')
  .action(watchCommand);

program
  .command('impact <file>')
  .description('Show impact analysis of changing a file')
  .action(impactCommand);

program
  .command('resolve')
  .description('AI-assisted merge conflict resolution')
  .action(resolveCommand);

// ===== MULTI-AGENT WORKFLOWS =====
program
  .command('feature <description>')
  .description('Full feature pipeline: BA → Tech Lead → Security → Tests → Review')
  .action(featureCommand);

program
  .command('refactor-plan <path>')
  .description('Generate a prioritized refactoring plan')
  .action(refactorPlanCommand);

// ===== CODE HEALTH =====
program
  .command('debt <action>')
  .description('Technical debt tracker (use: debt report|scan)')
  .action(debtCommand);

program
  .command('migration-check <path>')
  .description('Check database migration for safety issues')
  .action(migrationCheckCommand);

program
  .command('deps <action>')
  .description('Dependency health scanner (use: deps health)')
  .action(depsCommand);

// ===== TOKEN INTELLIGENCE =====
program
  .command('tokens <action> [target]')
  .description('Token management (use: tokens estimate|usage)')
  .action(tokensCommand);

// ===== ANALYTICS & REPORTS =====
program
  .command('analytics')
  .description('View your developer analytics and improvement trends')
  .action(analyticsCommand);

program
  .command('sprint-report')
  .description('Generate a sprint summary report')
  .option('-d, --days <number>', 'Sprint length in days', '14')
  .action(sprintReportCommand);

// ===== CONFIGURATION =====
program
  .command('agents <action> [name]')
  .description('List and inspect agents (use: agents list, agents info <name>)')
  .action(agentsCommand);

program
  .command('config <action> [key] [value]')
  .description('Manage configuration (use: config show, config set, config get)')
  .action(configCommand);

program
  .command('feedback [agent] [message]')
  .description('Give feedback to an agent to improve its responses')
  .action(feedbackCommand);

program
  .command('patterns')
  .description('View learned patterns from your project')
  .action(async () => {
    const { PatternLibrary } = await import('../src/features/pattern-library.js');
    const lib = new PatternLibrary();
    console.log();
    console.log(lib.formatPatterns());
    console.log();
  });

// ===== V2: DEVOPS & INFRASTRUCTURE =====
program
  .command('devops [question]')
  .description('Docker, CI/CD, and infrastructure guidance')
  .action(devopsCommand);

program
  .command('cost-optimizer [question]')
  .description('Deployment cost analysis and optimization')
  .action(costOptimizerCommand);

program
  .command('deploy [question]')
  .description('Get a complete deployment strategy for your project')
  .action(deployCommand);

program
  .command('monitoring [question]')
  .description('Observability, alerting, and logging strategy')
  .action(monitoringCommand);

// ===== V2: FULL-STACK BUILDER =====
program
  .command('scaffold <description>')
  .description('Scaffold a new full-stack project')
  .action(scaffoldCommand);

program
  .command('build <description>')
  .description('Build a feature into your existing project')
  .option('-s, --stack <stack>', 'Tech stack to use')
  .action(buildCommand);

program
  .command('fullstack-builder <description>')
  .description('Full-stack project architecture and scaffolding')
  .action(fullstackBuilderCommand);

// ===== V2: DATABASE & API =====
program
  .command('db-architect [path-or-question]')
  .description('Database schema design and query optimization')
  .action(dbArchitectCommand);

program
  .command('api-architect [path-or-question]')
  .description('API design review and best practices')
  .action(apiArchitectCommand);

// ===== V2: MOBILE DEVELOPMENT =====
program
  .command('flutter [path-or-question]')
  .description('Flutter/Dart development and code review')
  .action(flutterCommand);

program
  .command('react-native [path-or-question]')
  .description('React Native development and review')
  .action(reactNativeCommand);

program
  .command('ios [path-or-question]')
  .description('iOS/Swift development and review')
  .action(iosCommand);

program
  .command('android [path-or-question]')
  .description('Android/Kotlin development and review')
  .action(androidCommand);

// ===== V2: QUALITY & PERFORMANCE =====
program
  .command('performance [path]')
  .description('Frontend and backend performance audit')
  .action(performanceCommand);

program
  .command('accessibility [path]')
  .description('WCAG compliance and accessibility audit')
  .action(accessibilityCommand);

// ===== INTERACTIVE MODE =====
program
  .command('interactive')
  .alias('i')
  .description('Interactive REPL mode — natural language agent routing')
  .action(interactiveCommand);

// ===== STATS =====
program
  .command('stats')
  .description('Show npm download stats for dev-crew')
  .action(async () => {
    const https = await import('node:https');
    const get = (url: string): Promise<string> => new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    try {
      const [day, week, month, total] = await Promise.all([
        get('https://api.npmjs.org/downloads/point/last-day/dev-crew').then(d => JSON.parse(d).downloads || 0),
        get('https://api.npmjs.org/downloads/point/last-week/dev-crew').then(d => JSON.parse(d).downloads || 0),
        get('https://api.npmjs.org/downloads/point/last-month/dev-crew').then(d => JSON.parse(d).downloads || 0),
        get('https://api.npmjs.org/downloads/range/2024-01-01:2030-12-31/dev-crew').then(d => {
          const days = JSON.parse(d).downloads || [];
          return Array.isArray(days) ? days.reduce((s: number, e: { downloads: number }) => s + e.downloads, 0) : 0;
        }),
      ]);
      console.log();
      console.log(`  ${bold(cyan('Dev-Crew npm Stats'))}`);
      console.log(`  ${dim('─'.repeat(32))}`);
      console.log(`  Yesterday:     ${bold(String(day))} downloads`);
      console.log(`  Last 7 days:   ${bold(String(week))} downloads`);
      console.log(`  Last 30 days:  ${bold(String(month))} downloads`);
      console.log(`  All time:      ${bold(String(total))} downloads`);
      console.log(`  Version:       ${bold(pkg.version)} ${dim(`(${pkg.name})`)}`);
      console.log();
      console.log(`  ${dim('https://www.npmjs.com/package/dev-crew')}`);
      console.log();
    } catch {
      console.error('Failed to fetch stats. Check your internet connection.');
    }
  });

program.parse();

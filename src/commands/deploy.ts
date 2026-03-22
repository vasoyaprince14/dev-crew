/**
 * dev-crew deploy
 *
 * Detects project type → recommends platform → runs deployment CLI.
 * Supports: Vercel, Netlify, Railway.
 * Falls back to AI-generated deployment guide if no CLI available.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { ProjectDetector } from '../core/project-detector.js';
import { ActionLayer } from '../core/action-layer.js';
import { AgentRegistry } from '../agents/registry.js';
import { ConfigManager } from '../core/config-manager.js';
import { Spinner } from '../utils/spinner.js';
import { Logger } from '../utils/logger.js';

interface DeployOptions {
  platform?: string;
  prod?: boolean;
}

interface Platform {
  name: string;
  cli: string;
  checkCmd: string;
  deployCmd: string;
  prodFlag: string;
  icon: string;
}

const PLATFORMS: Record<string, Platform> = {
  vercel: {
    name: 'Vercel',
    cli: 'vercel',
    checkCmd: 'vercel --version',
    deployCmd: 'vercel',
    prodFlag: '--prod',
    icon: '\u{25B2}',
  },
  netlify: {
    name: 'Netlify',
    cli: 'netlify',
    checkCmd: 'netlify --version',
    deployCmd: 'netlify deploy',
    prodFlag: '--prod',
    icon: '\u{1F310}',
  },
  railway: {
    name: 'Railway',
    cli: 'railway',
    checkCmd: 'railway --version',
    deployCmd: 'railway up',
    prodFlag: '',
    icon: '\u{1F682}',
  },
};

export async function deployCommand(questionOrPlatform?: string, options: DeployOptions = {}): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();
  const actionLayer = new ActionLayer();

  console.log();
  console.log(chalk.bold.cyan('  Dev-Crew Deploy'));
  console.log(chalk.cyan('  ' + '='.repeat(50)));
  console.log();

  // Step 1: Detect project
  spinner.start('  Detecting project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.stop();

  const framework = projectInfo.framework || projectInfo.language || 'Unknown';
  const hasDocker = projectInfo.hasDocker || fs.existsSync('Dockerfile');

  console.log(chalk.dim(`  Framework:  ${framework}`));
  if (projectInfo.database?.length) {
    console.log(chalk.dim(`  Database:   ${projectInfo.database.join(', ')}`));
  }
  if (hasDocker) {
    console.log(chalk.dim(`  Docker:     Yes`));
  }

  // Step 2: Recommend platform
  const recommended = recommendPlatform(projectInfo, framework);
  const platformKey = options.platform || questionOrPlatform || recommended;

  // Check if this is a "question" mode (old behavior fallback)
  if (platformKey && !PLATFORMS[platformKey.toLowerCase()] && platformKey.length > 10) {
    // User passed a question, not a platform — use the AI deploy advisor
    return deployAdvisor(platformKey, projectInfo);
  }

  const platform = PLATFORMS[platformKey?.toLowerCase() || recommended];

  if (!platform) {
    console.log();
    console.log(chalk.bold('  Supported platforms:'));
    for (const [key, p] of Object.entries(PLATFORMS)) {
      console.log(`    ${p.icon} ${chalk.bold(p.name)} ${chalk.dim(`(dev-crew deploy ${key})`)}`);
    }
    console.log();
    console.log(chalk.dim(`  Recommended for ${framework}: ${chalk.bold(recommended)}`));
    return;
  }

  console.log();
  console.log(chalk.bold(`  ${platform.icon} Deploying to ${platform.name}`));
  console.log();

  // Step 3: Check CLI installed
  spinner.start(`  Checking ${platform.cli} CLI...`);
  const cliInstalled = isCliInstalled(platform.checkCmd);
  spinner.stop();

  if (cliInstalled) {
    console.log(chalk.green(`  \u{2714} ${platform.cli} CLI — installed`));
  } else {
    console.log(chalk.red(`  \u{2716} ${platform.cli} CLI — not installed`));
    console.log();
    console.log(chalk.dim(`  Install it:`));
    console.log(chalk.cyan(`    npm i -g ${platform.cli}`));
    console.log();

    // Offer to install
    const install = await actionLayer.confirm(`  Install ${platform.cli} now?`);
    if (install) {
      try {
        console.log(chalk.dim(`  Installing ${platform.cli}...`));
        execSync(`npm i -g ${platform.cli}`, { stdio: 'pipe', timeout: 60000 });
        console.log(chalk.green(`  \u{2714} ${platform.cli} installed`));
      } catch {
        console.log(chalk.red(`  Failed to install. Install manually: npm i -g ${platform.cli}`));
        return;
      }
    } else {
      return;
    }
  }

  // Step 4: Pre-deploy checks
  console.log();
  spinner.start('  Running pre-deploy checks...');

  const checks: Array<{ name: string; pass: boolean; message?: string }> = [];

  // Check: package.json exists
  const hasPkg = fs.existsSync('package.json');
  checks.push({ name: 'package.json', pass: hasPkg });

  // Check: build script exists
  if (hasPkg) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const hasBuild = !!(pkg.scripts?.build);
      checks.push({ name: 'Build script', pass: hasBuild, message: hasBuild ? undefined : 'No "build" script in package.json' });
    } catch {
      checks.push({ name: 'Build script', pass: false, message: 'Cannot parse package.json' });
    }
  }

  // Check: .env.example exists (warn if using env vars without it)
  const hasEnvExample = fs.existsSync('.env.example');
  if (hasEnvExample) {
    checks.push({ name: '.env.example', pass: true });
  }

  // Check: build works
  if (hasPkg) {
    try {
      execSync('npm run build 2>&1', { stdio: 'pipe', timeout: 120000 });
      checks.push({ name: 'Build', pass: true });
    } catch (err) {
      const output = err && typeof err === 'object' && 'stdout' in err ? String((err as Record<string, unknown>).stdout) : '';
      checks.push({ name: 'Build', pass: false, message: output.split('\n').slice(-3).join(' ').slice(0, 100) });
    }
  }

  spinner.stop();

  for (const check of checks) {
    const icon = check.pass ? chalk.green('\u{2714}') : chalk.red('\u{2716}');
    const msg = check.message ? chalk.dim(` — ${check.message}`) : '';
    console.log(`  ${icon} ${check.name}${msg}`);
  }

  const hasFailures = checks.some(c => !c.pass && c.name === 'Build');
  if (hasFailures) {
    console.log();
    console.log(chalk.yellow('  Build failed. Fix build errors before deploying.'));
    console.log(chalk.dim('  Run: npm run build'));
    return;
  }

  // Step 5: Deploy
  console.log();
  const prod = options.prod !== false;
  const deployStr = prod && platform.prodFlag
    ? `${platform.deployCmd} ${platform.prodFlag}`
    : platform.deployCmd;

  const confirmDeploy = await actionLayer.confirm(`  Run: ${chalk.cyan(deployStr)} ?`);
  if (!confirmDeploy) {
    logger.info('Cancelled.');
    return;
  }

  console.log();
  console.log(chalk.dim(`  Running: ${deployStr}`));
  console.log();

  try {
    // Run deploy with inherited stdio so user sees progress
    const result = spawnSync(platform.cli, deployStr.split(' ').slice(1), {
      stdio: 'inherit',
      timeout: 300000, // 5 min
    });

    console.log();
    if (result.status === 0) {
      console.log(chalk.green.bold('  \u{2714} Deployed successfully!'));
    } else {
      console.log(chalk.red(`  Deploy exited with code ${result.status}`));
    }
  } catch (err) {
    console.log(chalk.red(`  Deploy failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  console.log();
}

// ─── Helpers ──────────────────────────────────────

function recommendPlatform(projectInfo: any, framework: string): string {
  const fw = framework.toLowerCase();

  // Next.js → Vercel (native support)
  if (fw.includes('next')) return 'vercel';

  // Static sites → Netlify
  if (fw.includes('react') && !fw.includes('native')) return 'vercel';
  if (fw.includes('vue') || fw.includes('svelte') || fw.includes('astro')) return 'netlify';
  if (fw.includes('static') || fw.includes('html')) return 'netlify';

  // Backend apps → Railway
  if (fw.includes('nest') || fw.includes('express') || fw.includes('fastify')) return 'railway';
  if (fw.includes('django') || fw.includes('fastapi') || fw.includes('flask')) return 'railway';
  if (fw.includes('spring') || fw.includes('go') || fw.includes('rust')) return 'railway';

  // Has database → Railway (better for full-stack)
  if (projectInfo.database?.length > 0) return 'railway';

  // Default
  return 'vercel';
}

function isCliInstalled(checkCmd: string): boolean {
  try {
    execSync(checkCmd, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fallback: If user passes a question instead of platform name,
 * use the devops agent to provide a deployment guide.
 */
async function deployAdvisor(question: string, projectInfo: any): Promise<void> {
  const spinner = new Spinner();
  const logger = new Logger();
  const configManager = new ConfigManager();
  const registry = new AgentRegistry();

  const agent = registry.create('devops', projectInfo, {}, configManager.getFeedback('devops'));
  if (!agent) {
    logger.error('Failed to create devops agent');
    return;
  }

  spinner.start('  Planning deployment...');
  try {
    const result = await agent.execute({
      query: question || 'Provide a complete deployment strategy for this project.',
      files: ['.'],
    });
    spinner.stop();
    console.log(result.raw);
    console.log();
    logger.info(`Time: ${(result.duration / 1000).toFixed(1)}s | Tokens: ~${(result.tokensUsed || 0).toLocaleString()}`);
  } catch (err) {
    spinner.stop();
    logger.error(err instanceof Error ? err.message : String(err));
  }
}

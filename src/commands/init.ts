import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { ClaudeBridge } from '../core/claude-bridge.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';
import type { DevCrewConfig } from '../types/config.js';

export async function initCommand(): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();
  const configManager = new ConfigManager();

  if (configManager.isInitialized()) {
    logger.warn('Dev-Crew is already initialized in this project.');
    logger.info(`Config at: ${configManager.configPath}`);
    return;
  }

  // Check Claude Code
  spinner.start('Checking Claude Code installation...');
  const bridge = new ClaudeBridge();
  const claudeInstalled = await bridge.verify();

  if (!claudeInstalled) {
    spinner.fail('Claude Code not found');
    logger.error('Claude Code is required. Install it first:');
    logger.info('  npm install -g @anthropic-ai/claude-code');
    process.exit(1);
  }

  const version = await bridge.getVersion();
  spinner.succeed(`Claude Code found (${version})`);

  // Detect project
  spinner.start('Detecting project...');
  const detector = new ProjectDetector();
  const info = await detector.detect();
  spinner.succeed(`Detected: ${info.language} / ${info.framework || 'no framework'} / ${info.packageManager}`);

  if (info.database.length > 0) {
    logger.info(`  Database: ${info.database.join(', ')}`);
  }
  if (info.orm) {
    logger.info(`  ORM: ${info.orm}`);
  }
  if (info.testFramework) {
    logger.info(`  Tests: ${info.testFramework}`);
  }

  // Create config
  const config: DevCrewConfig = {
    project: {
      name: info.name,
      stack: info.framework || info.language,
      database: info.database[0] || undefined,
      orm: info.orm || undefined,
      test_framework: info.testFramework || undefined,
    },
    settings: {
      max_tokens_per_request: 8000,
      show_token_usage: true,
      auto_include_schema: true,
      default_review_depth: 'normal',
      confirm_before_apply: true,
      output_format: 'pretty',
    },
    agents: {
      review: {
        severity: 'normal',
        rules: [],
        ignore: ['**/*.spec.ts', '**/*.test.ts', 'src/generated/**'],
        focus: ['security', 'performance', 'error-handling'],
      },
      test: {
        framework: info.testFramework || undefined,
        coverage_target: 80,
        patterns: ['describe → it → expect', 'AAA pattern (Arrange, Act, Assert)'],
      },
    },
    feedback: {},
  };

  configManager.save(config);

  // Add .dev-crew to .gitignore if not already there
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.dev-crew')) {
      fs.appendFileSync(gitignorePath, '\n# Dev-Crew\n.dev-crew/\n');
      logger.info('Added .dev-crew/ to .gitignore');
    }
  }

  logger.blank();
  logger.success('Dev-Crew initialized!');
  logger.info(`Config: ${configManager.configPath}`);
  logger.blank();
  logger.info('Get started:');
  logger.info('  dev-crew review src/       # Review code');
  logger.info('  dev-crew fix <file>        # Fix issues');
  logger.info('  dev-crew debug <logs>      # Debug errors');
  logger.info('  dev-crew test <file>       # Generate tests');
  logger.info('  dev-crew agents list       # See all agents');
}

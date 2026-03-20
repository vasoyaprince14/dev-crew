import { ProviderBridge } from '../core/provider-bridge.js';
import { ConfigManager } from '../core/config-manager.js';
import { ProjectDetector } from '../core/project-detector.js';
import { Logger } from '../utils/logger.js';

export async function doctorCommand(): Promise<void> {
  const logger = new Logger();

  logger.header('Dev-Crew Doctor');

  // Check AI providers
  const bridge = new ProviderBridge();
  const providers = await bridge.detectProviders();
  const available = providers.filter(p => p.status === 'available' && p.id !== 'simulation');

  if (available.length > 0) {
    for (const p of available) {
      logger.success(`AI Provider: ${p.name} (available)`);
    }
  } else {
    logger.warn('No AI providers found. Simulation mode available.');
    logger.info('  Install one: npm install -g @anthropic-ai/claude-code');
  }
  const installed = available.length > 0;

  // Check config
  const config = new ConfigManager();
  if (config.isInitialized()) {
    logger.success(`Config: found at ${config.configPath}`);
  } else {
    logger.warn('Config: not initialized (run dev-crew init)');
  }

  // Check project
  const detector = new ProjectDetector();
  const info = await detector.detect();
  logger.success(`Project: ${info.name} (${info.language})`);
  if (info.framework) logger.info(`  Framework: ${info.framework}`);
  if (info.database.length) logger.info(`  Database: ${info.database.join(', ')}`);
  if (info.orm) logger.info(`  ORM: ${info.orm}`);
  if (info.testFramework) logger.info(`  Tests: ${info.testFramework}`);

  logger.blank();
  if (installed) {
    logger.success('Everything looks good!');
  } else {
    logger.error('Fix the issues above before using Dev-Crew.');
  }
}

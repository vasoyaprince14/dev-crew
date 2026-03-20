import chalk from 'chalk';
import yaml from 'js-yaml';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';

export async function configCommand(action: string, key?: string, value?: string): Promise<void> {
  const logger = new Logger();
  const configManager = new ConfigManager();

  switch (action) {
    case 'show': {
      if (!configManager.isInitialized()) {
        logger.warn('Not initialized. Run: dev-crew init');
        return;
      }
      const config = configManager.load();
      console.log(yaml.dump(config, { lineWidth: 120 }));
      break;
    }

    case 'set': {
      if (!key || value === undefined) {
        logger.error('Usage: dev-crew config set <key> <value>');
        logger.info('Example: dev-crew config set settings.default_review_depth deep');
        process.exit(1);
      }

      // Try to parse value as JSON for arrays/objects/numbers/booleans
      let parsedValue: unknown = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // keep as string
      }

      configManager.set(key, parsedValue);
      logger.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
      break;
    }

    case 'get': {
      if (!key) {
        logger.error('Usage: dev-crew config get <key>');
        process.exit(1);
      }
      const val = configManager.get(key);
      if (val === undefined) {
        logger.warn(`Key "${key}" not found`);
      } else {
        console.log(typeof val === 'object' ? yaml.dump(val) : String(val));
      }
      break;
    }

    default:
      logger.error('Usage: dev-crew config <show|set|get> [key] [value]');
      process.exit(1);
  }
}

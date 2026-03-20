import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { Logger } from '../utils/logger.js';

export async function agentsCommand(action: string, name?: string): Promise<void> {
  const logger = new Logger();
  const registry = new AgentRegistry();

  switch (action) {
    case 'list': {
      logger.header('Available Agents');
      const agents = registry.list();

      const freeAgents = agents.filter(a => a.tier === 'free');
      const proAgents = agents.filter(a => a.tier !== 'free');

      console.log(chalk.green.bold('\n  Free Agents:'));
      for (const agent of freeAgents) {
        console.log(`  ${chalk.white.bold(agent.name.padEnd(15))} ${chalk.gray(agent.description)}`);
      }

      console.log(chalk.yellow.bold('\n  Pro Agents:'));
      for (const agent of proAgents) {
        console.log(`  ${chalk.white.bold(agent.name.padEnd(15))} ${chalk.gray(agent.description)}`);
      }

      console.log();
      break;
    }

    case 'info': {
      if (!name) {
        logger.error('Usage: dev-crew agents info <name>');
        process.exit(1);
      }

      const entry = registry.get(name);
      if (!entry) {
        logger.error(`Agent "${name}" not found`);
        logger.info('Run "dev-crew agents list" to see all agents');
        process.exit(1);
      }

      const config = entry.defaultConfig;
      console.log();
      console.log(chalk.bold.white(`  ${config.name}`));
      console.log(chalk.gray(`  ${config.description}`));
      console.log();
      console.log(`  Tier:       ${config.tier}`);
      console.log(`  Max Tokens: ${config.maxTokens}`);
      console.log(`  Context:    depth ${config.contextDepth}`);
      if (config.includeSchema) console.log('  Includes:   database schema');
      console.log();
      break;
    }

    default:
      logger.error('Usage: dev-crew agents <list|info> [name]');
      process.exit(1);
  }
}

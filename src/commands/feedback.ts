import { ConfigManager } from '../core/config-manager.js';
import { AgentRegistry } from '../agents/registry.js';
import { Logger } from '../utils/logger.js';

export async function feedbackCommand(agentName: string, message?: string): Promise<void> {
  const logger = new Logger();
  const configManager = new ConfigManager();
  const registry = new AgentRegistry();

  if (!agentName) {
    // Show all feedback
    const config = configManager.load();
    if (!config.feedback || Object.keys(config.feedback).length === 0) {
      logger.info('No feedback recorded yet.');
      logger.info('Usage: dev-crew feedback <agent> "your feedback"');
      return;
    }

    for (const [agent, items] of Object.entries(config.feedback)) {
      console.log(`\n  ${agent}: ${items.length} items`);
      items.forEach((item, i) => {
        console.log(`    ${i + 1}. ${item}`);
      });
    }
    console.log();
    return;
  }

  if (!registry.has(agentName)) {
    logger.error(`Agent "${agentName}" not found`);
    logger.info('Run "dev-crew agents list" to see all agents');
    process.exit(1);
  }

  if (!message) {
    // Show feedback for specific agent
    const items = configManager.getFeedback(agentName);
    if (items.length === 0) {
      logger.info(`No feedback for ${agentName} agent.`);
    } else {
      console.log(`\n  Feedback for ${agentName}:`);
      items.forEach((item, i) => {
        console.log(`    ${i + 1}. ${item}`);
      });
      console.log();
    }
    return;
  }

  configManager.addFeedback(agentName, message);
  logger.success(`Feedback added for ${agentName} agent`);
  logger.info(`  "${message}"`);
}

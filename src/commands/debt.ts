import chalk from 'chalk';
import { DebtTracker } from '../features/debt-tracker.js';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

export async function debtCommand(action: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();
  const tracker = new DebtTracker();

  switch (action) {
    case 'report': {
      const report = tracker.generateReport();
      if (report.itemCount === 0) {
        logger.info('No technical debt tracked yet.');
        logger.info('Run "dev-crew review src/" first to detect debt items.');
        return;
      }
      console.log();
      console.log(tracker.formatReport(report));
      console.log();
      break;
    }

    case 'scan': {
      spinner.start('Scanning for technical debt...');
      const detector = new ProjectDetector();
      const projectInfo = await detector.detect();
      const configManager = new ConfigManager();
      const feedback = configManager.getFeedback('review');

      const registry = new AgentRegistry();
      const agent = registry.create('review', projectInfo, { maxTokens: 4096 }, feedback);
      if (!agent) {
        spinner.fail('Failed to create review agent');
        process.exit(1);
      }

      try {
        const result = await agent.execute({ files: ['src/'] });
        spinner.stop();

        const issues = result.parsed.issues || [];
        tracker.updateFromReview(issues);

        const report = tracker.generateReport();
        console.log();
        console.log(tracker.formatReport(report));
        console.log();
        logger.info(`Scanned with ${issues.length} issues found. Debt database updated.`);
      } catch (err) {
        spinner.fail('Scan failed');
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      break;
    }

    default:
      logger.error('Usage: dev-crew debt <report|scan>');
      process.exit(1);
  }
}

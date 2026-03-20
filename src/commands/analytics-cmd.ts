import { Analytics } from '../features/analytics.js';
import { Logger } from '../utils/logger.js';

export async function analyticsCommand(): Promise<void> {
  const logger = new Logger();
  const analytics = new Analytics();

  const report = analytics.generateReport(30);

  if (report.totalSessions === 0) {
    logger.info('No analytics data yet. Use Dev-Crew commands to start building your profile.');
    return;
  }

  console.log();
  console.log(analytics.formatReport(report));
  console.log();
}

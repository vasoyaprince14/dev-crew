import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { ActionLayer } from '../core/action-layer.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';
import type { ProjectInfo } from '../types/config.js';

interface PipelineStep {
  name: string;
  agent: string;
  icon: string;
  description: string;
  buildQuery: (desc: string, prevResults: string[]) => string;
}

const PIPELINE: PipelineStep[] = [
  {
    name: 'Business Analyst',
    agent: 'ba',
    icon: '📋',
    description: 'Breaking down requirements into user stories',
    buildQuery: (desc) => desc,
  },
  {
    name: 'Tech Lead',
    agent: 'tech-lead',
    icon: '🏗️',
    description: 'Designing architecture and file structure',
    buildQuery: (desc, prev) =>
      `Design the technical architecture for this feature:\n\nFeature: ${desc}\n\nBusiness Analysis:\n${prev[0] || 'N/A'}`,
  },
  {
    name: 'Security Review',
    agent: 'security',
    icon: '🔒',
    description: 'Security review of the design',
    buildQuery: (desc, prev) =>
      `Review the security implications of this feature design:\n\nFeature: ${desc}\n\nTech Design:\n${prev[1] || 'N/A'}`,
  },
  {
    name: 'Tester',
    agent: 'test',
    icon: '🧪',
    description: 'Planning test strategy',
    buildQuery: (desc, prev) =>
      `Plan a comprehensive test strategy for this feature:\n\nFeature: ${desc}\n\nTech Design:\n${prev[1] || 'N/A'}`,
  },
  {
    name: 'Final Review',
    agent: 'review',
    icon: '👀',
    description: 'Final review of the plan',
    buildQuery: (desc, prev) =>
      `Review this complete feature plan for any gaps or issues:\n\nFeature: ${desc}\n\n` +
      `BA:\n${prev[0] || 'N/A'}\n\nTech:\n${prev[1] || 'N/A'}\n\nSecurity:\n${prev[2] || 'N/A'}\n\nTests:\n${prev[3] || 'N/A'}`,
  },
];

export async function featureCommand(description: string): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();
  const actionLayer = new ActionLayer();

  if (!description) {
    logger.error('Usage: dev-crew feature "description of the feature"');
    process.exit(1);
  }

  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  const configManager = new ConfigManager();
  const registry = new AgentRegistry();

  console.log();
  console.log(chalk.bold.cyan(`  Feature Pipeline: ${description}`));
  console.log(chalk.cyan('  ' + '━'.repeat(50)));

  const prevResults: string[] = [];
  let totalTokens = 0;
  let totalDuration = 0;

  for (let i = 0; i < PIPELINE.length; i++) {
    const step = PIPELINE[i];

    console.log();
    console.log(chalk.bold(`  Step ${i + 1}/${PIPELINE.length}: ${step.icon} ${step.name}`));

    const agent = registry.create(step.agent, projectInfo, {}, configManager.getFeedback(step.agent));
    if (!agent) {
      logger.warn(`Skipping ${step.name} — agent not available`);
      prevResults.push('');
      continue;
    }

    spinner.start(`  ${step.description}...`);
    try {
      const result = await agent.execute({
        query: step.buildQuery(description, prevResults),
        files: ['src/'],
      });
      spinner.stop();

      console.log();
      console.log(result.raw);

      prevResults.push(result.raw);
      totalTokens += result.tokensUsed || 0;
      totalDuration += result.duration;

      // Ask to continue (except last step)
      if (i < PIPELINE.length - 1) {
        const proceed = await actionLayer.confirm('\n  Approve and continue?');
        if (!proceed) {
          logger.info('Pipeline stopped by user.');
          break;
        }
      }
    } catch (err) {
      spinner.fail(`${step.name} failed`);
      logger.error(err instanceof Error ? err.message : String(err));
      prevResults.push('');

      const continueAnyway = await actionLayer.confirm('  Continue with next step?');
      if (!continueAnyway) break;
    }
  }

  // Summary
  console.log();
  console.log(chalk.bold.cyan('  Pipeline Summary'));
  console.log(chalk.cyan('  ' + '━'.repeat(30)));
  console.log(`  Steps completed: ${prevResults.filter(r => r).length}/${PIPELINE.length}`);
  console.log(`  Total tokens: ~${totalTokens.toLocaleString()}`);
  console.log(`  Total time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log();
}

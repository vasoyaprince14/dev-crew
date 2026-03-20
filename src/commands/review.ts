import chalk from 'chalk';
import boxen from 'boxen';
import { AgentRegistry } from '../agents/registry.js';
import { ProjectDetector } from '../core/project-detector.js';
import { ConfigManager } from '../core/config-manager.js';
import { TokenIntelligence } from '../core/token-intelligence.js';
import { DependencyGraph } from '../core/dependency-graph.js';
import { GitIntelligence } from '../core/git-intelligence.js';
import { DebtTracker } from '../features/debt-tracker.js';
import { PatternLibrary } from '../features/pattern-library.js';
import { Analytics } from '../features/analytics.js';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface ReviewOptions {
  depth?: string;
  explain?: boolean;
  gitAware?: boolean;
  ci?: boolean;
  output?: string;
}

export async function reviewCommand(targetPath: string, options: ReviewOptions): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();
  const tokenIntel = new TokenIntelligence();

  // Detect project
  spinner.start('Scanning project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();
  spinner.succeed(
    `Detected: ${projectInfo.framework || projectInfo.language}` +
    (projectInfo.database.length ? ` + ${projectInfo.database.join(', ')}` : '') +
    (projectInfo.orm ? ` + ${projectInfo.orm}` : ''),
  );

  // USP 4: Dependency graph
  const target = targetPath || 'src/';
  const depGraph = new DependencyGraph();
  try {
    const nodes = await depGraph.build(target);
    if (nodes.length > 0) {
      console.log();
      console.log(chalk.gray('  ') + depGraph.formatTree(target));
    }
  } catch { /* non-critical */ }

  // USP 5: Git intelligence
  if (options.gitAware) {
    const gitIntel = new GitIntelligence();
    if (await gitIntel.isRepo()) {
      spinner.start('Analyzing git history...');
      const gitReport = await gitIntel.getFullReport(target);
      spinner.stop();
      console.log();
      console.log('  ' + gitIntel.formatReport(gitReport, target).split('\n').join('\n  '));
    }
  }

  // Load config
  const configManager = new ConfigManager();
  const agentOverrides = configManager.getAgentConfig('review');
  const feedback = configManager.getFeedback('review');

  // USP 21: Pattern library injection
  const patternLib = new PatternLibrary();
  const patternPrompt = patternLib.getPatternPrompt();

  // Create agent
  const registry = new AgentRegistry();
  const mergedRules = [...(agentOverrides.rules as string[] || [])];
  if (patternPrompt) {
    mergedRules.push(patternPrompt);
  }

  const agent = registry.create('review', projectInfo, { ...agentOverrides, rules: mergedRules }, feedback);
  if (!agent) {
    logger.error('Failed to create review agent');
    process.exit(1);
  }

  // USP 13: Explain mode
  const explainMode = options.explain ? '\n\nFor each issue found, also include a "why_it_matters" field with a detailed educational explanation including real-world examples.' : '';

  // Execute
  spinner.start('Analyzing with review agent...');
  try {
    const result = await agent.execute({
      files: [target],
      explainMode: explainMode,
    });
    spinner.stop();

    const parsed = result.parsed;
    const issues = parsed.issues || [];
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    // CI/JSON output mode
    if (options.ci || options.output === 'json') {
      const output = {
        status: criticalCount > 0 ? 'fail' : 'pass',
        score: parsed.score || 0,
        issues,
        summary: parsed.summary,
        tokens_used: result.tokensUsed || 0,
        duration_ms: result.duration,
      };
      console.log(JSON.stringify(output, null, 2));
      if (criticalCount > 0) process.exitCode = 2;
      return;
    }

    // Header box
    const headerText = [
      `Code Review: ${target}`,
      `Issues: ${issues.length} | Tokens: ~${(result.tokensUsed || 0).toLocaleString()} | Time: ${(result.duration / 1000).toFixed(1)}s`,
    ].join('\n');

    console.log(boxen(headerText, {
      padding: 1,
      borderStyle: 'round',
      borderColor: criticalCount > 0 ? 'red' : warningCount > 0 ? 'yellow' : 'green',
    }));

    // Score
    if (parsed.score) {
      const scoreColor = parsed.score >= 7 ? 'green' : parsed.score >= 5 ? 'yellow' : 'red';
      console.log(`\n  Quality Score: ${chalk[scoreColor].bold(`${parsed.score}/10`)}`);
    }

    // Summary
    if (parsed.summary) {
      console.log(`\n  ${parsed.summary}`);
    }

    // Issues
    if (issues.length > 0) {
      console.log();
      for (const issue of issues) {
        logger.issue(issue.severity, issue.file, issue.line, issue.title || issue.message);
        if (issue.suggestion) {
          console.log(chalk.gray(`     Fix: ${issue.suggestion}`));
        }
        console.log();
      }
    }

    // Positives
    if (parsed.positives && parsed.positives.length > 0) {
      console.log(chalk.green.bold('  Positives:'));
      for (const pos of parsed.positives) {
        console.log(chalk.green(`  + ${pos}`));
      }
      console.log();
    }

    // Summary line
    logger.divider();
    const parts: string[] = [];
    if (criticalCount > 0) parts.push(chalk.red(`${criticalCount} critical`));
    if (warningCount > 0) parts.push(chalk.yellow(`${warningCount} warning`));
    if (infoCount > 0) parts.push(chalk.blue(`${infoCount} info`));
    console.log(`  Summary: ${parts.join(', ') || chalk.green('No issues found')}`);

    // USP 1: Token savings dashboard
    const tokenReport = tokenIntel.calculateSavings([target], result.raw, result.raw.length);
    tokenIntel.recordSession(tokenReport, 'review');
    console.log();
    console.log(tokenIntel.formatReport(tokenReport));

    // USP 9: Update debt tracker
    const debtTracker = new DebtTracker();
    debtTracker.updateFromReview(issues);

    // USP 21: Record patterns
    patternLib.recordFromIssues(issues, 'review');

    // USP 20: Record analytics
    const analytics = new Analytics();
    analytics.recordEvent({
      date: new Date().toISOString(),
      agent: 'review',
      issueCount: issues.length,
      criticalCount,
      warningCount,
      score: parsed.score,
      tokensUsed: result.tokensUsed || 0,
      duration: result.duration,
    });

    // Exit code for CI
    if (criticalCount > 0) process.exitCode = 2;
  } catch (err) {
    spinner.fail('Review failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

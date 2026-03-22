/**
 * Create Pipeline v2 — Self-Healing App Builder
 *
 * 4 stages + fix loop:
 *   1. Plan     — Architecture + requirements (single AI call)
 *   2. Build    — Generate all files (===FILE=== format)
 *   3. Validate — Sandbox: npm install + tsc + structure checks
 *   4. Fix Loop — Send errors to AI, get fixes, re-validate (max 5)
 *   5. Enhance  — Tests + DevOps files (optional)
 *
 * Trust Layer: Shows real build status, not just spinners.
 */

import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { ConfigManager } from '../core/config-manager.js';
import { Spinner } from '../utils/spinner.js';
import { Sandbox } from '../core/sandbox.js';
import { parseOutput, formatFilesForPrompt } from '../core/output-parser.js';
import { buildPlanPrompt, buildGeneratePrompt, buildFixPrompt, buildEnhancePrompt } from '../core/prompt-engine.js';
import type { GeneratedFile } from '../core/file-writer.js';
import type { ProjectInfo } from '../types/config.js';
import type { ValidationCheck } from '../core/sandbox.js';

export interface CreateSpec {
  description: string;
  refinedDescription: string;
  techStack: string;
  features: string[];
  answers: Record<string, string>;
}

export interface PipelineResult {
  files: GeneratedFile[];
  setupSteps: string[];
  projectName: string;
  totalTokens: number;
  totalDuration: number;
  stagesCompleted: number;
  validationPassed: boolean;
  fixIterations: number;
}

const MAX_FIX_ITERATIONS = 5;
const ICON = { plan: '\u{1F9E0}', build: '\u{1F680}', validate: '\u{1F50D}', fix: '\u{1F527}', enhance: '\u{2699}', pass: '\u{2714}', fail: '\u{2716}', skip: '\u{23ED}' };

export class CreatePipeline {
  private registry: AgentRegistry;
  private configManager: ConfigManager;
  private projectInfo: ProjectInfo;
  private spinner: Spinner;
  private skipConfirm: boolean;

  constructor(projectInfo: ProjectInfo, skipConfirm = false) {
    this.registry = new AgentRegistry();
    this.configManager = new ConfigManager();
    this.projectInfo = projectInfo;
    this.spinner = new Spinner();
    this.skipConfirm = skipConfirm;
  }

  async run(spec: CreateSpec): Promise<PipelineResult> {
    let totalTokens = 0;
    let totalDuration = 0;
    let stagesCompleted = 0;
    let fixIterations = 0;
    let validationPassed = false;

    console.log();
    console.log(chalk.bold.cyan('  Build Pipeline v2'));
    console.log(chalk.cyan('  ' + '='.repeat(50)));

    // ─── Stage 1: PLAN ─────────────────────────────────────
    console.log();
    this.stageHeader(1, 4, ICON.plan, 'Plan', 'Designing architecture and requirements');

    const planAgent = this.createAgent('ba', 8192);
    if (!planAgent) {
      return this.emptyResult('Plan agent not available');
    }

    this.spinner.start('  Designing architecture...');
    let plan = '';
    try {
      const planPrompt = buildPlanPrompt(spec.description, spec.answers, spec.techStack);
      const planResult = await planAgent.execute({ query: planPrompt, streaming: false });
      plan = planResult.raw;
      totalTokens += planResult.tokensUsed || 0;
      totalDuration += planResult.duration;
      stagesCompleted++;
      this.spinner.stop();
      console.log(chalk.green(`  ${ICON.pass} Plan complete — ${this.fmtTime(planResult.duration)}`));
    } catch (err) {
      this.spinner.stop();
      console.log(chalk.red(`  ${ICON.fail} Plan failed: ${this.errMsg(err)}`));
      return this.emptyResult('Plan stage failed');
    }

    // ─── Stage 2: BUILD ─────────────────────────────────────
    console.log();
    this.stageHeader(2, 4, ICON.build, 'Build', 'Generating complete application');

    const buildAgent = this.createAgent('app-creator', 16384);
    if (!buildAgent) {
      return this.emptyResult('Build agent not available');
    }

    this.spinner.start('  Generating code...');
    let files: GeneratedFile[] = [];
    let projectName = 'my-app';

    try {
      const genPrompt = buildGeneratePrompt(spec.description, plan, spec.techStack);
      const genResult = await buildAgent.execute({ query: genPrompt, streaming: false });
      const parsed = parseOutput(genResult.raw);
      files = parsed.files;
      projectName = parsed.projectName;
      totalTokens += genResult.tokensUsed || 0;
      totalDuration += genResult.duration;
      stagesCompleted++;
      this.spinner.stop();
      console.log(chalk.green(`  ${ICON.pass} Generated ${files.length} files — ${this.fmtTime(genResult.duration)}`));
    } catch (err) {
      this.spinner.stop();
      console.log(chalk.red(`  ${ICON.fail} Build failed: ${this.errMsg(err)}`));
      return this.emptyResult('Build stage failed');
    }

    if (files.length === 0) {
      console.log(chalk.red(`  ${ICON.fail} No files generated — AI response could not be parsed`));
      return this.emptyResult('No files generated');
    }

    // ─── Stage 3: VALIDATE & FIX LOOP ──────────────────────
    console.log();
    this.stageHeader(3, 4, ICON.validate, 'Validate & Fix', 'Checking build, fixing errors');

    for (let iteration = 0; iteration <= MAX_FIX_ITERATIONS; iteration++) {
      const sandbox = new Sandbox();

      try {
        sandbox.writeFiles(files);

        if (iteration === 0) {
          this.spinner.start('  Running validation...');
        } else {
          this.spinner.start(`  Re-validating (attempt ${iteration + 1}/${MAX_FIX_ITERATIONS + 1})...`);
        }

        const result = sandbox.validate();
        this.spinner.stop();

        // Display check results
        this.displayChecks(result.checks);

        if (result.success) {
          validationPassed = true;
          console.log();
          console.log(chalk.green.bold(`  ${ICON.pass} Build: CLEAN`));
          stagesCompleted++;
          break;
        }

        // Validation failed — can we fix it?
        if (iteration >= MAX_FIX_ITERATIONS) {
          console.log();
          console.log(chalk.yellow(`  ${ICON.fail} Build has errors after ${MAX_FIX_ITERATIONS} fix attempts`));
          console.log(chalk.dim('  Files will be written — manual fixes may be needed'));
          stagesCompleted++;
          break;
        }

        // ─── FIX: Send errors to AI ──────────────
        fixIterations++;
        console.log();
        console.log(chalk.yellow(`  ${ICON.fix} Fixing ${result.errors.length} error(s) — attempt ${fixIterations}/${MAX_FIX_ITERATIONS}`));

        const fixAgent = this.createAgent('app-creator', 16384);
        if (!fixAgent) {
          console.log(chalk.yellow('  Fix agent not available — skipping'));
          break;
        }

        this.spinner.start('  AI is fixing errors...');

        try {
          const errorsText = result.errors.join('\n\n---\n\n');
          const filesText = formatFilesForPrompt(files);
          const fixPrompt = buildFixPrompt(errorsText, filesText);
          const fixResult = await fixAgent.execute({ query: fixPrompt, streaming: false });
          const fixedOutput = parseOutput(fixResult.raw);
          totalTokens += fixResult.tokensUsed || 0;
          totalDuration += fixResult.duration;

          this.spinner.stop();

          if (fixedOutput.files.length > 0) {
            // Merge fixed files into existing files
            files = this.mergeFiles(files, fixedOutput.files);
            console.log(chalk.dim(`  Updated ${fixedOutput.files.length} file(s) — ${this.fmtTime(fixResult.duration)}`));
          } else {
            console.log(chalk.yellow('  AI returned no file changes — stopping fix loop'));
            break;
          }
        } catch (err) {
          this.spinner.stop();
          console.log(chalk.red(`  Fix failed: ${this.errMsg(err)}`));
          break;
        }
      } finally {
        sandbox.cleanup();
      }
    }

    // ─── Stage 4: ENHANCE (Tests + DevOps) ──────────────────
    console.log();
    this.stageHeader(4, 4, ICON.enhance, 'Enhance', 'Adding tests and DevOps config');

    const fileNames = files.map(f => f.path);
    const enhanceTypes: Array<'tests' | 'devops'> = ['tests', 'devops'];

    for (const type of enhanceTypes) {
      const agentName = type === 'tests' ? 'test' : 'devops';
      const agent = this.createAgent(agentName, 8192);
      if (!agent) continue;

      const label = type === 'tests' ? 'Test suite' : 'DevOps config';
      this.spinner.start(`  Generating ${label.toLowerCase()}...`);

      try {
        const prompt = buildEnhancePrompt(spec.description, plan, fileNames, type);
        const result = await agent.execute({ query: prompt, streaming: false });
        const enhancedFiles = parseOutput(result.raw);
        totalTokens += result.tokensUsed || 0;
        totalDuration += result.duration;

        if (enhancedFiles.files.length > 0) {
          files = this.mergeFiles(files, enhancedFiles.files);
          this.spinner.stop();
          console.log(chalk.green(`  ${ICON.pass} ${label}: ${enhancedFiles.files.length} files — ${this.fmtTime(result.duration)}`));
        } else {
          this.spinner.stop();
          console.log(chalk.dim(`  ${ICON.skip} ${label}: no additional files`));
        }
      } catch {
        this.spinner.stop();
        console.log(chalk.dim(`  ${ICON.skip} ${label}: skipped (non-critical)`));
      }
    }

    stagesCompleted++;

    // ─── FINAL STATUS ──────────────────────────────────────
    console.log();
    console.log(chalk.cyan('  ' + '-'.repeat(50)));
    console.log(chalk.bold(`  Status:  ${validationPassed ? chalk.green('READY') : chalk.yellow('NEEDS REVIEW')}`));
    console.log(chalk.bold(`  Files:   ${files.length} generated`));
    console.log(chalk.bold(`  Build:   ${validationPassed ? chalk.green('CLEAN (0 errors)') : chalk.yellow('Has warnings')}`));
    if (fixIterations > 0) {
      console.log(chalk.bold(`  Fixes:   ${fixIterations} auto-fix iteration(s)`));
    }
    console.log(chalk.cyan('  ' + '-'.repeat(50)));

    return {
      files: this.deduplicateFiles(files),
      setupSteps: this.extractSetupSteps(plan),
      projectName,
      totalTokens,
      totalDuration,
      stagesCompleted,
      validationPassed,
      fixIterations,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private createAgent(name: string, maxTokens: number) {
    return this.registry.create(
      name,
      this.projectInfo,
      { maxTokens },
      this.configManager.getFeedback(name),
    );
  }

  private stageHeader(step: number, total: number, icon: string, name: string, description: string): void {
    console.log(chalk.bold(`  ${icon} Step ${step}/${total}: ${name}`));
    console.log(chalk.dim(`  ${description}`));
  }

  private displayChecks(checks: ValidationCheck[]): void {
    for (const check of checks) {
      const icon = check.status === 'pass' ? chalk.green(ICON.pass)
        : check.status === 'fail' ? chalk.red(ICON.fail)
        : chalk.dim(ICON.skip);
      const msg = check.message ? chalk.dim(` — ${check.message.split('\n')[0]}`) : '';
      console.log(`  ${icon} ${check.name}${msg}`);
    }
  }

  private mergeFiles(existing: GeneratedFile[], updated: GeneratedFile[]): GeneratedFile[] {
    const map = new Map<string, GeneratedFile>();
    for (const f of existing) map.set(f.path, f);
    for (const f of updated) map.set(f.path, f); // Updated files override
    return Array.from(map.values());
  }

  private deduplicateFiles(files: GeneratedFile[]): GeneratedFile[] {
    const map = new Map<string, GeneratedFile>();
    for (const file of files) {
      map.set(file.path, file);
    }
    return Array.from(map.values());
  }

  private extractSetupSteps(plan: string): string[] {
    // Try to find setup steps in the plan
    const steps: string[] = [];
    const lines = plan.split('\n');
    let inSteps = false;

    for (const line of lines) {
      if (/setup|getting started|run/i.test(line) && /:/i.test(line)) {
        inSteps = true;
        continue;
      }
      if (inSteps && /^\s*[-\d]/.test(line)) {
        steps.push(line.trim().replace(/^[-\d.]+\s*/, ''));
      } else if (inSteps && line.trim() === '') {
        if (steps.length > 0) break;
      }
    }

    return steps;
  }

  private fmtTime(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private emptyResult(reason: string): PipelineResult {
    console.log(chalk.red(`  Pipeline aborted: ${reason}`));
    return {
      files: [],
      setupSteps: [],
      projectName: 'my-app',
      totalTokens: 0,
      totalDuration: 0,
      stagesCompleted: 0,
      validationPassed: false,
      fixIterations: 0,
    };
  }
}

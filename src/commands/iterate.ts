/**
 * dev-crew iterate "add dark mode"
 *
 * Reads the current project, asks AI for a surgical plan,
 * generates only the changed files, shows diffs, applies with confirmation.
 * Runs build validation after applying changes.
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { ProjectDetector } from '../core/project-detector.js';
import { AgentRegistry } from '../agents/registry.js';
import { ConfigManager } from '../core/config-manager.js';
import { ActionLayer } from '../core/action-layer.js';
import { Spinner } from '../utils/spinner.js';
import { Logger } from '../utils/logger.js';
import { MASTER_SYSTEM_PROMPT, FILE_OUTPUT_FORMAT } from '../core/prompt-engine.js';
import { parseOutput, formatFilesForPrompt } from '../core/output-parser.js';
import { Sandbox } from '../core/sandbox.js';
import type { GeneratedFile } from '../core/file-writer.js';

export async function iterateCommand(description: string, options: { dir?: string } = {}): Promise<void> {
  const logger = new Logger();
  const spinner = new Spinner();
  const actionLayer = new ActionLayer();

  if (!description) {
    logger.error('Usage: dev-crew iterate "add dark mode to the dashboard"');
    process.exit(1);
  }

  const projectDir = options.dir || process.cwd();

  console.log();
  console.log(chalk.bold.cyan('  Dev-Crew Iterate'));
  console.log(chalk.cyan('  ' + '='.repeat(50)));
  console.log(chalk.dim(`  "${description}"`));
  console.log();

  // Step 1: Read project
  spinner.start('  Reading project...');
  const detector = new ProjectDetector();
  const projectInfo = await detector.detect();

  const projectFiles = readProjectFiles(projectDir);
  spinner.stop();
  console.log(chalk.dim(`  Found ${projectFiles.length} files in project`));

  if (projectFiles.length === 0) {
    logger.error('No source files found. Run this from a project directory.');
    return;
  }

  // Step 2: Build project summary (token-efficient)
  const summary = buildProjectSummary(projectFiles, projectInfo);

  // Step 3: Ask AI for a plan
  spinner.start('  Planning changes...');

  const reg = new AgentRegistry();
  const configManager = new ConfigManager();
  const planAgent = reg.create('app-creator', projectInfo, { maxTokens: 4096 }, configManager.getFeedback('app-creator'));

  if (!planAgent) {
    spinner.stop();
    logger.error('Failed to create planning agent');
    return;
  }

  let plan: string;
  try {
    const planPrompt = `${MASTER_SYSTEM_PROMPT}

TASK: Plan the minimal changes needed to modify this existing project.

USER REQUEST: "${description}"

PROJECT SUMMARY:
${summary}

Respond with a brief plan in this format:

===PLAN===
CHANGES:
- MODIFY: path/to/file.ts — reason
- CREATE: path/to/new-file.ts — reason
- MODIFY: path/to/other.ts — reason

APPROACH: Brief description of the implementation strategy
===ENDPLAN===

RULES:
- Change the MINIMUM number of files needed
- Prefer modifying existing files over creating new ones
- Never suggest deleting files unless explicitly asked
- Be specific about which files and what changes`;

    const planResult = await planAgent.execute({ query: planPrompt, streaming: false });
    plan = planResult.raw;
    spinner.stop();

    // Display the plan
    console.log();
    console.log(chalk.bold('  Plan:'));
    const planLines = plan.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('MODIFY') || l.trim().startsWith('CREATE'));
    for (const line of planLines.slice(0, 10)) {
      const trimmed = line.trim().replace(/^-\s*/, '');
      if (trimmed.startsWith('MODIFY')) {
        console.log(chalk.yellow(`  \u{270F}  ${trimmed}`));
      } else if (trimmed.startsWith('CREATE')) {
        console.log(chalk.green(`  \u{2795} ${trimmed}`));
      } else {
        console.log(chalk.dim(`     ${trimmed}`));
      }
    }
    console.log();
  } catch (err) {
    spinner.stop();
    logger.error(`Planning failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  // Step 4: Confirm
  const proceed = await actionLayer.confirm('  Proceed with changes?');
  if (!proceed) {
    logger.info('Cancelled.');
    return;
  }

  // Step 5: Generate the actual changes
  console.log();
  spinner.start('  Generating changes...');

  const buildAgent = reg.create('app-creator', projectInfo, { maxTokens: 16384 }, configManager.getFeedback('app-creator'));
  if (!buildAgent) {
    spinner.stop();
    logger.error('Failed to create build agent');
    return;
  }

  try {
    // Send relevant files + plan + request
    const relevantFiles = selectRelevantFiles(projectFiles, plan, 15);
    const filesContext = relevantFiles
      .map(f => `===FILE path=${f.path}===\n${f.content}\n===ENDFILE===`)
      .join('\n\n');

    const buildPrompt = `${MASTER_SYSTEM_PROMPT}

TASK: Implement the following change to an existing project.

USER REQUEST: "${description}"

PLAN:
${plan}

CURRENT FILES:
${filesContext}

OUTPUT ONLY the files that need to change or be created.
Do NOT output unchanged files.

${FILE_OUTPUT_FORMAT}

CRITICAL: Keep changes minimal. Only modify what's needed for the request.`;

    const buildResult = await buildAgent.execute({ query: buildPrompt, streaming: false });
    const parsed = parseOutput(buildResult.raw);
    spinner.stop();

    if (parsed.files.length === 0) {
      logger.error('AI returned no file changes.');
      return;
    }

    // Step 6: Show diffs
    console.log();
    console.log(chalk.bold.cyan('  Changes'));
    console.log(chalk.cyan('  ' + '-'.repeat(40)));

    for (const file of parsed.files) {
      const existingPath = path.join(projectDir, file.path);
      const exists = fs.existsSync(existingPath);

      if (exists) {
        const oldContent = fs.readFileSync(existingPath, 'utf-8');
        const oldLines = oldContent.split('\n').length;
        const newLines = file.content.split('\n').length;
        const diff = newLines - oldLines;
        const diffStr = diff >= 0 ? chalk.green(`+${diff}`) : chalk.red(`${diff}`);
        console.log(chalk.yellow(`  \u{270F}  ${file.path}`) + chalk.dim(` (${diffStr} lines)`));
      } else {
        const lines = file.content.split('\n').length;
        console.log(chalk.green(`  \u{2795} ${file.path}`) + chalk.dim(` (${lines} lines)`));
      }
    }

    console.log();
    console.log(chalk.dim(`  ${parsed.files.length} file(s) will be ${parsed.files.some(f => !fs.existsSync(path.join(projectDir, f.path))) ? 'created/modified' : 'modified'}`));

    // Step 7: Confirm apply
    const apply = await actionLayer.confirm('\n  Apply changes?');
    if (!apply) {
      logger.info('Cancelled. No files changed.');
      return;
    }

    // Step 8: Write files
    let written = 0;
    for (const file of parsed.files) {
      const fullPath = path.join(projectDir, file.path);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf-8');
      written++;
    }

    console.log(chalk.green(`  \u{2714} ${written} file(s) updated`));

    // Step 9: Validate
    spinner.start('  Validating build...');
    const sandbox = new Sandbox();
    try {
      // Copy the whole project to sandbox for validation
      const allProjectFiles = readProjectFiles(projectDir);
      sandbox.writeFiles(allProjectFiles);
      const validation = sandbox.validate();
      spinner.stop();

      for (const check of validation.checks) {
        const icon = check.status === 'pass' ? chalk.green('\u{2714}')
          : check.status === 'fail' ? chalk.red('\u{2716}')
          : chalk.dim('\u{23ED}');
        console.log(`  ${icon} ${check.name}`);
      }

      if (!validation.success) {
        console.log(chalk.yellow('\n  Build has issues. You may need to fix manually.'));
      }
    } finally {
      sandbox.cleanup();
    }

    // Summary
    console.log();
    console.log(chalk.bold.cyan('  Done!'));
    console.log(chalk.dim(`  ${written} files changed for: "${description}"`));
    console.log();

  } catch (err) {
    spinner.stop();
    logger.error(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Helpers ──────────────────────────────────────

function readProjectFiles(dir: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.dev-crew-temp', 'coverage']);
  const maxFiles = 200;
  const maxFileSize = 50000; // 50KB per file

  function walk(currentDir: string, relative: string) {
    if (files.length >= maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      if (ignoreDirs.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = relative ? `${relative}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > maxFileSize) continue;
          if (isBinaryFile(entry.name)) continue;

          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({ path: relPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  walk(dir, '');
  return files;
}

function isBinaryFile(name: string): boolean {
  const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.tar', '.gz', '.lock']);
  const ext = path.extname(name).toLowerCase();
  return binaryExts.has(ext);
}

function buildProjectSummary(files: GeneratedFile[], projectInfo: any): string {
  const lines: string[] = [];
  lines.push(`Project: ${projectInfo.framework || projectInfo.language || 'Unknown'}`);
  if (projectInfo.database?.length) lines.push(`Database: ${projectInfo.database.join(', ')}`);
  if (projectInfo.orm) lines.push(`ORM: ${projectInfo.orm}`);
  lines.push('');
  lines.push('Files:');

  for (const file of files) {
    const lineCount = file.content.split('\n').length;
    lines.push(`  ${file.path} (${lineCount} lines)`);
  }

  // Include key file contents (package.json, main entry, etc.)
  const keyFiles = ['package.json', 'tsconfig.json'];
  for (const keyFile of keyFiles) {
    const f = files.find(ff => ff.path === keyFile);
    if (f) {
      lines.push(`\n--- ${f.path} ---`);
      lines.push(f.content.slice(0, 2000));
    }
  }

  return lines.join('\n');
}

function selectRelevantFiles(files: GeneratedFile[], plan: string, max: number): GeneratedFile[] {
  const planLower = plan.toLowerCase();

  // Score each file by relevance to the plan
  const scored = files.map(f => {
    let score = 0;
    const pathLower = f.path.toLowerCase();

    // Direct mention in plan
    if (planLower.includes(pathLower) || planLower.includes(path.basename(f.path).toLowerCase())) {
      score += 10;
    }

    // Key files always included
    if (f.path === 'package.json' || f.path === 'tsconfig.json') {
      score += 5;
    }

    // Source files more relevant than config
    if (f.path.startsWith('src/') || f.path.startsWith('app/') || f.path.startsWith('pages/')) {
      score += 2;
    }

    // Component/page files if UI change mentioned
    if ((planLower.includes('ui') || planLower.includes('component') || planLower.includes('page') || planLower.includes('button') || planLower.includes('dark') || planLower.includes('theme')) &&
        (pathLower.includes('component') || pathLower.includes('page') || pathLower.includes('layout') || pathLower.includes('theme') || pathLower.includes('style'))) {
      score += 3;
    }

    // API/route files if backend change mentioned
    if ((planLower.includes('api') || planLower.includes('route') || planLower.includes('endpoint')) &&
        (pathLower.includes('api') || pathLower.includes('route') || pathLower.includes('controller'))) {
      score += 3;
    }

    return { file: f, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(s => s.file);
}

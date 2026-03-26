import fs from 'node:fs';
import path from 'node:path';

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

/**
 * Zero-AI instant project scan.
 * Runs code graph analysis + static checks without any AI provider.
 * This is the showcase command — shows what dev-crew can do locally.
 */
export async function scanCommand(targetPath?: string) {
  const dir = targetPath ? path.resolve(targetPath) : process.cwd();
  const start = Date.now();

  console.log();
  console.log(`  ${bold(cyan('Dev-Crew Project Scan'))} ${dim('— zero AI, pure analysis')}`);
  console.log(`  ${dim('─'.repeat(50))}`);
  console.log(`  ${dim('Target:')} ${dir}`);
  console.log();

  // ── 1. Detect project ──
  const { ProjectDetector } = await import('../core/project-detector.js');
  const detector = new ProjectDetector();
  const info = await detector.detect(dir);
  console.log(`  ${bold('Project')}  ${info.name || path.basename(dir)}`);
  console.log(`  ${dim('Language')} ${info.language}  ${dim('Framework')} ${info.framework || 'none'}`);
  console.log(`  ${dim('Test fw')}  ${info.testFramework || 'none'}`);
  console.log();

  // ── 2. Build code graph ──
  console.log(`  ${dim('Building code graph...')}`);
  const { CodeGraph } = await import('../core/code-graph.js');
  const graph = new CodeGraph();
  await graph.buildFromDirectory(dir);
  const stats = graph.getStats();
  console.log(`  ${bold(green('Code Graph'))}`);
  console.log(`    ${bold(String(stats.nodeCount))} symbols across ${bold(String(stats.fileCount))} files`);
  console.log(`    ${bold(String(stats.edgeCount))} connections mapped`);
  console.log(`    Languages: ${stats.languages.join(', ') || 'none detected'}`);
  console.log();

  // ── 3. Find top-connected files (hotspots) ──
  const hotspots = graph.getHotspots(5);
  if (hotspots.length > 0) {
    console.log(`  ${bold(yellow('Hotspot Files'))} ${dim('(most connections = highest blast radius)')}`);
    for (const h of hotspots) {
      const rel = path.relative(dir, h.file);
      console.log(`    ${bold(String(h.connections).padStart(3))} connections  ${rel}`);
    }
    console.log();
  }

  // ── 4. Static analysis ──
  const sourceFiles = collectSourceFiles(dir, 50);
  if (sourceFiles.length > 0) {
    const { StaticAnalyzer } = await import('../core/static-analyzer.js');
    const analyzer = new StaticAnalyzer();
    const allFindings = analyzer.analyze(sourceFiles);
    // Filter out node_modules noise
    const findings = allFindings.filter(f => !f.file.includes('node_modules'));
    const errors = findings.filter(f => f.type === 'error').length;
    const warnings = findings.filter(f => f.type === 'warning').length;
    const infos = findings.filter(f => f.type === 'info').length;

    if (findings.length > 0) {
      console.log(`  ${bold('Static Analysis')}`);
      if (errors > 0) console.log(`    ${red(`${errors} errors`)}`);
      if (warnings > 0) console.log(`    ${yellow(`${warnings} warnings`)}`);
      if (infos > 0) console.log(`    ${dim(`${infos} info`)}`);

      // Show top 5 findings
      const top = findings.slice(0, 5);
      for (const f of top) {
        const rel = path.relative(dir, f.file);
        const icon = f.type === 'error' ? red('✗') : f.type === 'warning' ? yellow('⚠') : dim('ℹ');
        const loc = f.line ? `:${f.line}` : '';
        console.log(`    ${icon} ${dim(`${rel}${loc}`)} ${f.message}`);
      }
      if (findings.length > 5) {
        console.log(`    ${dim(`... and ${findings.length - 5} more`)}`);
      }
      console.log();
    } else {
      console.log(`  ${bold(green('Static Analysis'))}  ${green('✓ No issues found')}`);
      console.log();
    }
  }

  // ── 5. Summary ──
  const elapsed = Date.now() - start;
  console.log(`  ${dim('─'.repeat(50))}`);
  console.log(`  ${dim(`Completed in ${elapsed}ms — no AI tokens used`)}`);
  console.log(`  ${dim('Run')} ${bold('dev-crew review <file>')} ${dim('for AI-powered deep analysis')}`);
  console.log();
}

function collectSourceFiles(dir: string, max: number): string[] {
  const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt']);
  const ignore = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor', 'target']);
  const files: string[] = [];

  function walk(d: string, depth: number) {
    if (depth > 4 || files.length >= max) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= max) break;
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) {
        if (!ignore.has(e.name)) walk(path.join(d, e.name), depth + 1);
      } else if (exts.has(path.extname(e.name))) {
        files.push(path.join(d, e.name));
      }
    }
  }
  walk(dir, 0);
  return files;
}

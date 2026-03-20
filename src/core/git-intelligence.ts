import { simpleGit, type SimpleGit } from 'simple-git';
import chalk from 'chalk';

interface Hotspot {
  file: string;
  changes: number;
  isHotspot: boolean;
}

interface CommitPattern {
  total: number;
  bugFixes: number;
  features: number;
  refactors: number;
  instabilityScore: number;
  contributors: string[];
  lastChanged: string;
}

interface TestCoverageInfo {
  codeChanges: number;
  testChanges: number;
  testRatio: number;
  coverageRisk: boolean;
}

interface GitReport {
  hotspots: Hotspot[];
  commitPattern: CommitPattern;
  testCoverage: TestCoverageInfo;
}

export class GitIntelligence {
  private git: SimpleGit;

  constructor(repoPath?: string) {
    this.git = simpleGit(repoPath || process.cwd());
  }

  async isRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch { return false; }
  }

  async getHotspots(filePath: string, days = 30): Promise<Hotspot[]> {
    try {
      const log = await this.git.log({ file: filePath, '--after': `${days} days ago` });
      const fileChanges: Record<string, number> = {};

      for (const commit of log.all.slice(0, 50)) {
        try {
          const diff = await this.git.diffSummary([`${commit.hash}^`, commit.hash]);
          for (const file of diff.files) {
            fileChanges[file.file] = (fileChanges[file.file] || 0) + 1;
          }
        } catch { /* skip merge commits etc */ }
      }

      return Object.entries(fileChanges)
        .map(([file, changes]) => ({ file, changes, isHotspot: changes > 5 }))
        .sort((a, b) => b.changes - a.changes);
    } catch { return []; }
  }

  async getCommitPatterns(filePath: string, count = 10): Promise<CommitPattern> {
    try {
      const log = await this.git.log({ file: filePath, maxCount: count });
      let bugFixes = 0, features = 0, refactors = 0;

      for (const commit of log.all) {
        const msg = commit.message.toLowerCase();
        if (msg.match(/\b(fix|bug|hotfix|patch|resolve)\b/)) bugFixes++;
        else if (msg.match(/\b(feat|add|implement|create|new)\b/)) features++;
        else if (msg.match(/\b(refactor|clean|improve|rename|move)\b/)) refactors++;
      }

      return {
        total: log.all.length,
        bugFixes,
        features,
        refactors,
        instabilityScore: bugFixes / Math.max(log.all.length, 1),
        contributors: [...new Set(log.all.map(c => c.author_name))],
        lastChanged: log.latest?.date || 'unknown',
      };
    } catch {
      return { total: 0, bugFixes: 0, features: 0, refactors: 0, instabilityScore: 0, contributors: [], lastChanged: 'unknown' };
    }
  }

  async getTestCoverage(filePath: string, commits = 5): Promise<TestCoverageInfo> {
    try {
      const log = await this.git.log({ file: filePath, maxCount: commits });
      let codeChanges = 0, testChanges = 0;

      for (const commit of log.all) {
        try {
          const diff = await this.git.diffSummary([`${commit.hash}^`, commit.hash]);
          for (const file of diff.files) {
            if (file.file.includes('.spec.') || file.file.includes('.test.')) testChanges++;
            else if (file.file.match(/\.(ts|js|tsx|jsx)$/)) codeChanges++;
          }
        } catch { /* skip */ }
      }

      return {
        codeChanges,
        testChanges,
        testRatio: testChanges / Math.max(codeChanges, 1),
        coverageRisk: testChanges === 0 && codeChanges > 3,
      };
    } catch {
      return { codeChanges: 0, testChanges: 0, testRatio: 0, coverageRisk: false };
    }
  }

  async getRecentChanges(filePath: string, count = 3): Promise<string> {
    try {
      const log = await this.git.log({ file: filePath, maxCount: count });
      const diffs: string[] = [];
      for (const commit of log.all.slice(0, count)) {
        try {
          const diff = await this.git.diff([`${commit.hash}^`, commit.hash, '--', filePath]);
          if (diff) diffs.push(`// Commit: ${commit.message}\n${diff.slice(0, 2000)}`);
        } catch { /* skip */ }
      }
      return diffs.join('\n\n');
    } catch { return ''; }
  }

  async getFullReport(filePath: string): Promise<GitReport> {
    const [hotspots, commitPattern, testCoverage] = await Promise.all([
      this.getHotspots(filePath),
      this.getCommitPatterns(filePath),
      this.getTestCoverage(filePath),
    ]);
    return { hotspots, commitPattern, testCoverage };
  }

  formatReport(report: GitReport, filePath: string): string {
    const lines: string[] = [chalk.bold.cyan('Git Intelligence:')];
    const cp = report.commitPattern;

    lines.push(`├── ${cp.total} commits in recent history`);
    lines.push(`├── ${cp.contributors.length} contributor${cp.contributors.length !== 1 ? 's' : ''} active`);

    if (cp.instabilityScore > 0.5) {
      lines.push(chalk.yellow(`├── ${cp.bugFixes}/${cp.total} recent changes were bug fixes (instability signal)`));
    }

    const hotspots = report.hotspots.filter(h => h.isHotspot);
    if (hotspots.length > 0) {
      lines.push(chalk.red(`├── Hotspot files: ${hotspots.map(h => h.file).join(', ')}`));
    }

    if (report.testCoverage.coverageRisk) {
      lines.push(chalk.yellow(`└── No tests changed in recent commits (coverage risk)`));
    } else {
      lines.push(`└── Test coverage ratio: ${report.testCoverage.testRatio.toFixed(1)}`);
    }

    return lines.join('\n');
  }
}

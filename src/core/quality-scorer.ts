import chalk from 'chalk';
import boxen from 'boxen';

interface QualityDimension {
  name: string;
  score: number; // 1-10
}

interface QualityReport {
  before: QualityDimension[];
  after: QualityDimension[];
  overallBefore: number;
  overallAfter: number;
  improvement: number;
}

export class QualityScorer {
  /**
   * Request a before/after quality score from Claude via the agent
   */
  buildQualityPromptSection(): string {
    return `
Also include a quality score comparison in your response JSON under the key "quality_score":
{
  "quality_score": {
    "before": {
      "security": 5,
      "performance": 6,
      "readability": 7,
      "testability": 4,
      "error_handling": 3
    },
    "after": {
      "security": 9,
      "performance": 8,
      "readability": 8,
      "testability": 7,
      "error_handling": 8
    }
  }
}
Score each dimension 1-10 based on the code before and after your suggested changes.`;
  }

  parseQualityScore(raw: any): QualityReport | null {
    if (!raw?.quality_score) return null;

    const qs = raw.quality_score;
    if (!qs.before || !qs.after) return null;

    const dims = ['security', 'performance', 'readability', 'testability', 'error_handling'];
    const before: QualityDimension[] = [];
    const after: QualityDimension[] = [];

    for (const dim of dims) {
      if (typeof qs.before[dim] === 'number' && typeof qs.after[dim] === 'number') {
        before.push({ name: dim, score: qs.before[dim] });
        after.push({ name: dim, score: qs.after[dim] });
      }
    }

    if (before.length === 0) return null;

    const overallBefore = Math.round(before.reduce((s, d) => s + d.score, 0) / before.length * 10) / 10;
    const overallAfter = Math.round(after.reduce((s, d) => s + d.score, 0) / after.length * 10) / 10;
    const improvement = overallAfter > 0 ? Math.round(((overallAfter - overallBefore) / overallBefore) * 100) : 0;

    return { before, after, overallBefore, overallAfter, improvement };
  }

  formatReport(report: QualityReport): string {
    const lines: string[] = [chalk.bold.cyan('Code Quality Impact'), ''];

    const pad = 18;
    lines.push(`${'BEFORE'.padEnd(pad)}AFTER`);

    for (let i = 0; i < report.before.length; i++) {
      const b = report.before[i];
      const a = report.after[i];
      const name = this.capitalize(b.name.replace('_', ' '));
      const arrow = a.score > b.score ? chalk.green('→') : a.score < b.score ? chalk.red('→') : '→';
      const bColor = b.score >= 7 ? 'green' : b.score >= 5 ? 'yellow' : 'red';
      const aColor = a.score >= 7 ? 'green' : a.score >= 5 ? 'yellow' : 'red';
      lines.push(
        `${name.padEnd(14)} ${chalk[bColor](`${b.score}/10`)}   ${arrow}    ${chalk[aColor](`${a.score}/10`)}`,
      );
    }

    lines.push('');
    const overallColor = report.overallAfter >= 7 ? 'green' : report.overallAfter >= 5 ? 'yellow' : 'red';
    lines.push(`${'Overall:'.padEnd(14)} ${report.overallBefore}/10   →    ${chalk[overallColor].bold(`${report.overallAfter}/10`)}`);
    lines.push('─'.repeat(42));

    if (report.improvement > 0) {
      lines.push(chalk.green.bold(`Quality improvement: +${report.improvement}%`));
    } else if (report.improvement < 0) {
      lines.push(chalk.red(`Quality change: ${report.improvement}%`));
    }

    return boxen(lines.join('\n'), { padding: 1, borderStyle: 'round', borderColor: 'green' });
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

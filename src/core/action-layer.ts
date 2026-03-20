import fs from 'node:fs';
import { execSync } from 'node:child_process';
import readline from 'node:readline';
import { formatDiff, colorizeDiff } from '../utils/diff-formatter.js';
import { Logger } from '../utils/logger.js';

export class ActionLayer {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async showAndApply(file: string, newContent: string): Promise<boolean> {
    const oldContent = fs.readFileSync(file, 'utf-8');

    const diff = formatDiff(oldContent, newContent, file);
    console.log(diff);

    const confirmed = await this.confirm('Apply this change?');

    if (confirmed) {
      const backupPath = `${file}.backup`;
      fs.writeFileSync(backupPath, oldContent);
      fs.writeFileSync(file, newContent);
      this.logger.success(`Applied. Backup at ${backupPath}`);
      return true;
    }

    this.logger.info('Skipped');
    return false;
  }

  async applyDiff(file: string, diffText: string): Promise<boolean> {
    console.log(colorizeDiff(diffText));

    const confirmed = await this.confirm('Apply this diff?');
    if (!confirmed) return false;

    const tmpDiff = `/tmp/dev-crew-${Date.now()}.patch`;
    fs.writeFileSync(tmpDiff, diffText);

    try {
      execSync(`git apply ${tmpDiff}`, { stdio: 'pipe' });
      fs.unlinkSync(tmpDiff);
      this.logger.success('Diff applied successfully');
      return true;
    } catch {
      this.logger.error('Failed to apply diff. Manual intervention needed.');
      try { fs.unlinkSync(tmpDiff); } catch { /* ignore */ }
      return false;
    }
  }

  confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/n) `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
}

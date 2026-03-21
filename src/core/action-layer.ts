import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    if (!fs.existsSync(file)) {
      this.logger.error(`File not found: ${file}`);
      return false;
    }
    const oldContent = fs.readFileSync(file, 'utf-8');
    const diff = formatDiff(oldContent, newContent, file);
    console.log(diff);

    const confirmed = await this.confirm('Apply this change?');

    if (confirmed) {
      // Timestamped backup to avoid overwriting previous backups
      const backupPath = `${file}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, oldContent);
      // Preserve original file mode
      const stat = fs.statSync(file);
      fs.writeFileSync(file, newContent, { mode: stat.mode });
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

    // Use OS temp dir (works on all platforms)
    const tmpDiff = path.join(os.tmpdir(), `dev-crew-${Date.now()}.patch`);
    fs.writeFileSync(tmpDiff, diffText);

    try {
      // Check we're in a git repo first
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
      execSync(`git apply ${tmpDiff}`, { stdio: 'pipe' });
      fs.unlinkSync(tmpDiff);
      this.logger.success('Diff applied successfully');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('not a git repository')) {
        this.logger.error('Not a git repository. Cannot apply diff with git apply.');
      } else {
        this.logger.error('Failed to apply diff. Manual intervention needed.');
      }
      try { fs.unlinkSync(tmpDiff); } catch { /* ignore */ }
      return false;
    }
  }

  confirm(message: string): Promise<boolean> {
    // Handle non-TTY gracefully (e.g., piped input)
    if (!process.stdin.isTTY) {
      return Promise.resolve(false);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/n) `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
      // Handle EOF (Ctrl+D)
      rl.on('close', () => resolve(false));
    });
  }
}

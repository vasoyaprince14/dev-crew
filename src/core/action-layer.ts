import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

    return new Promise((resolve) => {
      // Write prompt directly to stdout — avoids readline entirely
      // This prevents conflicts with Discovery's readline closing stdin
      process.stdout.write(`${message} (y/n) `);

      // Ensure stdin is in the right state for raw reading
      if (process.stdin.isPaused()) {
        process.stdin.resume();
      }
      const wasRaw = process.stdin.isRaw;
      process.stdin.setRawMode(true);
      process.stdin.setEncoding('utf8');

      const onData = (key: string) => {
        process.stdin.setRawMode(wasRaw ?? false);
        process.stdin.removeListener('data', onData);
        process.stdin.pause();

        const char = key.toLowerCase();
        // Echo the key and newline
        process.stdout.write(char + '\n');

        if (char === 'y') {
          resolve(true);
        } else if (char === '\x03') {
          // Ctrl+C
          resolve(false);
        } else {
          resolve(false);
        }
      };

      process.stdin.on('data', onData);
    });
  }
}

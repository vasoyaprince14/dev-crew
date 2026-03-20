import { spawn } from 'node:child_process';
import { TokenOptimizer } from './token-optimizer.js';
import { Logger } from '../utils/logger.js';
import type { ClaudeOptions, ClaudeResponse } from '../types/response.js';

export class ClaudeBridge {
  private optimizer: TokenOptimizer;
  private logger: Logger;

  constructor(verbose = false) {
    this.optimizer = new TokenOptimizer();
    this.logger = new Logger(verbose);
  }

  async verify(): Promise<boolean> {
    try {
      const result = await this.execute('claude', ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const result = await this.execute('claude', ['--version']);
      return result.stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  async send(prompt: string, options: ClaudeOptions = {}): Promise<ClaudeResponse> {
    const startTime = Date.now();

    const optimizedPrompt = this.optimizer.compress(prompt);

    const estimatedTokens = this.optimizer.estimate(optimizedPrompt);
    this.logger.debug(`Estimated input tokens: ${estimatedTokens}`);

    const args = this.buildArgs(options);

    return new Promise((resolve, reject) => {
      const proc = spawn('claude', [...args, optimizedPrompt], {
        timeout: options.timeout || 300_000,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        if (options.streaming && options.onStream) {
          options.onStream(chunk);
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code !== 0) {
          reject(new Error(`AI engine exited with code ${code}: ${stderr}`));
          return;
        }

        resolve({
          content: stdout.trim(),
          duration,
          tokensUsed: this.optimizer.estimate(stdout),
        });
      });

      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              'AI engine not found. Install the required backend first:\n' +
              '  npm install -g @anthropic-ai/claude-code',
            ),
          );
        } else {
          reject(err);
        }
      });
    });
  }

  async sendStructured<T>(prompt: string, options: ClaudeOptions = {}): Promise<T> {
    const wrappedPrompt = `${prompt}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no backticks. Just the JSON object.`;

    const response = await this.send(wrappedPrompt, options);

    let clean = response.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to extract JSON if there's extra text
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      clean = clean.slice(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(clean) as T;
  }

  private buildArgs(options: ClaudeOptions): string[] {
    const args = ['--print'];

    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt);
    }
    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat);
    }

    return args;
  }

  private execute(
    command: string,
    args: string[],
  ): Promise<{ exitCode: number; stdout: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      proc.stdout.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      proc.on('close', (code) => resolve({ exitCode: code || 0, stdout }));
      proc.on('error', () => resolve({ exitCode: 1, stdout: '' }));
    });
  }
}

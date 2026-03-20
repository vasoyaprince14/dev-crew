import { spawn, execSync } from 'node:child_process';
import { TokenOptimizer } from './token-optimizer.js';
import { Logger } from '../utils/logger.js';
import type { ClaudeOptions, ClaudeResponse } from '../types/response.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderStatus = 'available' | 'not-installed' | 'error';

export interface ProviderInfo {
  id: string;
  name: string;
  status: ProviderStatus;
  color: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  color: string;
  /** Command used to check installation (`<command> --version`). */
  command: string;
  /** Priority for auto-selection – lower is better. */
  priority: number;
  /** Build the CLI args for a prompt + options. */
  buildArgs: (prompt: string, options: ClaudeOptions) => string[];
}

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    color: '#d97706',
    command: 'claude',
    priority: 1,
    buildArgs(prompt, options) {
      const args = ['--print'];
      if (options.systemPrompt) args.push('--system-prompt', options.systemPrompt);
      if (options.outputFormat) args.push('--output-format', options.outputFormat);
      args.push(prompt);
      return args;
    },
  },
  {
    id: 'aider',
    name: 'Aider',
    color: '#10b981',
    command: 'aider',
    priority: 2,
    buildArgs(prompt, options) {
      const args = ['--message', prompt, '--no-git', '--yes'];
      if (options.systemPrompt) args.push('--system-prompt', options.systemPrompt);
      return args;
    },
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    color: '#6366f1',
    command: 'gh',
    priority: 3,
    buildArgs(prompt, _options) {
      // `gh copilot suggest` is the closest non-interactive path
      return ['copilot', 'suggest', '-t', 'shell', prompt];
    },
  },
  {
    id: 'openai',
    name: 'OpenAI CLI',
    color: '#ef4444',
    command: 'openai',
    priority: 4,
    buildArgs(prompt, options) {
      const args = ['api', 'chat_completions.create', '-m', 'gpt-4o', '-g', 'user', prompt];
      if (options.maxTokens) args.push('--max-tokens', String(options.maxTokens));
      return args;
    },
  },
  {
    id: 'ollama',
    name: 'Ollama',
    color: '#8b5cf6',
    command: 'ollama',
    priority: 5,
    buildArgs(prompt, options) {
      const args = ['run', 'llama3'];
      if (options.systemPrompt) args.push('--system', options.systemPrompt);
      args.push(prompt);
      return args;
    },
  },
];

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

const SIMULATION_PROVIDER: ProviderInfo = {
  id: 'simulation',
  name: 'Simulation Mode',
  status: 'available',
  color: '#94a3b8',
};

function generateSimulationResponse(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes('review')) {
    return JSON.stringify({
      summary: 'Code review complete (simulated)',
      issues: [
        { severity: 'warning', message: 'Consider adding error handling for edge cases', line: 12 },
        { severity: 'info', message: 'Function could benefit from JSDoc comments', line: 5 },
      ],
      score: 8,
      suggestions: [
        'Add unit tests for the new helper function',
        'Extract repeated logic into a shared utility',
      ],
    }, null, 2);
  }

  if (lower.includes('debug')) {
    return JSON.stringify({
      diagnosis: 'Potential null reference detected (simulated)',
      rootCause: 'The variable may be undefined when accessed outside the conditional block',
      suggestedFix: 'Add a null check before accessing the property',
      confidence: 0.85,
    }, null, 2);
  }

  if (lower.includes('test')) {
    return JSON.stringify({
      tests: [
        { name: 'should handle valid input', type: 'unit', status: 'generated' },
        { name: 'should throw on invalid input', type: 'unit', status: 'generated' },
        { name: 'should handle edge cases', type: 'unit', status: 'generated' },
      ],
      framework: 'vitest',
      coverage: '3 test cases generated',
    }, null, 2);
  }

  if (lower.includes('refactor')) {
    return JSON.stringify({
      suggestions: [
        'Extract method: move lines 10-25 into a dedicated helper',
        'Replace magic number with named constant',
        'Simplify nested conditionals using early returns',
      ],
      estimatedImpact: 'Improved readability and maintainability',
    }, null, 2);
  }

  if (lower.includes('explain') || lower.includes('document')) {
    return JSON.stringify({
      explanation: 'This module handles request routing and middleware composition (simulated)',
      keyComponents: [
        'Router – maps URL patterns to handler functions',
        'Middleware chain – processes requests through a pipeline',
        'Error boundary – catches and formats unhandled exceptions',
      ],
    }, null, 2);
  }

  // Generic fallback
  return JSON.stringify({
    response: 'Simulated AI response',
    note: 'No real AI provider is installed. Install one of: claude, aider, gh copilot, openai, ollama',
    prompt_received: prompt.slice(0, 120),
  }, null, 2);
}

// ---------------------------------------------------------------------------
// ProviderBridge
// ---------------------------------------------------------------------------

export class ProviderBridge {
  private optimizer: TokenOptimizer;
  private logger: Logger;
  private currentProvider: ProviderConfig | null = null;
  private useSimulation = false;

  constructor(verbose = false) {
    this.optimizer = new TokenOptimizer();
    this.logger = new Logger(verbose);
  }

  // -----------------------------------------------------------------------
  // Detection
  // -----------------------------------------------------------------------

  /**
   * Probe every known provider by running `<command> --version` and return
   * their availability status.
   */
  async detectProviders(): Promise<ProviderInfo[]> {
    const results: ProviderInfo[] = [];

    for (const provider of PROVIDERS) {
      const status = await this.checkInstalled(provider.command);
      results.push({
        id: provider.id,
        name: provider.name,
        status,
        color: provider.color,
      });
    }

    // Simulation is always available
    results.push({ ...SIMULATION_PROVIDER });

    return results;
  }

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  /**
   * Auto-select the best available provider by priority.
   * Falls back to simulation mode if nothing is installed.
   */
  async autoSelect(): Promise<ProviderInfo> {
    const sorted = [...PROVIDERS].sort((a, b) => a.priority - b.priority);

    for (const provider of sorted) {
      const status = await this.checkInstalled(provider.command);
      if (status === 'available') {
        this.currentProvider = provider;
        this.useSimulation = false;
        this.logger.debug(`Auto-selected provider: ${provider.name}`);
        return {
          id: provider.id,
          name: provider.name,
          status: 'available',
          color: provider.color,
        };
      }
    }

    // Nothing installed – fall back to simulation
    this.currentProvider = null;
    this.useSimulation = true;
    this.logger.debug('No AI providers found – using simulation mode');
    return { ...SIMULATION_PROVIDER };
  }

  /**
   * Manually switch to a specific provider by id.
   * Use `"simulation"` to force simulation mode.
   */
  async setProvider(id: string): Promise<ProviderInfo> {
    if (id === 'simulation') {
      this.currentProvider = null;
      this.useSimulation = true;
      return { ...SIMULATION_PROVIDER };
    }

    const provider = PROVIDERS.find((p) => p.id === id);
    if (!provider) {
      throw new Error(
        `Unknown provider "${id}". Available: ${PROVIDERS.map((p) => p.id).join(', ')}, simulation`,
      );
    }

    const status = await this.checkInstalled(provider.command);
    if (status !== 'available') {
      throw new Error(
        `Provider "${provider.name}" is not available (${status}). Install it first or choose another provider.`,
      );
    }

    this.currentProvider = provider;
    this.useSimulation = false;
    return {
      id: provider.id,
      name: provider.name,
      status: 'available',
      color: provider.color,
    };
  }

  // -----------------------------------------------------------------------
  // Info
  // -----------------------------------------------------------------------

  /**
   * Return information about the currently selected provider.
   */
  getProviderInfo(): ProviderInfo {
    if (this.useSimulation || !this.currentProvider) {
      return { ...SIMULATION_PROVIDER };
    }
    return {
      id: this.currentProvider.id,
      name: this.currentProvider.name,
      status: 'available',
      color: this.currentProvider.color,
    };
  }

  // -----------------------------------------------------------------------
  // Verify / Version  (mirrors ClaudeBridge API)
  // -----------------------------------------------------------------------

  async verify(): Promise<boolean> {
    if (this.useSimulation) return true;
    if (!this.currentProvider) return false;

    try {
      const result = await this.execute(this.currentProvider.command, ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    if (this.useSimulation) return 'simulation-1.0.0';
    if (!this.currentProvider) return 'unknown';

    try {
      const result = await this.execute(this.currentProvider.command, ['--version']);
      return result.stdout.trim() || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // -----------------------------------------------------------------------
  // Send  (mirrors ClaudeBridge.send)
  // -----------------------------------------------------------------------

  async send(prompt: string, options: ClaudeOptions = {}): Promise<ClaudeResponse> {
    // ----- simulation path -----
    if (this.useSimulation || !this.currentProvider) {
      return this.simulatedSend(prompt);
    }

    // ----- real provider path -----
    const startTime = Date.now();
    const optimizedPrompt = this.optimizer.compress(prompt);
    const estimatedTokens = this.optimizer.estimate(optimizedPrompt);
    this.logger.debug(
      `[${this.currentProvider.name}] Estimated input tokens: ${estimatedTokens}`,
    );

    const args = this.currentProvider.buildArgs(optimizedPrompt, options);
    const command = this.currentProvider.command;

    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        timeout: options.timeout || 300_000,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Close stdin immediately so the AI process knows no more input is coming
      proc.stdin.end();

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
          reject(
            new Error(`AI provider "${this.currentProvider!.name}" exited with code ${code}: ${stderr}`),
          );
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
              `AI provider "${this.currentProvider!.name}" not found. ` +
              `Ensure "${command}" is installed and on your PATH.`,
            ),
          );
        } else {
          reject(err);
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private simulatedSend(prompt: string): Promise<ClaudeResponse> {
    const startTime = Date.now();
    // Add a tiny async delay to mimic real latency
    return new Promise((resolve) => {
      const content = generateSimulationResponse(prompt);
      const duration = Date.now() - startTime;
      resolve({
        content,
        duration,
        tokensUsed: this.optimizer.estimate(content),
      });
    });
  }

  private async checkInstalled(command: string): Promise<ProviderStatus> {
    try {
      execSync(`${command} --version`, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5_000,
      });
      return 'available';
    } catch {
      return 'not-installed';
    }
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

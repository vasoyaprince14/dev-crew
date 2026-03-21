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
// CLI-based provider definitions (subprocess spawning)
// ---------------------------------------------------------------------------

const CLI_PROVIDERS: ProviderConfig[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    color: '#d97706',
    command: 'claude',
    priority: 2,
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
    priority: 3,
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
    priority: 4,
    buildArgs(prompt, _options) {
      return ['copilot', 'suggest', '-t', 'shell', prompt];
    },
  },
  {
    id: 'openai',
    name: 'OpenAI CLI',
    color: '#ef4444',
    command: 'openai',
    priority: 5,
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
    priority: 6,
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

  return JSON.stringify({
    response: 'Simulated AI response',
    note: 'No real AI provider is installed. Set ANTHROPIC_API_KEY or install: claude, aider, gh copilot, openai, ollama',
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
  private useDirectAPI = false;
  private anthropicClient: any = null; // Lazy-loaded Anthropic SDK

  constructor(verbose = false) {
    this.optimizer = new TokenOptimizer();
    this.logger = new Logger(verbose);
  }

  // -----------------------------------------------------------------------
  // Detection
  // -----------------------------------------------------------------------

  async detectProviders(): Promise<ProviderInfo[]> {
    const results: ProviderInfo[] = [];

    // Check direct API first
    const apiStatus = this.hasAnthropicKey() ? 'available' as const : 'not-installed' as const;
    results.push({
      id: 'claude-api',
      name: 'Claude API (Direct)',
      status: apiStatus,
      color: '#d97706',
    });

    for (const provider of CLI_PROVIDERS) {
      const status = await this.checkInstalled(provider.command);
      results.push({
        id: provider.id,
        name: provider.name,
        status,
        color: provider.color,
      });
    }

    results.push({ ...SIMULATION_PROVIDER });
    return results;
  }

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  async autoSelect(): Promise<ProviderInfo> {
    // Priority 1: Direct Claude API (if ANTHROPIC_API_KEY is set)
    if (this.hasAnthropicKey()) {
      this.useDirectAPI = true;
      this.useSimulation = false;
      this.currentProvider = null;
      this.logger.debug('Auto-selected provider: Claude API (Direct)');
      return {
        id: 'claude-api',
        name: 'Claude API (Direct)',
        status: 'available',
        color: '#d97706',
      };
    }

    // Priority 2+: CLI providers
    const sorted = [...CLI_PROVIDERS].sort((a, b) => a.priority - b.priority);
    for (const provider of sorted) {
      const status = await this.checkInstalled(provider.command);
      if (status === 'available') {
        this.currentProvider = provider;
        this.useSimulation = false;
        this.useDirectAPI = false;
        this.logger.debug(`Auto-selected provider: ${provider.name}`);
        return {
          id: provider.id,
          name: provider.name,
          status: 'available',
          color: provider.color,
        };
      }
    }

    // Fallback: simulation
    this.currentProvider = null;
    this.useSimulation = true;
    this.useDirectAPI = false;
    this.logger.debug('No AI providers found – using simulation mode');
    return { ...SIMULATION_PROVIDER };
  }

  async setProvider(id: string): Promise<ProviderInfo> {
    if (id === 'simulation') {
      this.currentProvider = null;
      this.useSimulation = true;
      this.useDirectAPI = false;
      return { ...SIMULATION_PROVIDER };
    }

    if (id === 'claude-api') {
      if (!this.hasAnthropicKey()) {
        throw new Error(
          'ANTHROPIC_API_KEY not set. Get one at https://console.anthropic.com/settings/keys',
        );
      }
      this.useDirectAPI = true;
      this.useSimulation = false;
      this.currentProvider = null;
      return {
        id: 'claude-api',
        name: 'Claude API (Direct)',
        status: 'available',
        color: '#d97706',
      };
    }

    const provider = CLI_PROVIDERS.find((p) => p.id === id);
    if (!provider) {
      throw new Error(
        `Unknown provider "${id}". Available: claude-api, ${CLI_PROVIDERS.map((p) => p.id).join(', ')}, simulation`,
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
    this.useDirectAPI = false;
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

  getProviderInfo(): ProviderInfo {
    if (this.useDirectAPI) {
      return { id: 'claude-api', name: 'Claude API (Direct)', status: 'available', color: '#d97706' };
    }
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
  // Verify / Version
  // -----------------------------------------------------------------------

  async verify(): Promise<boolean> {
    if (this.useDirectAPI) {
      return this.hasAnthropicKey();
    }
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
    if (this.useDirectAPI) return 'claude-api-direct';
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
  // Send
  // -----------------------------------------------------------------------

  async send(prompt: string, options: ClaudeOptions = {}): Promise<ClaudeResponse> {
    // Direct API path (best — no subprocess overhead, real streaming, real token counts)
    if (this.useDirectAPI) {
      return this.sendDirectAPI(prompt, options);
    }

    // Simulation path
    if (this.useSimulation || !this.currentProvider) {
      return this.simulatedSend(prompt);
    }

    // CLI subprocess path
    return this.sendCLI(prompt, options);
  }

  // -----------------------------------------------------------------------
  // Direct Anthropic API
  // -----------------------------------------------------------------------

  private async getAnthropicClient(): Promise<any> {
    if (this.anthropicClient) return this.anthropicClient;
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    this.anthropicClient = new Anthropic();
    return this.anthropicClient;
  }

  private async sendDirectAPI(prompt: string, options: ClaudeOptions): Promise<ClaudeResponse> {
    const startTime = Date.now();
    const client = await this.getAnthropicClient();

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    const maxTokens = options.maxTokens || 4096;

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: prompt },
    ];

    // Streaming path — real token-by-token streaming from Claude API
    if (options.streaming && options.onStream) {
      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const stream = await client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: options.systemPrompt || undefined,
        messages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          content += event.delta.text;
          try { options.onStream(event.delta.text); } catch { /* callback error */ }
        }
        if (event.type === 'message_delta' && (event as any).usage) {
          outputTokens = (event as any).usage.output_tokens || 0;
        }
      }

      // Get final message for accurate token counts
      const finalMessage = await stream.finalMessage();
      inputTokens = finalMessage.usage?.input_tokens || 0;
      outputTokens = finalMessage.usage?.output_tokens || 0;

      return {
        content: content.trim(),
        duration: Date.now() - startTime,
        tokensUsed: inputTokens + outputTokens,
      };
    }

    // Non-streaming path
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: options.systemPrompt || undefined,
      messages,
    });

    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    return {
      content: content.trim(),
      duration: Date.now() - startTime,
      tokensUsed,
    };
  }

  // -----------------------------------------------------------------------
  // CLI subprocess path
  // -----------------------------------------------------------------------

  private sendCLI(prompt: string, options: ClaudeOptions): Promise<ClaudeResponse> {
    const startTime = Date.now();
    const optimizedPrompt = this.optimizer.compress(prompt);
    const estimatedTokens = this.optimizer.estimate(optimizedPrompt);
    this.logger.debug(
      `[${this.currentProvider!.name}] Estimated input tokens: ${estimatedTokens}`,
    );

    const args = this.currentProvider!.buildArgs(optimizedPrompt, options);
    const command = this.currentProvider!.command;
    const timeoutMs = options.timeout || 120_000;
    const providerName = this.currentProvider!.name;

    return new Promise((resolve, reject) => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const proc = spawn(command, args, {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stdin.end();

      let stdout = '';
      let stderr = '';

      timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true;
          try { proc.kill('SIGTERM'); } catch { /* already dead */ }
          setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, 5000);
          reject(new Error(`AI provider "${providerName}" timed out after ${Math.round(timeoutMs / 1000)}s`));
        }
      }, timeoutMs);

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8');
        stdout += chunk;
        if (options.streaming && options.onStream) {
          try { options.onStream(chunk); } catch { /* callback error, ignore */ }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      proc.on('close', (code) => {
        if (finished) return;
        finished = true;
        if (timeoutId) clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (code !== 0) {
          const errMsg = stderr.trim().slice(0, 500);
          reject(
            new Error(`AI provider "${providerName}" exited with code ${code}${errMsg ? ': ' + errMsg : ''}`),
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
        if (finished) return;
        finished = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              `AI provider "${providerName}" not found. ` +
              `Ensure "${command}" is installed and on your PATH.`,
            ),
          );
        } else {
          reject(new Error(`AI provider "${providerName}" error: ${err.message}`));
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private hasAnthropicKey(): boolean {
    return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10);
  }

  private simulatedSend(prompt: string): Promise<ClaudeResponse> {
    const startTime = Date.now();
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

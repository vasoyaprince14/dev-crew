import { spawn, execSync } from 'node:child_process';
import { TokenOptimizer } from './token-optimizer.js';
import { Logger } from '../utils/logger.js';
import { ProviderError } from '../utils/errors.js';
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
  command: string;
  priority: number;
  buildArgs: (prompt: string, options: ClaudeOptions) => string[];
}

// ---------------------------------------------------------------------------
// CLI-based provider definitions
// Dev-Crew works ON TOP of these tools — no extra API keys needed.
// ---------------------------------------------------------------------------

const CLI_PROVIDERS: ProviderConfig[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    color: '#d97706',
    command: 'claude',
    priority: 1, // Default — users already have this
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

  const simFields = {
    _simulation_notice: '[SIMULATION] This is example data, not real AI analysis. Run \'dev-crew doctor\' for setup instructions.',
    simulated: true,
    _install_help: "Run 'dev-crew doctor' for setup instructions",
  };

  if (lower.includes('review')) {
    return JSON.stringify({
      ...simFields,
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
      ...simFields,
      diagnosis: 'Potential null reference detected (simulated)',
      rootCause: 'The variable may be undefined when accessed outside the conditional block',
      suggestedFix: 'Add a null check before accessing the property',
      confidence: 0.85,
    }, null, 2);
  }

  if (lower.includes('test')) {
    return JSON.stringify({
      ...simFields,
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
      ...simFields,
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
      ...simFields,
      explanation: 'This module handles request routing and middleware composition (simulated)',
      keyComponents: [
        'Router – maps URL patterns to handler functions',
        'Middleware chain – processes requests through a pipeline',
        'Error boundary – catches and formats unhandled exceptions',
      ],
    }, null, 2);
  }

  return JSON.stringify({
    ...simFields,
    response: 'Simulated AI response',
    note: 'Install Claude Code, Aider, Ollama, or another AI provider to get real responses.',
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
  private anthropicClient: any = null;

  constructor(verbose = false) {
    this.optimizer = new TokenOptimizer();
    this.logger = new Logger(verbose);
  }

  // -----------------------------------------------------------------------
  // Detection
  // -----------------------------------------------------------------------

  async detectProviders(): Promise<ProviderInfo[]> {
    const results: ProviderInfo[] = [];

    // CLI providers first (no extra setup needed)
    for (const provider of CLI_PROVIDERS) {
      const status = await this.checkInstalled(provider.command);
      results.push({
        id: provider.id,
        name: provider.name,
        status,
        color: provider.color,
      });
    }

    // Direct API — optional upgrade for power users
    const apiAvailable = this.hasAnthropicKey() && await this.hasAnthropicSDK();
    results.push({
      id: 'claude-api',
      name: 'Claude API (Direct)',
      status: apiAvailable ? 'available' : 'not-installed',
      color: '#d97706',
    });

    results.push({ ...SIMULATION_PROVIDER });
    return results;
  }

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  async autoSelect(): Promise<ProviderInfo> {
    // Priority 1: CLI providers (Claude Code first — no extra setup for user)
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

    // Priority 2: Direct API (if user has API key + SDK installed)
    if (this.hasAnthropicKey() && await this.hasAnthropicSDK()) {
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
          'ANTHROPIC_API_KEY not set. This is optional — Dev-Crew works on top of Claude Code by default.',
        );
      }
      if (!await this.hasAnthropicSDK()) {
        throw new Error(
          'Anthropic SDK not installed. Run: npm install -g @anthropic-ai/sdk',
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
        `Unknown provider "${id}". Available: ${CLI_PROVIDERS.map((p) => p.id).join(', ')}, claude-api, simulation`,
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

  isSimulation(): boolean {
    return this.useSimulation;
  }

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
    if (this.useDirectAPI) return this.hasAnthropicKey();
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
    // Direct API (optional power-user path)
    if (this.useDirectAPI) {
      return this.sendDirectAPI(prompt, options);
    }

    // Simulation path
    if (this.useSimulation || !this.currentProvider) {
      return this.simulatedSend(prompt);
    }

    // Default: CLI subprocess (works on top of Claude Code, etc.)
    return this.sendCLI(prompt, options);
  }

  // -----------------------------------------------------------------------
  // Direct Anthropic API (optional — only when user has API key + SDK)
  // -----------------------------------------------------------------------

  private async sendDirectAPI(prompt: string, options: ClaudeOptions): Promise<ClaudeResponse> {
    const startTime = Date.now();

    let client: any;
    try {
      client = await this.getAnthropicClient();
    } catch {
      // SDK not available — fall back to CLI or simulation
      this.useDirectAPI = false;
      this.logger.debug('Anthropic SDK not available, falling back');
      return this.send(prompt, options);
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    const maxTokens = options.maxTokens || 4096;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: prompt },
    ];

    try {
      // Streaming path
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
        }

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
    } catch (err: any) {
      // API errors — give helpful messages
      const msg = err?.message || String(err);
      if (msg.includes('401') || msg.includes('authentication')) {
        throw new ProviderError('Invalid ANTHROPIC_API_KEY', 'Check your key at console.anthropic.com');
      }
      if (msg.includes('429') || msg.includes('rate')) {
        throw new ProviderError('Rate limited by Claude API', 'Wait a moment and try again.');
      }
      if (msg.includes('529') || msg.includes('overloaded')) {
        throw new ProviderError('Claude API is overloaded', 'Try again in a few seconds.');
      }
      throw new ProviderError(`Claude API error: ${msg.slice(0, 200)}`);
    }
  }

  private async getAnthropicClient(): Promise<any> {
    if (this.anthropicClient) return this.anthropicClient;
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    this.anthropicClient = new Anthropic();
    return this.anthropicClient;
  }

  // -----------------------------------------------------------------------
  // CLI subprocess path (default — works on top of Claude Code, etc.)
  // -----------------------------------------------------------------------

  private sendCLI(prompt: string, options: ClaudeOptions): Promise<ClaudeResponse> {
    const startTime = Date.now();
    const optimizedPrompt = this.optimizer.compress(prompt);
    const estimatedTokens = this.optimizer.estimate(optimizedPrompt);
    this.logger.debug(
      `[${this.currentProvider!.name}] Estimated input tokens: ${estimatedTokens}`,
    );

    const command = this.currentProvider!.command;
    const providerName = this.currentProvider!.name;

    // Scale timeout based on prompt size — larger prompts need more time
    // Base: 120s for small prompts, up to 300s for large ones
    const baseTimeout = options.timeout || 120_000;
    const tokenScale = Math.min(estimatedTokens / 2000, 1.5); // up to 1.5x for large prompts
    const timeoutMs = Math.round(baseTimeout + (baseTimeout * tokenScale));

    // For claude --print: pipe prompt via stdin instead of CLI args to avoid arg length limits
    const isClaudeCode = command === 'claude';
    let args: string[];
    let stdinPrompt: string | null = null;

    if (isClaudeCode) {
      // Build args WITHOUT the prompt — we'll pipe it via stdin
      args = ['--print'];
      if (options.systemPrompt) args.push('--system-prompt', options.systemPrompt);
      if (options.outputFormat) args.push('--output-format', options.outputFormat);
      stdinPrompt = optimizedPrompt;
    } else {
      args = this.currentProvider!.buildArgs(optimizedPrompt, options);
    }

    return new Promise((resolve, reject) => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const proc = spawn(command, args, {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Pipe prompt via stdin for Claude Code (avoids CLI arg length limits)
      if (stdinPrompt) {
        proc.stdin.write(stdinPrompt);
        proc.stdin.end();
      } else {
        proc.stdin.end();
      }

      let stdout = '';
      let stderr = '';

      timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true;
          try { proc.kill('SIGTERM'); } catch { /* already dead */ }
          setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, 5000);
          reject(new Error(`AI provider "${providerName}" timed out after ${Math.round(timeoutMs / 1000)}s. Try a simpler query or fewer files.`));
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

  private async hasAnthropicSDK(): Promise<boolean> {
    try {
      await import('@anthropic-ai/sdk');
      return true;
    } catch {
      return false;
    }
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
        simulated: true,
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

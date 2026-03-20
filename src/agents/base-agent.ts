import { ClaudeBridge } from '../core/claude-bridge.js';
import { ContextEngine } from '../core/context-engine.js';
import { TokenOptimizer } from '../core/token-optimizer.js';
import { ResponseParser } from '../core/response-parser.js';
import type { AgentConfig, AgentInput, AgentResult, ParsedResponse } from '../types/agent.js';
import type { ProjectInfo } from '../types/config.js';
import { Logger } from '../utils/logger.js';

export abstract class BaseAgent {
  protected bridge: ClaudeBridge;
  protected context: ContextEngine;
  protected optimizer: TokenOptimizer;
  protected parser: ResponseParser;
  protected config: AgentConfig;
  protected projectInfo: ProjectInfo;
  protected logger: Logger;
  protected feedback: string[];

  constructor(config: AgentConfig, projectInfo: ProjectInfo, feedback: string[] = []) {
    this.bridge = new ClaudeBridge();
    this.context = new ContextEngine();
    this.optimizer = new TokenOptimizer();
    this.parser = new ResponseParser();
    this.config = config;
    this.projectInfo = projectInfo;
    this.logger = new Logger();
    this.feedback = feedback;
  }

  abstract getSystemPrompt(): string;
  abstract buildPrompt(input: AgentInput): string;
  abstract parseResponse(raw: string): ParsedResponse;

  async execute(input: AgentInput): Promise<AgentResult> {
    // 1. Gather context
    const contextData = await this.context.gather({
      files: input.files,
      projectInfo: this.projectInfo,
      includeSchema: this.config.includeSchema ?? true,
      includeConfig: this.config.includeConfig ?? true,
      maxDepth: this.config.contextDepth ?? 2,
    });

    // 2. Build prompt
    const prompt = this.buildPrompt({ ...input, context: contextData });

    // 3. Estimate tokens
    const estimate = this.optimizer.estimate(prompt);
    this.logger.debug(`Estimated tokens: ${estimate}`);
    if (estimate > 50000) {
      this.logger.warn(`This operation will use ~${estimate.toLocaleString()} tokens`);
    }

    // 4. Send to AI engine
    const response = await this.bridge.send(prompt, {
      systemPrompt: this.getSystemPrompt(),
      maxTokens: this.config.maxTokens ?? 8192,
      streaming: input.streaming ?? false,
      onStream: input.onStream as ((chunk: string) => void) | undefined,
    });

    // 5. Parse response
    const parsed = this.parseResponse(response.content);

    return {
      parsed,
      raw: response.content,
      tokensUsed: response.tokensUsed,
      duration: response.duration,
      agent: this.config.name,
    };
  }

  protected mergeUserRules(basePrompt: string): string {
    if (!this.config.rules || this.config.rules.length === 0) {
      return basePrompt;
    }

    const rulesSection = this.config.rules.map(rule => `- ${rule}`).join('\n');
    return `${basePrompt}\n\n## Additional Project-Specific Rules (from user config)\n${rulesSection}`;
  }

  protected getFeedbackPrompt(): string {
    if (this.feedback.length === 0) return '';
    return `\n\n## User Corrections & Preferences (IMPORTANT — follow these strictly)\n${this.feedback.map(f => `- ${f}`).join('\n')}`;
  }

  protected getProjectContext(): string {
    const p = this.projectInfo;
    return `## Project Context (auto-detected)
- Language: ${p.language}
- Framework: ${p.framework || 'none detected'}
- Database: ${p.database.join(', ') || 'none detected'}
- ORM: ${p.orm || 'none detected'}
- Test Framework: ${p.testFramework || 'none detected'}
- Structure: ${p.structure}
- Monorepo: ${p.monorepo ? 'yes' : 'no'}`;
  }
}

import { ProviderBridge } from '../core/provider-bridge.js';
import { ContextEngine } from '../core/context-engine.js';
import { TokenOptimizer } from '../core/token-optimizer.js';
import { ResponseParser } from '../core/response-parser.js';
import { GitIntelligence } from '../core/git-intelligence.js';
import { DependencyGraph } from '../core/dependency-graph.js';
import { PatternLibrary } from '../features/pattern-library.js';
import { DebtTracker } from '../features/debt-tracker.js';
import { TokenIntelligence } from '../core/token-intelligence.js';
import type { AgentConfig, AgentInput, AgentResult, ParsedResponse } from '../types/agent.js';
import type { ProjectInfo } from '../types/config.js';
import { Logger } from '../utils/logger.js';

// Shared provider instance across all agents in a session
let sharedProvider: ProviderBridge | null = null;

export function setSharedProvider(provider: ProviderBridge): void {
  sharedProvider = provider;
}

export function getSharedProvider(): ProviderBridge {
  if (!sharedProvider) {
    sharedProvider = new ProviderBridge();
    sharedProvider.autoSelect();
  }
  return sharedProvider;
}

// Agents that benefit from git intelligence (expensive — 58 git commands)
const GIT_INTEL_AGENTS = new Set(['review', 'security', 'performance', 'tech-lead', 'cto']);

// Agents that need schema context
const SCHEMA_AGENTS = new Set(['review', 'fix', 'db-architect', 'security', 'designer', 'ba', 'fullstack-builder', 'app-creator']);

// Agents that need config context
const CONFIG_AGENTS = new Set(['review', 'security', 'devops', 'cost-optimizer', 'monitoring', 'app-creator']);

export abstract class BaseAgent {
  protected bridge: ProviderBridge;
  protected context: ContextEngine;
  protected optimizer: TokenOptimizer;
  protected parser: ResponseParser;
  protected config: AgentConfig;
  protected projectInfo: ProjectInfo;
  protected logger: Logger;
  protected feedback: string[];

  // Lazy-initialized feature instances
  private _gitIntelligence?: GitIntelligence;
  private _dependencyGraph?: DependencyGraph;
  private _patternLibrary?: PatternLibrary;
  private _debtTracker?: DebtTracker;
  private _tokenIntelligence?: TokenIntelligence;

  constructor(config: AgentConfig, projectInfo: ProjectInfo, feedback: string[] = []) {
    this.bridge = getSharedProvider();
    this.context = new ContextEngine();
    this.optimizer = new TokenOptimizer();
    this.parser = new ResponseParser();
    this.config = config;
    this.projectInfo = projectInfo;
    this.logger = new Logger();
    this.feedback = feedback;
  }

  // Lazy accessors
  protected get gitIntelligence(): GitIntelligence {
    if (!this._gitIntelligence) this._gitIntelligence = new GitIntelligence();
    return this._gitIntelligence;
  }

  protected get dependencyGraph(): DependencyGraph {
    if (!this._dependencyGraph) this._dependencyGraph = new DependencyGraph();
    return this._dependencyGraph;
  }

  protected get patternLibrary(): PatternLibrary {
    if (!this._patternLibrary) this._patternLibrary = new PatternLibrary();
    return this._patternLibrary;
  }

  protected get debtTracker(): DebtTracker {
    if (!this._debtTracker) this._debtTracker = new DebtTracker();
    return this._debtTracker;
  }

  protected get tokenIntelligence(): TokenIntelligence {
    if (!this._tokenIntelligence) this._tokenIntelligence = new TokenIntelligence();
    return this._tokenIntelligence;
  }

  abstract getSystemPrompt(): string;
  abstract buildPrompt(input: AgentInput): string;
  abstract parseResponse(raw: string): ParsedResponse;

  async execute(input: AgentInput): Promise<AgentResult> {
    const onProgress = input.onProgress as ((step: string) => void) | undefined;
    const agentName = this.config.name;
    const hasFiles = input.files && input.files.length > 0;
    const queryLen = (input.query || '').split(/\s+/).length;
    const isSimpleQuery = !hasFiles && queryLen < 15;

    // ── Step 0: Resolve files (ONLY when no files given AND there's a target) ──
    let resolvedFiles = input.files;
    if (!hasFiles && input.target) {
      try {
        onProgress?.('Resolving files...');
        await this.dependencyGraph.build(input.target);
        const depFiles = this.dependencyGraph.getContextFiles(input.target, 'review');
        if (depFiles.length > 0) {
          resolvedFiles = depFiles;
        }
      } catch {
        // Skip silently — dependency graph is a nice-to-have
      }
    }

    // ── Step 1: Gather context (LEAN — only what this agent needs) ──
    const needsSchema = SCHEMA_AGENTS.has(agentName) && (this.config.includeSchema !== false);
    const needsConfig = CONFIG_AGENTS.has(agentName) && (this.config.includeConfig !== false);
    const filesResolved = resolvedFiles && resolvedFiles.length > 0;

    onProgress?.('Reading files...');
    const contextData = await this.context.gather({
      files: filesResolved ? resolvedFiles : undefined,
      projectInfo: this.projectInfo,
      includeSchema: filesResolved ? needsSchema : false,
      includeConfig: filesResolved ? needsConfig : false,
      maxDepth: isSimpleQuery ? 0 : Math.min(this.config.contextDepth ?? 2, 2),
    });

    // ── Step 2: Git intelligence (ONLY for agents that need it, ONLY when files specified) ──
    let gitContext = '';
    if (filesResolved && GIT_INTEL_AGENTS.has(agentName)) {
      try {
        onProgress?.('Checking git history...');
        const report = await this.gitIntelligence.getFullReport(resolvedFiles![0]);
        const cp = report.commitPattern;
        // Compact format — minimal tokens
        const gitLines: string[] = ['## Git Context'];
        gitLines.push(`${cp.total} commits, ${cp.bugFixes} fixes, instability: ${cp.instabilityScore.toFixed(1)}`);
        if (report.testCoverage.coverageRisk) {
          gitLines.push(`WARNING: no tests in recent changes`);
        }
        const hotspots = report.hotspots.filter(h => h.isHotspot);
        if (hotspots.length > 0) {
          gitLines.push(`Hotspots: ${hotspots.slice(0, 3).map(h => h.file).join(', ')}`);
        }
        gitContext = gitLines.join('\n');
      } catch {
        // Git intel is optional — skip silently
      }
    }

    // ── Step 3: Build prompt (minimal) ──
    const enrichedInput = { ...input, files: resolvedFiles, context: contextData };
    if (gitContext) {
      enrichedInput.context = `${contextData}\n\n${gitContext}`;
    }
    const prompt = this.buildPrompt(enrichedInput);

    const estimate = this.optimizer.estimate(prompt);
    onProgress?.(`Sending (~${estimate.toLocaleString()} tokens)...`);

    // ── Step 4: System prompt (NO pattern injection for first-time use — saves disk I/O) ──
    const systemPrompt = this.getSystemPrompt();

    // ── Step 5: Send to AI ──
    const response = await this.bridge.send(prompt, {
      systemPrompt,
      maxTokens: this.config.maxTokens ?? 4096, // Reduced from 8192 — most responses are <3K
      streaming: input.streaming ?? false,
      onStream: input.onStream as ((chunk: string) => void) | undefined,
    });

    // ── Step 6: Parse response ──
    const parsed = this.parseResponse(response.content);

    // ── Step 7: Background learning (non-blocking, fire-and-forget) ──
    this.backgroundLearn(parsed, resolvedFiles || input.files || [], enrichedInput.context || '', systemPrompt);

    return {
      parsed,
      raw: response.content,
      tokensUsed: response.tokensUsed,
      duration: response.duration,
      agent: agentName,
      tokenReport: this.quickTokenEstimate(estimate, response.content),
    };
  }

  /**
   * Quick token estimate without expensive file walking.
   * Replaces the old TokenIntelligence.calculateSavings which re-read all files.
   */
  private quickTokenEstimate(inputTokens: number, responseContent: string): AgentResult['tokenReport'] {
    const responseTokens = this.optimizer.estimate(responseContent);
    const withDevCrew = inputTokens + responseTokens;
    // Without Dev-Crew: user pastes same files but without smart context,
    // system prompt, or project awareness. They'd need ~same tokens for files
    // but no system prompt overhead. However they'd get worse results.
    // Be honest: show what we actually used.
    return {
      withoutDevCrew: withDevCrew, // Same — we don't lie about savings
      withDevCrew,
      saved: 0,
      percentage: 0,
    };
  }

  /**
   * Non-critical background work — debt tracking, pattern learning, usage recording.
   * Errors are silently ignored.
   */
  private backgroundLearn(parsed: ParsedResponse, files: string[], context: string, systemPrompt: string): void {
    try {
      if (parsed.issues && parsed.issues.length > 0) {
        this.debtTracker.updateFromReview(parsed.issues);
      }
    } catch { /* non-critical */ }

    try {
      const savings = this.tokenIntelligence.calculateSavings(files, context, systemPrompt.length);
      this.tokenIntelligence.recordSession(savings, this.config.name);
    } catch { /* non-critical */ }
  }

  protected mergeUserRules(basePrompt: string): string {
    if (!this.config.rules || this.config.rules.length === 0) {
      return basePrompt;
    }
    const rulesSection = this.config.rules.map(rule => `- ${rule}`).join('\n');
    return `${basePrompt}\n\n## Project Rules\n${rulesSection}`;
  }

  protected getFeedbackPrompt(): string {
    if (this.feedback.length === 0) return '';
    return `\n\n## User Preferences (follow strictly)\n${this.feedback.map(f => `- ${f}`).join('\n')}`;
  }

  protected getProjectContext(): string {
    const p = this.projectInfo;
    // Compact — every token counts
    return `## Project: ${p.language}${p.framework ? '/' + p.framework : ''}${p.database.length ? ', DB: ' + p.database.join(',') : ''}${p.orm ? ', ORM: ' + p.orm : ''}`;
  }
}

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

  // Lazy accessors — instances are created on first use
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

    // 0. Resolve additional context files from dependency graph when no files specified
    let resolvedFiles = input.files;
    if ((!resolvedFiles || resolvedFiles.length === 0) && input.query) {
      try {
        onProgress?.('Building dependency graph...');
        // Look for code-related terms in the query to find a target file
        const target = input.target;
        if (target) {
          await this.dependencyGraph.build(target);
          const depFiles = this.dependencyGraph.getContextFiles(target, 'review');
          if (depFiles.length > 0) {
            resolvedFiles = depFiles;
          }
        }
      } catch (err) {
        this.logger.debug?.(`Dependency graph skipped: ${err}`);
      }
    }

    // 1. Gather context (skip heavy gathering for simple queries with no files)
    const hasFiles = resolvedFiles && resolvedFiles.length > 0;
    const isSimpleQuery = !hasFiles && (input.query || '').split(/\s+/).length < 15;
    onProgress?.('Gathering context...');
    const contextData = await this.context.gather({
      files: resolvedFiles,
      projectInfo: this.projectInfo,
      includeSchema: hasFiles ? (this.config.includeSchema ?? true) : false,
      includeConfig: hasFiles ? (this.config.includeConfig ?? true) : false,
      maxDepth: isSimpleQuery ? 1 : (this.config.contextDepth ?? 2),
    });

    // 1b. If files are specified, gather git intelligence on the first file
    let gitContext = '';
    if (hasFiles && resolvedFiles!.length > 0) {
      try {
        onProgress?.('Analyzing git history...');
        const report = await this.gitIntelligence.getFullReport(resolvedFiles![0]);
        const cp = report.commitPattern;
        const tc = report.testCoverage;
        const hotspots = report.hotspots.filter(h => h.isHotspot);

        const gitLines: string[] = ['## Git Intelligence'];
        gitLines.push(`- ${cp.total} commits | ${cp.bugFixes} bug fixes, ${cp.features} features, ${cp.refactors} refactors`);
        gitLines.push(`- Instability score: ${cp.instabilityScore.toFixed(2)} (${cp.instabilityScore > 0.5 ? 'HIGH — many bug fixes' : 'normal'})`);
        gitLines.push(`- Contributors: ${cp.contributors.join(', ') || 'unknown'}`);
        gitLines.push(`- Last changed: ${cp.lastChanged}`);
        gitLines.push(`- Test coverage ratio: ${tc.testRatio.toFixed(2)}${tc.coverageRisk ? ' (WARNING: no tests in recent changes)' : ''}`);
        if (hotspots.length > 0) {
          gitLines.push(`- Hotspot files (frequently changed): ${hotspots.slice(0, 5).map(h => h.file).join(', ')}`);
        }
        gitContext = gitLines.join('\n');
      } catch (err) {
        this.logger.debug?.(`Git intelligence skipped: ${err}`);
      }
    }

    // 2. Build prompt — inject git context if available
    const enrichedInput = { ...input, files: resolvedFiles, context: contextData };
    if (gitContext) {
      enrichedInput.context = `${contextData}\n\n${gitContext}`;
    }
    const prompt = this.buildPrompt(enrichedInput);

    // 3. Estimate tokens
    const estimate = this.optimizer.estimate(prompt);
    onProgress?.(`Prompt ready (~${estimate.toLocaleString()} tokens)`);
    if (estimate > 50000) {
      this.logger.warn(`This operation will use ~${estimate.toLocaleString()} tokens`);
    }

    // 4. Build system prompt with pattern context
    const systemPrompt = this.getSystemPromptWithPatterns();

    // 5. Send to AI engine
    onProgress?.('Sending to AI provider...');
    const response = await this.bridge.send(prompt, {
      systemPrompt,
      maxTokens: this.config.maxTokens ?? 8192,
      streaming: input.streaming ?? false,
      onStream: input.onStream as ((chunk: string) => void) | undefined,
    });

    // 6. Parse response
    const parsed = this.parseResponse(response.content);

    // 7. Learn from response — record issues to debt tracker and pattern library
    if (parsed.issues && parsed.issues.length > 0) {
      try {
        onProgress?.('Updating debt tracker and pattern library...');
        this.debtTracker.updateFromReview(parsed.issues);
        this.patternLibrary.recordFromIssues(parsed.issues, this.config.name);
      } catch (err) {
        this.logger.debug?.(`Learning from response skipped: ${err}`);
      }
    }

    // 8. Calculate token savings
    let tokenReport: AgentResult['tokenReport'];
    try {
      const originalFiles = resolvedFiles || input.files || [];
      const savings = this.tokenIntelligence.calculateSavings(
        originalFiles,
        enrichedInput.context || '',
        systemPrompt.length,
      );
      this.tokenIntelligence.recordSession(savings, this.config.name);
      tokenReport = {
        withoutDevCrew: savings.withoutDevCrew,
        withDevCrew: savings.withDevCrew,
        saved: savings.saved,
        percentage: savings.percentage,
      };
    } catch (err) {
      this.logger.debug?.(`Token intelligence skipped: ${err}`);
    }

    return {
      parsed,
      raw: response.content,
      tokensUsed: response.tokensUsed,
      duration: response.duration,
      agent: this.config.name,
      tokenReport,
    };
  }

  /**
   * Returns the system prompt enriched with learned pattern context.
   */
  private getSystemPromptWithPatterns(): string {
    let systemPrompt = this.getSystemPrompt();
    try {
      const patternContext = this.getPatternContext();
      if (patternContext) {
        systemPrompt = `${systemPrompt}\n${patternContext}`;
      }
    } catch {
      // Pattern library unavailable — continue without it
    }
    return systemPrompt;
  }

  /**
   * Gets the pattern prompt from the pattern library.
   * Subclasses can override to customize pattern injection.
   */
  protected getPatternContext(): string {
    return this.patternLibrary.getPatternPrompt();
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

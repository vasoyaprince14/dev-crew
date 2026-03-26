import { ProviderBridge } from '../core/provider-bridge.js';
import { ContextEngine } from '../core/context-engine.js';
import { TokenOptimizer } from '../core/token-optimizer.js';
import { ResponseParser } from '../core/response-parser.js';
import { GitIntelligence } from '../core/git-intelligence.js';
import { DependencyGraph } from '../core/dependency-graph.js';
import { StaticAnalyzer } from '../core/static-analyzer.js';
import { DiffContext } from '../core/diff-context.js';
import { CodeGraph } from '../core/code-graph.js';
import { PatternLibrary } from '../features/pattern-library.js';
import { DebtTracker } from '../features/debt-tracker.js';
import { TokenIntelligence } from '../core/token-intelligence.js';
import { InputSanitizer } from '../core/input-sanitizer.js';
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

// Agents that benefit from local static analysis (real tool output, not AI guesses)
const STATIC_ANALYSIS_AGENTS = new Set(['review', 'fix', 'debug', 'security', 'performance', 'tech-lead']);

// Agents that benefit from auto-importing related files via dependency graph
const AUTO_IMPORT_AGENTS = new Set(['review', 'fix', 'debug', 'test', 'security', 'tech-lead']);

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
  private _staticAnalyzer?: StaticAnalyzer;
  private _diffContext?: DiffContext;
  private _codeGraph?: CodeGraph;
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

  protected get staticAnalyzer(): StaticAnalyzer {
    if (!this._staticAnalyzer) this._staticAnalyzer = new StaticAnalyzer();
    return this._staticAnalyzer;
  }

  protected get diffContext(): DiffContext {
    if (!this._diffContext) this._diffContext = new DiffContext();
    return this._diffContext;
  }

  protected get codeGraph(): CodeGraph {
    if (!this._codeGraph) this._codeGraph = new CodeGraph();
    return this._codeGraph;
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

  // Pre/post processing hooks — subclasses can override
  protected preProcess(input: AgentInput): AgentInput { return input; }
  protected postProcess(parsed: ParsedResponse): ParsedResponse { return parsed; }
  protected validate(input: AgentInput): string[] { return []; }

  async execute(input: AgentInput): Promise<AgentResult> {
    const onProgress = input.onProgress as ((step: string) => void) | undefined;
    const agentName = this.config.name;
    const hasFiles = input.files && input.files.length > 0;
    const queryLen = (input.query || '').split(/\s+/).length;
    const isSimpleQuery = !hasFiles && queryLen < 15;

    // ── Validation ──
    const warnings = this.validate(input);
    for (const w of warnings) {
      this.logger.warn(w);
    }

    // ── Pre-processing hook ──
    input = this.preProcess(input);

    // ── Fast path: simple queries skip expensive operations ──
    const skipExpensive = isSimpleQuery && !['review', 'security', 'test'].includes(agentName);

    // ── Step 0: Build code graph + blast radius (smart context selection) ──
    let resolvedFiles = input.files ? [...input.files] : undefined;
    let blastRadiusContext = '';

    if (hasFiles && AUTO_IMPORT_AGENTS.has(agentName) && !skipExpensive) {
      try {
        onProgress?.('Building code graph...');
        // Build graph from project root, then use blast radius to find related files
        this.codeGraph.buildFromDirectory(this.projectInfo.root, 300);
        const smartFiles = this.codeGraph.getSmartContext(input.files!, 10);
        resolvedFiles = smartFiles;

        // Generate blast radius summary for the AI
        blastRadiusContext = this.codeGraph.formatBlastRadius(input.files!);

        this.logger.debug(`Code graph: ${this.codeGraph.getStats().nodeCount} nodes, ${this.codeGraph.getStats().edgeCount} edges`);
        this.logger.debug(`Blast radius selected ${smartFiles.length} files`);
      } catch (err) {
        this.logger.debug('Code graph failed, falling back to import resolution: ' + (err as Error).message);
        // Fallback to old import-based resolution
        try {
          for (const file of input.files!) {
            await this.dependencyGraph.build(file, 1);
            const related = this.dependencyGraph.getContextFiles(file, 'review');
            for (const r of related) {
              if (resolvedFiles && !resolvedFiles.includes(r)) {
                resolvedFiles.push(r);
              }
            }
          }
        } catch { /* already logged */ }
      }
      // Cap at 12 files to stay within token budget
      if (resolvedFiles && resolvedFiles.length > 12) {
        resolvedFiles = resolvedFiles.slice(0, 12);
      }
    }

    if (!hasFiles && input.target && !skipExpensive) {
      try {
        onProgress?.('Resolving files...');
        this.codeGraph.buildFromDirectory(this.projectInfo.root, 300);
        const smartFiles = this.codeGraph.getSmartContext([input.target], 8);
        if (smartFiles.length > 0) {
          resolvedFiles = smartFiles;
          blastRadiusContext = this.codeGraph.formatBlastRadius([input.target]);
        }
      } catch (err) {
        this.logger.debug('Code graph resolution failed: ' + (err as Error).message);
        // Fallback
        try {
          await this.dependencyGraph.build(input.target);
          const depFiles = this.dependencyGraph.getContextFiles(input.target, 'review');
          if (depFiles.length > 0) resolvedFiles = depFiles;
        } catch { /* already logged */ }
      }
    }

    // ── Step 1: Local static analysis (real tool output — not AI guesses) ──
    let staticContext = '';
    const filesResolved = resolvedFiles && resolvedFiles.length > 0;
    if (filesResolved && STATIC_ANALYSIS_AGENTS.has(agentName) && !skipExpensive) {
      try {
        onProgress?.('Running local analysis...');
        const findings = this.staticAnalyzer.analyze(resolvedFiles!);
        staticContext = this.staticAnalyzer.formatForPrompt(findings);
      } catch (err) {
        this.logger.debug('Static analysis failed: ' + (err as Error).message);
      }
    }

    // ── Step 2: Gather context (LEAN — only what this agent needs) ──
    const needsSchema = SCHEMA_AGENTS.has(agentName) && (this.config.includeSchema !== false);
    const needsConfig = CONFIG_AGENTS.has(agentName) && (this.config.includeConfig !== false);

    onProgress?.('Reading files...');
    const contextData = await this.context.gather({
      files: filesResolved ? resolvedFiles : undefined,
      projectInfo: this.projectInfo,
      includeSchema: filesResolved ? needsSchema : false,
      includeConfig: filesResolved ? needsConfig : false,
      maxDepth: isSimpleQuery ? 0 : Math.min(this.config.contextDepth ?? 2, 2),
    });

    // ── Step 3: Git intelligence (ONLY for agents that need it, ONLY when files specified) ──
    let gitContext = '';
    if (filesResolved && GIT_INTEL_AGENTS.has(agentName) && !skipExpensive) {
      try {
        onProgress?.('Checking git history...');
        const report = await this.gitIntelligence.getFullReport(resolvedFiles![0]);
        const cp = report.commitPattern;
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
      } catch (err) {
        this.logger.debug('Git intelligence unavailable: ' + (err as Error).message);
      }
    }

    // ── Step 3b: Git diff context (when no specific files, show recent changes) ──
    let diffContextStr = '';
    if (!filesResolved && ['review', 'security', 'pr'].includes(agentName)) {
      try {
        const hunks = this.diffContext.getUncommittedDiff();
        if (hunks.length > 0) {
          diffContextStr = this.diffContext.formatForPrompt(hunks);
        }
      } catch (err) {
        this.logger.debug('Diff context unavailable: ' + (err as Error).message);
      }
    }

    // ── Step 4: Build prompt with all enrichments ──
    const allContext = [contextData, blastRadiusContext, staticContext, gitContext, diffContextStr]
      .filter(Boolean)
      .join('\n\n');
    const enrichedInput = { ...input, files: resolvedFiles, context: allContext };
    const prompt = this.buildPrompt(enrichedInput);

    const estimate = this.optimizer.estimate(prompt);
    onProgress?.(`Sending (~${estimate.toLocaleString()} tokens)...`);

    // ── Step 5: System prompt ──
    const systemPrompt = this.getSystemPrompt();

    // ── Step 6: Send to AI (with retry on parse failure) ──
    let response = await this.bridge.send(prompt, {
      systemPrompt,
      maxTokens: this.config.maxTokens ?? 4096,
      streaming: input.streaming ?? false,
      onStream: input.onStream as ((chunk: string) => void) | undefined,
    });

    // ── Step 7: Parse response + post-process ──
    let parsed = this.parseResponse(response.content);

    // Retry once if response is empty/malformed and not streaming
    if (!parsed.summary && !parsed.raw && !input.streaming) {
      this.logger.debug('Empty response — retrying...');
      try {
        response = await this.bridge.send(prompt, {
          systemPrompt,
          maxTokens: this.config.maxTokens ?? 4096,
        });
        parsed = this.parseResponse(response.content);
      } catch (err) {
        this.logger.debug('Retry failed: ' + (err as Error).message);
      }
    }

    parsed = this.postProcess(parsed);

    // ── Step 8: Token savings (real calculation) ──
    const files = resolvedFiles || input.files || [];
    const savings = this.tokenIntelligence.calculateSavings(files, enrichedInput.context || '', systemPrompt.length);

    // ── Step 9: Background learning (non-blocking, fire-and-forget) ──
    this.backgroundLearn(parsed, savings);

    return {
      parsed,
      raw: response.content,
      tokensUsed: response.tokensUsed,
      duration: response.duration,
      agent: agentName,
      simulated: response.simulated,
      tokenReport: {
        withoutDevCrew: savings.withoutDevCrew,
        withDevCrew: savings.withDevCrew,
        saved: savings.saved,
        percentage: savings.percentage,
      },
    };
  }

  /**
   * Non-critical background work — debt tracking, usage recording.
   */
  private backgroundLearn(parsed: ParsedResponse, savings: { withoutDevCrew: number; withDevCrew: number; saved: number; percentage: number }): void {
    try {
      if (parsed.issues && parsed.issues.length > 0) {
        this.debtTracker.updateFromReview(parsed.issues);
      }
    } catch (err) {
      this.logger.debug('Debt tracking failed: ' + (err as Error).message);
    }

    try {
      this.tokenIntelligence.recordSession(savings as any, this.config.name);
    } catch (err) {
      this.logger.debug('Token recording failed: ' + (err as Error).message);
    }
  }

  protected mergeUserRules(basePrompt: string): string {
    if (!this.config.rules || this.config.rules.length === 0) {
      return basePrompt;
    }
    const sanitizedRules = InputSanitizer.sanitizeRules(this.config.rules);
    const rulesSection = sanitizedRules.map(rule => `- ${rule}`).join('\n');
    return `${basePrompt}\n\n## Project Rules\n${rulesSection}`;
  }

  protected getFeedbackPrompt(): string {
    if (this.feedback.length === 0) return '';
    const sanitized = this.feedback.map(f => InputSanitizer.sanitizeFeedback(f));
    return `\n\n## User Preferences (follow strictly)\n${sanitized.map(f => `- ${f}`).join('\n')}`;
  }

  protected getProjectContext(): string {
    const p = this.projectInfo;
    // Compact — every token counts
    return `## Project: ${p.language}${p.framework ? '/' + p.framework : ''}${p.database.length ? ', DB: ' + p.database.join(',') : ''}${p.orm ? ', ORM: ' + p.orm : ''}`;
  }
}

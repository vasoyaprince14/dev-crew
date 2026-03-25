// Dev-Crew — AI-powered developer crew built by Prince Vasoya

// Core
export { ClaudeBridge } from './core/claude-bridge.js';
export { ProjectDetector } from './core/project-detector.js';
export { ContextEngine } from './core/context-engine.js';
export { TokenOptimizer } from './core/token-optimizer.js';
export { TokenIntelligence } from './core/token-intelligence.js';
export { TokenBudget } from './core/token-budget.js';
export { ResponseParser } from './core/response-parser.js';
export { ConfigManager } from './core/config-manager.js';
export { ActionLayer } from './core/action-layer.js';
export { DependencyGraph } from './core/dependency-graph.js';
export { CodeGraph } from './core/code-graph.js';
export { DiffContext } from './core/diff-context.js';
export { StaticAnalyzer } from './core/static-analyzer.js';
export { InputSanitizer } from './core/input-sanitizer.js';
export { ProjectCache } from './core/project-cache.js';
export { GitIntelligence } from './core/git-intelligence.js';
export { QualityScorer } from './core/quality-scorer.js';
export { ProviderBridge } from './core/provider-bridge.js';
export { parseNaturalInput } from './core/nlp-router.js';

// UI
export { TerminalUI } from './ui/terminal-ui.js';

// Agents
export { BaseAgent } from './agents/base-agent.js';
export { AgentRegistry } from './agents/registry.js';

// Features
export { DevCrewError, ProviderError, ConfigError } from './utils/errors.js';
export { DebtTracker } from './features/debt-tracker.js';
export { PatternLibrary } from './features/pattern-library.js';
export { Analytics } from './features/analytics.js';

// Types
export type { AgentConfig, AgentInput, AgentResult, ParsedResponse, Issue, Fix, FileDiff } from './types/agent.js';
export type { DevCrewConfig, ProjectInfo } from './types/config.js';
export type { ClaudeOptions, ClaudeResponse, TokenReport } from './types/response.js';

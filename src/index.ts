// Dev-Crew — AI-powered developer crew on your local Claude Code

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
export { GitIntelligence } from './core/git-intelligence.js';
export { QualityScorer } from './core/quality-scorer.js';

// Agents
export { BaseAgent } from './agents/base-agent.js';
export { AgentRegistry } from './agents/registry.js';

// Features
export { DebtTracker } from './features/debt-tracker.js';
export { PatternLibrary } from './features/pattern-library.js';
export { Analytics } from './features/analytics.js';

// Types
export type { AgentConfig, AgentInput, AgentResult, ParsedResponse, Issue, Fix, FileDiff } from './types/agent.js';
export type { DevCrewConfig, ProjectInfo } from './types/config.js';
export type { ClaudeOptions, ClaudeResponse, TokenReport } from './types/response.js';

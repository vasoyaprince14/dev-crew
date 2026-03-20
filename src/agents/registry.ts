import { BaseAgent } from './base-agent.js';
import { ReviewAgent } from './review/index.js';
import { FixAgent } from './fix/index.js';
import { DebugAgent } from './debug/index.js';
import { TestAgent } from './test/index.js';
import { TechLeadAgent } from './tech-lead/index.js';
import { BusinessAnalystAgent } from './business-analyst/index.js';
import { CTOAgent } from './cto/index.js';
import { PRReviewerAgent } from './pr-reviewer/index.js';
import { SecurityAgent } from './security/index.js';
import { DesignerAgent } from './designer/index.js';
import { OnboardAgent } from './onboard/index.js';
import { AskAgent } from './ask/index.js';
import type { AgentConfig } from '../types/agent.js';
import type { ProjectInfo } from '../types/config.js';

interface AgentEntry {
  cls: new (config: AgentConfig, projectInfo: ProjectInfo, feedback?: string[]) => BaseAgent;
  defaultConfig: AgentConfig;
}

const BUILT_IN_AGENTS: Record<string, AgentEntry> = {
  review: {
    cls: ReviewAgent,
    defaultConfig: {
      name: 'review',
      description: 'Deep code review with project-aware rules',
      tier: 'free',
      maxTokens: 8192,
      includeSchema: true,
      includeConfig: true,
      contextDepth: 2,
    },
  },
  fix: {
    cls: FixAgent,
    defaultConfig: {
      name: 'fix',
      description: 'Suggest and apply code fixes',
      tier: 'free',
      maxTokens: 8192,
      includeSchema: true,
      contextDepth: 2,
    },
  },
  debug: {
    cls: DebugAgent,
    defaultConfig: {
      name: 'debug',
      description: 'Root cause analysis from logs and errors',
      tier: 'free',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  test: {
    cls: TestAgent,
    defaultConfig: {
      name: 'test',
      description: 'Generate and improve tests',
      tier: 'free',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  'tech-lead': {
    cls: TechLeadAgent,
    defaultConfig: {
      name: 'tech-lead',
      description: 'Architecture decisions and code structure guidance',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 3,
    },
  },
  ba: {
    cls: BusinessAnalystAgent,
    defaultConfig: {
      name: 'ba',
      description: 'Translate requirements into technical specs',
      tier: 'pro',
      maxTokens: 8192,
      includeSchema: true,
      contextDepth: 2,
    },
  },
  cto: {
    cls: CTOAgent,
    defaultConfig: {
      name: 'cto',
      description: 'High-level strategic technical review',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 3,
    },
  },
  pr: {
    cls: PRReviewerAgent,
    defaultConfig: {
      name: 'pr',
      description: 'Automated pull request review',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  security: {
    cls: SecurityAgent,
    defaultConfig: {
      name: 'security',
      description: 'Security audit and vulnerability detection',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  designer: {
    cls: DesignerAgent,
    defaultConfig: {
      name: 'designer',
      description: 'API and database schema design review',
      tier: 'pro',
      maxTokens: 8192,
      includeSchema: true,
      contextDepth: 2,
    },
  },
  onboard: {
    cls: OnboardAgent,
    defaultConfig: {
      name: 'onboard',
      description: 'Codebase onboarding guide for new developers',
      tier: 'free',
      maxTokens: 8192,
      contextDepth: 3,
    },
  },
  ask: {
    cls: AskAgent,
    defaultConfig: {
      name: 'ask',
      description: 'Ask questions about your codebase',
      tier: 'free',
      maxTokens: 4096,
      contextDepth: 2,
    },
  },
};

export class AgentRegistry {
  private agents: Map<string, AgentEntry> = new Map();

  constructor() {
    for (const [name, entry] of Object.entries(BUILT_IN_AGENTS)) {
      this.agents.set(name, entry);
    }
  }

  get(name: string): AgentEntry | undefined {
    return this.agents.get(name);
  }

  create(
    name: string,
    projectInfo: ProjectInfo,
    overrides?: Partial<AgentConfig>,
    feedback?: string[],
  ): BaseAgent | null {
    const entry = this.agents.get(name);
    if (!entry) return null;

    const config: AgentConfig = { ...entry.defaultConfig, ...overrides };
    return new entry.cls(config, projectInfo, feedback);
  }

  list(): Array<{ name: string; description: string; tier: string }> {
    return Array.from(this.agents.entries()).map(([name, entry]) => ({
      name,
      description: entry.defaultConfig.description,
      tier: entry.defaultConfig.tier,
    }));
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }
}

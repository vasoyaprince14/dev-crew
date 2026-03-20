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
import { FullStackBuilderAgent } from './fullstack-builder/index.js';
import { DBArchitectAgent } from './db-architect/index.js';
import { APIArchitectAgent } from './api-architect/index.js';
import { DevOpsAgent } from './devops/index.js';
import { CostOptimizerAgent } from './cost-optimizer/index.js';
import { FlutterAgent } from './flutter/index.js';
import { ReactNativeAgent } from './react-native/index.js';
import { IOSAgent } from './ios/index.js';
import { AndroidAgent } from './android/index.js';
import { MonitoringAgent } from './monitoring/index.js';
import { PerformanceAgent } from './performance/index.js';
import { AccessibilityAgent } from './accessibility/index.js';
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
  'fullstack-builder': {
    cls: FullStackBuilderAgent,
    defaultConfig: {
      name: 'fullstack-builder',
      description: 'Scaffold full-stack project structures',
      tier: 'pro',
      maxTokens: 8192,
      includeSchema: true,
      includeConfig: true,
      contextDepth: 3,
    },
  },
  'db-architect': {
    cls: DBArchitectAgent,
    defaultConfig: {
      name: 'db-architect',
      description: 'Database schema review and query optimization',
      tier: 'pro',
      maxTokens: 8192,
      includeSchema: true,
      contextDepth: 2,
    },
  },
  'api-architect': {
    cls: APIArchitectAgent,
    defaultConfig: {
      name: 'api-architect',
      description: 'API design review and optimization',
      tier: 'pro',
      maxTokens: 8192,
      includeSchema: true,
      contextDepth: 2,
    },
  },
  devops: {
    cls: DevOpsAgent,
    defaultConfig: {
      name: 'devops',
      description: 'Docker, CI/CD, and infrastructure guidance',
      tier: 'pro',
      maxTokens: 8192,
      includeConfig: true,
      contextDepth: 2,
    },
  },
  'cost-optimizer': {
    cls: CostOptimizerAgent,
    defaultConfig: {
      name: 'cost-optimizer',
      description: 'Deployment cost analysis and optimization',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  flutter: {
    cls: FlutterAgent,
    defaultConfig: {
      name: 'flutter',
      description: 'Flutter/Dart development and code review',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  'react-native': {
    cls: ReactNativeAgent,
    defaultConfig: {
      name: 'react-native',
      description: 'React Native development and review',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  ios: {
    cls: IOSAgent,
    defaultConfig: {
      name: 'ios',
      description: 'iOS/Swift development and review',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  android: {
    cls: AndroidAgent,
    defaultConfig: {
      name: 'android',
      description: 'Android/Kotlin development and review',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  monitoring: {
    cls: MonitoringAgent,
    defaultConfig: {
      name: 'monitoring',
      description: 'Observability, alerting, and logging strategy',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  performance: {
    cls: PerformanceAgent,
    defaultConfig: {
      name: 'performance',
      description: 'Frontend and backend performance audit',
      tier: 'pro',
      maxTokens: 8192,
      contextDepth: 2,
    },
  },
  accessibility: {
    cls: AccessibilityAgent,
    defaultConfig: {
      name: 'accessibility',
      description: 'WCAG compliance and accessibility audit',
      tier: 'pro',
      maxTokens: 8192,
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

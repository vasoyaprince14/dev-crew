export interface AgentConfig {
  name: string;
  description: string;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  includeSchema?: boolean;
  includeConfig?: boolean;
  contextDepth?: number;
  maxTokens?: number;
  rules?: string[];
  focus?: string[];
  ignore?: string[];
}

export interface AgentInput {
  files?: string[];
  target?: string;
  query?: string;
  context?: string;
  streaming?: boolean;
  onStream?: (chunk: string) => void;
  [key: string]: unknown;
}

export interface AgentResult {
  parsed: ParsedResponse;
  raw: string;
  tokensUsed?: number;
  duration: number;
  agent: string;
  simulated?: boolean;
  tokenReport?: {
    withoutDevCrew: number;
    withDevCrew: number;
    saved: number;
    percentage: number;
  };
}

export interface ParsedResponse {
  type: 'review' | 'fix' | 'debug' | 'test' | 'general';
  summary: string;
  issues?: Issue[];
  fixes?: Fix[];
  diffs?: FileDiff[];
  suggestions?: string[];
  rootCause?: string;
  score?: number;
  positives?: string[];
  raw: string;
}

export interface Issue {
  severity: 'critical' | 'warning' | 'info';
  file: string;
  line?: number;
  title?: string;
  message: string;
  suggestion?: string;
}

export interface Fix {
  file: string;
  description: string;
  diff: string;
  newContent?: string;
}

export interface FileDiff {
  file: string;
  hunks: Array<{
    oldStart: number;
    oldLines: string[];
    newStart: number;
    newLines: string[];
  }>;
}

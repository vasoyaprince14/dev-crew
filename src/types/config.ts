export interface DevCrewConfig {
  project?: {
    name?: string;
    stack?: string;
    database?: string;
    orm?: string;
    test_framework?: string;
  };
  settings?: {
    max_tokens_per_request?: number;
    show_token_usage?: boolean;
    auto_include_schema?: boolean;
    auto_include_env_example?: boolean;
    default_review_depth?: 'quick' | 'normal' | 'deep';
    confirm_before_apply?: boolean;
    output_format?: 'pretty' | 'json' | 'markdown';
  };
  agents?: Record<string, AgentOverrides>;
  feedback?: Record<string, string[]>;
}

export interface AgentOverrides {
  severity?: 'relaxed' | 'normal' | 'strict';
  rules?: string[];
  ignore?: string[];
  focus?: string[];
  auto_apply?: boolean;
  preserve_style?: boolean;
  create_backup?: boolean;
  framework?: string;
  coverage_target?: number;
  style?: string;
  patterns?: string[];
  [key: string]: unknown;
}

export interface ProjectInfo {
  name: string;
  root: string;
  language: 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust' | 'unknown';
  framework: string | null;
  database: string[];
  orm: string | null;
  testFramework: string | null;
  packageManager: string;
  hasDocker: boolean;
  hasCI: boolean;
  ciPlatform: string | null;
  monorepo: boolean;
  structure: 'modular' | 'layered' | 'flat' | 'unknown';
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  files: string[];
}

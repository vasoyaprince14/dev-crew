export interface ClaudeResponse {
  content: string;
  tokensUsed?: number;
  duration: number;
  simulated?: boolean;
}

export interface ClaudeOptions {
  systemPrompt?: string;
  maxTokens?: number;
  timeout?: number;
  streaming?: boolean;
  onStream?: (chunk: string) => void;
  outputFormat?: string;
}

export interface TokenReport {
  prompt: number;
  response: number;
  total: number;
  cost: number;
}

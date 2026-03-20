export interface ClaudeResponse {
  content: string;
  tokensUsed?: number;
  duration: number;
}

export interface ClaudeOptions {
  systemPrompt?: string;
  maxTokens?: number;
  timeout?: number;
  streaming?: boolean;
  onStream?: (chunk: string) => void;
}

export interface TokenReport {
  prompt: number;
  response: number;
  total: number;
  cost: number;
}

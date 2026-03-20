import { BaseAgent } from '../base-agent.js';
import { getOnboardSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class OnboardAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getOnboardSystemPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];
    parts.push('Give a comprehensive onboarding tour of this codebase for a new developer.\n');
    if (input.context) parts.push(input.context);
    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

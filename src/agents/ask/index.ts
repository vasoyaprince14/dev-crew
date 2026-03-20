import { BaseAgent } from '../base-agent.js';
import { getAskSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class AskAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getAskSystemPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];
    if (input.query) {
      parts.push(`## Question\n${input.query}\n`);
    }
    if (input.context) parts.push(input.context);
    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return {
      type: 'general',
      summary: raw.split('\n')[0] || 'Answer provided',
      raw,
    };
  }
}

import { BaseAgent } from '../base-agent.js';
import { getMarketingSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class MarketingAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getMarketingSystemPrompt();
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];
    if (input.query) parts.push(`## Marketing Request\n${input.query}`);
    if (input.context) parts.push(input.context);
    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

import { BaseAgent } from '../base-agent.js';
import { getBASystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class BusinessAnalystAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getBASystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## Business Requirement\n${input.query}\n`);
    }

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

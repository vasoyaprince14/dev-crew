import { BaseAgent } from '../base-agent.js';
import { getDBArchitectSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class DBArchitectAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getDBArchitectSystemPrompt(
      this.projectInfo.database?.join(', ') || 'general',
      this.projectInfo.orm || 'none',
    );
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## Question\n${input.query}\n`);
    } else {
      parts.push('Review the database schema and query patterns of this project.\n');
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

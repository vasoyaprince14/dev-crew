import { BaseAgent } from '../base-agent.js';
import { getAndroidSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class AndroidAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getAndroidSystemPrompt();
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
      parts.push('Review the following code and provide feedback.\n');
    }
    if (input.context) { parts.push(input.context); }
    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

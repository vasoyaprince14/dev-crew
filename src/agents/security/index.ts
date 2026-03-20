import { BaseAgent } from '../base-agent.js';
import { getSecuritySystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class SecurityAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getSecuritySystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    parts.push('Perform a security audit on the following code.\n');

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

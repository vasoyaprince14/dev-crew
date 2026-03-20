import { BaseAgent } from '../base-agent.js';
import { getFullStackBuilderSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class FullStackBuilderAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getFullStackBuilderSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## Application Description\n${input.query}\n`);
    } else {
      parts.push('Suggest a full-stack project structure for this codebase.\n');
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

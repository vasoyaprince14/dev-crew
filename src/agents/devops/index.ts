import { BaseAgent } from '../base-agent.js';
import { getDevOpsSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class DevOpsAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getDevOpsSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## DevOps Question\n${input.query}\n`);
    } else {
      parts.push('Review the infrastructure and deployment setup of this project.\n');
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

import { BaseAgent } from '../base-agent.js';
import { getTechLeadSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class TechLeadAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getTechLeadSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## Architecture Question\n${input.query}\n`);
    } else {
      parts.push('Review the architecture of the following codebase and provide guidance.\n');
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

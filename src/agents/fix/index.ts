import { BaseAgent } from '../base-agent.js';
import { getFixSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class FixAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getFixSystemPrompt(this.projectInfo.language, this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## Issue to Fix\n${input.query}\n`);
    } else {
      parts.push('Analyze the following code and fix any issues you find.\n');
    }

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseFix(raw);
  }
}

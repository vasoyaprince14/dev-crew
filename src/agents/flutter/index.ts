import { BaseAgent } from '../base-agent.js';
import { getFlutterSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class FlutterAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getFlutterSystemPrompt();
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

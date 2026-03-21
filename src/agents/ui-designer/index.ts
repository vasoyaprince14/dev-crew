import { BaseAgent } from '../base-agent.js';
import { getUIDesignerSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class UIDesignerAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getUIDesignerSystemPrompt(this.projectInfo.framework || 'React');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];
    if (input.query) parts.push(`## UI/UX Request\n${input.query}`);
    if (input.context) parts.push(input.context);
    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

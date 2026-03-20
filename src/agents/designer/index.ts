import { BaseAgent } from '../base-agent.js';
import { getDesignerSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class DesignerAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getDesignerSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    const designType = (input.designType as string) || 'api';
    parts.push(`Review the ${designType} design of the following code.\n`);

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

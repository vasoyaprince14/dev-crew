import { BaseAgent } from '../base-agent.js';
import { getCostOptimizerSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class CostOptimizerAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getCostOptimizerSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## Cost Optimization Question\n${input.query}\n`);
    } else {
      parts.push('Analyze the deployment and infrastructure costs of this project.\n');
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

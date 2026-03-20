import { BaseAgent } from '../base-agent.js';
import { getReviewSystemPrompt, getFrameworkRules } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class ReviewAgent extends BaseAgent {
  getSystemPrompt(): string {
    const basePrompt = getReviewSystemPrompt(
      this.projectInfo.framework || 'general',
      this.projectInfo.language,
      this.projectInfo.database.join(', '),
      this.projectInfo.orm || 'none',
    );

    const frameworkRules = getFrameworkRules(this.projectInfo.framework);

    let prompt = basePrompt;
    if (frameworkRules) prompt += `\n\n${frameworkRules}`;
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;

    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    parts.push('Review the following code for issues, focusing on production readiness.\n');

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseReview(raw);
  }
}

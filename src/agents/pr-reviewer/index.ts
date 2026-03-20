import { BaseAgent } from '../base-agent.js';
import { getPRReviewerSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class PRReviewerAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getPRReviewerSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    parts.push('Review the following pull request diff.\n');

    if (input.query) {
      parts.push(`## PR Diff\n\`\`\`diff\n${input.query}\n\`\`\`\n`);
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

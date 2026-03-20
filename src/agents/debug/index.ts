import { BaseAgent } from '../base-agent.js';
import { getDebugSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class DebugAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getDebugSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    parts.push('Analyze the following error/logs and identify the root cause.\n');

    if (input.query) {
      parts.push(`## Error/Logs\n\`\`\`\n${input.query}\n\`\`\`\n`);
    }

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseDebug(raw);
  }
}

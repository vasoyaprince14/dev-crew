import { BaseAgent } from '../base-agent.js';
import { getTestSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class TestAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getTestSystemPrompt(
      this.projectInfo.language,
      this.projectInfo.framework || 'general',
      this.projectInfo.testFramework || 'vitest',
    );
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];
    const testType = (input.testType as string) || 'unit';

    parts.push(`Generate ${testType} tests for the following code.\n`);

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseTest(raw);
  }
}

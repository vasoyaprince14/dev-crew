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

  protected postProcess(parsed: ParsedResponse): ParsedResponse {
    if (parsed.issues && parsed.issues.length > 1) {
      // Deduplicate same-location issues
      const seen = new Set<string>();
      parsed.issues = parsed.issues.filter(issue => {
        const key = `${issue.file}:${issue.line || 0}:${issue.message.slice(0, 50)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Sort by severity (critical first)
      const order = { critical: 0, warning: 1, info: 2 };
      parsed.issues.sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2));
    }
    return parsed;
  }

  protected validate(input: AgentInput): string[] {
    const warnings: string[] = [];
    if (!input.files?.length && !input.context) {
      warnings.push('Code review works best with files — use @path to include files');
    }
    return warnings;
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

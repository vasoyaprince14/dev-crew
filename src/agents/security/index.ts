import { BaseAgent } from '../base-agent.js';
import { getSecuritySystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

const SECRET_PATTERN = /(?:password|secret|api.?key)\s*=\s*['"][^'"]+['"]/i;
const EVAL_PATTERN = /\beval\s*\(/;
const SQL_CONCAT_PATTERN = /['"].*\+.*SELECT/i;

export class SecurityAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getSecuritySystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  protected preProcess(input: AgentInput): AgentInput {
    // Quick regex scan for common security issues in input context
    const hints: string[] = [];
    const text = input.context || '';
    if (SECRET_PATTERN.test(text)) hints.push('DETECTED: Possible hardcoded secret in source');
    if (EVAL_PATTERN.test(text)) hints.push('DETECTED: eval() usage found');
    if (SQL_CONCAT_PATTERN.test(text)) hints.push('DETECTED: Possible SQL string concatenation');
    if (hints.length > 0) {
      return { ...input, context: `## Pre-scan Findings\n${hints.join('\n')}\n\n${text}` };
    }
    return input;
  }

  protected postProcess(parsed: ParsedResponse): ParsedResponse {
    // Deduplicate findings by message similarity
    if (parsed.issues && parsed.issues.length > 1) {
      const seen = new Set<string>();
      parsed.issues = parsed.issues.filter(issue => {
        const key = issue.message.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return parsed;
  }

  protected validate(input: AgentInput): string[] {
    const warnings: string[] = [];
    if (!input.files?.length && !input.context) {
      warnings.push('Security audit works best with files — use @path to include files');
    }
    return warnings;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    parts.push('Perform a security audit on the following code.\n');

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

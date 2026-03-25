import fs from 'node:fs';
import { BaseAgent } from '../base-agent.js';
import { getSEOSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

export class SEOAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getSEOSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  protected preProcess(input: AgentInput): AgentInput {
    const hints: string[] = [];

    // Check for robots.txt
    if (fs.existsSync('robots.txt')) {
      hints.push('robots.txt found in project root');
    } else if (fs.existsSync('public/robots.txt')) {
      hints.push('robots.txt found in public/');
    } else {
      hints.push('No robots.txt found — consider adding one');
    }

    // Check for sitemap
    if (fs.existsSync('public/sitemap.xml') || fs.existsSync('sitemap.xml')) {
      hints.push('sitemap.xml found');
    }

    if (hints.length > 0) {
      return { ...input, context: `## SEO Pre-scan\n${hints.join('\n')}\n\n${input.context || ''}` };
    }
    return input;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];
    if (input.query) parts.push(`## SEO Request\n${input.query}`);
    if (input.context) parts.push(input.context);
    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}
